/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import clone from 'clone';
import DOMPurify from 'dompurify';
import FileSaver from 'file-saver';
import htmlReactParser, {domToReact} from 'html-react-parser';
import JSZip from 'jszip';
import isEmpty from 'lodash.isempty';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';

import {setActiveLayerInfo} from '../actions/layerinfo';
import {LayerRole, addLayerFeatures, removeLayer, changeLayerProperty} from '../actions/layers';
import {zoomToPoint} from '../actions/map';
import {openExternalUrl} from '../actions/windows';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils, {ToggleSet} from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import Icon from './Icon';
import NavBar from './widgets/NavBar';
import Spinner from './widgets/Spinner';

import './style/IdentifyViewer.css';

const EXCLUDE_PROPS = ['featurereport', 'displayfield', 'layername', 'layertitle', 'layerinfo', 'attribnames', 'clickPos', 'displayname', 'bbox'];
const EXCLUDE_ATTRS = ['htmlContent', 'htmlContentInline'];

const BuiltinExporters = [
    {
        id: 'json',
        title: 'json',
        allowClipboard: true,
        export: (json, callback) => {
            const data = JSON.stringify(json, null, ' ');
            callback({
                data: data, type: "text/plain;charset=utf-8", filename: "results.json"
            });
        }
    }, {
        id: 'geojson',
        title: 'geojson',
        allowClipboard: true,
        export: (json, callback) => {
            const featureCollection = {
                type: "FeatureCollection",
                features: Object.values(json).flat().map(entry => {
                    const feature = omit(entry, EXCLUDE_PROPS);
                    feature.properties = omit(feature.properties, EXCLUDE_ATTRS);
                    if (feature.geometry) {
                        feature.crs = {
                            type: "name",
                            properties: {
                                name: CoordinatesUtils.toOgcUrnCrs(entry.crs)
                            }
                        };
                    }
                    return feature;
                })
            };
            const data = JSON.stringify(featureCollection, null, ' ');
            callback({
                data: data, type: "application/geo+json;charset=utf-8", filename: "results.json"
            });
        }
    }, {
        id: 'csv',
        title: 'CSV',
        allowClipboard: true,
        export: (json, callback) => {
            const dataset = [];
            Object.entries(json).forEach(([layerName, features]) => {
                features.forEach(feature => {
                    dataset.push([feature.layertitle + ": " + feature.displayname]);
                    Object.entries(feature.properties || {}).forEach(([attrib, value]) => {
                        if (!EXCLUDE_ATTRS.includes(attrib)) {
                            dataset.push(["", attrib, String(value)]);
                        }
                    });
                    if (feature.geometry) {
                        dataset.push(["", "geometry", VectorLayerUtils.geoJSONGeomToWkt(feature.geometry)]);
                    }
                });
            });
            const csv = dataset.map(row => row.map(field => field ? `"${field.replace('"', '""')}"` : "").join("\t")).join("\n");
            callback({
                data: csv, type: "text/plain;charset=utf-8", filename: "results.csv"
            });
        }
    }, {
        id: 'csvzip',
        title: 'CSV+ZIP',
        allowClipboard: false,
        export: (json, callback) => {

            const data = [];
            const filenames = [];
            Object.entries(json).forEach(([layerName, features]) => {
                const exportAttrs = Object.keys(features[0]?.properties ?? {}).filter(attr => !EXCLUDE_ATTRS.includes(attr));
                const dataset = [[...exportAttrs]];
                if (features[0].geometry) {
                    dataset[0].push("geometry");
                }
                features.forEach(feature => {
                    const row = exportAttrs.map(attr => String(feature.properties[attr]));
                    if (feature.geometry) {
                        row.push(VectorLayerUtils.geoJSONGeomToWkt(feature.geometry));
                    }
                    dataset.push(row);
                });
                const csv = dataset.map(row => row.map(field => `"${field.replace('"', '""')}"`).join(";")).join("\n");
                data.push(csv);
                filenames.push(features[0].layername);
            });
            if (data.length > 1) {
                const zip = new JSZip();
                for (let i = 0; i < data.length; i++) {
                    const blob = new Blob([data[i]], {type: "text/csv;charset=utf-8"});
                    zip.file(filenames[i] + ".csv", blob);
                }
                zip.generateAsync({type: "arraybuffer"}).then((result) => {
                    callback({
                        data: result, type: "application/zip", filename: "results.zip"
                    });
                });
            } else {
                callback({
                    data: data[0], type: "text/csv;charset=utf-8", filename: filenames[0] + ".csv"
                });
            }
        }
    }, {
        id: 'shapefile',
        title: 'Shapefile',
        allowClipboard: false,
        export: (json, callback) => {
            import("@mapbox/shp-write").then(shpwriteMod => {
                const shpwrite = shpwriteMod.default;
                const layers = Object.entries(json);
                const options = {
                    outputType: 'arraybuffer',
                    types: {
                        point: 'points',
                        polygon: 'polygons',
                        polyline: 'lines'
                    }
                };
                const promises = layers.map(([layerName, features]) => {
                    const geojson = {
                        type: "FeatureCollection",
                        features: features.map(entry => omit(entry, EXCLUDE_PROPS))
                    };
                    const layerOptions = {...options, folder: layerName};
                    const crs = features[0]?.crs;
                    if (crs) {
                        const wkt = CoordinatesUtils.getEsriWktFromCrs(crs);
                        if (wkt) {
                            layerOptions.prj = wkt;
                        }
                    }
                    return shpwrite.zip(geojson, layerOptions).then((shpData) => ({
                        layerName,
                        shpData
                    }));
                });
                Promise.all(promises).then((results) => {
                    if (results.length === 1) {
                        callback({
                            data: results[0].shpData,
                            type: "application/zip",
                            filename: results[0].layerName + ".zip"
                        });
                    } else {
                        const zip = new JSZip();
                        results.forEach(({layerName, shpData}) => {
                            zip.file(layerName + ".zip", shpData);
                        });
                        zip.generateAsync({type: "arraybuffer"}).then((result) => {
                            callback({
                                data: result,
                                type: "application/zip",
                                filename: "shapefiles.zip"
                            });
                        });
                    }
                });
            });
        }
    }, {
        id: 'xlsx',
        title: 'XLSX',
        allowClipboard: false,
        export: (json, callback) => {
            import('xlsx').then(xlsx => {

                const document = xlsx.utils.book_new();

                Object.entries(json).forEach(([layerName, features]) => {
                    const exportAttrs = Object.keys(features[0]?.properties ?? {}).filter(attr => !EXCLUDE_ATTRS.includes(attr));
                    const dataset = [[...exportAttrs]];
                    if (features[0].geometry) {
                        dataset[0].push("geometry");
                    }
                    features.forEach(feature => {
                        const row = exportAttrs.map(attr => feature.properties[attr]);
                        if (feature.geometry) {
                            const geomWkt = VectorLayerUtils.geoJSONGeomToWkt(feature.geometry);
                            if (geomWkt.length < 32768) {
                                row.push(geomWkt);
                            } else {
                                row.push("Geometry too large");
                            }
                        }
                        dataset.push(row);
                    });
                    const worksheet = xlsx.utils.aoa_to_sheet(dataset);
                    const sheetName = features[0].layertitle.slice(0, 30).replace(/[\\/?*[]]?/g, '_');
                    xlsx.utils.book_append_sheet(document, worksheet, sheetName);
                });
                const data = xlsx.write(document, {type: "buffer"});
                callback({
                    data: data, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "results.xlsx"
                });
            });
        }
    }
];

