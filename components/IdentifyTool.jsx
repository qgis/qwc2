/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import {featureCollection} from '@turf/helpers';
import intersect from '@turf/intersect';
import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole, addLayer, addLayerFeatures, addMarker, removeMarker, removeLayer} from '../actions/layers';
import {zoomToExtent, zoomToPoint} from '../actions/map';
import {setCurrentTask} from '../actions/task';
import IdentifyViewer from '../components/IdentifyViewer';
import MapSelection from '../components/MapSelection';
import ResizeableWindow from '../components/ResizeableWindow';
import TaskBar from '../components/TaskBar';
import ButtonBar from '../components/widgets/ButtonBar';
import MenuButton from '../components/widgets/MenuButton';
import NumberInput from '../components/widgets/NumberInput';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import DataServiceExprUtils from '../utils/DataServiceExprUtils';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MeasureUtils from '../utils/MeasureUtils';
import {registerPermalinkDataStoreHook, unregisterPermalinkDataStoreHook} from '../utils/PermaLinkUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/IdentifyTool.css';


class IdentifyTool extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        addMarker: PropTypes.func,
        /** Whether to append results by default (without having to press `CTRL` when clicking). */
        appendResultsByDefault: PropTypes.bool,
        /** Available region identify modes. */
        availableRegionModes: PropTypes.arrayOf(PropTypes.string),
        /** Whether to clear the identify results when exiting the identify tool. */
        clearResultsOnClose: PropTypes.bool,
        click: PropTypes.object,
        currentSearchResult: PropTypes.object,
        /** Whether to enable the aggregated report download button. */
        enableAggregatedReports: PropTypes.bool,
        /** Whether to enable the possibility select results for comparison. */
        enableCompare: PropTypes.bool,
        /** Whether to enable the export functionality. Either `true|false` or a list of single allowed formats (builtin formats: `json`, `geojson`, `csv`, `csvzip`, `shapefile`, `xlsx`). If a list is provided, the export formats will be sorted according to that list, and the default format will be the first format of the list. */
        enableExport: PropTypes.oneOfType([PropTypes.bool, PropTypes.array]),
        enabled: PropTypes.bool,
        /** Whether to clear the task when the results window is closed. */
        exitTaskOnResultsClose: PropTypes.bool,
        /** Whether to include the geometry in exported features. Default: `true`. */
        exportGeometry: PropTypes.bool,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string,
            minimizeable: PropTypes.bool
        }),
        /** Whether to highlight all results if no result is hovered. */
        highlightAllResults: PropTypes.bool,
        /** Whether to trigger an identify when selecting a search result. */
        identifySearchResults: PropTypes.bool,
        iframeDialogsInitiallyDocked: PropTypes.bool,
        /** The initial radius units of the identify dialog in radius mode. One of 'm', 'ft', 'km', 'mi'. */
        initialRadiusUnits: PropTypes.string,
        layerFilter: PropTypes.object,
        layers: PropTypes.array,
        /** How to handle long attribute names / values. */
        longAttributesDisplay: PropTypes.oneOf(["wrap", "ellipsis"]),
        map: PropTypes.object,
        /** Whether to only show the results dialog if there are results to display. */
        onlyShowDialogWithResults: PropTypes.bool,
        /** Extra params to append to the GetFeatureInfo request (i.e. `FI_POINT_TOLERANCE`, `FI_LINE_TOLERANCE`, `feature_count`, ...). Additionally, `region_feature_count` is supported. */
        params: PropTypes.object,
        removeLayer: PropTypes.func,
        removeMarker: PropTypes.func,
        /** Whether to replace an attribute value containing an URL to an image with an inline image. */
        replaceImageUrls: PropTypes.bool,
        /** Result display mode. */
        resultDisplayMode: PropTypes.oneOf(["tree", "flat", "paginated", "table"]),
        /** Target cell size of the result grid in comparison mode. */
        resultGridSize: PropTypes.number,
        /** Whether multi-display mode should be enabled by default, only relevant if `resultDisplayMode` is `paginated`. */
        resultMultiDisplay: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        setToolRef: PropTypes.func,
        /** Whether to show a layer selector to filter the identify results by layer. */
        showLayerSelector: PropTypes.bool,
        /** Whether to prefix the identify result titles with the respecitve layer name. */
        showLayerTitles: PropTypes.bool,
        /** Whether to skip empty feature attributes. */
        skipEmptyFeatureAttributes: PropTypes.bool,
        startupParams: PropTypes.object,
        startupState: PropTypes.object,
        task: PropTypes.object,
        taskId: PropTypes.string,
        theme: PropTypes.object,
        toolIcon: PropTypes.string,
        toolTitle: PropTypes.string,
        zoomToExtent: PropTypes.func,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        setToolRef: () => {}
    };
    state = {
        mode: 'Point',
        identifyResults: null,
        pendingRequests: [],
        radius: 10,
        radiusUnits: this.props.initialRadiusUnits,
        filterGeom: null,
        filterGeomModifiers: {}
    };
    constructor(props) {
        super(props);
        this.fileinput = document.createElement("input");
        this.fileinput.type = "file";
        this.fileinput.accept = "application/json";
        this.fileinput.addEventListener("change", this.fileSelected);
        this.viewerRef = null;
        this.pendingIdentifyFilter = null;
        this.permalinkStateKey = this.props.taskId.toLowerCase() + "resultstate";
        registerPermalinkDataStoreHook(this.permalinkStateKey, this.storeIdentifyResults);
        props.setToolRef(this);
    }
    componentWillUnmount() {
        unregisterPermalinkDataStoreHook(this.permalinkStateKey);
        this.props.setToolRef(null);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme && !prevProps.theme) {
            if (this.props.startupState[this.permalinkStateKey]) {
                this.deserializeResults(
                    {...this.props.startupState[this.permalinkStateKey].identifyResults}
                );
            }
        } else if (this.props.theme !== prevProps.theme) {
            this.clearResults();
        } else if (this.props.enabled) {
            if (this.props.currentSearchResult && this.props.currentSearchResult !== prevProps.currentSearchResult) {
                const res = this.props.currentSearchResult;
                this.identifyPoint(CoordinatesUtils.reproject([res.x, res.y], res.crs, this.props.map.projection));
            } else if (this.state.mode === "Point") {
                const queryPoint = this.queryPoint(prevProps);
                if (queryPoint) {
                    this.identifyPoint(queryPoint);
                }
            } else if (["Region", "Rectangle", "Circle"].includes(this.state.mode)) {
                if (this.state.filterGeom && this.state.filterGeom !== prevState.filterGeom) {
                    const center = [0, 0];
                    this.state.filterGeom.coordinates[0].forEach(p => {
                        center[0] += p[0];
                        center[1] += p[1];
                    });
                    center[0] /= this.state.filterGeom.coordinates[0].length;
                    center[1] /= this.state.filterGeom.coordinates[0].length;
                    this.identifyRegion(this.state.filterGeom, center);
                }
            } else if (this.state.mode === "Radius") {
                const center = this.queryPoint(prevProps);
                if (center) {
                    const radius = MeasureUtils.convertLength(this.state.radius, this.state.radiusUnits, CoordinatesUtils.getUnits(this.props.map.projection));
                    const deg2rad = Math.PI / 180;
                    const filterGeom = {type: "Polygon", coordinates: [
                        Array.apply(null, Array(91)).map((item, index) => ([center[0] + radius * Math.cos(4 * index * deg2rad), center[1] + radius * Math.sin(4 * index * deg2rad)]))
                    ]};
                    this.setState({filterGeom, filterGeomModifiers: {ctrl: this.props.click.modifiers.ctrl}});
                    this.identifyRegion(filterGeom, center);
                }
            }
        } else if (prevProps.enabled && this.props.clearResultsOnClose) {
            this.clearResults();
        }
    }
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
    identifyPoint = (clickPoint) => {
        this.props.addMarker('identify', clickPoint, '', this.props.map.projection);
        this.setState((state) => {
            // Remove any search selection layer to avoid confusion
            this.props.removeLayer("searchselection");
            const pendingRequests = [];
            const identifyResults = (this.props.click.modifiers.ctrl || this.props.appendResultsByDefault) ? (state.identifyResults ?? {}) : {};

            let queryableLayers = [];
            queryableLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
            queryableLayers.forEach(l => {
                const request = IdentifyUtils.buildRequest(l, l.queryLayers.join(","), clickPoint, this.props.map, this.props.params);
                pendingRequests.push(request.id);
                IdentifyUtils.sendRequest(request, (response) => {
                    this.handleResponse(request.id, response, l, request.params.info_format, clickPoint, this.props.click.modifiers.ctrl);
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
            return {identifyResults: identifyResults, pendingRequests: pendingRequests};
        });
    };
    identifyRegion = (filterGeom, center) => {
        this.props.removeMarker('identify');
        const queryableLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
        const poly = filterGeom.coordinates[0];
        if (poly.length < 3) {
            return;
        }

        const pendingRequests = [];
        const requestFilterGeom = this.getRequestFilterGeomWkt(filterGeom);
        // Querying without the filter geometry would match the whole layer
        if (!requestFilterGeom) {
            return;
        }
        queryableLayers.forEach(layer => {
            const request = IdentifyUtils.buildFilterRequest(layer, layer.queryLayers.join(","), requestFilterGeom, this.props.map, this.props.params);
            pendingRequests.push(request.id);
            IdentifyUtils.sendRequest(request, (response) => {
                this.handleResponse(request.id, response, layer, request.params.info_format, center);
                pendingRequests.splice(pendingRequests.indexOf(request.id), 1);
                if (pendingRequests.length === 0) {
                    this.setState({filterGeom: null, filterGeomModifiers: {}});
                }
            });
        });
        this.setState(state => {
            const identifyResults = (state.filterGeomModifiers.ctrl || this.props.appendResultsByDefault) ? (state.identifyResults ?? {}) : {};
            return {identifyResults: identifyResults, pendingRequests: [...pendingRequests]};
        });
    };
    identifyFeaturesFilter = (identifyFilter) => {
        const layerEntries = IdentifyUtils.parseIdentifyFilter(identifyFilter, this.props.layers, this.props.map);
        let pendingRequests = [];
        const bboxes = [];
        layerEntries.forEach(({layer, entries}) => {
            // Start from the filters currently active on the layer, so that no feature
            // which the map filter hides is identified
            const filterParams = {...this.props.layerFilter?.filterParams};
            entries.forEach(entry => {
                const key = layer.wms_name + "#" + entry.sublayer;
                filterParams[key] = DataServiceExprUtils.joinExpressions(filterParams[key], entry.expr);
            });
            // buildWMSLayerParams merges in the layer permission filter
            const wmsParams = LayerUtils.buildWMSLayerParams(layer, {filterParams: filterParams, filterGeom: this.props.layerFilter?.filterGeom}).params;
            if (!wmsParams.FILTER) {
                /* eslint-disable-next-line */
                console.warn("Cannot build an identify filter for layer: " + layer.name);
                return;
            }
            const queryLayers = [...new Set(entries.map(entry => entry.sublayer))].join(",");
            const request = IdentifyUtils.buildFilterRequest(layer, queryLayers, wmsParams.FILTER_GEOM, this.props.map, {...this.props.params, filter: wmsParams.FILTER});
            pendingRequests.push(request.id);
            IdentifyUtils.sendRequest(request, (response) => {
                const results = this.handleResponse(request.id, response, layer, request.params.info_format, null);
                pendingRequests = pendingRequests.filter(x => x !== request.id);
                // No click position, use the feature center
                Object.values(results).flat().forEach(feature => {
                    if (feature.bbox) {
                        bboxes.push(feature.bbox);
                        feature.clickPos = [0.5 * (feature.bbox[0] + feature.bbox[2]), 0.5 * (feature.bbox[1] + feature.bbox[3])];
                    } else {
                        feature.clickPos = this.props.map.center;
                    }
                });
                if (pendingRequests.length === 0 && !isEmpty(bboxes)) {
                    const extent = bboxes.reduce((res, bbox) => ([
                        Math.min(res[0], bbox[0]), Math.min(res[1], bbox[1]),
                        Math.max(res[2], bbox[2]), Math.max(res[3], bbox[3])
                    ]));
                    if (extent[0] !== extent[2] || extent[1] !== extent[3]) {
                        this.props.zoomToExtent(extent, this.props.map.projection);
                    } else {
                        // Degenerate extent (single point feature)
                        const zoom = MapUtils.computeZoom(this.props.map.scales, this.props.theme.minSearchScaleDenom || 1000);
                        this.props.zoomToPoint([extent[0], extent[1]], zoom, this.props.map.projection);
                    }
                }
            });
        });
        this.setState({identifyResults: {}, pendingRequests: pendingRequests});
    };
    getRequestFilterGeomWkt = (identifyGeom) => {
        const sourceFilterGeom = this.props.layerFilter?.filterGeom;
        if (!sourceFilterGeom) return VectorLayerUtils.geoJSONGeomToWkt(identifyGeom);
        try {
            const intersection = intersect(featureCollection([
                {type: "Feature", properties: {}, geometry: identifyGeom},
                {type: "Feature", properties: {}, geometry: sourceFilterGeom}
            ]));
            return intersection?.geometry ? VectorLayerUtils.geoJSONGeomToWkt(intersection.geometry) : null;
        } catch {
            return VectorLayerUtils.geoJSONGeomToWkt(identifyGeom);
        }
    };
    handleResponse = (reqId, response, layer, format, clickPoint, ctrlPick = false) => {
        if (!this.state.pendingRequests.includes(reqId)) {
            return {};
        }
        const newResults = IdentifyUtils.parseResponse(response, layer, format, clickPoint, this.props.map.projection);
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
            return {
                identifyResults: identifyResults,
                pendingRequests: state.pendingRequests.filter(x => x !== reqId)
            };
        });
        return newResults;
    };
    onShow = (mode, data) => {
        this.setState({mode: mode || 'Point'});
        if (mode === "Point" && data?.pos) {
            this.identifyPoint(data.pos);
        }
    };
    onToolClose = () => {
        this.setState({mode: 'Point', filterGeom: null});
        if (this.props.clearResultsOnClose) {
            this.clearResults();
        }
    };
    onWindowClose = () => {
        this.clearResults();
        if (this.props.task.id === this.props.taskId && (this.props.task.data?.exitTaskOnResultsClose || this.props.exitTaskOnResultsClose)) {
            this.props.setCurrentTask(null);
        }
    };
    clearResults = () => {
        this.props.removeMarker('identify');
        this.setState({identifyResults: null, pendingRequests: [], filterGeom: null, filterGeomModifiers: {}});
    };
    updateRadius = (radius, units) => {
        this.setState(state => ({
            radius: radius,
            radiusUnits: units,
            filterGeom: {...state.filterGeom, radius: MeasureUtils.convertLength(radius, units, 'm')}}
        ));
    };
    switchMode = (key) => {
        if (key === "Clear") {
            this.clearResults();
        } else {
            this.setState({mode: key});
        }
    };
    export = () => {
        if (this.viewerRef) {
            const results = this.viewerRef.serializeResults();
            const data = JSON.stringify(results, null, ' ');
            FileSaver.saveAs(new Blob([data], {type: 'application/json'}), 'results.json');
        }
    };
    import = () => {
        this.fileinput.click();
    };
    fileSelected = (ev) => {
        const reader = new FileReader();
        reader.readAsText(ev.target.files[0]);
        reader.onload = () => {
            try {
                this.deserializeResults(JSON.parse(reader.result));
            } catch {
                /* eslint-disable-next-line no-alert */
                alert(LocaleUtils.tr("common.dataloadfailed"));
            }
        };
    };
    storeIdentifyResults = () => {
        return new Promise((resolve) => resolve(this.viewerRef ? {
            state: {identifyResults: this.viewerRef.serializeResults()}
        } : {}));
    };
    deserializeResults = (identifyResults) => {
        const pendingRequests = [];
        const importErrors = {};
        if (Array.isArray(identifyResults) || identifyResults === null) {
            identifyResults = {};
        }
        const displayErrorsIfDone = (finishedRequest) => {
            pendingRequests.splice(pendingRequests.indexOf(finishedRequest));
            if (pendingRequests.length === 0 && !isEmpty(importErrors)) {
                const errMsg = Object.entries(importErrors).map(([layerid, errors]) => {
                    const [layerUrl, layerName] = layerid.split("#", 2);
                    const match = LayerUtils.searchLayer(this.props.layers, 'url', layerUrl, 'name', layerName);
                    const layertitle = match?.sublayer?.title ?? layerName;
                    if (errors === true) {
                        return `- ${layertitle}: ${LocaleUtils.tr("identify.missinglayer")}`;
                    } else {
                        return `- ${layertitle}: ${LocaleUtils.tr("identify.featuresmissing", errors.missing.length, `${errors.key} = {${errors.missing.join(",")}}`)}`;
                    }
                }).join("\n");
                // eslint-disable-next-line no-alert
                alert(LocaleUtils.tr("identify.importerrors", errMsg));
            }
        };
        const queryLayer = (reqId, layerid, layerresults, layer, layerName) => {
            const values = layerresults.values.map(x => (typeof x === "string" ? `"${x}"` : x)).join(" , ");
            const filter = {filter: `${layerName}:"${layerresults.key}" IN ( ${values} )`};
            const request = IdentifyUtils.buildFilterRequest(layer, layerName, undefined, this.props.map, filter);
            IdentifyUtils.sendRequest(request, (response) => {
                const results = this.handleResponse(reqId, response, layer, request.params.info_format, [0, 0], false);
                if (layerName in results) {
                    const restoredkeys = new Set((results[layerName]).map(f => String(f.id)));
                    const missing = layerresults.values.filter(x => !restoredkeys.has(String(x)));
                    if (missing.length > 0) {
                        importErrors[layerid] = {key: layerresults.key, missing: missing};
                    }
                } else {
                    importErrors[layerid] = true;
                }
                displayErrorsIfDone(reqId);
            });
        };
        Object.entries(identifyResults).forEach(([layerid, layerresults]) => {
            const [layerUrl, layerName] = layerid.split("#", 2);
            const match = LayerUtils.searchLayer(this.props.layers, 'url', layerUrl, 'name', layerName);
            if (layerresults.key && layerresults.values) {
                delete identifyResults[layerid]; // Features will be re-queried
                if (match) {
                    const reqId = uuidv4();
                    pendingRequests.push(reqId);
                    queryLayer(reqId, layerid, layerresults, match.layer, layerName);
                } else {
                    const loadLayerReqId = uuidv4();
                    pendingRequests.push(loadLayerReqId);
                    ServiceLayerUtils.findLayers("wms", layerUrl, [{id: uuidv4(), name: layerName}], this.props.map.projection, (id, layer) => {
                        if (layer) {
                            this.props.addLayer(layer);
                            queryLayer(loadLayerReqId, layerid, layerresults, layer, layerName);
                        } else {
                            importErrors[layerid] = true;
                            this.setState(state => ({pendingRequests: state.pendingRequests.filter(x => x !== loadLayerReqId)}));
                        }
                        displayErrorsIfDone(loadLayerReqId);
                    });
                }
            } else {
                identifyResults[layerid] = identifyResults[layerid].filter(f => f.type === "Feature");
                if (!match) {
                    ServiceLayerUtils.findLayers("wms", layerUrl, [{id: uuidv4(), name: layerName}], this.props.map.projection, (id, layer) => {
                        if (layer) {
                            this.props.addLayer(layer);
                        }
                    });
                }
            }
        });
        if (pendingRequests.length === 0 && isEmpty(identifyResults) && isEmpty(importErrors)) {
            /* eslint-disable-next-line no-alert */
            alert(LocaleUtils.tr("identify.nothingtoimport"));
            identifyResults = null;
        }
        this.setState({identifyResults: identifyResults, pendingRequests: [...pendingRequests]});
    };
    renderBody = () => {
        const buttons = [
            {key: "Point", label: LocaleUtils.tr("common.point")},
            this.props.availableRegionModes.includes('Region') ? {key: "Region", label: LocaleUtils.tr("common.polygon")} : null,
            this.props.availableRegionModes.includes('Radius') ? {key: "Radius", label: LocaleUtils.tr("common.radius")} : null,
            this.props.availableRegionModes.includes('Circle') ? {key: "Circle", label: LocaleUtils.tr("common.circle")} : null,
            this.props.availableRegionModes.includes('Rectangle') ? {key: "Rectangle", label: LocaleUtils.tr("common.rectangle")} : null,
            {key: "Clear", icon: "clear"}
        ];
        let tooloptions = null;
        if (this.state.mode === "Point") {
            tooloptions = (
                <div className="identify-mode-hint">{LocaleUtils.tr("infotool.clickhelpPoint")}</div>
            );
        } else if (["Region", "Rectangle", "Circle"].includes(this.state.mode)) {
            tooloptions = (
                <div className="identify-mode-hint">{LocaleUtils.tr("infotool.clickhelpArea")}</div>
            );
        } else if (this.state.mode === "Radius") {
            tooloptions = (
                <div>
                    <div className="identify-mode-hint">
                        {LocaleUtils.tr("infotool.clickhelpRadius")}
                    </div>
                    <div className="identify-radius-controls controlgroup">
                        <span>{LocaleUtils.tr("infotool.radius")}:&nbsp;</span>
                        <NumberInput
                            max={1000000} min={1} mobile
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

        return (
            <div>
                <div className="identify-toolbar">
                    <ButtonBar active={this.state.mode} buttons={buttons} onClick={this.switchMode} />
                    <MenuButton menuIcon="export" tooltip={LocaleUtils.tr("common.export")}>
                        <div onClick={this.import} value="geojson">{LocaleUtils.tr("common.import")}</div>
                        <div onClick={this.export} value="export">{LocaleUtils.tr("common.export")}</div>
                    </MenuButton>
                </div>
                {tooloptions}
                {!this.props.appendResultsByDefault ? (
                    <div className="identify-mode-hint"><i>{LocaleUtils.tr("identify.ctrlhint")}</i></div>
                ) : null}
            </div>
        );
    };
    render() {
        let resultWindow = null;
        if (this.props.onlyShowDialogWithResults && isEmpty(this.state.identifyResults)) {
            // pass
        } else if (this.state.pendingRequests.length > 0 || this.state.identifyResults !== null) {
            let body = null;
            if (isEmpty(this.state.identifyResults)) {
                if (this.state.pendingRequests.length > 0) {
                    body = (<div className="identify-body"><span className="identify-body-message">{LocaleUtils.tr("identify.querying")}</span></div>);
                } else {
                    body = (<div className="identify-body"><span className="identify-body-message">{LocaleUtils.tr("common.noresults")}</span></div>);
                }
            } else {
                body = (
                    <IdentifyViewer
                        enableAggregatedReports={this.props.enableAggregatedReports}
                        enableCompare={this.props.enableCompare}
                        enableExport={this.props.enableExport}
                        exportGeometry={this.props.exportGeometry}
                        highlightAllResults={this.props.highlightAllResults}
                        identifyResults={this.state.identifyResults}
                        iframeDialogsInitiallyDocked={this.props.iframeDialogsInitiallyDocked}
                        innerRef={(el) => { this.viewerRef = el; }}
                        longAttributesDisplay={this.props.longAttributesDisplay}
                        replaceImageUrls={this.props.replaceImageUrls}
                        resultDisplayMode={this.props.resultDisplayMode}
                        resultGridSize={this.props.resultGridSize}
                        resultMultiDisplay={this.props.resultMultiDisplay}
                        showLayerSelector={this.props.showLayerSelector}
                        showLayerTitles={this.props.showLayerTitles}
                        skipEmptyFeatureAttributes={this.props.skipEmptyFeatureAttributes}
                    />
                );
            }
            resultWindow = (
                <ResizeableWindow busyIcon={this.state.pendingRequests.length > 0} dockable={this.props.geometry.side} icon={this.props.toolIcon}
                    initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                    initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                    initiallyDocked={this.props.geometry.initiallyDocked} key="IdentifyResultsWindow"
                    minimizeable={this.props.geometry.minimizeable} onClose={this.onWindowClose}
                    title={this.props.toolTitle}
                >
                    {body}
                </ResizeableWindow>
            );
        }
        const geomTypeMap = {
            Region: "Polygon",
            Radius: "Polygon",
            Circle: "Circle",
            Rectangle: "Box"
        };
        return [resultWindow, (
            <TaskBar key="IdentifyTaskBar" onHide={this.onToolClose} onShow={this.onShow} task={this.props.taskId}>
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        ), (["Region", "Rectangle", "Radius", "Circle"].includes(this.state.mode)) ? (
            <MapSelection
                active={this.state.mode !== "Radius"} geomType={geomTypeMap[this.state.mode]}
                geometry={this.state.filterGeom}
                geometryChanged={(geom, mod) => this.setState({filterGeom: geom, filterGeomModifiers: mod})} key="MapSelection"
                measure={this.state.mode === "Circle"}
            />
        ) : null];
    }
}

export default connect((state) => {
    return {
        click: state.map.click || {modifiers: {}},
        layerFilter: state.layers.filter,
        layers: state.layers.flat,
        map: state.map,
        task: state.task,
        theme: state.theme.current,
        startupParams: state.localConfig.startupParams,
        startupState: state.localConfig.startupState
    };
}, {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures,
    addMarker: addMarker,
    removeMarker: removeMarker,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask,
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(IdentifyTool);
