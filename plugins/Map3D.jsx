/**
 * Copyright 2023 Sourcepole AG
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
import GeoTIFFSource from "@giro3d/giro3d/sources/GeoTIFFSource.js";
import {fromUrl} from "geotiff";
import PropTypes from 'prop-types';
import {Vector2, Vector3, Raycaster, CubeTextureLoader, AmbientLight} from 'three';
import {MapControls} from 'three/examples/jsm/controls/MapControls.js';

import {LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import ResizeableWindow from '../components/ResizeableWindow';
import LayerRegistry from '../components/map/layers/index';
import BottomBar3D from '../components/map3d/BottomBar3D';
import LayerTree3D from '../components/map3d/LayerTree3D';
import OverviewMap3D from '../components/map3d/OverviewMap3D';
import TopBar3D from '../components/map3d/TopBar3D';
import {BackgroundSwitcher} from '../plugins/BackgroundSwitcher';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/Map3D.css';


/**
 * Displays a 3D map view.
 */
class Map3D extends React.Component {
    static propTypes = {
        bbox: PropTypes.object,
        enabled: PropTypes.bool,
        /** Default window geometry. */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool
        }),
        layers: PropTypes.array,
        mapBbox: PropTypes.object,
        projection: PropTypes.string,
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
        drapedLayers: []
    };
    state = {
        enabled: false,
        sceneContext: {
            ...Map3D.defaultSceneState,

            addLayer: (layer) => {},
            getLayer: (layer) => {},
            removeLayer: (layerId) => {},
            updateDrapedLayer: (layerId, diff) => {},

            addSceneObject: (object) => {},
            removeSceneObject: (objectId) => {},

            setViewToExtent: (bounds, angle) => {},
            getTerrainHeight: (scenePos) => {}
        },
        taskContext: {
            currentTask: {id: null, mode: null},
            setCurrentTask: (task, mode) => {}
        },
        cursorPosition: null
    };
    constructor(props) {
        super(props);
        this.container = null;
        this.inspector = null;
        this.instance = null;
        this.sceneObjects = {};
        this.map = null;
        this.animationInterrupted = false;
        this.state.sceneContext.addLayer = this.addLayer;
        this.state.sceneContext.getLayer = this.getLayer;
        this.state.sceneContext.removeLayer = this.removeLayer;
        this.state.sceneContext.updateDrapedLayer = this.updateDrapedLayer;
        this.state.sceneContext.addSceneObject = this.addSceneObject;
        this.state.sceneContext.removeSceneObject = this.removeSceneObject;
        this.state.sceneContext.setViewToExtent = this.setViewToExtent;
        this.state.sceneContext.getTerrainHeight = this.getTerrainHeight;
        this.state.taskContext.setCurrentTask = this.setCurrentTask;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.enabled && !prevProps.enabled) {
            this.setState({enabled: true});
            this.props.setCurrentTask(null);
        } else if (!this.state.enabled && prevState.enabled) {
            this.disposeInstance();
        }
        if (this.state.enabled) {
            if (this.props.theme !== prevProps.theme) {
                this.disposeInstance();
                this.setupInstance();
            } else if (this.props.layers !== prevProps.layers) {
                this.setState((state) => (
                    {
                        sceneContext: {...state.sceneContext, drapedLayers: this.collectDrapedLayers(state.sceneContext.drapedLayers)}
                    }
                ));
            }

            // Update map layers
            if (this.state.sceneContext.baseLayers !== prevState.sceneContext.baseLayers) {
                this.applyBaseLayer();
            }

            if (this.state.sceneContext.drapedLayers !== prevState.sceneContext.drapedLayers) {
                this.applyDrapedLayers(this.state.sceneContext.drapedLayers, prevState.sceneContext.drapedLayers);
            }
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
    collectDrapedLayers = (prevDrapedLayers) => {
        const prevLayersMap = prevDrapedLayers.reduce((res, layer) => (
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
                visibility: prevLayer?.visibility ?? true,
                opacity: prevLayer?.opacity ?? 255
            };
        }).filter(Boolean);
    };
    applyDrapedLayers = (layers, prevLayers) => {
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
    addLayer = (layerId, layer) => {
        layer.__qwcLayerId = layerId;
        this.map.addLayer(layer);
    };
    getLayer = (layerId) => {
        return this.map.getLayers(l => l.__qwcLayerId === layerId)[0] ?? null;
    }
    removeLayer = (layerId) => {
        this.map.getLayers(l => l.__qwcLayerId === layerId).forEach(layer => {
            this.map.removeLayer(layer, {dispose: true});
        });
    };
    updateDrapedLayer = (layerId, diff) => {
        this.setState(state => ({
            sceneContext: {
                ...state.sceneContext,
                drapedLayers: state.sceneContext.drapedLayers.map(entry => {
                    return entry.id === layerId ? {...entry, ...diff} : entry;
                })
            }
        }));
    };
    addSceneObject = (objectId, object) => {
        this.sceneObjects[objectId] = object;
        this.instance.add(object);
    };
    removeSceneObject = (objectId) => {
        if (this.sceneObjects[objectId]) {
            this.instance.remove(this.sceneObjects[objectId]);
            delete this.sceneObjects[objectId];
        }
    };
    render() {
        if (!this.state.enabled) {
            return null;
        }
        const baseLayer = this.state.sceneContext.baseLayers.find(l => l.visibility === true);
        const extraControls = [{
            icon: "sync",
            callback: () => this.setViewToExtent(this.props.mapBbox.bounds, this.props.mapBbox.rotation),
            title: LocaleUtils.tr("map3d.syncview")
        }];
        return [(
            <ResizeableWindow
                extraControls={extraControls} icon="map3d"
                initialHeight={this.props.geometry.initialHeight}
                initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX}
                initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                key="Map3D"
                onClose={() => this.setState({enabled: false})}
                onExternalWindowResized={this.redrawScene}
                splitScreenWhenDocked
                splitTopAndBottomBar
                title={LocaleUtils.tr("map3d.title")}
            >
                <div className="map3d-body" role="body">
                    <div className="map3d-map" onMouseDown={this.stopAnimations} onMouseMove={this.getScenePosition} ref={this.setupContainer} />
                    <BackgroundSwitcher bottombarHeight={10} changeLayerVisibility={this.setBaseLayer} layers={this.state.sceneContext.baseLayers} />
                    <TopBar3D sceneContext={this.state.sceneContext} taskContext={this.state.taskContext} />
                    <LayerTree3D sceneContext={this.state.sceneContext} taskContext={this.state.taskContext} />
                    <BottomBar3D cursorPosition={this.state.cursorPosition} sceneContext={this.state.sceneContext} />
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
                </div>
            </ResizeableWindow>
        ), (
            <div id="map3dinspector" key="Map3DInspector" />
        )];
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
        // Setup instance
        this.instance = new Instance({
            target: this.container,
            crs: projection,
            renderer: {
                clearColor: 0x000000
            }
        });
        this.sceneObjects = {};

        // Light
        this.instance.scene.add(new AmbientLight('white', 1));

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
                ...this.props.themes.backgroundLayers.find(bl => bl.name === e.name),
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

        // Collect draped layers
        const drapedLayers = this.collectDrapedLayers([]);


        this.setState(state => ({
            sceneContext: {
                ...state.sceneContext,
                scene: this.instance,
                map: this.map,
                mapCrs: projection,
                dtmUrl: demUrl,
                dtmCrs: demCrs,
                baseLayers: baseLayers,
                drapedLayers: drapedLayers,
                modelLayers: []
            }
        }));

        this.setViewToExtent(this.props.mapBbox.bounds, this.props.mapBbox.rotation);

        // this.inspector = Inspector.attach("map3dinspector", this.instance);
    };
    disposeInstance = () => {
        if (this.inspector) {
            this.inspector.detach();
        }
        this.map.dispose({disposeLayers: true});
        this.instance.view.controls.dispose();
        this.instance.dispose();
        Object.values(this.sceneObjects).forEach(object => {
            this.instance.remove(object);
        });
        this.sceneObjects = {};
        this.inspector = null;
        this.map = null;
        this.instance = null;
        this.setState((state) => ({
            cursorPosition: null,
            sceneContext: {...state.sceneContext, ...Map3D.defaultSceneState},
            taskContext: {...state.taskContext, currentTask: {id: null, mode: null}}
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
    getScenePosition = (ev) => {
        if (!this.instance) {
            return;
        }
        const rect = ev.currentTarget.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;

        // Normalize mouse position (-1 to +1)
        const mouse = new Vector2();
        mouse.x = (x / rect.width) * 2 - 1;
        mouse.y = -(y / rect.height) * 2 + 1;

        const raycaster = new Raycaster();
        const camera = this.instance.view.camera;
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(this.instance.scene.children, true);

        if (intersects.length > 0) {
            const p = intersects[0].point;
            this.setState({cursorPosition: [p.x, p.y, p.z]});
        }
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
    redrawScene = (ev) => {
        const width = ev.target.innerWidth;
        const height = ev.target.innerHeight;
        this.instance.renderer.setSize(width, height);
        this.instance.view.camera.aspect = width / height;
        this.instance.view.camera.updateProjectionMatrix();
        this.instance.renderer.render(this.instance.scene, this.instance.view.camera);
    };
    setCurrentTask = (task, mode) => {
        this.setState(state => ({taskContext: {
            ...state.taskContext,
            currentTask: {id: task, mode: mode}
        }}));
    };
}

export default connect((state) => ({
    enabled: state.task.id === 'Map3D',
    mapBbox: state.map.bbox,
    projection: state.map.projection,
    bbox: (state.theme.current || {}).initialBbox,
    layers: state.layers.flat,
    theme: state.theme.current,
    themes: state.theme.themes
}), {
    setCurrentTask: setCurrentTask
})(Map3D);
