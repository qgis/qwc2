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
import FileSaver from 'file-saver';
import htmlReactParser, {domToReact} from 'html-react-parser';
import JSZip from 'jszip';
import isEmpty from 'lodash.isempty';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';

import {setActiveLayerInfo} from '../actions/layerinfo';
import {LayerRole, addLayerFeatures, removeLayer, changeLayerProperty} from '../actions/layers';
import {zoomToExtent} from '../actions/map';
import {openExternalUrl} from '../actions/windows';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import Icon from './Icon';
import Spinner from './widgets/Spinner';

import './style/IdentifyViewer.css';


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
                    const feature = omit(entry, ['featurereport', 'displayfield', 'layername', 'layertitle', 'layerinfo', 'attribnames', 'clickPos', 'displayname', 'bbox']);
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
            let data = "";
            Object.entries(json).forEach(([layerName, features]) => {
                features.forEach(feature => {
                    data += layerName + ": " + feature.displayname + "\n";
                    Object.entries(feature.properties || {}).forEach(([attrib, value]) => {
                        if (attrib !== "htmlContent" && attrib !== "htmlContentInline") {
                            data += '\t"' + attrib + '"\t"' + String(value).replace('"', '""') + '"\n';
                        }
                    });
                    if (feature.geometry) {
                        data += '\t"geometry"\t"' + VectorLayerUtils.geoJSONGeomToWkt(feature.geometry) + '"\n';
                    }
                });
                data += "\n";
            });
            callback({
                data: data, type: "text/plain;charset=utf-8", filename: "results.csv"
            });
        }
    }, {
        id: 'csvzip',
        title: 'CSV+ZIP',
        allowClipboard: false,
        export: (json, callback) => {
            let first = true;
            const data = [];
            const filenames = [];
            Object.entries(json).forEach(([layerName, features]) => {
                let csv = "";
                if (first) {
                    Object.entries(features[0].properties || {}).forEach(([attrib]) => {
                        if (attrib !== "htmlContent" && attrib !== "htmlContentInline") {
                            csv += attrib  + ';';
                        }
                    });
                    if (features[0].geometry) {
                        csv += 'geometry';
                    } else if (csv !== "") {
                        csv = csv.slice(0, -1); // Remove trailling semi column ;
                    }
                    first = false;
                    csv += '\n';
                }
                features.forEach(feature => {
                    Object.entries(feature.properties || {}).forEach(([attrib, value]) => {
                        if (attrib !== "htmlContent" && attrib !== "htmlContentInline") {
                            csv += String(value).replace('"', '""') + ';';
                        }
                    });
                    if (feature.geometry) {
                        csv += VectorLayerUtils.geoJSONGeomToWkt(feature.geometry);
                    } else if (csv !== "") {
                        csv = csv.slice(0, -1); // Remove trailling semi column ;
                    }
                    csv += '\n';
                });
                first = true;
                data.push(csv);
                filenames.push(layerName);
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
        displayResultTree: PropTypes.bool,
        enableAggregatedReports: PropTypes.bool,
        enableExport: PropTypes.oneOfType([PropTypes.bool, PropTypes.array]),
        exportGeometry: PropTypes.bool,
        highlightAllResults: PropTypes.bool,
        identifyResults: PropTypes.object,
        iframeDialogsInitiallyDocked: PropTypes.bool,
        layers: PropTypes.array,
        longAttributesDisplay: PropTypes.oneOf(['ellipsis', 'wrap']),
        mapcrs: PropTypes.string,
        openExternalUrl: PropTypes.func,
        removeLayer: PropTypes.func,
        replaceImageUrls: PropTypes.bool,
        setActiveLayerInfo: PropTypes.func,
        showLayerSelector: PropTypes.bool,
        showLayerTitles: PropTypes.bool,
        theme: PropTypes.object,
        zoomToExtent: PropTypes.func
    };
    static defaultProps = {
        longAttributesDisplay: 'ellipsis',
        customExporters: [],
        displayResultTree: true,
        attributeCalculator: (/* layer, feature */) => { return []; },
        attributeTransform: (name, value /* , layer, feature */) => value,
        enableAggregatedReports: true,
        showLayerTitles: true,
        showLayerSelector: true,
        highlightAllResults: true
    };
    state = {
        expanded: {},
        expandedResults: {},
        resultTree: {},
        currentResult: null,
        currentLayer: null,
        exportFormat: 'geojson',
        selectedAggregatedReport: null,
        generatingReport: false,
        selectedLayer: ''
    };
    constructor(props) {
        super(props);
        this.currentResultElRef = null;
        this.scrollIntoView = false;
        this.state.exportFormat = !Array.isArray(props.enableExport) || props.enableExport.includes('geojson') ? 'geojson' : props.enableExport[0];
    }
    componentDidMount() {
        this.updateResultTree();
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.identifyResults !== prevProps.identifyResults) {
            this.updateResultTree();
        }

        if (prevState.currentResult !== this.state.currentResult || prevState.resultTree !== this.state.resultTree) {
            this.setHighlightedResults(this.state.currentResult === null ? null : [this.state.currentResult], this.state.resultTree);
        }
        // Scroll to selected result
        if (this.state.currentResult && this.state.currentResult !== prevState.currentResult &&
        this.currentResultElRef && this.scrollIntoView) {
            this.currentResultElRef.parentNode.scrollTop = this.currentResultElRef.offsetTop - this.currentResultElRef.parentNode.offsetTop;
            this.scrollIntoView = false;
            this.currentResultElRef = null;
        }
    }
    componentWillUnmount() {
        this.props.removeLayer("__identifyviewerhighlight");
    }
    updateResultTree = () => {
        const layers = Object.keys(this.props.identifyResults);
        let currentResult = null;
        let currentLayer = null;
        if (layers.length === 1 && this.props.identifyResults[layers[0]].length === 1) {
            currentResult = this.props.identifyResults[layers[0]][0];
            currentLayer = layers[0];
        }
        this.setState({
            resultTree: clone(this.props.identifyResults),
            currentResult: currentResult,
            currentLayer: currentLayer
        });
    };
    setHighlightedResults = (results, resultTree) => {
        if (!results && this.props.highlightAllResults) {
            const selectedLayer = this.state.selectedLayer || '';
            results = Object.keys(resultTree).reduce((res, layer) => {
                const layerData = resultTree[selectedLayer || layer];
                return res.concat(layerData.map(result => ({ ...result, id: `${selectedLayer || layer}.${result.id}` })));
            }, []);
        }
        results = (results || []).filter(result => result.type.toLowerCase() === "feature").map(feature => {
            const newFeature = {...feature, properties: {}};
            // Ensure selection style is used
            delete newFeature.styleName;
            delete newFeature.styleOptions;
            return newFeature;
        });
        if (!isEmpty(results)) {
            const layer = {
                id: "__identifyviewerhighlight",
                role: LayerRole.SELECTION
            };
            this.props.addLayerFeatures(layer, results, true);
        } else {
            this.props.removeLayer("__identifyviewerhighlight");
        }
    };
    getExpandedClass = (path, deflt) => {
        const expanded = this.state.expanded[path] !== undefined ? this.state.expanded[path] : deflt;
        return expanded ? "identify-layer-expandable identify-layer-expanded" : "identify-layer-expandable";
    };
    toggleExpanded = (path, deflt) => {
        const newstate = this.state.expanded[path] !== undefined ? !this.state.expanded[path] : !deflt;
        const diff = {};
        diff[path] = newstate;
        if (this.state.currentLayer === path && !newstate) {
            this.setState((state) => ({...state, expanded: {...state.expanded, ...diff}, currentResult: null, currentLayer: null}));
        } else {
            this.setState((state) => ({...state, expanded: {...state.expanded, ...diff}}));
        }
    };
    setCurrentResult = (layer, result) => {
        if (this.state.currentResult === result) {
            this.setState({currentResult: null, currentLayer: null});
        } else {
            this.setState({currentResult: result, currentLayer: layer});
            this.scrollIntoView = true;
        }
    };
    removeResultLayer = (layer) => {
        this.setState((state) => {
            const newResultTree = {...state.resultTree};
            delete newResultTree[layer];
            this.setState({
                resultTree: newResultTree,
                currentResult: state.currentLayer === layer ? null : state.currentResult,
                currentLayer: state.currentLayer === layer ? null : state.currentLayer
            });
        });
    };
    removeResult = (layer, result) => {
        this.setState((state) => {
            const newResultTree = {...state.resultTree};
            newResultTree[layer] = state.resultTree[layer].filter(item => item !== result);
            if (isEmpty(newResultTree[layer])) {
                delete newResultTree[layer];
            }
            const selectedLayer = isEmpty(newResultTree[layer]) ? '' : state.selectedLayer;
            return {
                resultTree: newResultTree,
                currentResult: state.currentResult === result ? null : state.currentResult,
                selectedLayer: selectedLayer
            };
        });
    };
    exportResults = (clipboard = false) => {
        const filteredResults = {};
        Object.keys(this.state.selectedLayer !== '' ? { [this.state.selectedLayer]: this.state.resultTree[this.state.selectedLayer] } : this.state.resultTree).map(key => {
            if (!isEmpty(this.state.resultTree[key])) {
                filteredResults[key] = this.state.resultTree[key];
            }
        });
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
    renderLayer = (layer) => {
        const results = this.state.resultTree[layer];
        if (results.length === 0) {
            return null;
        }
        return (
            <div className={this.getExpandedClass(layer, true)} key={layer}>
                <div className="identify-result-entry"
                    onMouseEnter={() => this.setHighlightedResults(results, this.state.resultTree)}
                    onMouseLeave={() => this.setHighlightedResults(this.state.currentResult === null ? null : [this.state.currentResult], this.state.resultTree)}
                >
                    <span className="clickable" onClick={()=> this.toggleExpanded(layer, true)}><b>{results[0].layertitle}</b></span>
                    <Icon className="identify-remove-result" icon="minus-sign" onClick={() => this.removeResultLayer(layer)} />
                    {this.props.enableExport === true || !isEmpty(this.props.enableExport) ? (<Icon className="identify-export-result" icon="export" onClick={() => this.exportResultLayer(layer)} />) : null}
                </div>
                <div className="identify-layer-entries">
                    {results.map(result => this.renderResult(layer, result))}
                </div>
            </div>
        );
    };
    renderResult = (layer, result) => {
        const ref = this.state.currentResult === result && this.scrollIntoView ? el => { this.currentResultElRef = el; } : null;
        return (
            <div className="identify-result-entry"
                key={result.id}
                onMouseEnter={() => this.setHighlightedResults([result], this.state.resultTree)}
                onMouseLeave={() => this.setHighlightedResults(this.state.currentResult === null ? null : [this.state.currentResult], this.state.resultTree)}
            >
                <span className={this.state.currentResult === result ? "active clickable" : "clickable"} onClick={()=> this.setCurrentResult(layer, result)} ref={ref}>{result.displayname}</span>
                <Icon className="identify-remove-result" icon="minus-sign" onClick={() => this.removeResult(layer, result)} />
                {this.props.enableExport === true || !isEmpty(this.props.enableExport) ? (<Icon className="identify-export-result" icon="export" onClick={() => this.exportResult(layer, result)} />) : null}
            </div>
        );
    };
    renderResultAttributes = (layer, result, resultClass, reportFeatures) => {
        if (!result) {
            return null;
        }
        let resultbox = null;
        let extraattribs = null;
        let featureReportTemplate = null;
        if (ConfigUtils.getConfigProp("documentServiceUrl")) {
            featureReportTemplate = result.featurereport || this.findFeatureReportTemplate(layer);
        }
        if (featureReportTemplate) {
            reportFeatures[layer] = [
                ...(reportFeatures[layer] || []),
                result
            ];
        }
        let inlineExtaAttribs = false;
        if (result.type === "text") {
            resultbox = (
                <pre className="identify-result-box">
                    {result.text}
                </pre>
            );
        } else if (result.type === "html") {
            resultbox = (
                <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, result.text)} ref={el => this.pollIframe(el, result.text)} />
            );
        } else if (result.properties.htmlContent) {
            if (result.properties.htmlContentInline) {
                resultbox = (
                    <div className="identify-result-box">{this.parsedContent(result.properties.htmlContent)}</div>
                );
            } else {
                resultbox = (
                    <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, result.properties.htmlContent)} ref={el => this.pollIframe(el, result.properties.htmlContent)} />
                );
            }
        } else {
            inlineExtaAttribs = true;
            const properties = Object.keys(result.properties) || [];
            let rows = [];
            if (properties.length === 1 && result.properties.maptip) {
                rows = properties.map(attrib => (
                    <tr key={attrib}>
                        <td className="identify-attr-value">{this.attribValue(result.properties[attrib], attrib, layer, result)}</td>
                    </tr>
                ));
            } else {
                rows = properties.map(attrib => {
                    if (
                        this.props.theme.skipEmptyFeatureAttributes &&
                        (result.properties[attrib] === "" || result.properties[attrib] === null || result.properties[attrib] === "NULL")
                    ) {
                        return null;
                    }
                    return (
                        <tr key={attrib}>
                            <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i>{attrib}</i></td>
                            <td className={"identify-attr-value " + this.props.longAttributesDisplay}>{this.attribValue(result.properties[attrib], attrib, layer, result)}</td>
                        </tr>
                    );
                });
            }
            rows.push(...this.computeExtraAttributes(layer, result));
            if (featureReportTemplate) {
                rows = rows.concat(
                    <tr key="__featurereport">
                        <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i>{LocaleUtils.tr("identify.featureReport")}</i></td>
                        <td className={"identify-attr-value " + this.props.longAttributesDisplay}><a href={this.getFeatureReportUrl(featureReportTemplate, result)}>{LocaleUtils.tr("identify.link")}</a></td>
                    </tr>
                );
            }
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
        if (!inlineExtaAttribs && (this.props.attributeCalculator || featureReportTemplate)) {
            extraattribs = (
                <div className="identify-result-box">
                    <table className="attribute-list"><tbody>
                        {this.computeExtraAttributes(layer, result)}
                        {featureReportTemplate ? (
                            <tr>
                                <td className={"identify-attr-title " + this.props.longAttributesDisplay}>
                                    <i>{LocaleUtils.tr("identify.featureReport")}</i>
                                </td>
                                <td className={"identify-attr-value " + this.props.longAttributesDisplay}>
                                    <a href={this.getFeatureReportUrl(featureReportTemplate, result)} rel="noreferrer" target="_blank">
                                        {LocaleUtils.tr("identify.link")}
                                    </a>
                                </td>
                            </tr>
                        ) : null}
                    </tbody></table>
                </div>
            );
        }
        let zoomToFeatureButton = null;
        if (result.bbox && result.crs) {
            zoomToFeatureButton = (<Icon icon="zoom" onClick={() => this.zoomToResult(result)} />);
        }
        const key = result + ":" + result.id;
        const expanded = this.state.expandedResults[key];
        return (
            <div className={resultClass} key="results-attributes">
                <div className="identify-result-title">
                    {this.props.collapsible ? (
                        <Icon icon={expanded ? "tree_minus" : "tree_plus"} onClick={() => this.setState(state => ({expandedResults: {...state.expandedResults, [key]: !expanded}}))} />
                    ) : (
                        <Icon icon="minus" onClick={() => this.removeResult(layer, result)} />
                    )}
                    <span>{(this.props.showLayerTitles ? (result.layertitle + ": ") : "") + result.displayname}</span>
                    {zoomToFeatureButton}
                    <Icon icon="info-sign" onClick={() => this.showLayerInfo(result)} />
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
    render() {
        const tree = this.props.displayResultTree;
        let body = null;
        const reportFeatures = {};
        if (tree) {
            const contents = Object.keys(this.state.resultTree).map(layer => this.renderLayer(layer));
            const attributes = this.renderResultAttributes(this.state.currentLayer, this.state.currentResult, 'identify-result-tree-frame', reportFeatures);
            const resultsContainerStyle = {
                maxHeight: attributes ? '10em' : 'initial'
            };
            body = [
                (<div className="identify-results-container" key="results-container" style={resultsContainerStyle}>{contents}</div>),
                attributes
            ];
        } else {
            body = (
                <div className="identify-flat-results-list">
                    {this.props.showLayerSelector ? (
                        <div className="identify-selectbox">
                            <select className="identify-layer-select" onChange={(e) => {const selectedLayer = e.target.value; this.setState({ selectedLayer });}}>
                                <option value=''>{LocaleUtils.tr("identify.layerall")}</option>
                                {Object.keys(this.state.resultTree).sort().map(
                                    layer => (
                                        <option key={layer} value={layer}>
                                            {this.state.resultTree[layer]?.[0]?.layertitle || layer}
                                        </option>
                                    ))}
                            </select>
                            <span className="identify-buttonbox-spacer" />
                            <span>{LocaleUtils.tr("identify.featurecount")}: {Object.values(this.state.selectedLayer !== '' ? this.state.resultTree[this.state.selectedLayer] : this.state.resultTree ).flat().length}</span>
                        </div>
                    ) : null}
                    {Object.keys(this.state.selectedLayer !== '' ? { [this.state.selectedLayer]: this.state.resultTree[this.state.selectedLayer] } : this.state.resultTree).map(layer => {
                        const layerResults = this.state.resultTree[layer];
                        return layerResults.map(result => {
                            const resultClass = this.state.currentResult === result ? 'identify-result-frame-highlighted' : 'identify-result-frame-normal';
                            return (
                                <div key={result.id}
                                    onMouseEnter={() => this.setState({ currentResult: result, currentLayer: layer })}
                                    onMouseLeave={() => this.setState({ currentResult: null, currentLayer: null })}
                                >
                                    {this.renderResultAttributes(layer, result, resultClass, reportFeatures)}
                                </div>
                            );
                        });
                    })
                    }
                </div>
            );
        }
        // "el.style.background='inherit'": HACK to trigger an additional repaint, since Safari/Chrome on iOS render the element cut off the first time
        const exporters = this.getExporters();
        const clipboardExportDisabled = exporters.find(entry => entry.id === this.state.exportFormat)?.allowClipboard !== true;
        return (
            <div className="identify-body" ref={el => { if (el) el.style.background = 'inherit'; } }>
                {body}
                {this.props.enableExport === true || !isEmpty(this.props.enableExport) ? (
                    <div className="identify-buttonbox">
                        <span className="identify-buttonbox-spacer" />
                        <span>{LocaleUtils.tr("identify.export")}:&nbsp;</span>
                        <div className="controlgroup">
                            <select className="combo identify-export-format" onChange={ev => this.setState({exportFormat: ev.target.value})} value={this.state.exportFormat}>
                                {exporters.filter(entry => {
                                    return !Array.isArray(this.props.enableExport) || this.props.enableExport.includes(entry.id);
                                }).map(entry => (
                                    <option key={entry.id} value={entry.id}>{entry.title ?? LocaleUtils.tr(entry.titleMsgId)}</option>
                                ))}
                            </select>
                            <button className="button" onClick={() => this.exportResults()} title={LocaleUtils.tr("identify.download")}>
                                <Icon icon="export" />
                            </button>
                            <button className="button" disabled={clipboardExportDisabled} onClick={() => this.exportResults(true)} title={LocaleUtils.tr("identify.clipboard")}>
                                <Icon icon="copy" />
                            </button>
                        </div>
                    </div>
                ) : null}
                {this.props.enableAggregatedReports && Object.values(reportFeatures).find(entry => entry.length > 1) !== undefined ? (
                    <div className="identify-buttonbox">
                        <span className="identify-buttonbox-spacer" />
                        <span>{LocaleUtils.tr("identify.aggregatedreport")}:&nbsp;</span>
                        <div className="controlgroup">
                            <select className="combo identify-export-format" onChange={ev => this.setState({selectedAggregatedReport: ev.target.value})} value={this.state.selectedAggregatedReport || ""}>
                                <option disabled value=''>{LocaleUtils.tr("identify.selectlayer")}</option>
                                {Object.entries(reportFeatures).map(([layername, results]) => {
                                    if (results.length > 1) {
                                        return (
                                            <option key={layername} value={layername}>{results[0].layertitle}</option>
                                        );
                                    }
                                    return null;
                                })}
                            </select>
                            <button
                                className="button"
                                disabled={!this.state.selectedAggregatedReport || this.state.generatingReport}
                                onClick={() => this.downloadAggregatedReport(this.state.selectedAggregatedReport, reportFeatures[this.state.selectedAggregatedReport])}
                            >
                                {this.state.generatingReport ? (<Spinner />) : (<Icon icon="report" />)}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }
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
    getFeatureReportUrl = (template, result) => {
        const serviceUrl = ConfigUtils.getConfigProp("documentServiceUrl").replace(/\/$/, "");
        const params = {
            feature: result.id,
            x: result.clickPos[0],
            y: result.clickPos[1],
            crs: this.props.mapcrs
        };
        return serviceUrl + "/" + template + "?" + Object.keys(params).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key])).join("&");
    };
    downloadAggregatedReport = (layername, results) => {
        const serviceUrl = ConfigUtils.getConfigProp("documentServiceUrl").replace(/\/$/, "");
        const params = {
            feature: results.map(result => result.id).join(","),
            x: results[0].clickPos[0],
            y: results[0].clickPos[1],
            crs: this.props.mapcrs
        };
        this.setState({generatingReport: true});
        const template = results[0].featurereport || this.findFeatureReportTemplate(layername);
        const url = serviceUrl + "/" + template + "?" + Object.keys(params).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key])).join("&");
        axios.get(url, {responseType: "arraybuffer"}).then(response => {
            FileSaver.saveAs(new Blob([response.data], {type: "application/pdf"}), layername + ".pdf");
            this.setState({generatingReport: false});
        }).catch(() => {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("identify.reportfail"));
            this.setState({generatingReport: false});
        });
    };
    showLayerInfo = (result) => {
        let match = null;
        // Search matching layer by technical name
        for (const name of [result.layername, result.layerinfo]) {
            match = LayerUtils.searchLayer(this.props.layers, 'name', name);
            if (match) {
                break;
            }
        }
        if (!match) {
            // Search matching layer by title
            match = LayerUtils.searchLayer(this.props.layers, 'title', result.layertitle);
        }
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
        text = text.replace('&#10;', '<br />');
        const options = {replace: (node) => {
            if (node.name === "a") {
                return (
                    <a href={node.attribs.href} onClick={node.attribs.onclick ? (ev) => this.evalOnClick(ev, node.attribs.onclick) : this.attributeLinkClicked} target={node.attribs.target || "_blank"}>
                        {domToReact(node.children, options)}
                    </a>
                );
            }
            return undefined;
        }};
        return htmlReactParser(text, options);
    };
    evalOnClick = (ev, onclick) => {
        // eslint-disable-next-line
        eval(onclick);
        ev.preventDefault();
    };
    attributeLinkClicked = (ev) => {
        this.props.openExternalUrl(ev.target.href, ev.target.target, {docked: this.props.iframeDialogsInitiallyDocked});
        ev.preventDefault();
    };
    zoomToResult = (result) => {
        this.props.zoomToExtent(result.bbox, result.crs);
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
    mapcrs: state.map.projection
});

export default connect(selector, {
    addLayerFeatures: addLayerFeatures,
    changeLayerProperty: changeLayerProperty,
    removeLayer: removeLayer,
    setActiveLayerInfo: setActiveLayerInfo,
    openExternalUrl: openExternalUrl,
    zoomToExtent: zoomToExtent
})(IdentifyViewer);
