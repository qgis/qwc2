/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, addLayerFeatures, addMarker, removeMarker, removeLayer} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import IdentifyViewer from '../components/IdentifyViewer';
import MapSelection from '../components/MapSelection';
import ResizeableWindow from '../components/ResizeableWindow';
import TaskBar from '../components/TaskBar';
import NumberInput from '../components/widgets/NumberInput';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import IdentifyUtils from '../utils/IdentifyUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MeasureUtils from '../utils/MeasureUtils';
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
        /** Whether to clear the identify results when exiting the identify tool. */
        clearResultsOnClose: PropTypes.bool,
        click: PropTypes.object,
        currentIdentifyTool: PropTypes.string,
        currentTask: PropTypes.string,
        /** Optional list of custom exporters to offer along with the built-in exporters. See js/IdentifyExtensions.js for details. This prop can be specified in the appConfig.js cfg section. */
        customExporters: PropTypes.array,
        /** Whether to enable the aggregated report download button. */
        enableAggregatedReports: PropTypes.bool,
        /** Whether to enable the export functionality. Either `true|false` or a list of single allowed formats (builtin formats: `json`, `geojson`, `csv`, `csvzip`, `shapefile`, `xlsx`). If a list is provided, the export formats will be sorted according to that list, and the default format will be the first format of the list. */
        enableExport: PropTypes.oneOfType([PropTypes.bool, PropTypes.array]),
        enabled: PropTypes.bool,
        /** Whether to clear the task when the results window is closed. */
        exitTaskOnResultsClose: PropTypes.bool,
        /** Whether to include the geometry in exported features. Default: `true`. */
        exportGeometry: PropTypes.bool,
        /** Whether to assume that XML GetFeatureInfo responses specify the technical layer name in the `name` attribute, rather than the layer title. */
        featureInfoReturnsLayerName: PropTypes.bool,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        /** Whether to highlight all results if no result is hovered */
        highlightAllResults: PropTypes.bool,
        iframeDialogsInitiallyDocked: PropTypes.bool,
        /** The initial radius units of the identify dialog in radius mode. One of 'm', 'ft', 'km', 'mi'. */
        initialRadiusUnits: PropTypes.string,
        layers: PropTypes.array,
        longAttributesDisplay: PropTypes.string,
        map: PropTypes.object,
        /** Extra params to append to the GetFeatureInfo request (i.e. `FI_POINT_TOLERANCE`, `FI_LINE_TOLERANCE`, `feature_count`, ...). Additionally, `region_feature_count` and `radius_feature_count` are supported. */
        params: PropTypes.object,
        removeLayer: PropTypes.func,
        removeMarker: PropTypes.func,
        /** Whether to replace an attribute value containing an URL to an image with an inline image. */
        replaceImageUrls: PropTypes.bool,
        /** Result display mode, one of `tree`, `flat`, `paginated`. */
        resultDisplayMode: PropTypes.string,
        selection: PropTypes.object,
        setCurrentTask: PropTypes.func,
        /** Whether to show a layer selector to filter the identify results by layer. */
        showLayerSelector: PropTypes.bool,
        startupParams: PropTypes.object,
        theme: PropTypes.object
    };
    static defaultProps = {
        enableAggregatedReports: true,
        enableExport: true,
        exportGeometry: true,
        clearResultsOnClose: true,
        customExporters: [],
        longAttributesDisplay: 'ellipsis',
        resultDisplayMode: 'flat',
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
        initialRadiusUnits: 'm',
        highlightAllResults: true,
        showLayerSelector: true
    };
    state = {
        mode: 'Point',
        identifyResults: null,
        pendingRequests: 0,
        radius: 0,
        radiusUnits: this.props.initialRadiusUnits,
        exitTaskOnResultsClose: null,
        filterGeom: null,
        filterGeomModifiers: {}
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.props.enabled && this.props.theme && !prevProps.theme) {
            const startupParams = this.props.startupParams;
            const haveIc = ["1", "true"].includes((startupParams.ic || "").toLowerCase());
            const c = (startupParams.c || "").split(/[;,]/g).map(x => parseFloat(x) || 0);
            if (haveIc && c.length === 2) {
                const mapCrs = this.props.theme.mapCrs;
                this.identifyPoint(CoordinatesUtils.reproject(c, startupParams.crs || mapCrs, mapCrs));
            }
        } else if (this.props.theme !== prevProps.theme) {
            this.clearResults();
        } else if (!this.props.enabled && prevProps.enabled) {
            if (this.props.clearResultsOnClose) {
                this.clearResults();
            }
        }
        if (this.props.enabled) {
            if (this.state.mode === "Point") {
                const clickPoint = this.queryPoint(prevProps);
                this.identifyPoint(clickPoint);
            } else if (this.state.mode === "Region") {
                if (this.state.filterGeom && this.state.filterGeom !== prevState.filterGeom) {
                    this.identifyRegion();
                }
            } else if (this.state.mode === "Radius") {
                if (this.state.filterGeom && this.state.filterGeom !== prevState.filterGeom) {
                    this.setState((state) => ({
                        radius: MeasureUtils.convertLength(state.filterGeom.radius, 'm', state.radiusUnits)
                    }));
                    this.identifyRadius();
                }
            }
        }
    }
    identifyPoint = (clickPoint) => {
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
                            this.parseResult(response, l, request.params.info_format, clickPoint, this.props.click.modifiers.ctrl);
                        }
                    });
                });

                if (!isEmpty(this.props.click.features)) {
                    this.props.click.features.forEach((feature) => {
                        const layer = this.props.layers.find(l => l.id === feature.layerId);
                        if (layer?.role === LayerRole.USERLAYER) {
                            const queryFeature = {...(layer.features?.find?.(f => f.id === feature.id) ?? feature)};
                            if (!queryFeature?.properties) {
                                return;
                            }
                            if (!identifyResults[layer.name]) {
                                identifyResults[layer.name] = [];
                            }
                            queryFeature.crs = layer.projection ?? this.props.map.projection;
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
        if (this.props.click.button !== 0 || this.props.click === prevProps.click || (this.props.click.features || []).find(feature => feature.id === 'startupposmarker')) {
            return null;
        }
        const searchMarker = (this.props.click.features || []).find(feature => feature.id === 'searchmarker');
        if (searchMarker && searchMarker.geometry.type === "Point") {
            return searchMarker.geometry.coordinates;
        }
        return this.props.click.coordinate;
    };
    identifyRegion = () => {
        const queryableLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
        const poly = this.state.filterGeom.coordinates[0];
        if (poly.length < 3 || isEmpty(queryableLayers)) {
            return;
        }
        const identifyResults = this.state.filterGeomModifiers.ctrl !== true ? {} : this.state.identifyResults;
        const center = [0, 0];
        poly.forEach(point => {
            center[0] += point[0];
            center[1] += point[1];
        });
        center[0] /= poly.length;
        center[1] /= poly.length;

        const filter = VectorLayerUtils.geoJSONGeomToWkt(this.state.filterGeom);
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
    identifyRadius = () => {
        const clickPoint = this.state.filterGeom.center;
        const queryableLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
        if (isEmpty(queryableLayers)) {
            return;
        }
        const identifyResults = this.state.filterGeomModifiers.ctrl !== true ? {} : this.state.identifyResults;
        const filter = VectorLayerUtils.geoJSONGeomToWkt(this.state.filterGeom);
        let pendingRequests = 0;
        const params = {...this.props.params};
        if (this.props.params.radius_feature_count) {
            params.feature_count = this.props.params.radius_feature_count;
            delete params.radius_feature_count;
        }
        queryableLayers.forEach((layer) => {
            const request = IdentifyUtils.buildFilterRequest(layer, layer.queryLayers.join(","), filter, this.props.map, params);
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
    };
    changeBufferUnit = (ev) => {
        this.setState({ radiusUnits: ev.target.value });
    };
    parseResult = (response, layer, format, clickPoint, ctrlPick = false) => {
        const newResults = IdentifyUtils.parseResponse(response, layer, format, clickPoint, this.props.map.projection, this.props.featureInfoReturnsLayerName);
        // Merge with previous
        this.setState((state) => {
            const identifyResults = {...state.identifyResults};
            Object.entries(newResults).forEach(([layername, features]) => {
                const key = layer.url + "#" + layername;
                identifyResults[key] = features.reduce((result, feature) => {
                    const idx = result.findIndex(f => f.id === feature.id);
                    if (idx === -1) {
                        result.push(feature);
                    } else if (ctrlPick === true) {
                        result.splice(idx, 1);
                    }
                    return result;
                }, identifyResults[key] || []);
            });
            return {identifyResults: identifyResults};
        });
    };
    onShow = (mode, data) => {
        this.setState({mode: mode || 'Point', exitTaskOnResultsClose: data?.exitTaskOnResultsClose});
        if (mode === "Point" && data?.pos) {
            this.identifyPoint(data.pos);
        }
    };
    onToolClose = () => {
        this.setState({mode: 'Point', exitTaskOnResultsClose: null, filterGeom: null});
        if (this.props.clearResultsOnClose) {
            this.clearResults();
        }
    };
    onWindowClose = () => {
        this.clearResults();
        if (this.state.exitTaskOnResultsClose || this.props.exitTaskOnResultsClose) {
            this.props.setCurrentTask(null);
        }
    };
    clearResults = () => {
        this.props.removeMarker('identify');
        this.props.removeLayer("identifyslection");
        this.props.removeLayer("identifyradiusbuffer");
        this.setState({identifyResults: null, pendingRequests: 0});
    };
    updateRadius = (radius, units) => {
        this.setState(state => ({
            radius: radius,
            radiusUnits: units,
            filterGeom: {...state.filterGeom, radius: MeasureUtils.convertLength(radius, units, 'm')}}
        ));
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
                        {text}
                    </div>
                    <div className="identify-radius-controls controlgroup">
                        <span>{LocaleUtils.tr("infotool.radius")}:&nbsp;</span>
                        <NumberInput
                            disabled={!this.state.filterGeom} max={1000000} min={1} mobile
                            onChange={rad => this.updateRadius(rad, this.state.radiusUnits)}
                            value={this.state.radius}
                        />
                        <select
                            onChange={ev => this.updateRadius(this.state.radius, ev.target.value)}
                            value={this.state.radiusUnits}
                        >
                            <option value="m">m</option>
                            <option value="ft">ft</option>
                            <option value="km">km</option>
                            <option value="mi">mi</option>
                        </select>
                    </div>
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
                    body = (<div className="identify-body"><span className="identify-body-message">{LocaleUtils.tr("identify.querying")}</span></div>);
                } else {
                    body = (<div className="identify-body"><span className="identify-body-message">{LocaleUtils.tr("identify.noresults")}</span></div>);
                }
            } else {
                body = (
                    <IdentifyViewer
                        attributeCalculator={this.props.attributeCalculator}
                        attributeTransform={this.props.attributeTransform}
                        customExporters={this.props.customExporters}
                        enableAggregatedReports={this.props.enableAggregatedReports}
                        enableCompare
                        enableExport={this.props.enableExport}
                        exportGeometry={this.props.exportGeometry}
                        highlightAllResults={this.props.highlightAllResults}
                        identifyResults={this.state.identifyResults}
                        iframeDialogsInitiallyDocked={this.props.iframeDialogsInitiallyDocked}
                        longAttributesDisplay={this.props.longAttributesDisplay}
                        replaceImageUrls={this.props.replaceImageUrls}
                        resultDisplayMode={this.props.resultDisplayMode}
                        showLayerSelector={this.props.showLayerSelector}
                    />
                );
            }
            resultWindow = (
                <ResizeableWindow busyIcon={this.state.pendingRequests > 0} dockable={this.props.geometry.side} icon="info-sign"
                    initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                    initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                    initiallyDocked={this.props.geometry.initiallyDocked} key="IdentifyWindow"
                    onClose={this.onWindowClose} title={LocaleUtils.tr("identify.title")}
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
        ), (this.state.mode === "Region" || this.state.mode === "Radius") ? (
            <MapSelection
                active geomType={this.state.mode === "Radius" ? "Circle" : "Polygon"}
                geometry={this.state.filterGeom}
                geometryChanged={(geom, mod) => this.setState({filterGeom: geom, filterGeomModifiers: mod})} key="MapSelection"
                measure={this.state.mode === "Radius"}
            />
        ) : null];
    }
}

export default connect((state) => {
    const enabled = state.task.id === "Identify" || (
        state.task.identifyEnabled &&
        ConfigUtils.getConfigProp("identifyTool", state.theme.current, "Identify") === "Identify"
    );
    return {
        click: state.map.click || {modifiers: {}},
        enabled: enabled,
        layers: state.layers.flat,
        map: state.map,
        selection: state.selection,
        theme: state.theme.current,
        startupParams: state.localConfig.startupParams
    };
}, {
    addLayerFeatures: addLayerFeatures,
    addMarker: addMarker,
    removeMarker: removeMarker,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask
})(Identify);
