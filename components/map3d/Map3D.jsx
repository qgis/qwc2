/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import FeatureCollection from "@giro3d/giro3d/entities/FeatureCollection.js";
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
import {BackgroundSwitcher} from '../../plugins/BackgroundSwitcher';
import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LayerUtils from '../../utils/LayerUtils';
import MiscUtils from '../../utils/MiscUtils';
import {registerPermalinkDataStoreHook, unregisterPermalinkDataStoreHook, UrlParams} from '../../utils/PermaLinkUtils';
import {MapContainerPortalContext} from '../PluginsContainer';
import BottomBar3D from './BottomBar3D';
import Compare3D from './Compare3D';
import Draw3D from './Draw3D';
import EditDataset3D from './EditDataset3D';
import ExportObjects3D from './ExportObjects3D';
import HideObjects3D from './HideObjects3D';
import Identify3D from './Identify3D';
import LayerTree3D from './LayerTree3D';
import Map3DLight from './Map3DLight';
import MapControls3D from './MapControls3D';
import MapExport3D from './MapExport3D';
import Measure3D from './Measure3D';
import OverviewMap3D from './OverviewMap3D';
import Settings3D from './Settings3D';
import TopBar3D from './TopBar3D';
import View3DSwitcher from './View3DSwitcher';
import LayerRegistry from './layers/index';
import {importGltf, updateObjectLabel} from './utils/MiscUtils3D';
import Tiles3DStyle from './utils/Tiles3DStyle';

import './style/Map3D.css';

