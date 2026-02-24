/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Coordinates, {crsIsGeographic} from '@giro3d/giro3d/core/geographic/Coordinates';
import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import DrapedFeatureCollection from '@giro3d/giro3d/entities/DrapedFeatureCollection';
import Map from '@giro3d/giro3d/entities/Map.js';
import Tiles3D from "@giro3d/giro3d/entities/Tiles3D.js";
import Inspector from "@giro3d/giro3d/gui/Inspector.js";
import GeoTIFFSource from "@giro3d/giro3d/sources/GeoTIFFSource.js";
import axios from 'axios';
import {fromUrl} from "geotiff";
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {Vector2, CubeTextureLoader, Group, Raycaster, Mesh, Box3, Vector3, Matrix4} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader';
import {v4 as uuidv4} from 'uuid';

import {LayerRole} from '../../actions/layers';
import {setCurrentTask} from '../../actions/task';
import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LayerUtils from '../../utils/LayerUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import {registerPermalinkDataStoreHook, unregisterPermalinkDataStoreHook, UrlParams} from '../../utils/PermaLinkUtils';
import ServiceLayerUtils from '../../utils/ServiceLayerUtils';
import ThemeUtils from '../../utils/ThemeUtils';
import {MapContainerPortalContext} from '../PluginsContainer';
import ViewSwitcher from '../ViewSwitcher';
import EditDataset3D from './EditDataset3D';
import LayerRegistry from './layers/index';
import MapControls3D from './MapControls3D';
import {updateObjectLabel} from './utils/MiscUtils3D';
import Tiles3DStyle from './utils/Tiles3DStyle';

import './style/Map3D.css';


// Ensures onUnload is called *after* all other children have unmounted
class UnloadWrapper extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        onUnload: PropTypes.func,
        sceneId: PropTypes.string
    };
    onUnload = (el) => {
        if (!el) {
            this.props.onUnload(this.props.sceneId);
        }
    };
    render() {
        return (
            <div>
                {this.props.children}
                <span ref={this.onUnload} />
            </div>
        );
    }
}

class Map3D extends React.Component {
    static contextType = MapContainerPortalContext;
    static propTypes = {
        controlsPosition: PropTypes.string,
        defaultFov: PropTypes.number,
        defaultSceneQuality: PropTypes.number,
        innerRef: PropTypes.func,
        layers: PropTypes.array,
        mouseButtons: PropTypes.object,
        onCameraChanged: PropTypes.func,
        onMapInitialized: PropTypes.func,
        pluginOptions: PropTypes.object,
        plugins3d: PropTypes.object,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object,
        themes: PropTypes.object
    };
    static defaultProps = {
        geometry: {
            initialWidth: 600,
            initialHeight: 800,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true
        }
    };
    static defaultSceneState = {
        scene: null,
        map: null,
        mapCrs: null,
        dtmUrl: null,
        dtmCrs: null,
        baseLayers: [],
        colorLayers: {},
        objectTree: {},
        collisionObjects: [],
        settings: {
            fov: 30,
            sceneQuality: 100
        },
        sceneId: null,
        rebuildInstance: false
    };
    state = {
        sceneContext: {
            ...Map3D.defaultSceneState,

            addLayer: (layer) => {},
            getLayer: (layerId) => {},
            removeLayer: (layerId) => {},
            updateColorLayer: (layerId, options, flags) => {},
            setBaseLayer: (layer, visibility) => {},

            importTiles3D: (url, name, addToLayerTree = false, treeOptions = {}, showEditTool = false, matrix = null, label = null) => {},
            importObject3D: (dataOrUrl, name, addToLayerTree = false, treeOptions = {}, showEditTool = false) => {},
            addSceneObject: (objectId, object, options = {}, addToLayerTree = false, showEditTool = false) => {},
            getSceneObject: (objectId) => {},
            removeSceneObject: (objectId) => {},
            updateSceneObject: (objectId, options, flags) => {},
            zoomToObject: (objectId) => {},

            getMap: () => {},

            setViewToExtent: (bounds, angle) => {},
            getTerrainHeightFromDTM: (scenePos) => {},
            getTerrainHeightFromMap: (scenePos) => {},
            getSceneIntersection: (x, y, objects) => {},

            getSetting: (key) => {},
            setSetting: (key, value) => {}
        }
    };
    constructor(props) {
        super(props);
        this.container = null;
        this.inspector = null;
        this.instance = null;
        this.map = null;
        this.sceneObjectGroup = null;
        this.objectMap = {};
        this.tilesetStyles = {};
        this.state.sceneContext.addLayer = this.addLayer;
        this.state.sceneContext.getLayer = this.getLayer;
        this.state.sceneContext.removeLayer = this.removeLayer;
        this.state.sceneContext.updateColorLayer = this.updateColorLayer;
        this.state.sceneContext.setBaseLayer = this.setBaseLayer;
        this.state.sceneContext.importTiles3D = this.importTiles3D;
        this.state.sceneContext.importObject3D = this.importObject3D;
        this.state.sceneContext.addSceneObject = this.addSceneObject;
        this.state.sceneContext.getSceneObject = this.getSceneObject;
        this.state.sceneContext.removeSceneObject = this.removeSceneObject;
        this.state.sceneContext.updateSceneObject = this.updateSceneObject;
        this.state.sceneContext.zoomToObject = this.zoomToObject;
        this.state.sceneContext.getMap = this.getMap;
        this.state.sceneContext.getTerrainHeightFromDTM = this.getTerrainHeightFromDTM;
        this.state.sceneContext.getTerrainHeightFromMap = this.getTerrainHeightFromMap;
        this.state.sceneContext.getSceneIntersection = this.getSceneIntersection;
        this.state.sceneContext.getSetting = this.getSetting;
        this.state.sceneContext.setSetting = this.setSetting;

        this.state.sceneContext.settings.fov = props.defaultFov;
        this.state.sceneContext.settings.sceneQuality = props.defaultSceneQuality;

        registerPermalinkDataStoreHook("map3d", this.store3dState);
    }
    componentDidMount() {
        this.props.innerRef(this);
    }
    componentWillUnmount() {
        unregisterPermalinkDataStoreHook("map3d");
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme !== prevProps.theme) {
            if (this.props.theme.map3d) {
                this.setState(state => ({
                    sceneContext: {
                        ...state.sceneContext,
                        rebuildInstance: true
                    }
                }));
            }
        } else if (this.props.layers !== prevProps.layers && this.instance) {
            this.setState((state) => ({
                sceneContext: {
                    ...state.sceneContext,
                    colorLayers: this.collectColorLayers(state.sceneContext.colorLayers, prevProps.layers)
                }
            }));
        }

