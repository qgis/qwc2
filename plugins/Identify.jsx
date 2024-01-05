/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import NumericInput from "react-numeric-input2";
import buffer from "@turf/buffer";
import { point as turfpoint } from "@turf/helpers";
import {LayerRole, addLayerFeatures, addMarker, removeMarker, removeLayer} from '../actions/layers';
import {changeSelectionState} from '../actions/selection';
import {setCurrentTask} from '../actions/task';
import IdentifyViewer from '../components/IdentifyViewer';
import ResizeableWindow from '../components/ResizeableWindow';
import TaskBar from '../components/TaskBar';
import IdentifyUtils from '../utils/IdentifyUtils';
import LocaleUtils from '../utils/LocaleUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/Identify.css';


/**
 * Displays queried feature attributes.
 *
 * Uses WMS GetFeatureInfo to query features and displays the result in
 * table, as a HTML fragment or as plain text based on the supported GetFeatureInfo
 * format.
 *
 * Extendable in combination with the `qwc-feature-info-service`, which provides support
 * for customized queries and templates for the result presentation.
 */
class Identify extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        addMarker: PropTypes.func,
        /** Optional function for computing derived attributes. See js/IdentifyExtensions.js for details. This prop can be specified in the appConfig.js cfg section. */
        attributeCalculator: PropTypes.func,
        /** Optional function for transforming attribute values. See js/IdentifyExtensions.js for details. This prop can be specified in the appConfig.js cfg section. */
        attributeTransform: PropTypes.func,
        changeSelectionState: PropTypes.func,
        /** Whether to clear the identify results when exiting the identify tool. */
        clearResultsOnClose: PropTypes.bool,
        click: PropTypes.object,
        currentIdentifyTool: PropTypes.string,
        currentTask: PropTypes.string,
        /** Optional list of custom exporters to offer along with the built-in exporters. See js/IdentifyExtensions.js for details. This prop can be specified in the appConfig.js cfg section. */
        customExporters: PropTypes.array,
        /** Whether to display a tree overview of results (as opposed to a flat list of results). */
        displayResultTree: PropTypes.bool,
        /** Whether to enable the export functionality. Either `true|false` or a list of single allowed formats (builtin formats: `json`, `geojson`, `csv`, `csvzip`) */
        enableExport: PropTypes.oneOfType([PropTypes.bool, PropTypes.array]),
        /** Whether to clear the task when the results window is closed. */
        exitTaskOnResultsClose: PropTypes.bool,
        /** Whether to include the geometry in exported features. Default: `true`. */
        exportGeometry: PropTypes.bool,
        /** Whether to assume that XML GetFeatureInfo responses specify the technical layer name in the `name` attribute, rather than the layer title. */
        featureInfoReturnsLayerName: PropTypes.bool,
        /** Default window geometry with size, position and docking status. Positive position values are related to top (InitialY) and left (InitialX), negative values to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        iframeDialogsInitiallyDocked: PropTypes.bool,
        /** The initial radius of the identify dialog in radius mode. */
        initialRadius: PropTypes.number,
        /** The initial radius units of the identify dialog in radius mode. One of 'meters', 'feet', 'kilometers', 'miles'. */
        initialRadiusUnits: PropTypes.string,
        layers: PropTypes.array,
        longAttributesDisplay: PropTypes.string,
        map: PropTypes.object,
        params: PropTypes.object,
        removeLayer: PropTypes.func,
        removeMarker: PropTypes.func,
        /** Whether to replace an attribute value containing an URL to an image with an inline image. */
        replaceImageUrls: PropTypes.bool,
        selection: PropTypes.object,
        setCurrentTask: PropTypes.func
    };
    static defaultProps = {
        enableExport: true,
        exportGeometry: true,
        clearResultsOnClose: true,
        customExporters: [],
        longAttributesDisplay: 'ellipsis',
        displayResultTree: true,
        replaceImageUrls: true,
        featureInfoReturnsLayerName: true,
        geometry: {
            initialWidth: 240,
            initialHeight: 320,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        },
        initialRadius: 50,
        initialRadiusUnits: 'meters'
    };
    state = {
        mode: 'Point',
        identifyResults: null,
        pendingRequests: 0,
        radius: this.props.initialRadius,
        radiusUnits: this.props.initialRadiusUnits
    };
    componentDidUpdate(prevProps) {
        if (this.props.currentIdentifyTool !== prevProps.currentIdentifyTool && prevProps.currentIdentifyTool === "Identify") {
            this.clearResults();
        }
        if (this.props.currentIdentifyTool === "Identify" || this.props.currentTask === "Identify") {
            if (this.state.mode === "Point") {
                this.identifyPoint(prevProps);
            } else if (this.state.mode === "Region") {
                this.identifyRegion(prevProps);
            } else if (this.state.mode === "Radius") {
                this.identifyRadius(prevProps);
            }
        }
    }
    identifyPoint = (prevProps) => {
        const clickPoint = this.queryPoint(prevProps);
        if (clickPoint) {
            this.setState((state) => {
                // Remove any search selection layer to avoid confusion
                this.props.removeLayer("searchselection");
                let pendingRequests = 0;
                const identifyResults = this.props.click.modifiers.ctrl !== true ? {} : state.identifyResults;

                let queryableLayers = [];
                queryableLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
                queryableLayers.forEach(l => {
                    const request = IdentifyUtils.buildRequest(l, l.queryLayers.join(","), clickPoint, this.props.map, this.props.params);
                    ++pendingRequests;
                    IdentifyUtils.sendRequest(request, (response) => {
                        this.setState((state2) => ({pendingRequests: state2.pendingRequests - 1}));
                        if (response) {
                            this.parseResult(response, l, request.params.info_format, clickPoint);
                        }
                    });
                });

                if (!isEmpty(this.props.click.features)) {
                    this.props.click.features.forEach((feature) => {
                        const layer = this.props.layers.find(l => l.id === feature.layerId);
                        if (layer && layer.role === LayerRole.USERLAYER && !isEmpty(feature.properties)) {
                            if (!identifyResults[layer.name]) {
                                identifyResults[layer.name] = [];
                            }
                            const queryFeature = {...feature};
                            queryFeature.displayname = queryFeature.properties.name || queryFeature.properties.Name || queryFeature.properties.NAME || queryFeature.properties.label || queryFeature.properties.id || queryFeature.id;
                            queryFeature.layertitle = layer.title || layer.name || layer.id;
                            queryFeature.properties = Object.entries(queryFeature.properties).reduce((res, [key, val]) => ({
                                ...res, [key]: typeof val === "object" ? JSON.stringify(val) : val
                            }), {});
                            identifyResults[layer.name].push(queryFeature);
                        }
                    });
                }
                this.props.addMarker('identify', clickPoint, '', this.props.map.projection);
                return {identifyResults: identifyResults, pendingRequests: pendingRequests};
            });
        }
    };
    queryPoint = (prevProps) => {
        if (this.props.click.button !== 0 || this.props.click === prevProps.click || (this.props.click.features || []).find(entry => entry.feature === 'startupposmarker')) {
            return null;
        }
        const searchMarker = (this.props.click.features || []).find(feature => feature.id === 'searchmarker');
        if (searchMarker) {
            return searchMarker.geometry.coordinates;
        }
        return this.props.click.coordinate;
    };
    identifyRegion = (prevProps) => {
        if (!this.props.selection.polygon || this.props.selection === prevProps.selection) {
            return;
        }
        const poly = this.props.selection.polygon;
        const queryableLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
        if (poly.length < 1 || isEmpty(queryableLayers)) {
            return;
        }
        const identifyResults = this.props.click.modifiers.ctrl !== true ? {} : this.state.identifyResults;
        this.props.changeSelectionState({reset: true});
        const geometry = {
            type: "Polygon",
            coordinates: [poly]
        };
        const center = [0, 0];
        poly.forEach(point => {
            center[0] += point[0];
            center[1] += point[1];
        });
        center[0] /= poly.length;
        center[1] /= poly.length;

        const filter = VectorLayerUtils.geoJSONGeomToWkt(geometry);
        let pendingRequests = 0;
        const params = {...this.props.params};
        if (this.props.params.region_feature_count) {
            params.feature_count = this.props.params.region_feature_count;
            delete params.region_feature_count;
        }
        queryableLayers.forEach(layer => {
            const request = IdentifyUtils.buildFilterRequest(layer, layer.queryLayers.join(","), filter, this.props.map, params);
            ++pendingRequests;
            IdentifyUtils.sendRequest(request, (response) => {
                this.setState((state) => ({pendingRequests: state.pendingRequests - 1}));
                if (response) {
                    this.parseResult(response, layer, request.params.info_format, center);
                }
            });
            this.setState({identifyResults: identifyResults, pendingRequests: pendingRequests});
        });
    };
    identifyRadius = (prevProps) => {
        if (!this.props.selection.point || this.props.selection.point === prevProps.selection.point) {
            return;
        }
        const clickPoint = this.props.selection.point;
        if (clickPoint) {
            const circle = this.computeBuffer(clickPoint);
            const queryableLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
            if (isEmpty(queryableLayers)) {
                return;
            }
            const poly = circle.geometry.coordinates[0];
            const identifyResults = this.props.click.modifiers.ctrl !== true ? {} : this.state.identifyResults;
            this.props.changeSelectionState({ reset: true });
            const geometry = {
                type: "Polygon",
                coordinates: [poly]
            };

            const filter = VectorLayerUtils.geoJSONGeomToWkt(geometry);
            let pendingRequests = 0;
            queryableLayers.forEach((layer) => {
                const request = IdentifyUtils.buildFilterRequest(layer, layer.queryLayers.join(","), filter, this.props.map, this.props.params);
                ++pendingRequests;
                IdentifyUtils.sendRequest(request, (response) => {
                    this.setState((state) => ({pendingRequests: state.pendingRequests - 1}));
                    if (response) {
                        this.parseResult(response, layer, request.params.info_format, clickPoint);
                    }
                });
                this.setState({identifyResults: identifyResults, pendingRequests: pendingRequests});
            });
            this.props.addMarker("identify", clickPoint, "", this.props.map.projection);
        }
    };
    changeBufferUnit = (ev) => {
        this.setState({ radiusUnits: ev.target.value });
    };
    computeBuffer = (point) => {
        const layer = {
            id: "identifyradiusbuffer",
            role: LayerRole.SELECTION
        };
        const feature = turfpoint(point);
        const wgsGeometry = VectorLayerUtils.reprojectGeometry(feature.geometry, this.props.map.projection, "EPSG:4326");
        const wgsFeature = { ...feature, geometry: wgsGeometry };
        const output = buffer(wgsFeature, this.state.radius, {units: this.state.radiusUnits});
        if (output && output.geometry) {
            output.geometry = VectorLayerUtils.reprojectGeometry(output.geometry, "EPSG:4326", this.props.map.projection);
            output.id = "buffer";
            output.styleName = "default";
            output.styleOptions = {
                fillColor: [255, 0, 0, 0.15],
                strokeColor: [255, 0, 0, 1]
            };
            this.props.addLayerFeatures(layer, [output]);
        }
        return output;
    };
    parseResult = (response, layer, format, clickPoint) => {
        const newResults = IdentifyUtils.parseResponse(response, layer, format, clickPoint, this.props.map.projection, this.props.featureInfoReturnsLayerName, this.props.layers);
        // Merge with previous
        this.setState((state) => {
            const identifyResults = { ...state.identifyResults };
            Object.keys(newResults).forEach((layername) => {
                let existingFeatures = identifyResults[layername] || [];
                newResults[layername].forEach((newFeature) => {
                    const featureIndex = existingFeatures.findIndex((feature) => feature.id === newFeature.id);
                    if (featureIndex !== -1) {
                        existingFeatures.splice(featureIndex, 1);
                    } else {
                        existingFeatures.push(newFeature);
                    }
                });
                identifyResults[layername] = existingFeatures;
            });
            return {identifyResults: identifyResults};
        });
    };
    onShow = (mode) => {
        this.setState({mode: mode || 'Point'});
        if (mode === "Region") {
            this.props.changeSelectionState({geomType: 'Polygon'});
        }
        if (mode === "Radius") {
            this.props.changeSelectionState({geomType: 'Point'});
        }
    };
    onToolClose = () => {
        this.props.changeSelectionState({geomType: undefined});
        this.setState({mode: 'Point'});
        if (this.props.clearResultsOnClose) {
            this.clearResults();
        }
    };
    onWindowClose = () => {
        this.clearResults();
        if (this.props.exitTaskOnResultsClose) {
            this.props.setCurrentTask(null);
        }
    };
    clearResults = () => {
        this.props.removeMarker('identify');
        this.props.removeLayer("identifyslection");
        this.props.removeLayer("identifyradiusbuffer");
        this.setState({identifyResults: null, pendingRequests: 0});
    };
    renderRadiusContent = () => {
        return (
            <div className="identify-radius-controls">
                <span>
                    <span>{LocaleUtils.tr("infotool.radius")} &nbsp;</span>
                    <NumericInput
                        max={10000}
                        min={1}
                        mobile
                        onChange={(nr) => this.setState({ radius: nr })}
                        precision={0}
                        step={10}
                        strict
                        value={this.state.radius}
                    />
                    <select
                        onChange={this.changeBufferUnit}
                        value={this.state.radiusUnits}
                    >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                        <option value="kilometers">km</option>
                        <option value="miles">mi</option>
                    </select>
                </span>
            </div>
        );
    };
    renderBody = () => {
        if (this.state.mode === "Point") {
            return LocaleUtils.tr("infotool.clickhelpPoint");
        } else if (this.state.mode === "Region") {
            return LocaleUtils.tr("infotool.clickhelpPolygon");
        } else if (this.state.mode === "Radius") {
            const text = LocaleUtils.tr("infotool.clickhelpRadius");
            return (
                <div>
                    <div>
                        <span>{text}</span>
                    </div>
                    {this.renderRadiusContent()}
                </div>
            );
        }
        return null;
    };
    render() {
        let resultWindow = null;
        if (this.state.pendingRequests > 0 || this.state.identifyResults !== null) {
            let body = null;
            if (isEmpty(this.state.identifyResults)) {
                if (this.state.pendingRequests > 0) {
                    body = (<div className="identify-body" role="body"><span className="identify-body-message">{LocaleUtils.tr("identify.querying")}</span></div>);
                } else {
                    body = (<div className="identify-body" role="body"><span className="identify-body-message">{LocaleUtils.tr("identify.noresults")}</span></div>);
                }
            } else {
                body = (
                    <IdentifyViewer
                        attributeCalculator={this.props.attributeCalculator}
                        attributeTransform={this.props.attributeTransform}
                        customExporters={this.props.customExporters}
                        displayResultTree={this.props.displayResultTree}
                        enableExport={this.props.enableExport}
                        identifyResults={this.state.identifyResults}
                        iframeDialogsInitiallyDocked={this.props.iframeDialogsInitiallyDocked}
                        longAttributesDisplay={this.props.longAttributesDisplay}
                        replaceImageUrls={this.props.replaceImageUrls}
                        role="body" />
                );
            }
            resultWindow = (
                <ResizeableWindow dockable={this.props.geometry.side} icon="info-sign"
                    initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                    initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                    initiallyDocked={this.props.geometry.initiallyDocked} key="IdentifyWindow"
                    onClose={this.onWindowClose} title={LocaleUtils.trmsg("identify.title")}
                    >
                    {body}
                </ResizeableWindow>
            );
        }
        return [resultWindow, (
            <TaskBar key="IdentifyTaskBar" onHide={this.onToolClose} onShow={this.onShow} task="Identify">
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        )];
    }
}

const selector = (state) => ({
    click: state.map.click || {modifiers: {}},
    currentTask: state.task.id,
    currentIdentifyTool: state.identify.tool,
    layers: state.layers.flat,
    map: state.map,
    selection: state.selection
});

export default connect(selector, {
    addLayerFeatures: addLayerFeatures,
    addMarker: addMarker,
    changeSelectionState: changeSelectionState,
    removeMarker: removeMarker,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask
})(Identify);