// Ensures unUnload is called *after* all other children have unmounted
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
        innerRef: PropTypes.func,
        layers: PropTypes.array,
        onCameraChanged: PropTypes.func,
        onMapInitialized: PropTypes.func,
        options: PropTypes.object,
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
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
        sceneObjects: {},
        collisionObjects: [],
        settings: {
            sceneQuality: 100
        }
    };
    state = {
        sceneContext: {
            ...Map3D.defaultSceneState,

            addLayer: (layer) => {},
            getLayer: (layerId) => {},
            removeLayer: (layerId) => {},
            updateColorLayer: (layerId, options, path) => {},

            add3dTiles: (url, options) => {},
            addSceneObject: (objectId, object, options = {}) => {},
            getSceneObject: (objectId) => {},
            removeSceneObject: (objectId) => {},
            updateSceneObject: (objectId, options) => {},
            zoomToObject: (objectId) => {},

            getMap: () => {},

            setViewToExtent: (bounds, angle) => {},
            getTerrainHeightFromDTM: (scenePos) => {},
            getTerrainHeightFromMap: (scenePos) => {},
            getSceneIntersection: (x, y, objects) => {},

            getSetting: (key) => {},
            setSetting: (key, value) => {}
        },
        sceneId: null
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
        this.sceneSettings = {};
        this.state.sceneContext.options = this.props.options;
        this.state.sceneContext.addLayer = this.addLayer;
        this.state.sceneContext.getLayer = this.getLayer;
        this.state.sceneContext.removeLayer = this.removeLayer;
        this.state.sceneContext.updateColorLayer = this.updateColorLayer;
        this.state.sceneContext.add3dTiles = this.add3dTiles;
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
            this.setupInstance();
        } else if (this.props.layers !== prevProps.layers) {
            this.setState((state) => (
                {
                    sceneContext: {...state.sceneContext, colorLayers: this.collectColorLayers(state.sceneContext.colorLayers)}
                }
            ));
        }

        // Update map layers
        if (this.state.sceneContext.baseLayers !== prevState.sceneContext.baseLayers) {
            this.applyBaseLayer();
        }

        if (this.state.sceneContext.colorLayers !== prevState.sceneContext.colorLayers) {
            this.applyColorLayerUpdates(this.state.sceneContext.colorLayers, prevState.sceneContext.colorLayers);
        }
        // Update scene objects
        if (this.state.sceneContext.sceneObjects !== prevState.sceneContext.sceneObjects) {
            this.applySceneObjectUpdates(this.state.sceneContext.sceneObjects, prevState.sceneContext.sceneObjects);

            // Update collision objects
            this.setState(state => ({
                sceneContext: {
                    ...state.sceneContext,
                    collisionObjects: Object.entries(state.sceneContext.sceneObjects).map(([objId, options]) => {
                        if (options.layertree && options.visibility) {
                            const obj = this.objectMap[objId];
                            return obj.tiles?.group ?? obj;
                        }
                        return null;
                    }).filter(Boolean)
                }
            }));
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
        if (visibility && layer?.name === currentBaseLayer) {
            // Nothing changed
            return;
        }
        this.setState(state => ({
            sceneContext: {
                ...state.sceneContext,
                baseLayers: state.sceneContext.baseLayers.map(entry => (
                    {...entry, visibility: entry.name === layer.name ? visibility : false}
                ))
            }
        }));
        UrlParams.updateParams({bl3d: visibility ? layer.name : ''});
    };
    collectColorLayers = (prevColorLayers) => {
        return this.props.layers.reduce((colorLayers, layer) => {
            if (layer.role !== LayerRole.THEME && layer.role !== LayerRole.USERLAYER) {
                return colorLayers;
            }
            const layerCreator = LayerRegistry[layer.type];
            if (!layerCreator || !layerCreator.create3d) {
                return colorLayers;
            }
            const prevOptions = prevColorLayers[layer.id];
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
                visibility: prevOptions?.visibility ?? false,
                opacity: prevOptions?.opacity ?? 255,
                extrusionHeight: prevOptions?.extrusionHeight ?? (['vector', 'wfs'].includes(layer.type) ? 0 : undefined),
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
            const layerCreator = LayerRegistry[options.type];
            let mapLayer = this.getLayer(layerId);
            if (mapLayer) {
                layerCreator.update3d(mapLayer.source, options, prevOptions, this.state.sceneContext.mapCrs);
            } else {
                mapLayer = layerCreator.create3d(options, this.state.sceneContext.mapCrs);
                this.addLayer(layerId, mapLayer);
            }
            this.map.insertLayerAfter(mapLayer, layerBelow);
            mapLayer.visible = options.visibility;
            mapLayer.opacity = options.opacity / 255;
            layerBelow = mapLayer;
            if (options.extrusionHeight !== 0) {
                this.createUpdateExtrudedLayer(mapLayer, options, options.features !== prevOptions?.features);
            } else if (prevOptions?.extrusionHeight !== 0) {
                this.removeExtrudedLayer(options.id);
            }
        });
        // Remove old layers
        Object.entries(prevColorLayers).forEach(([layerId, options]) => {
            if (!(layerId in colorLayers)) {
                if (options.extrusionHeight !== 0) {
                    this.removeExtrudedLayer(options.id);
                }
                this.removeLayer(layerId);
            }
        });
        this.instance.notifyChange(this.map);
    };
    createUpdateExtrudedLayer = (mapLayer, options, forceCreate = false) => {
        const bounds = options.bbox.bounds;
        const extent = new Extent(options.bbox.crs, bounds[0], bounds[2], bounds[1], bounds[3]);
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
            obj = new FeatureCollection({
                source: mapLayer.source.source,
                extent: extent,
                minLevel: 1,
                maxLevel: 1,
                ignoreZ: true,
                elevation: (feature) => {
                    let coordinates = feature.getGeometry().getCoordinates();
                    while (Array.isArray(coordinates[0])) {
                        coordinates = coordinates[0];
                    }
                    return this.getTerrainHeightFromMap(coordinates) ?? 0;
                },
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
            this.instance.add(obj);
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
        obj.updateStyles();
    };
    removeExtrudedLayer = (layerId) => {
        const objId = layerId + ":extruded";
        if (this.objectMap[objId]) {
            this.instance.remove(this.objectMap[objId]);
            delete this.objectMap[objId];
        }
        this.instance.notifyChange();
    };
    applySceneObjectUpdates = (sceneObjects, prevSceneObjects) => {
        Object.entries(sceneObjects).forEach(([objectId, options]) => {
            const prevOptions = prevSceneObjects?.[objectId];
            const object = this.objectMap[objectId];
            if (options.opacity !== prevOptions?.opacity || options.visibility !== prevOptions?.visibility) {
                object.visible = options.visibility && options.opacity > 0;
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
                this.instance.notifyChange(object);
            }
            if (options.style !== prevOptions?.style) {
                this.loadTilesetStyle(objectId, options);
            }
            if (options.tilesetStyle !== prevOptions?.tilesetStyle) {
                object.tiles.group.children.forEach(group => {
                    Tiles3DStyle.applyTileStyle(group, options, this.state.sceneContext);
                });
                this.instance.notifyChange(object);
            }
        });
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
    updateColorLayer = (layerId, options, path = []) => {
        this.setState((state) => {
            const entry = {
                ...state.sceneContext.colorLayers[layerId]
            };
            let subentry = entry;
            path.forEach(idx => {
                subentry.sublayers = [...subentry.sublayers];
                subentry.sublayers[idx] = {...subentry.sublayers[idx]};
                subentry = subentry.sublayers[idx];
            });
            Object.assign(subentry, options);
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
    add3dTiles = (url, name, options = {}, showEditTool = false, matrix = null, label = null) => {
        const tiles = new Tiles3D({
            url: MiscUtils.resolveAssetsPath(url)
        });
        // Recenter tile group
        tiles.tiles.addEventListener('load-tile-set', ({tileSet}) => {
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
                this.zoomToObject(name);
                this.props.setCurrentTask("EditDataset3D", null, null, {objectId: name});
            }
        });
        tiles.tiles.addEventListener('needs-update', () => {
            this.instance.notifyChange(tiles);
        });

        // Apply style when loading tile
        tiles.tiles.addEventListener('load-model', ({scene}) => {
            scene.userData.tilesetName = name;
            scene.userData.batchIdAttr = "id";
            Tiles3DStyle.applyTileStyle(scene, this.state.sceneContext.sceneObjects[name], this.state.sceneContext);
            this.instance.notifyChange(tiles);
        });
        // Show/hide labels when tile visibility changes
        tiles.tiles.addEventListener('tile-visibility-change', ({scene, visible}) => {
            Object.values(scene.userData.tileLabels || {}).forEach(l => {
                l.labelObject.visible = visible;
                l.labelObject.element.style.display = visible ? 'initial' : 'none';
            });
        });
        tiles.castShadow = true;
        tiles.receiveShadow = true;
        tiles.userData.layertree = true;
        this.instance.add(tiles);
        this.objectMap[name] = tiles;

        this.setState((state) => {
            const objectState = {
                imported: true,
                visibility: true,
                opacity: 255,
                layertree: true,
                title: name,
                ...options
            };
            return {
                sceneContext: {
                    ...state.sceneContext,
                    sceneObjects: {...state.sceneContext.sceneObjects, [name]: objectState}
                }
            };
        });
    };
    addSceneObject = (objectId, object, options = {}) => {
        this.sceneObjectGroup.add(object);
        this.objectMap[objectId] = object;
        this.instance.notifyChange(object);
        this.setState((state) => {
            const objectState = {
                visibility: true,
                opacity: 255,
                layertree: false,
                ...options
            };
            return {
                sceneContext: {
                    ...state.sceneContext,
                    sceneObjects: {...state.sceneContext.sceneObjects, [objectId]: objectState}
                }
            };
        });
    };
    getSceneObject = (objectId) => {
        return this.objectMap[objectId];
    };
    removeSceneObject = (objectId, callback = undefined) => {
        const object = this.objectMap[objectId];
        if (!object) {
            return;
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
        this.setState((state) => {
            const newSceneObjects = {...state.sceneContext.sceneObjects};
            delete newSceneObjects[objectId];
            return {
                sceneContext: {
                    ...state.sceneContext,
                    sceneObjects: newSceneObjects
                }
            };
        }, callback);
    };
    updateSceneObject = (objectId, options) => {
        this.setState((state) => {
            return {
                sceneContext: {
                    ...state.sceneContext,
                    sceneObjects: {
                        ...state.sceneContext.sceneObjects,
                        [objectId]: {
                            ...state.sceneContext.sceneObjects[objectId],
                            ...options
                        }
                    }
                }
            };
        });
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
        const baseLayer = this.state.sceneContext.baseLayers.find(l => l.visibility === true);
        const overviewLayer = this.state.sceneContext.baseLayers.find(l => l.overview === true) ?? baseLayer;
        return [
            ReactDOM.createPortal((
                <div className="map3d-map" id="map3d" key="Map3D" ref={this.setupContainer} />
            ), this.context),
            this.state.sceneContext.scene ? (
                <UnloadWrapper key={this.state.sceneId} onUnload={this.onUnload} sceneId={this.state.sceneId}>
                    <MapControls3D onCameraChanged={this.props.onCameraChanged} onControlsSet={this.setupControls} sceneContext={this.state.sceneContext}>
                        <BackgroundSwitcher changeLayerVisibility={this.setBaseLayer} layers={this.state.sceneContext.baseLayers} />
                        <BottomBar3D sceneContext={this.state.sceneContext} />
                        <Compare3D sceneContext={this.state.sceneContext} />
                        <Draw3D sceneContext={this.state.sceneContext} />
                        <EditDataset3D sceneContext={this.state.sceneContext} />
                        <ExportObjects3D sceneContext={this.state.sceneContext} />
                        <HideObjects3D sceneContext={this.state.sceneContext} />
                        <Identify3D sceneContext={this.state.sceneContext} />
                        <LayerTree3D sceneContext={this.state.sceneContext} />
                        <Map3DLight sceneContext={this.state.sceneContext} />
                        <MapExport3D sceneContext={this.state.sceneContext} />
                        <Measure3D sceneContext={this.state.sceneContext} />
                        <OverviewMap3D baseLayer={overviewLayer} sceneContext={this.state.sceneContext} />
                        <Settings3D sceneContext={this.state.sceneContext} />
                        <TopBar3D sceneContext={this.state.sceneContext} searchProviders={this.props.searchProviders} />
                        <View3DSwitcher position={2} />
                    </MapControls3D>
                </UnloadWrapper>
            ) : null
        ];
    }
    setupContainer = (el) => {
        if (el) {
            this.container = el;
            el.resizeObserver = new ResizeObserver(entries => {
                const rect = entries[0].contentRect;
                this.state.sceneContext.scene.view.dispatchEvent({type: 'view-resized', width: rect.width, height: rect.height});
            });
            el.resizeObserver.observe(el);
            this.setupInstance();
        }
    };
    setupInstance = () => {
        if (this.instance) {
            this.disposeInstance();
        }
        const projection = this.props.theme.mapCrs;

        // Setup instance
        this.instance = new Instance({
            target: this.container,
            crs: projection,
            renderer: {
                clearColor: 0x000000,
                preserveDrawingBuffer: true
            }
        });
        this.sceneObjectGroup = new Group();
        this.instance.add(this.sceneObjectGroup);

        // Setup map
        const bounds = CoordinatesUtils.reprojectBbox(this.props.theme.initialBbox.bounds, this.props.theme.initialBbox.crs, projection);
        const extent = new Extent(projection, bounds[0], bounds[2], bounds[1], bounds[3]);
        this.map = new Map({
            extent: extent,
            backgroundColor: "white"
        });
        this.instance.add(this.map);

        // Setup camera
        const center = extent.center();
        this.instance.view.camera.position.set(center.x, center.y, 0.5 * (extent.east - extent.west));

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
        const demCrs = this.props.theme.map3d?.dtm?.crs || "EPSG:3857";
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
        let visibleBaseLayer = null;
        const baseLayers = (this.props.theme.map3d?.basemaps || []).map(e => {
            const baseLayer = {
                ...this.props.layers.find(bl => bl.name === e.name),
                visibility: e.visibility === true,
                overview: e.overview === true
            };
            if (baseLayer.visibility) {
                visibleBaseLayer = baseLayer;
            }
            return baseLayer;
        });
        if (visibleBaseLayer) {
            this.setBaseLayer(visibleBaseLayer, true);
        }

        // Collect color layers
        const colorLayers = this.collectColorLayers([]);

        const sceneObjects = {};
        this.objectMap = {};
        // Add 3d tiles
        (this.props.theme.map3d?.tiles3d || []).forEach(entry => {
            const tiles = new Tiles3D({
                url: MiscUtils.resolveAssetsPath(entry.url),
                errorTarget: 32
            });
            tiles.tiles.addEventListener('load-tile-set', () => {
                this.instance.notifyChange(tiles);
            });
            tiles.tiles.addEventListener('needs-update', () => {
                this.instance.notifyChange(tiles);
            });
            // Apply style when loading tile
            tiles.tiles.addEventListener('load-model', ({scene}) => {
                scene.userData.tilesetName = entry.name;
                scene.userData.batchIdAttr = entry.idAttr ?? "id";
                Tiles3DStyle.applyTileStyle(scene, this.state.sceneContext.sceneObjects[entry.name], this.state.sceneContext);
                this.instance.notifyChange(tiles);
            });
            // Show/hide labels when tile visibility changes
            tiles.tiles.addEventListener('tile-visibility-change', ({scene, visible}) => {
                Object.values(scene.userData.tileLabels || {}).forEach(label => {
                    label.labelObject.visible = visible;
                    label.labelObject.element.style.display = visible ? 'initial' : 'none';
                });
            });
            tiles.castShadow = true;
            tiles.receiveShadow = true;
            tiles.userData.layertree = true;
            this.instance.add(tiles);
            this.objectMap[entry.name] = tiles;

            sceneObjects[entry.name] = {
                visibility: true,
                opacity: 255,
                layertree: true,
                title: entry.title ?? entry.name,
                baseColor: entry.baseColor,
                styles: entry.styles,
                style: entry.style || Object.keys(entry.styles || {})[0] || null,
                tilesetStyle: null,
                idAttr: entry.idAttr,
                colorAttr: entry.colorAttr,
                alphaAttr: entry.alphaAttr,
                labelAttr: entry.labelAttr
            };
        });

        // Add other objects
        (this.props.theme.map3d?.objects3d || []).forEach(entry => {
            importGltf(MiscUtils.resolveAssetsPath(entry.url), entry.name, this.state.sceneContext);
        });

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
                sceneObjects: sceneObjects
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

        this.instance.addEventListener('update-start', () => {
            const camera = this.instance.view.camera;
            const quality = this.state.sceneContext.settings.sceneQuality;
            const isFirstPerson = this.state.sceneContext.scene.view.controls.isFirstPerson;
            const maxDistance = isFirstPerson ? 200 + 20 * quality : 500 + quality * quality;
            // Hide scene objects according to scene quality
            Object.entries(this.state.sceneContext.sceneObjects).forEach(([objId, options]) => {
                const object = this.objectMap[objId];
                if (options.layertree && object.isObject3D) {
                    object.children.forEach(child => {
                        const distance = camera.position.distanceTo(child.getWorldPosition(new Vector3()));
                        child.userData.__wasVisible = child.visible;
                        if (distance > maxDistance) {
                            child.visible = false;
                        }
                    });
                }
            });
        });
        this.instance.addEventListener('update-end', () => {
            Object.entries(this.state.sceneContext.sceneObjects).forEach(([objId, options]) => {
                const object = this.objectMap[objId];
                if (options.layertree && object.isObject3D) {
                    object.children.forEach(child => {
                        child.visible = child.userData.__wasVisible;
                        delete child.userData.__wasVisible;
                    });
                }
            });
        });
        this.instance.addEventListener('before-entity-update', ({entity}) => {
            if (entity !== this.map) {
                this.instance.view.camera.userData.__previousFar = this.instance.view.camera.far;
                const quality = this.state.sceneContext.settings.sceneQuality;
                const isFirstPerson = this.state.sceneContext.scene.view.controls.isFirstPerson;
                this.instance.view.camera.far = isFirstPerson ? 200 + 20 * quality : 500 + quality * quality;
                this.instance.view.camera.updateProjectionMatrix();
            }
        });
        this.instance.addEventListener('after-entity-update', ({entity}) => {
            if (entity !== this.map) {
                this.instance.view.camera.far = this.instance.view.camera.userData.__previousFar;
                delete this.instance.view.camera.userData.__previousFar;
                this.instance.view.camera.updateProjectionMatrix();
            }
        });
    };
    loadTilesetStyle = (objectId, options) => {
        const url = options.styles?.[options.style];
        if (this.tilesetStyles[url]) {
            this.updateSceneObject(objectId, {tilesetStyle: this.tilesetStyles[url]});
        } else if (url) {
            const fullUrl = MiscUtils.resolveAssetsPath(url);
            axios.get(fullUrl).then(response => {
                this.tilesetStyles[url] = response.data;
                this.updateSceneObject(objectId, {tilesetStyle: this.tilesetStyles[url]});
            }).catch(() => {
                this.tilesetStyles[url] = {};
                this.updateSceneObject(objectId, {tilesetStyle: this.tilesetStyles[url]});
            });
        } else {
            this.tilesetStyles[url] = null;
            this.updateSceneObject(objectId, {tilesetStyle: this.tilesetStyles[url]});
        }
    };
    disposeInstance = () => {
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
        if (this.state.sceneId === key) {
            this.disposeInstance();
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
            return CoordinatesUtils.reproject(p, this.state.sceneContext.mapCrs, this.state.sceneContext.dtmCrs);
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
        const coordinates = new Coordinates(this.state.sceneContext.mapCrs, scenePos[0], scenePos[1], 0);
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
        const promises = Object.entries(this.state.sceneContext.sceneObjects).map(([objectId, entry]) => {
            if (!entry.layertree) {
                return null;
            }
            return new Promise(resolve => {
                const object = this.state.sceneContext.getSceneObject(objectId);
                if (entry.drawGroup) {
                    const exporter = new GLTFExporter();
                    exporter.parse(object, (result) => {
                        resolve({id: objectId, options: entry, data: result});
                    });
                } else if (entry.imported && object.tiles) {
                    const container = object.tiles.group.parent;
                    const tileset = {matrix: container.matrix.elements, label: container.userData.label, url: object.tiles.rootURL};
                    resolve({id: objectId, options: entry, tileset: tileset});
                } else {
                    resolve({id: objectId, options: entry});
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
                        extrusionHeight: options.extrusionHeight
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
                const loader = new GLTFLoader();
                loader.parse(item.data, ConfigUtils.getAssetsPath(), (gltf) => {
                    gltf.scene.traverse(c => {
                        if (c.isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                        }
                        updateObjectLabel(c, this.state.sceneContext);
                    });
                    this.state.sceneContext.addSceneObject(item.id, gltf.scene, item.options);
                });
            } else if (item.tileset) {
                this.add3dTiles(item.tileset.url, item.id, item.options, false, new Matrix4().fromArray(item.tileset.matrix), item.tileset.label);
            } else if (item.id in this.state.sceneContext.sceneObjects) {
                this.state.sceneContext.updateSceneObject(item.id, item.options);
            }
        });
        (data.colorLayers || []).forEach(item => {
            if (item.id in this.state.sceneContext.colorLayers) {
                this.state.sceneContext.updateColorLayer(item.id, item.options);
            }
        });
        this.state.sceneContext.restoreView(data);
        if (data.baseLayer !== undefined) {
            this.setState(state => ({
                sceneContext: {
                    ...state.sceneContext,
                    baseLayers: state.sceneContext.baseLayers.map(l => ({...l, visibility: l.name === data.baseLayer}))
                }
            }));
            UrlParams.updateParams({bl3d: data.baseLayer});
        }
        this.state.sceneContext.scene.notifyChange();
    };
}

export default connect((state) => ({
    theme: state.theme.current,
    layers: state.layers.flat
}), {
    setCurrentTask: setCurrentTask
})(Map3D);
