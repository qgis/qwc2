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
import PropTypes from 'prop-types';
import {Vector2, Vector3, Raycaster} from 'three';
import {MapControls} from 'three/examples/jsm/controls/MapControls.js';

import {LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import ResizeableWindow from '../components/ResizeableWindow';
import LayerRegistry from '../components/map/layers/index';
import BottomBar from '../components/map3d/BottomBar';
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
    state = {
        enabled: false,
        layers: {},
        baselayer: null,
        cursorPosition: null
    };
    constructor(props) {
        super(props);
        this.container = null;
        this.inspector = null;
        this.instance = null;
        this.map = null;
        this.animationInterrupted = false;
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
                this.sync2dLayers(this.state.layers);
            }
        }
    }
    render() {
        if (!this.state.enabled) {
            return null;
        }
        const baseLayers = (this.props.theme.map3d?.basemaps || []).map(e => {
            return {
                ...this.props.themes.backgroundLayers.find(bl => bl.name === e.name),
                visibility: e.name === this.state.baselayer
            };
        });
        const extraControls = [{
            icon: "sync",
            callback: () => this.setViewToExtent(this.props.mapBbox.bounds),
            msgid: LocaleUtils.trmsg("map3d.syncview")
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
                onClose={this.close}
                onExternalWindowResized={this.redrawScene}
                splitScreenWhenDocked
                splitTopAndBottomBar
                title={LocaleUtils.trmsg("map3d.title")}
            >
                <div className="map3d-body" onMouseDown={this.stopAnimations} onMouseMove={this.getScenePosition} ref={this.setupContainer} role="body">
                    <BackgroundSwitcher bottombarHeight={10} changeLayerVisibility={this.setBaseLayer} layers={baseLayers} />
                    <BottomBar cursorPosition={this.state.cursorPosition} instance={this.instance} projection={this.props.projection} />
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

        // Setup elevation
        let demUrl = this.props.theme.map3d?.dtm?.url ?? "";
        if (demUrl.startsWith(":")) {
            demUrl = location.href.split("?")[0] + ConfigUtils.getAssetsPath() + demUrl.substr(1);
        }
        if (demUrl) {
            const demSource = new GeoTIFFSource({
                url: demUrl,
                crs: this.props.theme.map3d.dtm.crs || "EPSG:3857"
            });
            const demMin = this.props.theme.map3d.dtm.min ?? undefined;
            const demMax = this.props.theme.map3d.dtm.max ?? undefined;
            const elevationLayer = new ElevationLayer({
                name: 'dem',
                extent: extent,
                source: demSource,
                minmax: demMin !== undefined && demMax !== undefined ? { demMin, demMax } : undefined
            });
            this.map.addLayer(elevationLayer);
        }

        // Setup baselayer
        const visibleBaseLayerName = (this.props.theme.map3d?.basemaps || []).find(e => e.visibility)?.name;
        if (visibleBaseLayerName) {
            const visibleBaseLayer = this.props.themes.backgroundLayers.find(l => l.name === visibleBaseLayerName);
            this.setBaseLayer(visibleBaseLayer, true);
        }

        // Sync 2d layers
        this.sync2dLayers({});

        this.setViewToExtent(this.props.mapBbox.bounds);

        // this.inspector = Inspector.attach("map3dinspector", this.instance);
    };
    disposeInstance = () => {
        if (this.inspector) {
            this.inspector.detach();
        }
        this.map.dispose({disposeLayers: true});
        this.instance.view.controls.dispose();
        this.instance.dispose();
        this.inspector = null;
        this.map = null;
        this.instance = null;
    };
    close = () => {
        this.setState({enabled: false, baselayer: null, cursorPosition: null});
    };
    setBaseLayer = (layer, visibility) => {
        this.setState({baselayer: visibility ? layer.name : null});

        const baseLayers = this.map.getLayers(l => l.name === "baselayer");
        if (baseLayers.length > 0) {
            baseLayers.forEach(bl => this.map.removeLayer(bl, {dispose: true}));
        }
        if (!visibility) {
            return;
        }
        const layerCreator = LayerRegistry[layer.type];
        if (!layerCreator || !layerCreator.create3d) {
            return;
        }
        const layer3d = layerCreator.create3d({...layer, name: "baselayer"}, this.props.projection);
        this.map.addLayer(layer3d);
        this.map.insertLayerAfter(layer3d, null);
    };
    sync2dLayers = (oldLayers) => {
        this.setState((state) => {
            const newLayers = {...state.layers};
            const layers = [...this.props.layers].reverse();
            layers.forEach((layer) => {
                if (layer.role !== LayerRole.THEME && layer.role !== LayerRole.USERLAYER) {
                    return;
                }
                const layerCreator = LayerRegistry[layer.type];
                if (!layerCreator || !layerCreator.create3d) {
                    return;
                }
                if (layer.name in oldLayers) {
                    layerCreator.update3d(oldLayers[layer.name].layer.source, layer, oldLayers[layer.name].options, this.props.projection);
                    newLayers[layer.name] = {
                        ...newLayers[layer.name],
                        options: layer
                    };
                } else {
                    const layer3d = layerCreator.create3d(layer, this.props.projection);
                    this.map.addLayer(layer3d);
                    newLayers[layer.name] = {
                        layer: layer3d,
                        options: layer
                    };
                }
                newLayers[layer.name].layer.visible = layer.visibility;
                newLayers[layer.name].layer.opacity = layer.opacity / 255;
            });
            Object.keys(oldLayers).forEach(name => {
                if (!(name in newLayers)) {
                    this.map.removeLayer(oldLayers[name].layer);
                }
            });
            // Reorder layers
            let prevLayer = this.map.getLayers(l => l.name === "baselayer")[0] ?? null;
            layers.forEach(layer => {
                if (newLayers[layer.name]) {
                    this.map.insertLayerAfter(newLayers[layer.name].layer, prevLayer);
                    prevLayer = newLayers[layer.name].layer;
                }
            });

            return {layers: newLayers};
        });
    };
    setViewToExtent = (bounds) => {
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
            currentPosition.applyAxisAngle(new Vector3(0, 0, 1), -oldYaw * k);
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
        window.addEventListener("mouseup", () => {
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
        window.addEventListener("mouseup", () => {
            this.animationInterrupted = true;
        }, {once: true});
    };
    stopAnimations = () => {
        this.animationInterrupted = true;
    };
    getScenePosition = (ev) => {
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
    updateControlsTarget = () => {
        const x = this.instance.view.controls.target.x;
        const y = this.instance.view.controls.target.y;
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
