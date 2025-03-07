/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import * as PanoViewer from '@panoramax/web-viewer';
import axios from 'axios';
import PropTypes from 'prop-types';

import {addLayer, addLayerFeatures, removeLayer, LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import MapSelection from '../components/MapSelection';
import ResizeableWindow from '../components/ResizeableWindow';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import ResourceRegistry from '../utils/ResourceRegistry';

import './style/Panoramax.css';
import '@panoramax/web-viewer/build/index.css';


/**
 * Panoramax Integration for QWC2.
 *
 */
class Panoramax extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        /** Whether or not to load the layer containing the image sequences. */
        loadSequencesTiles: PropTypes.bool,
        /** URL of the Panoramax instance. */
        panoramaxInstance: PropTypes.string,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object,
        /** Mode for the image sequences layer: either WMS (Require a custom URL) or MVT(EPSG:3857 only). */
        tileMode: PropTypes.string,
        /** URL of the WMS image sequences layer. */
        wmsUrl: PropTypes.string
    };
    static defaultProps = {
        geometry: {
            initialWidth: 640,
            initialHeight: 640,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        },
        loadSequencesTiles: true,
        panoramaxInstance: 'api.panoramax.xyz',
        tileMode: 'mvt'
    };
    state = {
        lon: null,
        lat: null,
        queryImage: null,
        selectionActive: false,
        selectionGeom: null,
        yaw: null,
        currentTooltip: ''
    };
    constructor(props) {
        super(props);
        this.viewerRef = React.createRef();
    }
    componentDidUpdate(prevProps, prevState) {
        if (!prevProps.active && this.props.active) {
            this.setState({selectionActive: true});
            if (this.props.loadSequencesTiles) {
                if (this.props.tileMode === "wms" && this.props.wmsUrl) {
                    this.addRecordingsWMS();
                } else {
                    this.addRecordingsMVT();
                }
            }
        } else if ( this.state.selectionGeom &&
            this.state.selectionGeom !== prevState.selectionGeom) {
            this.queryPoint(this.state.selectionGeom);
        } else if (this.state.queryImage && !this.viewer && this.state.selectionGeom) {
            this.initializeViewer(this.state.queryImage);
        } else if (this.viewer && this.state.queryImage !== prevState.queryImage) {
            this.viewer.select(null, this.state.queryImage, true);
        }
    }
    componentWillUnmount() {
        this.onClose();
    }
    onClose = () => {
        this.props.setCurrentTask(null);
        this.props.removeLayer('panoramax-recordings');
        this.props.removeLayer('panoramaxselection');
        this.setState({selectionGeom: null, queryImage: null, lon: null, lat: null, selectionActive: null, yaw: null, currentTooltip: ''});
        if (this.viewer) {
            this.viewer.stopSequence();
            this.viewer.destroy();
            delete this.viewer;
        }
        ResourceRegistry.removeResource('selected');
    };
    render() {
        if (!this.props.active) {
            return null;
        }
        const { selectionGeom, queryImage } = this.state;
        return (
            <>
                {selectionGeom && (
                    <ResizeableWindow
                        dockable={this.props.geometry.side}
                        icon="Panoramax"
                        initialHeight={this.props.geometry.initialHeight}
                        initialWidth={this.props.geometry.initialWidth}
                        initialX={this.props.geometry.initialX}
                        initialY={this.props.geometry.initialY}
                        initiallyDocked={this.props.geometry.initiallyDocked}
                        onClose={this.onClose}
                        splitScreenWhenDocked
                        title={LocaleUtils.tr("panoramax.title")}
                    >
                        <div className="panoramax-body" role="body">
                            {!queryImage && !this.viewer ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center' }}>
                                    <p>{LocaleUtils.tr("panoramax.notfound")}</p>
                                </div>
                            ) : (
                                <div id="viewer" ref={this.viewerRef} style={{ height: '100%' }} />
                            )}
                        </div>
                    </ResizeableWindow>
                )}
                <MapSelection
                    active={this.state.selectionActive}
                    cursor={`url("${ConfigUtils.getAssetsPath()}/img/target.svg") 1 1, default`}
                    geomType={'Point'}
                    geometry={selectionGeom}
                    geometryChanged={(geom) => this.setState({ selectionGeom: geom })}
                    styleOptions={{ fillColor: [0, 0, 0, 0], strokeColor: [0, 0, 0, 0] }}
                />
            </>
        );
    }
    initializeViewer = (image) => {
        const viewerElement = this.viewerRef.current;
        if (viewerElement) {
            this.viewer = new PanoViewer.Viewer(
                viewerElement,
                `https://${this.props.panoramaxInstance}/api`,
                {
                    map: false,
                    selectedPicture: image
                }
            );
            this.viewer.addEventListener('psv:picture-loading', (event) => {
                this.setState(
                    {
                        lon: event.detail.lon,
                        lat: event.detail.lat
                    },
                    () => this.handlePanoramaxEvent()
                );
            });
            this.viewer.addEventListener('psv:view-rotated', (event) => {
                this.setState(
                    { yaw: event.detail.x },
                    () => this.handlePanoramaxEvent()
                );
            });
            this.viewer.addEventListener('psv:picture-loaded', (event) => {
                this.setState(
                    { yaw: event.detail.x },
                    () => this.handlePanoramaxEvent()
                );
            });
        }
    };
    handlePanoramaxEvent = () => {
        ResourceRegistry.addResource('selected', `${ConfigUtils.getAssetsPath()}/img/panoramax-cursor.svg`);
        const layer = {
            id: "panoramaxselection",
            role: LayerRole.SELECTION
        };
        const feature = {
            geometry: {
                type: 'Point',
                coordinates: [this.state.lon, this.state.lat]
            },
            crs: 'EPSG:4326',
            styleName: 'image',
            styleOptions: {
                img: 'selected',
                rotation: MapUtils.degreesToRadians(this.state.yaw),
                anchor: [0.5, 0.5]
            }
        };
        this.props.addLayerFeatures(layer, [feature], true);
    };
    addRecordingsMVT = () => {
        const resolutions = MapUtils.getResolutionsForScales(this.props.theme.scales, this.props.theme.mapCrs);
        const layer = {
            id: 'panoramax-recordings',
            type: 'mvt',
            projection: this.props.theme.mapCrs,
            tileGridConfig: {
                origin: [0, 0],
                resolutions: resolutions
            },
            style: `https://${this.props.panoramaxInstance}/api/map/style.json`,
            role: LayerRole.USERLAYER
        };
        this.props.addLayer(layer);
    };
    addRecordingsWMS = () => {
        const layer = {
            id: 'panoramax-recordings',
            type: 'wms',
            projection: this.props.theme.mapCrs,
            url: this.props.wmsUrl,
            role: LayerRole.USERLAYER
        };
        this.props.addLayer(layer);
    };
    queryPoint = (props) => {
        const [centerX, centerY] = CoordinatesUtils.reproject(props.coordinates, this.props.theme.mapCrs, 'EPSG:4326');
        const offset = 0.001;
        const bbox = `${centerX - offset},${centerY - offset},${centerX + offset},${centerY + offset}`;
        axios.get(`https://${this.props.panoramaxInstance}/api/search?bbox=${bbox}`)
            .then(response => {

                this.setState({ queryImage: response.data.features[0].id });
            })
            .catch(() => {
                this.setState({ queryImage: null });
            });
    };
}

export default connect((state) => ({
    active: state.task.id === "Panoramax",
    click: state.map.click,
    mapScale: MapUtils.computeForZoom(state.map.scales, state.map.zoom),
    theme: state.theme.current
}), {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask
})(Panoramax);