        // Update map layers
        if (this.state.sceneContext.baseLayers !== prevState.sceneContext.baseLayers) {
            this.applyBaseLayer();
        }

        if (this.state.sceneContext.colorLayers !== prevState.sceneContext.colorLayers) {
            this.applyColorLayerUpdates(this.state.sceneContext.colorLayers, prevState.sceneContext.colorLayers);
        }
        // Update collision objects
        if (this.state.sceneContext.objectTree !== prevState.sceneContext.objectTree) {
            this.setState(state => ({
                sceneContext: {
                    ...state.sceneContext,
                    collisionObjects: Object.entries(state.sceneContext.objectTree).reduce((res, entry) => {
                        if (entry.visibility && entry.opacity > 0) {
                            const obj = this.objectMap[entry.objectId];
                            res.push(obj.tiles?.group ?? obj);
                        }
                        return res;
                    }, [])
                }
            }));
        }
        if (this.state.sceneContext.settings.fov !== prevState.sceneContext.settings.fov) {
            this.instance.view.camera.fov = this.state.sceneContext.settings.fov;
            this.instance.notifyChange(this.instance.view.camera);
        }
        if (this.state.sceneContext.settings.sceneQuality !== prevState.sceneContext.settings.sceneQuality) {
            const quality = Math.max(20, this.state.sceneContext.settings.sceneQuality);
            this.map.segments = Math.pow(2, Math.floor(quality / 20));
            this.instance.notifyChange(this.instance.view.camera);
        }
    }
    applyBaseLayer = () => {
        const baseLayer = this.state.sceneContext.baseLayers.find(e => e.visibility === true);
        this.removeLayer("__baselayer");
        UrlParams.updateParams({bl3d: baseLayer?.name ?? 'null'});
        if (!baseLayer) {
            return;
        }
        const layerCreator = LayerRegistry[baseLayer.type];
        if (layerCreator?.create3d) {
            const layer3d = layerCreator.create3d(baseLayer, this.state.sceneContext.mapCrs);
            this.addLayer("__baselayer", layer3d);
            this.map.insertLayerAfter(layer3d, null);
        }
    };
    setBaseLayer = (layer, visibility) => {
        const currentBaseLayer = this.state.sceneContext.baseLayers.find(l => l.visibility === true)?.name || "";
        if (visibility && layer.name === currentBaseLayer) {
            // Nothing changed
            return;
        }
        const dtm = this.getLayer("__dtm");
        if (visibility !== dtm.visible) {
            dtm.visible = visibility;
            this.map.receiveShadow = visibility;
            this.map.backgroundOpacity = visibility ? 1 : 0;
            this.instance.notifyChange(this.map);
        }
        this.setState(state => ({
            sceneContext: {
                ...state.sceneContext,
                baseLayers: state.sceneContext.baseLayers.map(entry => (
                    {...entry, visibility: entry.name === layer.name ? visibility : false}
                ))
            }
        }));
    };
    collectColorLayers = (prevColorLayers, prevLayers) => {
        const prevLayerMap = prevLayers.reduce((res, layer) => ({...res, [layer.id]: layer}), {});
        return this.props.layers.reduce((colorLayers, layer) => {
            if (layer.role !== LayerRole.THEME && layer.role !== LayerRole.USERLAYER) {
                return colorLayers;
            }
            const prevOptions = prevColorLayers[layer.id];
            if (prevOptions && layer === prevLayerMap[layer.id]) {
                colorLayers[layer.id] = prevOptions;
                return colorLayers;
            }
            const layerCreator = LayerRegistry[layer.type];
            if (!layerCreator || !layerCreator.create3d) {
                return colorLayers;
            }
            const preserveSublayerOptions = (entry, prevEntry) => {
                return entry.sublayers?.map?.(child => {
                    const prevChild = prevEntry?.sublayers?.find?.(x => x.name === child.name);
                    if (prevChild?.name === child.name) {
                        return {
                            ...child,
                            visibility: prevChild.visibility,
                            opacity: prevChild.opacity,
                            sublayers: preserveSublayerOptions(child, prevChild)
                        };
                    } else {
                        return child;
                    }
                });
            };
            colorLayers[layer.id] = {
                ...layer,
                projection: prevOptions?.projection ?? this.props.theme.mapCrs,
                visibility: prevOptions?.visibility ?? false,
                opacity: prevOptions?.opacity ?? 255,
                extrusionHeight: prevOptions?.extrusionHeight ?? (layerCreator.createFeatureSource ? 0 : undefined),
                fields: prevOptions?.fields ?? undefined,
                sublayers: preserveSublayerOptions(layer, prevOptions)
            };
            Object.assign(colorLayers[layer.id], LayerUtils.buildWMSLayerParams(colorLayers[layer.id]));
            if (colorLayers[layer.id].fields === undefined && layerCreator.getFields) {
                layerCreator.getFields(layer).then(fields => {
                    this.updateColorLayer(layer.id, {fields});
                });
            }
            return colorLayers;
        }, {});
    };
    applyColorLayerUpdates = (colorLayers, prevColorLayers) => {
        // Add-update new layers
        let layerBelow = this.getLayer("__baselayer");
        Object.entries(colorLayers).reverse().forEach(([layerId, options]) => {
            const prevOptions = prevColorLayers[layerId];
            if (options === prevOptions) {
                return;
            }
            const layerCreator = LayerRegistry[options.type];
            let mapLayer = this.getLayer(layerId);
            if (mapLayer) {
                layerCreator.update3d(mapLayer, options, prevOptions, this.state.sceneContext.mapCrs);
            } else {
                mapLayer = layerCreator.create3d(options, this.state.sceneContext.mapCrs);
                this.addLayer(layerId, mapLayer);
            }
            this.map.insertLayerAfter(mapLayer, layerBelow);
            // WMS layer handles visibility and opacity internally
            if (options.type !== "wms") {
                mapLayer.visible = options.visibility;
                mapLayer.opacity = options.opacity / 255;
            }
            layerBelow = mapLayer;
            if (options.extrusionHeight !== undefined && options.extrusionHeight !== 0) {
                this.createUpdateExtrudedLayer(layerCreator, mapLayer, options, options.features !== prevOptions?.features);
            } else if (prevOptions?.extrusionHeight !== undefined && prevOptions?.extrusionHeight !== 0) {
                this.removeExtrudedLayer(options.id);
            }
        });
        // Remove old layers
        Object.entries(prevColorLayers).forEach(([layerId, options]) => {
            if (!(layerId in colorLayers)) {
                if (options.extrusionHeight !== undefined && options.extrusionHeight !== 0) {
                    this.removeExtrudedLayer(options.id);
                }
                this.removeLayer(layerId);
            }
        });
        this.instance.notifyChange(this.map);
    };
    createUpdateExtrudedLayer = (layerCreator, mapLayer, options, forceCreate = false) => {
        const objId = options.id + ":extruded";
        const makeColor = (c) => {
            if (Array.isArray(c)) {
                return ((c[0] << 16) | (c[1] << 8) | c[2]);
            } else if (typeof c === "string") {
                return parseInt(c.replace("#", ""), 16);
            } else {
                return c;
            }
        };
        let obj = this.objectMap[objId];
        if (!obj || forceCreate) {
            if (obj) {
                this.instance.remove(obj);
            }
            const layercolor = makeColor(options.color ?? "#FF0000");
            obj = new DrapedFeatureCollection({
                source: layerCreator.createFeatureSource(mapLayer, options, this.state.sceneContext.mapCrs),
                drapingMode: 'per-feature',
                extrusionOffset: (feature) => {
                    if (typeof obj.userData.extrusionHeight === "string") {
                        return parseFloat(feature.getProperties()[obj.userData.extrusionHeight]) || 0;
                    } else {
                        return obj.userData.extrusionHeight;
                    }
                },
                style: (feature) => {
                    return obj.userData.featureStyles?.[feature.getId()] ?? {
                        fill: {color: layercolor, shading: true}
                    };
                }
            });
            obj.castShadow = true;
            obj.receiveShadow = true;
            this.instance.add(obj).then(() => {
                obj.attach(this.map);
            });
            this.objectMap[objId] = obj;
        }
        obj.userData.extrusionHeight = options.extrusionHeight;
        obj.userData.featureStyles = options.features?.reduce?.((res, feature) => ({
            ...res,
            [feature.id]: {
                fill: {
                    color: makeColor(feature.styleOptions.fillColor),
                    shading: true
                }
            }
        }), {});
        obj.opacity = mapLayer.opacity;
        obj.visible = mapLayer.visible;
        if (obj.visible) {
            obj.updateStyles();
        }
    };
    removeExtrudedLayer = (layerId) => {
        const objId = layerId + ":extruded";
        if (this.objectMap[objId]) {
            this.instance.remove(this.objectMap[objId]);
            delete this.objectMap[objId];
        }
        this.instance.notifyChange();
    };
    addLayer = (layerId, layer) => {
        layer.userData.layerId = layerId;
        this.map.addLayer(layer);
    };
    getLayer = (layerId) => {
        return this.map.getLayers(l => l.userData.layerId === layerId)[0] ?? null;
    };
    removeLayer = (layerId) => {
        this.map.getLayers(l => l.userData.layerId === layerId).forEach(layer => {
            this.map.removeLayer(layer, {dispose: true});
        });
    };
    updateColorLayer = (layerId, options, flags = {}) => {
        this.setState((state) => {
            const entry = {
                ...state.sceneContext.colorLayers[layerId]
            };
            let subentry = entry;
            (flags.path ?? []).forEach(idx => {
                subentry.sublayers = [...subentry.sublayers];
                subentry.sublayers[idx] = {...subentry.sublayers[idx]};
                subentry = subentry.sublayers[idx];
            });
            const prevOptions = {...subentry};
            Object.assign(subentry, options);
            if (subentry.visibility !== prevOptions.visibility && !isEmpty(subentry.sublayers) && flags.groupTogglesSublayers) {
                // Propagate visibility to children
                const setChildVisibilities = (child) => {
                    child.sublayers = child.sublayers.map(gchild => {
                        const ngchild = {...gchild, visibility: options.visibility};
                        if (!isEmpty(ngchild.sublayers)) {
                            setChildVisibilities(ngchild);
                        }
                        return ngchild;
                    });
                };
                setChildVisibilities(subentry);
            }
            Object.assign(entry, LayerUtils.buildWMSLayerParams(entry));
            return {
                sceneContext: {
                    ...state.sceneContext,
                    colorLayers: {
                        ...state.sceneContext.colorLayers,
                        [layerId]: entry
                    }
                }
            };
        });
    };
    importTiles3D = (url, objectId, addToLayerTree = false, treeOptions = {}, showEditTool = false, matrix = null, label = null) => {
        const tiles = new Tiles3D({
            url: MiscUtils.resolveAssetsPath(url)
        });
        // Recenter tile group (so that origin of transform tool is in the center of the tileset)
        tiles.tiles.addEventListener('load-tileset', ({tileSet}) => {
            if (tileSet.root.parent === null) {
                const bbox = new Box3();
                tiles.tiles.getBoundingBox(bbox);
                const center = bbox.getCenter(new Vector3());

                tiles.tiles.group.position.sub(center);
                if (matrix) {
                    tiles.tiles.group.parent.applyMatrix4(matrix);
                } else {
                    tiles.tiles.group.parent.position.copy(center);
                }
                tiles.tiles.group.parent.updateMatrixWorld(true);
                if (label) {
                    tiles.tiles.group.parent.userData.label = label;
                    updateObjectLabel(tiles.tiles.group.parent, this.state.sceneContext);
                }
            }
            this.instance.notifyChange(tiles);
            if (showEditTool) {
                this.props.setCurrentTask("EditDataset3D", null, null, {objectId: objectId});
            }
        });
        tiles.tiles.addEventListener('needs-update', () => {
            this.instance.notifyChange(tiles);
        });

        // Apply style when loading tile
        tiles.tiles.addEventListener('load-model', ({scene}) => {
            scene.userData.tilesetName = objectId;
            scene.userData.featureIdAttr = "id";
            Tiles3DStyle.applyTileStyle(scene, tiles.userData, this.state.sceneContext);
            this.instance.notifyChange(tiles);
        });
        // Show/hide labels when tile visibility changes
        tiles.tiles.addEventListener('tile-visibility-change', ({scene, visible}) => {
            Object.values(scene?.userData?.tileLabels ?? {}).forEach(l => {
                l.labelObject.visible = visible;
                l.labelObject.element.style.display = visible ? 'initial' : 'none';
            });
        });
        tiles.castShadow = true;
        tiles.receiveShadow = true;
        this.addSceneObject(objectId, tiles, addToLayerTree, treeOptions);
    };
    importObject3D = (dataOrUrl, objectId, addToLayerTree = false, treeOptions = {}, showEditTool = false, callback = null) => {
        const loader = new GLTFLoader();
        const processor = (gltf) => {
            // GLTF is Y-UP, we need Z-UP
            gltf.scene.rotation.x = Math.PI / 2;
            gltf.scene.updateMatrixWorld(true);

            gltf.scene.castShadow = true;
            gltf.scene.receiveShadow = true;
            gltf.scene.traverse(c => {
                if (c.geometry) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
                updateObjectLabel(c, this.state.sceneContext);
            });

            // Shift root position to center of object
            gltf.scene.updateMatrixWorld(true);

            const box = new Box3().setFromObject(gltf.scene);
            const centerWorld = box.getCenter(new Vector3());
            centerWorld.z = box.min.z;
            const centerLocal = gltf.scene.worldToLocal(centerWorld.clone());
            gltf.scene.position.add(centerWorld);

            // Offset children back so the world positions remain unchanged
            gltf.scene.children.forEach(child => {
                child.position.sub(centerLocal);
            });
            gltf.scene.updateMatrixWorld(true);

            this.addSceneObject(objectId, gltf.scene, addToLayerTree, treeOptions, showEditTool);
            callback?.();
        };
        if (typeof dataOrUrl === 'string') {
            loader.load(dataOrUrl, processor, () => {}, (err) => {
                /* eslint-disable-next-line */
                console.warn(err);
            });
        } else {
            loader.parse(dataOrUrl, ConfigUtils.getAssetsPath(), processor, (err) => {
                /* eslint-disable-next-line */
                console.warn(err);
            });
        }
    };
    addSceneObject = (objectId, object, addToLayerTree = false, treeOptions = {}, showEditTool = false) => {
        if (object.tiles) {
            this.instance.add(object);
        } else {
            this.sceneObjectGroup.add(object);
        }
        this.objectMap[objectId] = object;
        this.instance.notifyChange(object);
        if (addToLayerTree) {
            this.setState((state) => {
                const newObjectTree = {...state.sceneContext.objectTree};
                newObjectTree.null = {...newObjectTree.null, children: [...newObjectTree.null.children, objectId]};
                newObjectTree[objectId] = {
                    objectId: objectId,
                    parent: null,
                    visibility: true,
                    opacity: 255,
                    ...treeOptions
                };
                return {
                    sceneContext: {...state.sceneContext, objectTree: newObjectTree}
                };
            });
            object.userData.layertree = addToLayerTree;
        }
        if (showEditTool) {
            this.props.setCurrentTask("EditDataset3D", null, null, {objectId: objectId});
        }
    };
    getSceneObject = (objectId) => {
        return this.objectMap[objectId];
    };
    removeSceneObject = (objectId, callback = undefined) => {
        const object = this.objectMap[objectId];
        if (!object) {
            return;
        }
        if (object.tiles) {
            this.instance.remove(object);
        } else {
            this.sceneObjectGroup.remove(object);
        }
        // Ensure labels are removed
        object.traverse(c => {
            if (c.isCSS2DObject) {
                c.element.parentNode.removeChild(c.element);
            }
        });
        if (object.tiles) {
            this.instance.remove(object);
        } else {
            this.sceneObjectGroup.remove(object);
        }
        delete this.objectMap[objectId];
        this.instance.notifyChange();
        if (objectId in this.state.sceneContext.objectTree) {
            this.setState((state) => {
                const newObjectTree = {...state.sceneContext.objectTree};
                const parentId = newObjectTree[objectId].parent;
                newObjectTree[parentId] = {
                    ...newObjectTree[parentId],
                    children: newObjectTree[parentId].children.filter(x => x !== objectId)
                };
                delete newObjectTree[objectId];
                return {
                    sceneContext: {
                        ...state.sceneContext,
                        objectTree: newObjectTree
                    }
                };
            }, callback);
        } else {
            callback?.();
        }
    };
    updateSceneObject = (objectId, options, flags = {}) => {
        this.setState((state) => {
            const objectTree = {...state.sceneContext.objectTree};
            const prevOptions = objectTree[objectId] || {};
            options = {...prevOptions, ...options};
            if (options.objectId) {
                this.applySceneObjectState(objectId, options, prevOptions, objectTree);
            } else if (options.children && options.visibility !== prevOptions.visibility) {
                this.setChildObjectVisibility(objectTree, options.children, options.visibility, flags.groupTogglesSublayers);
            }
            return {
                sceneContext: {
                    ...state.sceneContext,
                    objectTree: {...objectTree, [objectId]: options}
                }
            };
        });
    };
    applySceneObjectState = (objectId, options, prevOptions, objectTree) => {
        const object = this.objectMap[objectId];
        let changed = false;
        if (options.visibility !== prevOptions.visibility || options.opacity !== prevOptions?.opacity) {
            // Visibile if object is visibile and parents also
            let isVisible = options.opacity > 0 && options.visibility;
            for (let curId = options.parent; isVisible && curId !== undefined; curId = objectTree[curId].parent) {
                isVisible &&= objectTree[curId].visibility;
            }
            changed |= object.visible !== isVisible;
            object.visible = isVisible;
        }
        if (options.opacity !== prevOptions?.opacity) {
            if (object.opacity !== undefined) {
                object.opacity = options.opacity / 255;
            } else {
                object.traverse(child => {
                    if (child instanceof Mesh) {
                        child.material.transparent = options.opacity < 255;
                        child.material.opacity = options.opacity / 255;
                        child.material.needsUpdate = true;
                    }
                });
            }
            changed = true;
        }
        if (changed) {
            this.instance.notifyChange(object);
        }
        if (options.style !== prevOptions?.style) {
            this.loadTilesetStyle(objectId, options.styles?.[options.style]);
        }
    };
    setChildObjectVisibility = (objectTree, children, visibility, groupTogglesSublayers) => {
        children.forEach(nodeId => {
            if (objectTree[nodeId].children) {
                this.setChildObjectVisibility(objectTree, objectTree[nodeId].children, visibility && objectTree[nodeId].visibility);
            } else {
                if (groupTogglesSublayers) {
                    objectTree[nodeId] = {...objectTree[nodeId], visibility: visibility};
                }
                const child = objectTree[nodeId];
                const newVisible = visibility && child.visibility && child.opacity > 0;
                const changed = newVisible !== this.objectMap[child.objectId].visible;
                this.objectMap[child.objectId].visible = newVisible;
                if (changed) {
                    this.instance.notifyChange(this.objectMap[child.objectId]);
                }
            }
        });
    };
    loadTilesetStyle = (objectId, url) => {
        const applyTilesetStyle = (styleurl) => {
            const tiles3d = this.objectMap[objectId];
            tiles3d.userData.tilesetStyle = this.tilesetStyles[styleurl];
            tiles3d.tiles.group.children.forEach(group => {
                Tiles3DStyle.applyTileStyle(group, tiles3d.userData, this.state.sceneContext);
            });
            this.instance.notifyChange(tiles3d);
        };
        if (this.tilesetStyles[url]) {
            applyTilesetStyle(url);
        } else if (url) {
            const fullUrl = MiscUtils.resolveAssetsPath(url);
            axios.get(fullUrl).then(response => {
                this.tilesetStyles[url] = response.data;
                applyTilesetStyle(url);
            }).catch(() => {
                this.tilesetStyles[url] = null;
                applyTilesetStyle(url);
            });
        } else {
            this.tilesetStyles[url] = null;
            applyTilesetStyle(url);
        }
    };
    zoomToObject = (objectId, margin = 20) => {
        const obj = this.state.sceneContext.getSceneObject(objectId);
        const bbox = new Box3();
        if (obj?.tiles) {
            obj.tiles.getBoundingBox(bbox);
        } else {
            bbox.setFromObject(obj);
        }
        if (!bbox.isEmpty()) {
            const bounds = [
                bbox.min.x - margin,
                bbox.min.y - margin,
                bbox.max.x + margin,
                bbox.max.y + margin
            ];
            this.state.sceneContext.setViewToExtent(bounds, 0);
        }
    };
    getMap = () => {
        return this.map;
    };
    render() {
        return [
            ReactDOM.createPortal((
                <div className="map3d-map" id="map3d" key="Map3D" ref={this.setupContainer} />
            ), this.context),
            this.state.sceneContext.scene && !this.state.sceneContext.rebuildInstance ? (
                <UnloadWrapper key={this.state.sceneContext.sceneId} onUnload={this.onUnload} sceneId={this.state.sceneContext.sceneId}>
                    <MapControls3D
                        controlsPosition={this.props.controlsPosition}
                        mouseButtons={this.props.mouseButtons}
                        onCameraChanged={this.props.onCameraChanged}
                        onControlsSet={this.setupControls}
                        sceneContext={this.state.sceneContext}
                    >
                        <EditDataset3D sceneContext={this.state.sceneContext} />
                        <ViewSwitcher position={1} />
                        {Object.entries(this.props.plugins3d).map(([name, Component]) => (
                            <Suspense key={name}>
                                <Component sceneContext={this.state.sceneContext} {...this.props.pluginOptions[name]} />
                            </Suspense>
                        ))}
                    </MapControls3D>
                </UnloadWrapper>
            ) : null
        ];
    }
    setupContainer = (el) => {
        if (el) {
            this.container = el;
            el.resizeObserver = new ResizeObserver(entries => {
                if (this.state.sceneContext.scene) {
                    const rect = entries[0].contentRect;
                    this.state.sceneContext.scene.view.dispatchEvent({type: 'view-resized', width: rect.width, height: rect.height});
                }
            });
            el.resizeObserver.observe(el);
            this.setupInstance();
        }
    };
    setupInstance = () => {
        if (this.instance) {
            this.disposeInstance();
        }
        if (!this.props.theme) {
            return;
        }
        const projection = this.props.theme.mapCrs;
        const crs = CoordinateSystem.fromSrid(projection);

        // Setup instance
        this.instance = new Instance({
            target: this.container,
            crs: crs,
            renderer: {
                clearColor: 0x000000,
                preserveDrawingBuffer: true
            }
        });
        this.sceneObjectGroup = new Group();
        this.sceneObjectGroup.name = "sceneObjects";
        this.instance.add(this.sceneObjectGroup);

        // Setup map
        const initialBbox = this.props.theme.map3d?.extent ?? this.props.theme.initialBbox;
        const bounds = CoordinatesUtils.reprojectBbox(initialBbox.bounds, initialBbox.crs, projection);
        const extent = new Extent(crs, bounds[0], bounds[2], bounds[1], bounds[3]);
        this.map = new Map({
            extent: extent,
            backgroundColor: "white"
        });
        this.instance.add(this.map);

        // Setup camera
        const center = extent.center();
        if (crsIsGeographic(center.crs)) {
            const position = Ellipsoid.WGS84.toCartesian(
                center.latitude,
                center.longitude,
                center.altitude
            );
            this.instance.view.camera.position.set(position.x, position.y, 0.5 * (extent.east - extent.west));
        } else {
            this.instance.view.camera.position.set(center.x, center.y, 0.5 * (extent.east - extent.west));
        }

        // Skybox
        const cubeTextureLoader = new CubeTextureLoader();
        cubeTextureLoader.setPath(ConfigUtils.getAssetsPath() + "/3d/skybox/");
        const cubeTexture = cubeTextureLoader.load([
            "px.jpg",
            "nx.jpg",
            "py.jpg",
            "ny.jpg",
            "pz.jpg",
            "nz.jpg"
        ]);
        this.instance.scene.background = cubeTexture;

        // Setup elevation
        const demUrl = MiscUtils.resolveAssetsPath(this.props.theme.map3d?.dtm?.url ?? "");
        const demCrs = CoordinateSystem.fromSrid(this.props.theme.map3d?.dtm?.crs || "EPSG:3857");
        if (demUrl) {
            const demSource = new GeoTIFFSource({
                url: demUrl,
                crs: demCrs
            });
            const demMin = this.props.theme.map3d.dtm.min ?? undefined;
            const demMax = this.props.theme.map3d.dtm.max ?? undefined;
            const elevationLayer = new ElevationLayer({
                name: 'dem',
                extent: extent,
                source: demSource,
                minmax: demMin !== undefined && demMax !== undefined ? { demMin, demMax } : undefined
            });
            this.addLayer("__dtm", elevationLayer);
        }

        // Collect baselayers
        const externalLayers = {};
        const baseLayers = ThemeUtils.createThemeBackgroundLayers(this.props.theme.map3d?.basemaps || [], this.props.themes, null, externalLayers);
        baseLayers.push({
            type: "blank",
            name: "",
            title: LocaleUtils.tr("bgswitcher.nobg")
        });
        for (const key of Object.keys(externalLayers)) {
            const idx = key.indexOf(":");
            const service = key.slice(0, idx);
            const serviceUrl = key.slice(idx + 1);
            ServiceLayerUtils.findLayers(service, serviceUrl, externalLayers[key], projection, (id, layer) => {
                // Don't expose sublayers
                if (layer) {
                    layer.sublayers = null;
                }
                this.setState(state => ({
                    sceneContext: {
                        ...state.sceneContext,
                        baseLayers: LayerUtils.replacePlaceholderLayer(state.sceneContext.baseLayers, id, layer)
                    }
                }));
            });
        }

        // Collect color layers
        const colorLayers = this.collectColorLayers([], []);

        this.objectMap = {};

        const objects = this.props.theme.map3d?.objects || [];
        // Convert legacy flat lists to tree
        (this.props.theme.map3d?.tiles3d || []).forEach(entry => {
            objects.push({...entry, type: "tiles3d"});
        });
        (this.props.theme.map3d?.objects3d || []).forEach(entry => {
            objects.push({...entry, type: "object3d"});
        });

        // Add objects and build tree
        const objectTree = {
            [null]: {parent: undefined, children: [], visibility: true}
        };
        const buildObjectTree = (entries, parentId) => {
            const nodeIds = [];
            entries.forEach(entry => {
                if (entry.type === "group") {
                    const groupId = uuidv4();
                    objectTree[groupId] = {
                        parent: parentId,
                        title: entry.title,
                        visibility: entry.visibility ?? true
                    };
                    // Need this separately to ensure object[groupId] is already assigned
                    objectTree[groupId].children = buildObjectTree(entry.items, groupId);
                    nodeIds.push(groupId);
                } else if (entry.type === "tiles3d") {
                    objectTree[entry.name] = {
                        objectId: entry.name,
                        parent: parentId,
                        title: entry.title ?? entry.name,
                        visibility: entry.visibility ?? true,
                        opacity: 255,
                        styles: entry.styles || {},
                        style: entry.style || Object.keys(entry.styles || {})[0] || null
                    };
                    this.importTiles3D(entry.url, entry.name);
                    this.objectMap[entry.name].userData = {
                        ...this.objectMap[entry.name].userData,
                        baseColor: entry.baseColor,
                        tilesetStyle: null,
                        idAttr: entry.idAttr,
                        colorAttr: entry.colorAttr,
                        alphaAttr: entry.alphaAttr,
                        labelAttr: entry.labelAttr
                    };
                    this.applySceneObjectState(entry.name, objectTree[entry.name], {}, objectTree);
                    nodeIds.push(entry.name);
                } else if (entry.type === "object3d") {
                    objectTree[entry.name] = {
                        objectId: entry.name,
                        parent: parentId,
                        title: entry.title ?? entry.name,
                        visibility: entry.visibility ?? true,
                        opacity: 255
                    };
                    this.importObject3D(entry, entry.name, false, {}, false, () => {
                        this.applySceneObjectState(entry.name, objectTree[entry.name], {}, objectTree);
                    });
                    nodeIds.push(entry.name);
                }
            });
            return nodeIds;
        };
        objectTree.null.children = buildObjectTree(objects, null);

        this.setState(state => ({
            sceneContext: {
                ...state.sceneContext,
                scene: this.instance,
                map: this.map,
                mapCrs: projection,
                dtmUrl: demUrl,
                dtmCrs: demCrs,
                baseLayers: baseLayers,
                colorLayers: colorLayers,
                objectTree: objectTree
            },
            sceneId: uuidv4()
        }));

        // Inspector
        if (["1", "true"].includes((UrlParams.getParam("inspector") || "").toLowerCase())) {
            const inspectorContainer = document.createElement("div");
            inspectorContainer.className = 'map3d-inspector';
            this.container.appendChild(inspectorContainer);
            this.inspector = new Inspector(inspectorContainer, this.instance);
        }

        this.instance.addEventListener('update-start', this.instanceOnUpdateStart);
        this.instance.addEventListener('update-end', this.instanceOnUpdateEnd);
        this.instance.addEventListener('before-entity-update', this.instanceOnBeforeEntityUpdate);
        this.instance.addEventListener('after-entity-update', this.instanceOnAfterEntityUpdate);
    };
    instanceOnUpdateStart = () => {
        if (!this.state.sceneContext.scene?.view?.controls) {
            return;
        }
        const camera = this.instance.view.camera;
        const quality = this.state.sceneContext.settings.sceneQuality;
        const isFirstPerson = this.state.sceneContext.scene.view.controls.isFirstPerson;
        const maxDistance = isFirstPerson ? 200 + 20 * quality : 500 + quality * quality;
        // Hide scene objects according to scene quality
        Object.values(this.objectMap).forEach(object => {
            if (object.userData.layertree && object.isObject3D && object.visible) {
                object.children.forEach(child => {
                    if (child.geometry) {
                        if (!child.geometry.boundingBox) {
                            child.geometry.computeBoundingBox();
                        }
                        const localCenter = child.geometry.boundingBox.getCenter(new Vector3());
                        const worldCenter = localCenter.applyMatrix4(child.matrixWorld);
                        const distance = camera.position.distanceTo(worldCenter);
                        child.userData.__wasVisible = child.visible;
                        if (distance > maxDistance) {
                            child.visible = false;
                        }
                    }
                });
            }
        });
    };
    instanceOnUpdateEnd = () => {
        if (!this.state.sceneContext.scene?.view?.controls) {
            return;
        }
        Object.values(this.objectMap).forEach(object => {
            if (object.userData.layertree && object.isObject3D) {
                object.children.forEach(child => {
                    child.visible = child.userData.__wasVisible;
                    delete child.userData.__wasVisible;
                });
            }
        });
    };
    instanceOnBeforeEntityUpdate = ({entity}) => {
        if (!this.state.sceneContext.scene?.view?.controls) {
            return;
        }
        if (entity !== this.map) {
            this.instance.view.camera.userData.__previousFar = this.instance.view.camera.far;
            const quality = this.state.sceneContext.settings.sceneQuality;
            const isFirstPerson = this.state.sceneContext.scene.view.controls.isFirstPerson;
            this.instance.view.camera.far = isFirstPerson ? 200 + 20 * quality : 500 + quality * quality;
            this.instance.view.camera.updateProjectionMatrix();
        }
    };
    instanceOnAfterEntityUpdate = ({entity}) => {
        if (!this.state.sceneContext.scene?.view?.camera) {
            return;
        }
        if (entity !== this.map) {
            this.instance.view.camera.far = this.instance.view.camera.userData.__previousFar;
            delete this.instance.view.camera.userData.__previousFar;
            this.instance.view.camera.updateProjectionMatrix();
        }
    };
    disposeInstance = () => {
        this.instance.removeEventListener('update-start', this.instanceOnUpdateStart);
        this.instance.removeEventListener('update-end', this.instanceOnUpdateEnd);
        this.instance.removeEventListener('before-entity-update', this.instanceOnBeforeEntityUpdate);
        this.instance.removeEventListener('after-entity-update', this.instanceOnAfterEntityUpdate);
        if (this.inspector) {
            this.inspector.detach();
        }
        this.map.dispose({disposeLayers: true});
        Object.values(this.objectMap).forEach(object => {
            this.instance.remove(object);
        });
        this.instance.dispose();
        this.inspector = null;
        this.map = null;
        this.objectMap = {};
        this.sceneObjectGroup = null;
        this.instance = null;
        this.setState((state) => ({
            sceneContext: {...state.sceneContext, ...Map3D.defaultSceneState}
        }));
        this.props.setCurrentTask(null);
    };
    onUnload = (key) => {
        // Ensure scene has not already been disposed
        if (this.state.sceneContext.sceneId === key) {
            if (this.state.sceneContext.rebuildInstance) {
                this.setupInstance();
            } else {
                this.disposeInstance();
            }
        }
    };
    setupControls = (instance) => {
        this.setState(state => ({sceneContext: {
            ...state.sceneContext,
            setViewToExtent: instance?.setViewToExtent,
            restoreView: instance?.restoreView

        }}), this.props.onMapInitialized);
    };
    getTerrainHeightFromDTM = (scenePos) => {
        let returnArray = true;
        if (!Array.isArray(scenePos[0])) {
            returnArray = false;
            scenePos = [scenePos];
        }
        const dtmPos = scenePos.map(p => {
            return CoordinatesUtils.reproject(p, this.state.sceneContext.mapCrs, this.state.sceneContext.dtmCrs.name);
        });
        const dtmExt = [Infinity, Infinity, -Infinity, -Infinity];
        dtmPos.forEach(p => {
            dtmExt[0] = Math.min(dtmExt[0], p[0]);
            dtmExt[1] = Math.min(dtmExt[1], p[1]);
            dtmExt[2] = Math.max(dtmExt[2], p[0]);
            dtmExt[3] = Math.max(dtmExt[3], p[1]);
        });
        return new Promise((resolve) => {
            if (!this.state.sceneContext.dtmUrl) {
                resolve(returnArray ? scenePos.map(x => 0) : 0);
                return;
            }
            fromUrl(this.state.sceneContext.dtmUrl).then(tiff => {

                tiff.getImage().then(image => {
                    const {ModelTiepoint, ModelPixelScale} = image.fileDirectory;

                    // Extract scale and tiepoint values
                    const [scaleX, scaleY] = [ModelPixelScale[0], ModelPixelScale[1]];
                    const [tiepointX, tiepointY] = [ModelTiepoint[3], ModelTiepoint[4]]; // Tiepoint world coordinates

                    // Calculate pixel indices (rounded to nearest integers)
                    const minPixelX = Math.round((dtmExt[0] - tiepointX) / scaleX);
                    const minPixelY = Math.round((tiepointY - dtmExt[3]) / scaleY); // Inverted Y-axis in image
                    const maxPixelY = Math.round((tiepointY - dtmExt[1]) / scaleY) + 1; // Inverted Y-axis in image
                    const maxPixelX = Math.round((dtmExt[2] - tiepointX) / scaleX) + 1;
                    const width = maxPixelX - minPixelX;
                    const height = maxPixelY - minPixelY;

                    image.readRasters({ window: [minPixelX, minPixelY, maxPixelX, maxPixelY] }).then(raster => {
                        if (!returnArray) {
                            resolve(raster[0][0]);
                        } else {
                            const h = dtmPos.map(p => {
                                const x = Math.round((p[0] - dtmExt[0]) / (dtmExt[2] - dtmExt[0]) * (width - 1));
                                const y = Math.round((1 - (p[1] - dtmExt[1]) / (dtmExt[3] - dtmExt[1])) * (height - 1));
                                return raster[0][x + y * width];
                            });
                            resolve(h);
                        }
                    });
                });
            });
        });
    };
    getTerrainHeightFromMap = (scenePos) => {
        const crs = CoordinateSystem.fromSrid(this.state.sceneContext.mapCrs);
        const coordinates = new Coordinates(crs, scenePos[0], scenePos[1], 0);
        const elevationResult = this.state.sceneContext.map.getElevation({coordinates});
        // const raycaster = new Raycaster(new Vector3(scenePos[0], scenePos[1], 10000));
        // const terrInter = raycaster.intersectObjects([this.map.object3d]).filter(result => result.object.children.length === 0)[0];
        elevationResult.samples.sort((a, b) => a.resolution - b.resolution);
        return elevationResult.samples[0]?.elevation;
    };
    getSceneIntersection = (x, y, objects = true) => {
        const raycaster = new Raycaster();
        const camera = this.instance.view.camera;
        raycaster.setFromCamera(new Vector2(x, y), camera);
        // Query object intersection
        const objInter = objects ? raycaster.intersectObjects(this.state.sceneContext.collisionObjects, true)[0] : undefined;
        // Query highest resolution terrain tile (i.e. tile with no children)
        const terrInter = raycaster.intersectObjects([this.map.object3d]).filter(result => result.object.children.length === 0)[0];
        // Return closest result
        if (objInter && terrInter) {
            return objInter.distance < terrInter.distance ? objInter : terrInter;
        }
        return objInter ?? terrInter;
    };
    getSetting = (key) => {
        return this.state.sceneContext.settings[key];
    };
    setSetting = (key, value) => {
        this.setState(state => ({
            sceneContext: {
                ...state.sceneContext, settings: {
                    ...state.sceneContext.settings,
                    [key]: value
                }
            }
        }));
    };
    redrawScene = (ev) => {
        const width = ev.target.innerWidth;
        const height = ev.target.innerHeight;
        this.instance.renderer.setSize(width, height);
        this.instance.view.camera.aspect = width / height;
        this.instance.view.camera.updateProjectionMatrix();
        this.instance.renderer.render(this.instance.scene, this.instance.view.camera);
    };
    setViewToExtent = (bounds, rotation) => {
        this.state.sceneContext.setViewToExtent(bounds, rotation);
    };
    store3dState = () => {
        const promises = Object.values(this.state.sceneContext.objectTree).map(entry => {
            return new Promise(resolve => {
                const object = this.state.sceneContext.getSceneObject(entry.objectId);
                if (entry.drawGroup) {
                    const exporter = new GLTFExporter();
                    exporter.parse(object, (result) => {
                        resolve({id: entry.objectId, options: entry, data: result});
                    });
                } else if (entry.imported && object.tiles) {
                    const container = object.tiles.group.parent;
                    const tileset = {matrix: container.matrix.elements, label: container.userData.label, url: object.tiles.rootURL};
                    resolve({id: entry.objectId, options: entry, tileset: tileset});
                } else {
                    resolve({id: entry.objectId, options: entry});
                }
            });
        }).filter(Boolean);
        return new Promise(resolve => {
            Promise.all(promises).then(objects => {
                const camera = this.state.sceneContext.scene.view.camera.position;
                const target = this.state.sceneContext.scene.view.controls.target;
                const layers = Object.entries(this.state.sceneContext.colorLayers).map(([layerId, options]) => ({
                    id: layerId, options: {
                        visibility: options.visibility,
                        opacity: options.opacity,
                        extrusionHeight: options.extrusionHeight,
                        expanded: options.expanded
                    }
                }));
                resolve({
                    objects: objects,
                    colorLayers: layers,
                    baseLayer: this.state.sceneContext.baseLayers.find(layer => layer.visibility === true)?.name || "",
                    personHeight: this.state.sceneContext.scene.view.controls.personHeight ?? 0,
                    camera: [camera.x, camera.y, camera.z],
                    target: [target.x, target.y, target.z]
                });
            });
        });
    };
    restore3dState = (data) => {
        if (isEmpty(data)) {
            return;
        }
        (data.objects || []).forEach(item => {
            if (item.data) {
                // Don't use importObject3D as we don't need to transform from Y-up to Z-up
                const loader = new GLTFLoader();
                loader.parse(item.data, ConfigUtils.getAssetsPath(), (gltf) => {
                    gltf.scene.traverse(c => {
                        if (c.isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                        }
                        updateObjectLabel(c, this.state.sceneContext);
                    });
                    this.addSceneObject(item.id, gltf.scene, true, item.options);
                });
            } else if (item.tileset) {
                this.importTiles3D(item.tileset.url, item.id, true, item.options, false, new Matrix4().fromArray(item.tileset.matrix), item.tileset.label);
            } else if (item.id in this.state.sceneContext.objectTree) {
                this.state.sceneContext.updateSceneObject(item.id, item.options);
            }
        });
        (data.colorLayers || []).forEach(item => {
            if (item.id in this.state.sceneContext.colorLayers) {
                this.state.sceneContext.updateColorLayer(item.id, item.options);
            }
        });
        this.state.sceneContext.restoreView(data);
        const bl3d = data.baseLayer ?? "";

        this.setBaseLayer({name: bl3d}, bl3d !== "null");
        this.state.sceneContext.scene.notifyChange();
    };
}

export default connect((state) => ({
    theme: state.theme.current,
    themes: state.theme.themes,
    layers: state.layers.flat
}), {
    setCurrentTask: setCurrentTask
})(Map3D);
