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
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import GeoTIFFSource from "@giro3d/giro3d/sources/GeoTIFFSource.js";
import PropTypes from 'prop-types';
import {Vector2, Raycaster} from 'three';
import {MapControls} from 'three/examples/jsm/controls/MapControls.js';

import {setCurrentTask} from '../actions/task';
import ResizeableWindow from '../components/ResizeableWindow';
import LayerRegistry from '../components/map/layers/index';
import BottomBar from '../components/map3d/BottomBar';
import {BackgroundSwitcher} from '../plugins/BackgroundSwitcher';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';

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
        projection: PropTypes.string,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object,
        themes: PropTypes.object
    };
    static defaultProps = {
        geometry: {
            initialWidth: 480,
            initialHeight: 640,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true
        }
    };
    state = {
        enabled: false,
        baselayer: null,
        cursorPosition: null
    };
    constructor(props) {
        super(props);
        this.container = null;
        this.inspector = null;
        this.instance = null;
        this.map = null;
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
        return [(
            <ResizeableWindow icon="map3d"
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
                <div className="map3d-body" onMouseMove={this.getScenePosition} ref={this.setupContainer} role="body">
                    <BackgroundSwitcher bottombarHeight={10} changeLayerVisibility={this.setBaseLayer} layers={baseLayers} />
                    <BottomBar cursorPosition={this.state.cursorPosition} instance={this.instance} projection={this.props.projection} />
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
        const source = layerCreator.create3d(layer, this.props.projection);
        this.map.addLayer(new ColorLayer({name: "baselayer", source: source}));
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
    projection: state.map.projection,
    bbox: (state.theme.current || {}).initialBbox,
    layers: state.layers.flat,
    theme: state.theme.current,
    themes: state.theme.themes
}), {
    setCurrentTask: setCurrentTask
})(Map3D);
