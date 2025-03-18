/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
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
import {fromUrl} from "geotiff";
import PropTypes from 'prop-types';
import {Vector2, CubeTextureLoader, Group, Raycaster, Mesh} from 'three';
import {v1 as uuidv1} from 'uuid';

import {LayerRole} from '../../actions/layers';
import {setCurrentTask} from '../../actions/task';
import {BackgroundSwitcher} from '../../plugins/BackgroundSwitcher';
import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import {UrlParams} from '../../utils/PermaLinkUtils';
import BottomBar3D from './BottomBar3D';
import Compare3D from './Compare3D';
import Draw3D from './Draw3D';
import LayerTree3D from './LayerTree3D';
import Map3DLight from './Map3DLight';
import MapControls3D from './MapControls3D';
import MapExport3D from './MapExport3D';
import Measure3D from './Measure3D';
import OverviewMap3D from './OverviewMap3D';
import TopBar3D from './TopBar3D';
import View3DSwitcher from './View3DSwitcher';
import LayerRegistry from './layers/index';

import './style/Map3D.css';

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
    static propTypes = {
        innerRef: PropTypes.func,
        layers: PropTypes.array,
        mapMargins: PropTypes.object,
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
        },
        options: {
            searchMinScaleDenom: 1000
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
        sceneObjects: {}
    };
    state = {
        sceneContext: {
            ...Map3D.defaultSceneState,

            addLayer: (layer) => {},
            getLayer: (layerId) => {},
            removeLayer: (layerId) => {},
            updateColorLayer: (layerId, options) => {},

            addSceneObject: (objectId, object, options = {}) => {},
            getSceneObject: (objectId) => {},
            removeSceneObject: (objectId) => {},
            updateSceneObject: (objectId, options) => {},

            setViewToExtent: (bounds, angle) => {},
            getTerrainHeightFromDTM: (scenePos) => {},
            getTerrainHeightFromMap: (scenePos) => {},
            getSceneIntersection: (x, y) => {}
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
        this.state.sceneContext.addLayer = this.addLayer;
        this.state.sceneContext.getLayer = this.getLayer;
        this.state.sceneContext.removeLayer = this.removeLayer;
        this.state.sceneContext.updateColorLayer = this.updateColorLayer;
        this.state.sceneContext.addSceneObject = this.addSceneObject;
        this.state.sceneContext.getSceneObject = this.getSceneObject;
        this.state.sceneContext.removeSceneObject = this.removeSceneObject;
        this.state.sceneContext.updateSceneObject = this.updateSceneObject;
        this.state.sceneContext.getTerrainHeightFromDTM = this.getTerrainHeightFromDTM;
        this.state.sceneContext.getTerrainHeightFromMap = this.getTerrainHeightFromMap;
        this.state.sceneContext.getSceneIntersection = this.getSceneIntersection;
    }
    componentDidMount() {
        this.props.innerRef(this);
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
            this.applySceneObjectUpdates(this.state.sceneContext.sceneObjects);
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
        this.setState(state => ({
            sceneContext: {
                ...state.sceneContext,
                baseLayers: state.sceneContext.baseLayers.map(entry => (
                    {...entry, visibility: entry.name === layer.name ? visibility : false}
                ))
            }
        }));
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
            const prevOptions = prevColorLayers[layer.uuid];
            colorLayers[layer.uuid] = {
                ...layer,
                visibility: prevOptions?.visibility ?? false,
                opacity: prevOptions?.opacity ?? 255,
                extrusionHeight: prevOptions?.extrusionHeight ?? (['vector', 'wfs'].includes(layer.type) ? 0 : undefined)
            };
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
            if (options.extrusionHeight > 0) {
                this.createUpdateExtrudedLayer(mapLayer, options, options.features !== prevOptions?.features);
            } else if (prevOptions?.extrusionHeight > 0) {
                this.removeExtrudedLayer(options.id);
            }
        });
        // Remove old layers
        Object.entries(prevColorLayers).forEach(([layerId, options]) => {
            if (!(layerId in colorLayers)) {
                if (options.extrusionHeight) {
                    this.removeExtrudedLayer(layerId);
                }
                this.removeLayer(layerId);
            }
        });
        this.instance.notifyChange(this.map);
    };
    createUpdateExtrudedLayer = (mapLayer, options, forceCreate = false) => {
        const bounds = options.bbox.bounds;
        const extent = new Extent(options.bbox.crs, bounds[0], bounds[2], bounds[1], bounds[3]);
        const objId = options.uuid + ":extruded";
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
                elevation: (feature) => {
                    let coordinates = feature.getGeometry().getCoordinates();
                    while (Array.isArray(coordinates[0])) {
                        coordinates = coordinates[0];
                    }
                    return coordinates[2] || this.getTerrainHeightFromMap(coordinates) || 0;
                },
                extrusionOffset: () => {
                    return obj.userData.extrusionHeight;
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
        obj.traverse(mesh => {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        });
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
    applySceneObjectUpdates = (sceneObjects) => {
        Object.entries(sceneObjects).forEach(([objectId, options]) => {
            const object = this.objectMap[objectId];
            object.visible = options.visibility;
            if (object.opacity !== undefined) {
                object.opacity = options.opacity / 255;
            } else {
                object.traverse(child => {
                    if (child instanceof Mesh) {
                        child.material.transparent = options.opacity < 255;
                        child.material.opacity = options.opacity / 255;
                    }
                });
            }
            this.instance.notifyChange(object);
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
    updateColorLayer = (layerId, options) => {
        this.setState((state) => {
            return {
                sceneContext: {
                    ...state.sceneContext,
                    colorLayers: {
                        ...state.sceneContext.colorLayers,
                        [layerId]: {
                            ...state.sceneContext.colorLayers[layerId],
                            ...options
                        }
                    }
                }
            };
        });
    };
    addSceneObject = (objectId, object, options = {}) => {
        this.sceneObjectGroup.add(object);
        this.objectMap[objectId] = object;
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
    removeSceneObject = (objectId) => {
        if (!this.objectMap[objectId]) {
            return;
        }
        this.setState((state) => {
            this.instance.remove(this.objectMap[objectId]);
            delete this.objectMap[objectId];
            const newSceneObjects = {...state.sceneContext.sceneObjects};
            delete newSceneObjects[objectId];
            return {
                sceneContext: {
                    ...state.sceneContext,
                    sceneObjects: newSceneObjects
                }
            };
        });
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
    render() {
        const baseLayer = this.state.sceneContext.baseLayers.find(l => l.visibility === true);
        const style = {
            marginTop: this.props.mapMargins.top,
            marginRight: this.props.mapMargins.right,
            marginBottom: this.props.mapMargins.bottom,
            marginLeft: this.props.mapMargins.left
        };
        return (
            <div className="map3d-body">
                <div className="map3d-inspector" />
                <div className="map3d-map" onMouseDown={this.stopAnimations} ref={this.setupContainer} style={style} />
                <View3DSwitcher position={2} />
                {this.state.sceneContext.scene ? (
                    <UnloadWrapper key={this.state.sceneId} onUnload={this.onUnload} sceneId={this.state.sceneId}>
                        <MapControls3D onControlsSet={this.setupControls} sceneContext={this.state.sceneContext} />
                        <BackgroundSwitcher bottombarHeight={10} changeLayerVisibility={this.setBaseLayer} layers={this.state.sceneContext.baseLayers} />
                        <TopBar3D options={this.props.options} sceneContext={this.state.sceneContext} searchProviders={this.props.searchProviders} />
                        <LayerTree3D sceneContext={this.state.sceneContext} />
                        <BottomBar3D sceneContext={this.state.sceneContext} />
                        <OverviewMap3D baseLayer={baseLayer} sceneContext={this.state.sceneContext} />
                        <Map3DLight sceneContext={this.state.sceneContext} />
                        <Measure3D sceneContext={this.state.sceneContext} />
                        {/*<Identify3D sceneContext={this.state.sceneContext} />*/}
                        <Compare3D sceneContext={this.state.sceneContext} />
                        <Draw3D sceneContext={this.state.sceneContext} />
                        <MapExport3D sceneContext={this.state.sceneContext} />
                    </UnloadWrapper>
                ) : null}
            </div>
        );
    }
    setupContainer = (el) => {
        if (el) {
            this.container = el;
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
        let demUrl = this.props.theme.map3d?.dtm?.url ?? "";
        if (demUrl.startsWith(":")) {
            demUrl = location.href.split("?")[0] + ConfigUtils.getAssetsPath() + demUrl.substr(1);
        }
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
                visibility: e.visibility === true
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

        // Add 3d tiles
        this.objectMap = {};
        const sceneObjects = {};
        (this.props.theme.map3d?.tiles3d || []).forEach(entry => {
            let tilesUrl = entry.url;
            if (tilesUrl.startsWith(":")) {
                tilesUrl = location.href.split("?")[0] + ConfigUtils.getAssetsPath() + tilesUrl.substr(1);
            }
            const tiles = new Tiles3D({
                url: tilesUrl
            });
            tiles.castShadow = true;
            tiles.receiveShadow = true;
            tiles.userData.layertree = true;
            this.instance.add(tiles);
            this.objectMap[entry.name] = tiles;
            sceneObjects[entry.name] = {visibility: true, opacity: 255, layertree: true, title: entry.title ?? entry.name};
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
            sceneId: uuidv1()
        }));

        // Inspector
        if (["1", "true"].includes((UrlParams.getParam("inspector") || "").toLowerCase())) {
            this.inspector = new Inspector(this.container.previousElementSibling, this.instance);
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
            setViewToExtent: instance?.setViewToExtent

        }}), this.props.onMapInitialized);
    };
    getTerrainHeightFromDTM = (scenePos) => {
        const dtmPos = CoordinatesUtils.reproject(scenePos, this.state.sceneContext.mapCrs, this.state.sceneContext.dtmCrs);
        return new Promise((resolve) => {
            fromUrl(this.state.sceneContext.dtmUrl).then(tiff => {

                tiff.getImage().then(image => {
                    const { ModelTiepoint, ModelPixelScale } = image.fileDirectory;

                    // Extract scale and tiepoint values
                    const [scaleX, scaleY] = [ModelPixelScale[0], ModelPixelScale[1]];
                    const [tiepointX, tiepointY] = [ModelTiepoint[3], ModelTiepoint[4]]; // Tiepoint world coordinates

                    // Calculate pixel indices (rounded to nearest integers)
                    const pixelX = Math.round((dtmPos[0] - tiepointX) / scaleX);
                    const pixelY = Math.round((tiepointY - dtmPos[1]) / scaleY); // Inverted Y-axis in image

                    image.readRasters({ window: [pixelX, pixelY, pixelX + 1, pixelY + 1] }).then(raster => {
                        resolve(raster[0][0]);
                    });
                });
            });
        });
    };
    getTerrainHeightFromMap = (scenePos) => {
        const coordinates = new Coordinates(this.state.sceneContext.mapCrs, scenePos[0], scenePos[1], 0);
        const elevationResult = this.state.sceneContext.map.getElevation({coordinates});
        elevationResult.samples.sort((a, b) => a.resolution > b.resolution);
        return elevationResult.samples[0]?.elevation;
    };
    getSceneIntersection = (x, y, objects = true) => {
        const raycaster = new Raycaster();
        const camera = this.instance.view.camera;
        raycaster.setFromCamera(new Vector2(x, y), camera);
        // Query object intersection
        const objInter = objects ? raycaster.intersectObjects([
            this.sceneObjectGroup,
            ...this.instance.getEntities().filter(e => e !== this.map).map(entity => entity.object3d)
        ], true)[0] : undefined;
        // Query highest resolution terrain tile (i.e. tile with no children)
        const terrInter = raycaster.intersectObjects([this.map.object3d]).filter(result => result.object.children.length === 0)[0];
        // Return closest result
        if (objInter && terrInter) {
            return objInter.distance < terrInter.distance ? objInter : terrInter;
        }
        return objInter ?? terrInter;
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
}

export default connect((state) => ({
    mapMargins: state.windows.mapMargins,
    theme: state.theme.current,
    layers: state.layers.flat
}), {
    setCurrentTask: setCurrentTask
})(Map3D);
