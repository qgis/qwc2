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
import Map from '@giro3d/giro3d/entities/Map.js';
import Tiles3D from "@giro3d/giro3d/entities/Tiles3D.js";
import GeoTIFFSource from "@giro3d/giro3d/sources/GeoTIFFSource.js";
import Tiles3DSource from "@giro3d/giro3d/sources/Tiles3DSource.js";
import {fromUrl} from "geotiff";
import PropTypes from 'prop-types';
import {Vector2, Vector3, CubeTextureLoader} from 'three';
import {MapControls} from 'three/addons/controls/MapControls';

import {LayerRole} from '../../actions/layers';
import {setMapCrs} from '../../actions/map3d';
import {BackgroundSwitcher} from '../../plugins/BackgroundSwitcher';
import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';
import BottomBar3D from './BottomBar3D';
import Compare3D from './Compare3D';
import LayerTree3D from './LayerTree3D';
import Map3DLight from './Map3DLight';
import Measure3D from './Measure3D';
import OverviewMap3D from './OverviewMap3D';
import TopBar3D from './TopBar3D';
import LayerRegistry from './layers/index';

import './style/Map3D.css';

class UnloadWrapper extends React.Component {
    onUnload = (el) => {
        if (!el)
            this.props.onUnload();
    }
    render () {
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
        mapBBox: PropTypes.object,
        mapMargins: PropTypes.object,
        options: PropTypes.object,
        projection: PropTypes.string,
        searchProviders: PropTypes.object,
        setMapCrs: PropTypes.func,
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
        colorLayers: [],
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
            getTerrainHeight: (scenePos) => {}
        }
    };
    constructor(props) {
        super(props);
        this.container = null;
        this.inspector = null;
        this.instance = null;
        this.map = null;
        this.objectMap = {};
        this.animationInterrupted = false;
        this.state.sceneContext.addLayer = this.addLayer;
        this.state.sceneContext.getLayer = this.getLayer;
        this.state.sceneContext.removeLayer = this.removeLayer;
        this.state.sceneContext.updateColorLayer = this.updateColorLayer;
        this.state.sceneContext.addSceneObject = this.addSceneObject;
        this.state.sceneContext.getSceneObject = this.getSceneObject;
        this.state.sceneContext.removeSceneObject = this.removeSceneObject;
        this.state.sceneContext.updateSceneObject = this.updateSceneObject;
        this.state.sceneContext.setViewToExtent = this.setViewToExtent;
        this.state.sceneContext.getTerrainHeight = this.getTerrainHeight;
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
            const layer3d = layerCreator.create3d(baseLayer, this.props.projection);
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
        const prevLayersMap = prevColorLayers.reduce((res, layer) => (
            {...res, [layer.id]: layer}
        ), {});

        return this.props.layers.map(layer => {
            if (layer.role !== LayerRole.THEME && layer.role !== LayerRole.USERLAYER) {
                return null;
            }
            const layerCreator = LayerRegistry[layer.type];
            if (!layerCreator || !layerCreator.create3d) {
                return null;
            }
            const prevLayer = prevLayersMap[layer.id];
            return {
                ...layer,
                visibility: prevLayer?.visibility ?? false,
                opacity: prevLayer?.opacity ?? 255
            };
        }).filter(Boolean);
    };
    applyColorLayerUpdates = (layers, prevLayers) => {
        const layersMap = layers.reduce((res, layer) => ({...res, [layer.id]: layer}), {});
        const prevLayersMap = prevLayers.reduce((res, layer) => ({...res, [layer.id]: layer}), {});

        // Add-update new layers
        let prevLayer = this.getLayer("__baselayer");
        [...layers].reverse().forEach(layer => {
            const layerCreator = LayerRegistry[layer.type];
            let mapLayer = this.getLayer(layer.id);
            if (mapLayer) {
                layerCreator.update3d(mapLayer.source, layer, prevLayersMap[layer.id], this.props.projection);
            } else {
                mapLayer = layerCreator.create3d(layer, this.props.projection);
                this.addLayer(layer.id, mapLayer);
            }
            this.map.insertLayerAfter(mapLayer, prevLayer);
            mapLayer.visible = layer.visibility;
            mapLayer.opacity = layer.opacity / 255;
            prevLayer = mapLayer;
        });
        // Remove old layers
        Object.keys(prevLayers).forEach(layer => {
            if (!(layer.id in layersMap)) {
                this.removeLayer(layer.id);
            }
        });
        this.instance.notifyChange(this.map);
    };
    applySceneObjectUpdates = (sceneObjects) => {
        Object.entries(sceneObjects).forEach(([objectId, options]) => {
            const object = this.objectMap[objectId];
            object.visible = options.visible;
            object.opacity = options.opacity;
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
    updateColorLayer = (layerId, diff) => {
        this.setState(state => ({
            sceneContext: {
                ...state.sceneContext,
                colorLayers: state.sceneContext.colorLayers.map(entry => {
                    return entry.id === layerId ? {...entry, ...diff} : entry;
                })
            }
        }));
    };
    addSceneObject = (objectId, object, options = {}) => {
        this.instance.add(object);
        this.objectMap[objectId] = object;
        this.setState((state) => {
            const objectState = {
                visible: true,
                opacity: 100,
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
                <div className="map3d-map" onMouseDown={this.stopAnimations} ref={this.setupContainer} style={style} />
                {this.state.sceneContext.scene ? (
                    <UnloadWrapper onUnload={this.disposeInstance}>
                        <BackgroundSwitcher bottombarHeight={10} changeLayerVisibility={this.setBaseLayer} layers={this.state.sceneContext.baseLayers} />
                        <TopBar3D options={this.props.options} sceneContext={this.state.sceneContext} searchProviders={this.props.searchProviders} />
                        <LayerTree3D sceneContext={this.state.sceneContext} />
                        <BottomBar3D sceneContext={this.state.sceneContext} />
                        <div className="map3d-nav-widget map3d-nav-pan">
                            <span />
                            <Icon icon="chevron-up" onMouseDown={(ev) => this.pan(ev, 0, 1)} />
                            <span />
                            <Icon icon="chevron-left" onMouseDown={(ev) => this.pan(ev, 1, 0)} />
                            <Icon icon="home" onClick={() => this.home()} />
                            <Icon icon="chevron-right" onMouseDown={(ev) => this.pan(ev, -1, 0)} />
                            <span />
                            <Icon icon="chevron-down" onMouseDown={(ev) => this.pan(ev, 0, -1)} />
                            <span />
                        </div>
                        <div className="map3d-nav-widget map3d-nav-rotate">
                            <span />
                            <Icon icon="tilt-up" onMouseDown={(ev) => this.tilt(ev, 0, 1)} />
                            <span />
                            <Icon icon="tilt-left" onMouseDown={(ev) => this.tilt(ev, 1, 0)} />
                            <Icon icon="point" onClick={() => this.setViewTopDown()} />
                            <Icon icon="tilt-right" onMouseDown={(ev) => this.tilt(ev, -1, 0)} />
                            <span />
                            <Icon icon="tilt-down" onMouseDown={(ev) => this.tilt(ev, 0, -1)} />
                            <span />
                        </div>
                        <OverviewMap3D baseLayer={baseLayer} sceneContext={this.state.sceneContext} />
                        <Map3DLight sceneContext={this.state.sceneContext} />
                        <Measure3D sceneContext={this.state.sceneContext} />
                        <Compare3D sceneContext={this.state.sceneContext} />
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
        const projection = this.props.projection;
        this.props.setMapCrs(projection);

        // Setup instance
        this.instance = new Instance({
            target: this.container,
            crs: projection,
            renderer: {
                clearColor: 0x000000,
                preserveDrawingBuffer: true
            }
        });

        // Setup map
        const bounds = CoordinatesUtils.reprojectBbox(this.props.theme.bbox.bounds, this.props.theme.bbox.crs, projection);
        const extent = new Extent(projection, bounds[0], bounds[2], bounds[1], bounds[3]);
        this.map = new Map({
            extent: extent,
            backgroundColor: "white",
            hillshading: true
        });
        this.instance.add(this.map);

        // Setup controls
        const controls = new MapControls(this.instance.view.camera, this.instance.domElement);
        controls.zoomToCursor = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.2;
        controls.maxPolarAngle = Math.PI * 0.5;
        this.instance.view.setControls(controls);

        const center = extent.center();
        this.instance.view.camera.position.set(center.x, center.y, 0.5 * (extent.east - extent.west));
        this.instance.view.controls.target = extent.centerAsVector3();
        this.instance.view.controls.addEventListener('change', this.updateControlsTarget);

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
            const tiles = new Tiles3D(
                new Tiles3DSource(tilesUrl)
            );
            tiles.userData.layertree = true;
            this.instance.add(tiles);
            this.objectMap[entry.name] = tiles;
            sceneObjects[entry.name] = {visible: true, opacity: 100, layertree: true, title: entry.title ?? entry.name};
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
            }
        }));

        this.setViewToExtent(this.props.mapBBox.bounds, this.props.mapBBox.rotation);

        // this.inspector = Inspector.attach("map3dinspector", this.instance);
    };
    disposeInstance = () => {
        if (this.inspector) {
            this.inspector.detach();
        }
        this.map.dispose({disposeLayers: true});
        this.instance.view.controls.dispose();
        this.instance.dispose();
        Object.values(this.objectMap).forEach(object => {
            this.instance.remove(object);
            object.traverse(obj => obj.dispose?.());
        });
        this.inspector = null;
        this.map = null;
        this.objectMap = {};
        this.instance = null;
        this.setState((state) => ({
            sceneContext: {...state.sceneContext, ...Map3D.defaultSceneState}
        }));
    };
    setViewToExtent = (bounds, angle = 0) => {
        const center = {
            x: 0.5 * (bounds[0] + bounds[2]),
            y: 0.5 * (bounds[1] + bounds[3])
        };
        const elevationResult = this.map.getElevation({coordinates: new Coordinates(this.props.projection, center.x, center.y)});
        elevationResult.samples.sort((a, b) => a.resolution > b.resolution);
        center.z = elevationResult.samples[0]?.elevation || 0;

        // Camera height to width bbox width
        const fov = 35 / 180 * Math.PI;
        const cameraHeight = (bounds[2] - bounds[0]) / (2 * Math.tan(fov / 2));

        // Animate from old to new position/target
        const oldPosition = this.instance.view.camera.position.clone();
        const oldTarget = this.instance.view.controls.target.clone();
        const oldYaw = this.instance.view.controls.getAzimuthalAngle();
        const newPosition = new Vector3(center.x, center.y, center.z + cameraHeight);
        const newTarget = new Vector3(center.x, center.y, center.z);
        let rotateAngle = -oldYaw + angle;
        while (rotateAngle > Math.PI) {
            rotateAngle -= 2 * Math.PI;
        }
        while (rotateAngle < -Math.PI) {
            rotateAngle += 2 * Math.PI;
        }
        const startTime = new Date() / 1000;

        this.animationInterrupted = false;
        const animate = () => {
            if (!this.instance || this.animationInterrupted) {
                return;
            }
            const duration = 2;
            const elapsed = new Date() / 1000 - startTime;
            const x = elapsed / duration;
            const k =  0.5 * (1 - Math.cos(x * Math.PI));

            const currentPosition = new Vector3().lerpVectors(oldPosition, newPosition, k);
            const currentTarget = new Vector3().lerpVectors(oldTarget, newTarget, k);
            currentPosition.x -= currentTarget.x;
            currentPosition.y -= currentTarget.y;
            currentPosition.applyAxisAngle(new Vector3(0, 0, 1), rotateAngle * k);
            currentPosition.x += currentTarget.x;
            currentPosition.y += currentTarget.y;
            this.instance.view.camera.position.copy(currentPosition);
            this.instance.view.controls.target.copy(currentTarget);
            this.instance.view.controls.update();

            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                this.instance.view.camera.position.copy(newPosition);
                this.instance.view.controls.target.copy(newTarget);
                this.instance.view.controls._rotateLeft(-angle);
                this.instance.view.controls.update();
            }
        };
        requestAnimationFrame(animate);
    };
    home = () => {
        const bounds = CoordinatesUtils.reprojectBbox(this.props.theme.bbox.bounds, this.props.theme.bbox.crs, this.props.projection);
        this.setViewToExtent(bounds);
    };
    pan = (ev, dx, dy) => {
        MiscUtils.killEvent(ev);
        // Pan faster the heigher one is above the terrain
        const d = (100 + (this.instance.view.camera.position.z - this.instance.view.controls.target.z) / 250);
        const delta = new Vector2(dx, dy).multiplyScalar(d);
        this.animationInterrupted = false;
        let lastTimestamp = new Date() / 1000;
        const animate = () => {
            if (this.animationInterrupted) {
                return;
            }
            // Pan <delta> distance per second
            const timestamp = new Date() / 1000;
            const k = timestamp - lastTimestamp;
            lastTimestamp = timestamp;
            this.instance.view.controls._pan(delta.x * k, delta.y * k);
            this.instance.view.controls.update();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        ev.view.addEventListener("mouseup", () => {
            this.animationInterrupted = true;
        }, {once: true});
    };
    setViewTopDown = () => {
        // Animate from old to new position
        const target = this.instance.view.controls.target;
        const oldPosition = this.instance.view.camera.position.clone();
        const oldYaw = this.instance.view.controls.getAzimuthalAngle();
        const newPosition = new Vector3(target.x, target.y, target.distanceTo(oldPosition));
        const startTime = new Date() / 1000;

        this.animationInterrupted = false;
        const animate = () => {
            if (!this.instance || this.animationInterrupted) {
                return;
            }
            const duration = 2;
            const elapsed = new Date() / 1000 - startTime;
            const x = elapsed / duration;
            const k =  0.5 * (1 - Math.cos(x * Math.PI));

            const currentPosition = new Vector3().lerpVectors(oldPosition, newPosition, k);
            currentPosition.x -= target.x;
            currentPosition.y -= target.y;
            currentPosition.applyAxisAngle(new Vector3(0, 0, 1), -oldYaw * k);
            currentPosition.x += target.x;
            currentPosition.y += target.y;
            this.instance.view.camera.position.copy(currentPosition);
            this.instance.view.controls.update();

            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                this.instance.view.camera.position.copy(newPosition);
                this.instance.view.controls.update();
            }
        };
        requestAnimationFrame(animate);
    };
    tilt = (ev, yaw, az) => {
        MiscUtils.killEvent(ev);
        // Pan faster the heigher one is above the terrain
        this.animationInterrupted = false;
        let lastTimestamp = new Date() / 1000;
        const animate = () => {
            if (this.animationInterrupted) {
                return;
            }
            // Pan <delta> distance per second
            const timestamp = new Date() / 1000;
            const k = timestamp - lastTimestamp;
            lastTimestamp = timestamp;
            if (az) {
                this.instance.view.controls._rotateUp(az * k);
            }
            if (yaw) {
                this.instance.view.controls._rotateLeft(yaw * k);
            }
            this.instance.view.controls.update();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        ev.view.addEventListener("mouseup", () => {
            this.animationInterrupted = true;
        }, {once: true});
    };
    stopAnimations = () => {
        this.animationInterrupted = true;
    };
    getTerrainHeight = (scenePos) => {
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
    updateControlsTarget = () => {
        const x = this.instance.view.camera.position.x;
        const y = this.instance.view.camera.position.y;
        const elevationResult = this.map.getElevation({coordinates: new Coordinates(this.props.projection, x, y)});
        elevationResult.samples.sort((a, b) => a.resolution > b.resolution);
        const terrainHeight = elevationResult.samples[0]?.elevation || 0;
        const cameraHeight = this.instance.view.camera.position.z;
        // If camera height is at terrain height, target height should be at terrain height
        // If camera height is at twice the terrain height or further, target height should be zero
        const targetHeight = terrainHeight > 0 ? terrainHeight * Math.max(0, 1 - (cameraHeight - terrainHeight) / terrainHeight) : 0;
        this.instance.view.controls.target.z = targetHeight;
    };
    redrawScene = (ev) => {
        const width = ev.target.innerWidth;
        const height = ev.target.innerHeight;
        this.instance.renderer.setSize(width, height);
        this.instance.view.camera.aspect = width / height;
        this.instance.view.camera.updateProjectionMatrix();
        this.instance.renderer.render(this.instance.scene, this.instance.view.camera);
    };
}

export default connect((state) => ({
    mapMargins: state.windows.mapMargins
}), {
    setMapCrs: setMapCrs
})(Map3D);