class IdentifyViewer extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        attributeCalculator: PropTypes.func,
        attributeTransform: PropTypes.func,
        changeLayerProperty: PropTypes.func,
        collapsible: PropTypes.bool,
        customExporters: PropTypes.array,
        enableAggregatedReports: PropTypes.bool,
        enableCompare: PropTypes.bool,
        enableExport: PropTypes.oneOfType([PropTypes.bool, PropTypes.array]),
        exportGeometry: PropTypes.bool,
        highlightAllResults: PropTypes.bool,
        identifyResults: PropTypes.object,
        iframeDialogsInitiallyDocked: PropTypes.bool,
        layers: PropTypes.array,
        longAttributesDisplay: PropTypes.oneOf(['ellipsis', 'wrap']),
        map: PropTypes.object,
        openExternalUrl: PropTypes.func,
        removeLayer: PropTypes.func,
        replaceImageUrls: PropTypes.bool,
        resultDisplayMode: PropTypes.string,
        setActiveLayerInfo: PropTypes.func,
        showLayerSelector: PropTypes.bool,
        showLayerTitles: PropTypes.bool,
        theme: PropTypes.object,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        longAttributesDisplay: 'ellipsis',
        customExporters: [],
        attributeCalculator: (/* layer, feature */) => { return []; },
        attributeTransform: (name, value /* , layer, feature */) => value,
        enableAggregatedReports: true,
        resultDisplayMode: 'flat',
        showLayerTitles: true,
        showLayerSelector: true,
        highlightAllResults: true
    };
    state = {
        collapsedLayers: new ToggleSet(),
        expandedResults: new ToggleSet(),
        selectedResults: new ToggleSet(),
        resultTree: {},
        reports: {},
        currentResult: null,
        settingsMenu: false,
        exportFormat: 'geojson',
        selectedAggregatedReport: "",
        generatingReport: false,
        selectedLayer: '',
        compareEnabled: false,
        currentPage: 0
    };
    constructor(props) {
        super(props);
        this.resultsTreeRef = null;
        this.currentResultElRef = null;
        this.scrollIntoView = false;
        this.state.exportFormat = !Array.isArray(props.enableExport) ? 'geojson' : props.enableExport[0];
    }
    componentDidMount() {
        this.updateResultTree();
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.identifyResults !== prevProps.identifyResults) {
            this.updateResultTree();
        }

        if (prevState.currentResult !== this.state.currentResult || prevState.resultTree !== this.state.resultTree || this.state.currentPage !== prevState.currentPage) {
            this.setHighlightedFeatures(this.state.currentResult ? [this.getCurrentResultFeature()] : null);
        }
        // Scroll to selected result
        if (this.state.currentResult && this.state.currentResult !== prevState.currentResult &&
        this.resultsTreeRef && this.currentResultElRef && this.scrollIntoView) {
            this.resultsTreeRef.scrollTop = this.currentResultElRef.offsetTop - 10;
            this.scrollIntoView = false;
            this.currentResultElRef = null;
        }
        // Ensure currentPage is in range
        if (this.state.resultTree !== prevState.resultTree || this.state.selectedLayer !== prevState.selectedLayer) {
            const count = Object.values(this.state.selectedLayer !== '' ? {[this.state.selectedLayer]: this.state.resultTree[this.state.selectedLayer]} : this.state.resultTree).flat().length;
            this.setState(state => ({currentPage: Math.max(0, Math.min(state.currentPage, count - 1))}));
        }
    }
    componentWillUnmount() {
        this.props.removeLayer("__identifyviewerhighlight");
    }
    getCurrentResultFeature = () => {
        return this.state.resultTree[this.state.currentResult?.layerid]?.find?.(feature => feature.id === this.state.currentResult.featureid) ?? null;
    };
    updateResultTree = () => {
        const layers = Object.keys(this.props.identifyResults);
        let currentResult = null;
        if (layers.length === 1 && this.props.identifyResults[layers[0]].length === 1) {
            currentResult = {
                layerid: layers[0],
                featureid: this.props.identifyResults[layers[0]][0].id
            };
        }

        this.setState({
            resultTree: clone(this.props.identifyResults),
            currentResult: currentResult,
            reports: LayerUtils.collectFeatureReports(this.props.layers)
        });
    };
    setHighlightedFeatures = (features) => {
        if (!features && this.props.highlightAllResults) {
            const resultTree = this.state.selectedLayer !== '' ? {[this.state.selectedLayer]: this.state.resultTree[this.state.selectedLayer]} : this.state.resultTree;
            features = Object.values(resultTree).flat();
        }
        features = (features || []).filter(feature => feature.type.toLowerCase() === "feature").map(feature => {
            const newFeature = {...feature, properties: {}};
            // Ensure selection style is used
            delete newFeature.styleName;
            delete newFeature.styleOptions;
            return newFeature;
        });
        if (!isEmpty(features)) {
            const layer = {
                id: "__identifyviewerhighlight",
                role: LayerRole.SELECTION
            };
            this.props.addLayerFeatures(layer, features, true);
        } else {
            this.props.removeLayer("__identifyviewerhighlight");
        }
    };
    removeResultLayer = (layerid) => {
        this.setState((state) => {
            const newResultTree = {...state.resultTree};
            delete newResultTree[layerid];
            return {
                resultTree: newResultTree,
                collapsedLayers: state.collapsedLayers.delete(layerid),
                currentResult: state.currentResult?.layerid === layerid ? null : state.currentResult
            };
        });
    };
    removeResult = (layerid, feature) => {
        this.setState((state) => {
            const newResultTree = {...state.resultTree};
            const collapsedLayers = state.collapsedLayers;
            newResultTree[layerid] = state.resultTree[layerid].filter(item => item !== feature);
            if (isEmpty(newResultTree[layerid])) {
                delete newResultTree[layerid];
                collapsedLayers.delete(layerid);
            }
            const selectedLayer = isEmpty(newResultTree[layerid]) ? '' : state.selectedLayer;
            const selectedResults = state.selectedResults.delete(layerid + "$" + feature.id);
            return {
                resultTree: newResultTree,
                currentResult: state.currentResult?.featureid === feature.id ? null : state.currentResult,
                selectedLayer: selectedLayer,
                selectedResults: selectedResults,
                expandedResults: state.expandedResults.delete(layerid + "$" + feature.id),
                collapsedLayers: collapsedLayers,
                compareEnabled: state.compareEnabled && selectedResults.size > 1
            };
        });
    };
    exportResults = (clipboard = false) => {
        const filteredResults = {};
        if (this.state.selectedResults.size() > 0) {
            this.state.selectedResults.entries().forEach(key => {
                const [layerid, featureid] = key.split("$");
                if (!filteredResults[layerid]) {
                    filteredResults[layerid] = [];
                }
                filteredResults[layerid].push(this.state.resultTree[layerid].find(feature => feature.id === featureid));
            });
        } else {
            Object.keys(this.state.selectedLayer !== '' ? { [this.state.selectedLayer]: this.state.resultTree[this.state.selectedLayer] } : this.state.resultTree).map(key => {
                if (!isEmpty(this.state.resultTree[key])) {
                    filteredResults[key] = this.state.resultTree[key];
                }
            });
        }
        this.export(filteredResults, clipboard);
    };
    exportResultLayer = (layer) => {
        this.export({[layer]: this.state.resultTree[layer]});
    };
    exportResult = (layer, result) => {
        this.export({[layer]: [result]});
    };
    export = (json, clipboard = false) => {
        const exporter = this.getExporters().find(entry => entry.id === this.state.exportFormat);
        if (exporter) {
            if (!this.props.exportGeometry) {
                json = Object.entries(json).reduce((res, [layerId, features]) => (
                    {...res, [layerId]: features.map(feature => omit(feature, ['geometry']))}
                ), {});
            }
            exporter.export(json, (result) => {
                if (clipboard && exporter.allowClipboard) {
                    navigator.clipboard.writeText(result.data);
                } else {
                    FileSaver.saveAs(new Blob([result.data], {type: result.type}), result.filename);
                }
            });
        }
    };
    renderResultTree = () => {
        const exportEnabled = this.props.enableExport === true || !isEmpty(this.props.enableExport);
        return (<div className="identify-results-tree" key="results-container" ref={el => { this.resultsTreeRef = el; }} style={{maxHeight: this.state.currentResult ? '10em' : 'initial'}}>
            {Object.entries(this.state.resultTree).map(([layerid, features]) => {
                if (features.length === 0) {
                    return null;
                }
                return (
                    <div key={layerid}>
                        <div className="identify-results-tree-entry"
                            onMouseEnter={() => this.setHighlightedFeatures(features)}
                            onMouseLeave={() => this.setHighlightedFeatures(this.state.currentResult ? [this.getCurrentResultFeature()] : null)}
                        >
                            <span onClick={() => this.toggleExpanded(layerid)}>
                                <Icon icon={this.state.collapsedLayers.has(layerid) ? "expand" : "collapse"} /> {features[0].layertitle}
                            </span>
                            {exportEnabled ? (<Icon className="identify-export-result" icon="export" onClick={() => this.exportResultLayer(layerid)} />) : null}
                            <Icon className="identify-remove-result" icon="trash" onClick={() => this.removeResultLayer(layerid)} />
                        </div>
                        {this.state.collapsedLayers.has(layerid) ? null : (
                            <div className="identify-results-tree-entries">
                                {features.map(feature => {
                                    // this.renderResult(layername, result)
                                    const ref = this.state.currentResult === feature && this.scrollIntoView ? el => { this.currentResultElRef = el; } : null;
                                    const active = this.state.currentResult?.featureid === feature.id && this.state.currentResult?.layerid === layerid;
                                    return (
                                        <div className="identify-results-tree-entry" key={feature.id}
                                            onMouseEnter={() => this.setHighlightedFeatures([feature])}
                                            onMouseLeave={() => this.setHighlightedFeatures(this.state.currentResult ? [this.getCurrentResultFeature()] : null)}
                                        >
                                            <span className={active ? "identify-results-tree-entry-active" : ""} onClick={()=> this.setCurrentResult(layerid, feature.id)} ref={ref}>
                                                {feature.displayname}
                                                {this.state.selectedResults.has(layerid + "$" + feature.id) ? (<Icon icon="pin" />) : null}
                                            </span>
                                            {exportEnabled ? (<Icon className="identify-export-result" icon="export" onClick={() => this.exportResult(layerid, feature)} />) : null}
                                            <Icon className="identify-remove-result" icon="trash" onClick={() => this.removeResult(layerid, feature)} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>);
    };
    toggleExpanded = (layerid) => {
        this.setState(state => ({
            collapsedLayers: state.collapsedLayers.toggle(layerid),
            currentResult: state.currentResult?.layerid === layerid ? null : state.currentResult
        }));
    };
    setCurrentResult = (layerid, featureid) => {
        if (this.state.currentResult?.layerid === layerid && this.state.currentResult?.featureid === featureid) {
            this.setState({currentResult: null});
        } else {
            this.setState({currentResult: {layerid, featureid}});
            this.scrollIntoView = true;
        }
    };
    renderResultAttributes = (layerid, feature, resultClass) => {
        if (!feature) {
            return null;
        }
        let resultbox = null;
        let extraattribs = null;
        let inlineExtaAttribs = false;
        const featureReports = this.state.reports[layerid] || [];
        if (feature.featureReport) {
            featureReports.push({
                title: feature.layertitle,
                template: feature.featureReport
            });
        }
        if (feature.type === "text") {
            resultbox = (
                <pre className="identify-result-box">
                    {feature.text}
                </pre>
            );
        } else if (feature.type === "html") {
            resultbox = (
                <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, feature.text)} ref={el => this.pollIframe(el, feature.text)} />
            );
        } else if (feature.properties.htmlContent) {
            if (feature.properties.htmlContentInline) {
                resultbox = (
                    <div className="identify-result-box">{this.parsedContent(feature.properties.htmlContent)}</div>
                );
            } else {
                resultbox = (
                    <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, feature.properties.htmlContent)} ref={el => this.pollIframe(el, feature.properties.htmlContent)} />
                );
            }
        } else {
            inlineExtaAttribs = true;
            const properties = Object.keys(feature.properties) || [];
            let rows = [];
            if (properties.length === 1 && feature.properties.maptip) {
                rows = properties.map(attrib => (
                    <tr key={attrib}>
                        <td className="identify-attr-value">{this.attribValue(feature.properties[attrib], attrib, layerid, feature)}</td>
                    </tr>
                ));
            } else {
                rows = properties.map(attrib => {
                    if (
                        this.props.theme.skipEmptyFeatureAttributes &&
                        (feature.properties[attrib] === "" || feature.properties[attrib] === null || feature.properties[attrib] === "NULL")
                    ) {
                        return null;
                    }
                    return (
                        <tr key={attrib}>
                            <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i>{attrib}</i></td>
                            <td className={"identify-attr-value " + this.props.longAttributesDisplay}>{this.attribValue(feature.properties[attrib], attrib, layerid, feature)}</td>
                        </tr>
                    );
                });
            }
            rows.push(...this.computeExtraAttributes(layerid, feature));
            featureReports.forEach((report, idx) => {
                rows.push(
                    <tr key={"__featurereport" + idx}>
                        <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i>{LocaleUtils.tr("identify.featureReport") + ": " + report.title}</i></td>
                        <td className={"identify-attr-value " + this.props.longAttributesDisplay}><a href={this.getFeatureReportUrl(report, feature)} rel="noreferrer" target="_blank">{LocaleUtils.tr("identify.link")}</a></td>
                    </tr>
                );
            });
            if (isEmpty(rows)) {
                rows = (
                    <tr><td className="identify-attr-value"><i>{LocaleUtils.tr("identify.noattributes")}</i></td></tr>
                );
            }
            resultbox = (
                <div className="identify-result-box">
                    <table className="attribute-list"><tbody>
                        {rows}
                    </tbody></table>
                </div>
            );
        }
        if (!inlineExtaAttribs && (this.props.attributeCalculator || !isEmpty(this.state.reports[layerid]))) {
            extraattribs = (
                <div className="identify-result-box">
                    <table className="attribute-list"><tbody>
                        {this.computeExtraAttributes(layerid, feature)}
                        {featureReports.map((report, idx) => (
                            <tr key={"report" + idx}>
                                <td className={"identify-attr-title " + this.props.longAttributesDisplay}>
                                    <i>{LocaleUtils.tr("identify.featureReport") + ": " + report.title}</i>
                                </td>
                                <td className={"identify-attr-value " + this.props.longAttributesDisplay}>
                                    <a href={this.getFeatureReportUrl(report, feature)} rel="noreferrer" target="_blank">
                                        {LocaleUtils.tr("identify.link")}
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody></table>
                </div>
            );
        }
        let zoomToFeatureButton = null;
        if (feature.bbox && feature.crs) {
            zoomToFeatureButton = (<Icon icon="zoom" onClick={() => this.zoomToResult(feature)} />);
        }
        const key = layerid + "$" + feature.id;
        const expanded = this.state.expandedResults.has(key);
        const selected = this.state.selectedResults.has(key);
        return (
            <div className={resultClass} key={key}>
                <div className="identify-result-title">
                    {this.props.collapsible ? (
                        <Icon icon={expanded ? "triangle-down" : "triangle-right"} onClick={() => this.setState(state => ({expandedResults: state.expandedResults.toggle(key)}))} />
                    ) : null}
                    {this.props.enableCompare ? (
                        <Icon className="identify-result-checkbox" icon={selected ? "checked" : "unchecked"} onClick={() => this.toggleSelectedResult(key)} />
                    ) : null}
                    <span>{(this.props.showLayerTitles ? (feature.layertitle + ": ") : "") + feature.displayname}</span>
                    {zoomToFeatureButton}
                    <Icon icon="info-sign" onClick={() => this.showLayerInfo(layerid)} />
                    <Icon icon="trash" onClick={() => this.removeResult(layerid, feature)} />
                </div>
                {this.props.collapsible && !expanded ? null : (
                    <div className="identify-result-container">
                        {resultbox}
                        {extraattribs}
                    </div>
                )}
            </div>
        );
    };
    toggleSelectedResult = (key) => {
        this.setState(state => {
            const selectedResults = state.selectedResults.toggle(key);
            return {
                selectedResults: selectedResults,
                compareEnabled: selectedResults.size > 1
            };
        });
    };
    render() {
        let body = null;
        const resultTree = this.state.selectedLayer !== '' ? {[this.state.selectedLayer]: this.state.resultTree[this.state.selectedLayer]} : this.state.resultTree;
        const flatResults = Object.entries(resultTree).map(([layerid, features]) => features.map(feature => ([layerid, feature]))).flat();
        if (this.state.compareEnabled) {
            body = (
                <div className="identify-compare-results">
                    {this.state.selectedResults.entries().map(key => {
                        const [layerid, featureid] = key.split("$");
                        const feature = this.state.resultTree[layerid].find(f => f.id === featureid);
                        return this.renderResultAttributes(layerid, feature, "identify-result-frame");
                    })}
                </div>
            );
        } else if (this.props.resultDisplayMode === 'tree') {
            body = [
                this.renderResultTree(),
                this.renderResultAttributes(this.state.currentResult?.layerid, this.getCurrentResultFeature(), 'identify-result-tree-frame')
            ];
        } else if (this.props.resultDisplayMode === 'flat') {
            body = (
                <div className="identify-flat-results-list">
                    {Object.entries(resultTree).map(([layerid, features]) => {
                        return features.map(feature => (
                            <div key={layerid + "$" + feature.id}
                                onMouseEnter={() => this.setHighlightedFeatures([feature])}
                                onMouseLeave={() => this.setHighlightedFeatures(null)}
                            >
                                {this.renderResultAttributes(layerid, feature, 'identify-result-frame')}
                            </div>
                        ));
                    })}
                </div>
            );
        } else if (this.props.resultDisplayMode === 'paginated' && this.state.currentPage < flatResults.length) {
            const [layerid, feature] = flatResults[this.state.currentPage];
            body = (
                <div className="identify-flat-results-list"
                    onMouseEnter={() => this.setHighlightedFeatures([feature])}
                    onMouseLeave={() => this.setHighlightedFeatures(null)}
                >
                    {this.renderResultAttributes(layerid, feature, 'identify-result-frame')}
                </div>
            );
        }
        // "el.style.background='inherit'": HACK to trigger an additional repaint, since Safari/Chrome on iOS render the element cut off the first time
        return (
            <div className="identify-body" ref={el => { if (el) el.style.background = 'inherit'; } }>
                {body}
                {flatResults.length > 0 ? this.renderToolbar(flatResults) : null}
            </div>
        );
    }
    renderToolbar = (results) => {
        const resultCount = results.length;
        const toggleButton = (key, icon, disabled, tooltip = undefined) => (
            <button className={"button" + (this.state[key] ? " pressed" : "")} disabled={disabled} onClick={() => this.setState(state => ({[key]: !state[key]}))} title={tooltip}><Icon icon={icon} /></button>
        );
        let infoLabel = null;
        if (this.state.compareEnabled) {
            infoLabel = (<span>{LocaleUtils.tr("identify.comparing", this.state.selectedResults.size())}</span>);
        } else if (this.props.resultDisplayMode !== 'paginated') {
            infoLabel = (<span>{LocaleUtils.tr("identify.featurecount", resultCount)}</span>);
        }
        const checkedPages = results.reduce((res, entry, idx) => {
            if (this.state.selectedResults.has(entry[0] + "$" + entry[1].id)) {
                return [...res, idx];
            }
            return res;
        }, []);
        return (
            <div className="identify-toolbar">
                {toggleButton("settingsMenu", "cog", false)}
                {this.state.settingsMenu ? this.renderSettingsMenu() : null}
                {this.props.enableCompare ? toggleButton("compareEnabled", "compare", this.state.selectedResults.size() < 2, LocaleUtils.tr("identify.compare")) : null}
                <span className="identify-toolbar-spacer" />
                {infoLabel}
                <span className="identify-toolbar-spacer" />
                {this.props.resultDisplayMode === 'paginated' ? (
                    <NavBar currentPage={this.state.currentPage} nPages={resultCount} pageChanged={page => this.setState({currentPage: page})} pageSizes={[1]} selectedPages={checkedPages} />
                ) : null}
            </div>
        );
    };
    renderSettingsMenu = () => {
        const exporters = Object.fromEntries(this.getExporters().map(exporter => ([exporter.id, exporter])));
        const enabledExporters = Array.isArray(this.props.enableExport) ? this.props.enableExport : Object.keys(exporters);
        const clipboardExportDisabled = exporters[this.state.exportFormat]?.allowClipboard !== true;
        const exportEnabled = this.props.enableExport === true || !isEmpty(this.props.enableExport);
        const reportsEnabled = this.props.enableAggregatedReports && Object.keys(this.state.reports).length > 0;
        return (
            <div className="identify-settings-menu">
                <table>
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("identify.results")}:</td>
                            <td>
                                <div className="controlgroup">
                                    <select className="controlgroup-expanditem" onChange={ev => this.setSelectedLayer(ev.target.value)}>
                                        <option value=''>{LocaleUtils.tr("identify.layerall")}</option>
                                        {Object.keys(this.state.resultTree).filter(key => this.state.resultTree[key].length).map(
                                            layer => (
                                                <option key={layer} value={layer}>
                                                    {this.state.resultTree[layer][0].layertitle}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </td>
                        </tr>
                        {exportEnabled ? (
                            <tr>
                                <td>{LocaleUtils.tr("identify.export")}:</td>
                                <td>
                                    <div className="controlgroup">
                                        <select className="controlgroup-expanditem" onChange={ev => this.setState({exportFormat: ev.target.value})} value={this.state.exportFormat}>
                                            {enabledExporters.map(id => (
                                                <option key={id} value={id}>{exporters[id].title ?? LocaleUtils.tr(exporters[id].titleMsgId)}</option>
                                            ))}
                                        </select>
                                        <button className="button" onClick={() => this.exportResults()} title={LocaleUtils.tr("identify.download")}>
                                            <Icon icon="export" />
                                        </button>
                                        <button className="button" disabled={clipboardExportDisabled} onClick={() => this.exportResults(true)} title={LocaleUtils.tr("identify.clipboard")}>
                                            <Icon icon="copy" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : null}
                        {reportsEnabled ? (
                            <tr>
                                <td>{LocaleUtils.tr("identify.aggregatedreport")}:</td>
                                <td>
                                    <div className="controlgroup">
                                        <select className="controlgroup-expanditem" onChange={ev => this.setState({selectedAggregatedReport: ev.target.value})} value={this.state.selectedAggregatedReport}>
                                            <option disabled value=''>{LocaleUtils.tr("identify.selectreport")}</option>
                                            {Object.entries(this.state.reports).map(([layername, reports]) => {
                                                return reports.map((report, idx) => (
                                                    <option key={layername + "::" + idx} value={layername + "::" + idx}>{report.title}</option>
                                                ));
                                            })}
                                        </select>
                                        <button
                                            className="button"
                                            disabled={!this.state.selectedAggregatedReport || this.state.generatingReport}
                                            onClick={this.downloadAggregatedReport}
                                        >
                                            {this.state.generatingReport ? (<Spinner />) : (<Icon icon="report" />)}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        );
    };
    setSelectedLayer = (layer) => {
        this.setState(state => {
            let newSelectedResults = state.selectedResults;
            if (layer !== '') {
                newSelectedResults = state.selectedResults.filtered(key => key.startsWith(layer + "$"));
            }
            return {
                selectedResults: newSelectedResults,
                selectedLayer: layer
            };
        });
    };
    computeExtraAttributes = (layer, result) => {
        const rows = [];
        Object.values(window.qwc2?.__attributeCalculators || {}).forEach((calc, idx) => {
            const row = calc(layer, result);
            if (row.length === 2) {
                rows.push((
                    <tr key={"custom-attr-" + idx}>
                        <td className="identify-attr-title"><i>{row[0]}</i></td>
                        <td className="identify-attr-value">{row[1]}</td>
                    </tr>
                ));
            } else if (row.length === 1) {
                rows.push((
                    <tr key={"custom-attr-" + idx}>
                        <td colSpan="2">{row[0]}</td>
                    </tr>
                ));
            }
        });
        if (this.props.attributeCalculator) {
            rows.push(...this.props.attributeCalculator(layer, result));
        }
        return rows;
    };
    getExporters = () => {
        return [
            ...BuiltinExporters,
            ...this.props.customExporters,
            ...Object.values(window.qwc2?.__identifyExportes || [])
        ];
    };
    setIframeContent = (iframe, html) => {
        if (iframe.getAttribute("identify-content-set")) {
            return;
        }
        iframe.setAttribute("identify-content-set", true);
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(html);
        iframe.contentWindow.document.close();
    };
    pollIframe = (iframe, html) => {
        if (iframe && !iframe.getAttribute("identify-content-set")) {
            const interval = setInterval(() => {
                if (iframe.getAttribute("identify-content-set")) {
                    return clearInterval(interval);
                }
                if (iframe.contentWindow && iframe.contentWindow.document) {
                    iframe.setAttribute("identify-content-set", true);
                    iframe.contentWindow.document.open();
                    iframe.contentWindow.document.write(html);
                    iframe.contentWindow.document.close();
                    clearInterval(interval);
                }
                return true;
            }, 500);
        }
    };
    collectFeatureReportTemplates = (entry) => {
        let reports = {};
        if (entry.sublayers) {
            for (const sublayer of entry.sublayers) {
                reports = {...reports, ...this.collectFeatureReportTemplates(sublayer)};
            }
        } else if (entry.featureReport) {
            reports[entry.name] = entry.featureReport;
        }
        return reports;
    };
    findFeatureReportTemplate = (layer) => {
        let reports = {};
        this.props.layers.filter(l => l.role === LayerRole.THEME).forEach(themeLayer => {
            reports = {...reports, ...this.collectFeatureReportTemplates(themeLayer)};
        });
        return reports[layer] || null;
    };
    getFeatureReportUrl = (report, result) => {
        const serviceUrl = ConfigUtils.getConfigProp("documentServiceUrl").replace(/\/$/, "");
        const params = {
            feature: result.id,
            x: result.clickPos[0],
            y: result.clickPos[1],
            crs: this.props.map.projection,
            single_report: report.single_report || false
        };
        const path = "/" + report.template + "." + (report.format || "pdf");
        const query = Object.keys(params).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key])).join("&");
        return serviceUrl + path + "?" + query;
    };
    downloadAggregatedReport = () => {
        const [layername, idx] = this.state.selectedAggregatedReport.split("::");
        const report = this.state.reports[layername][idx];
        const results = this.state.resultTree[layername];
        const serviceUrl = ConfigUtils.getConfigProp("documentServiceUrl").replace(/\/$/, "");
        const params = {
            feature: results.map(result => result.id).join(","),
            x: results[0].clickPos[0],
            y: results[0].clickPos[1],
            crs: this.props.map.projection,
            single_report: report.single_report || false
        };
        this.setState({generatingReport: true});
        const url = serviceUrl + "/" + report.template;
        axios.get(url, {params, responseType: "arraybuffer"}).then(response => {
            const filename = (report.filename || report.title.replace(" ", "_")) + "." + (report.format || "pdf");
            FileSaver.saveAs(new Blob([response.data], {type: "application/pdf"}), filename);
            this.setState({generatingReport: false});
        }).catch(() => {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("identify.reportfail"));
            this.setState({generatingReport: false});
        });
    };
    showLayerInfo = (layer) => {
        const [layerUrl, layerName] = layer.split('#');
        const match = LayerUtils.searchLayer(this.props.layers, layerUrl, layerName);
        if (match) {
            this.props.setActiveLayerInfo(match.layer, match.sublayer);
        }
    };
    attribValue = (text, attrName, layer, result) => {
        if (typeof text === 'object') {
            text = JSON.stringify(text);
        }
        if (this.props.replaceImageUrls && /^https?:\/\/.*\.(jpg|jpeg|png|bmp)$/i.exec(text)) {
            return (<a href={text} rel="noreferrer" target="_blank"><img src={text} /></a>);
        }
        text = "" + text; // Ensure text is a string
        text = this.props.attributeTransform(attrName, text, layer, result);
        text = MiscUtils.addLinkAnchors(text);
        return this.parsedContent(text);
    };
    parsedContent = (text) => {
        text = DOMPurify.sanitize(text, {ADD_ATTR: ['target']}).replace('&#10;', '<br />');
        const options = {replace: (node) => {
            if (node.name === "a") {
                return (
                    <a href={node.attribs.href} onClick={this.attributeLinkClicked} target={node.attribs.target || "_blank"}>
                        {domToReact(node.children, options)}
                    </a>
                );
            }
            return undefined;
        }};
        return htmlReactParser(text, options);
    };
    attributeLinkClicked = (ev) => {
        this.props.openExternalUrl(ev.target.href, ev.target.target, {docked: this.props.iframeDialogsInitiallyDocked});
        ev.preventDefault();
    };
    zoomToResult = (result) => {
        let zoom = 0;
        const maxZoom = MapUtils.computeZoom(this.props.map.scales, this.props.theme.minSearchScaleDenom || 1000);
        if (result.bbox[0] !== result.bbox[2] && result.bbox[1] !== result.bbox[3]) {
            zoom = Math.max(0, MapUtils.getZoomForExtent(result.bbox, this.props.map.resolutions, this.props.map.size, 0, maxZoom + 1) - 1);
        } else {
            zoom = maxZoom;
        }

        const x = 0.5 * (result.bbox[0] + result.bbox[2]);
        const y = 0.5 * (result.bbox[1] + result.bbox[3]);
        this.props.zoomToPoint([x, y], zoom, this.props.map.projection);

        const path = [];
        let sublayer = null;
        const layer = this.props.layers.find(l => {
            return l.role === LayerRole.THEME && (sublayer = LayerUtils.searchSubLayer(l, 'name', result.layername, path));
        });
        if (layer && sublayer) {
            this.props.changeLayerProperty(layer.id, "visibility", true, path);
        }
    };
}

const selector = (state) => ({
    theme: state.theme.current,
    layers: state.layers.flat,
    map: state.map
});

export default connect(selector, {
    addLayerFeatures: addLayerFeatures,
    changeLayerProperty: changeLayerProperty,
    removeLayer: removeLayer,
    setActiveLayerInfo: setActiveLayerInfo,
    openExternalUrl: openExternalUrl,
    zoomToPoint: zoomToPoint
})(IdentifyViewer);
