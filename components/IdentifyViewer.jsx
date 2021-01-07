/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import FileSaver from 'file-saver';
import {stringify} from 'wellknown';
import ReactHtmlParser from 'react-html-parser';
import {convertNodeToElement} from 'react-html-parser';
import geojsonBbox from 'geojson-bounding-box';
import ResizeableWindow from './ResizeableWindow';
import ConfigUtils from '../utils/ConfigUtils';
import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import {setActiveLayerInfo} from '../actions/layerinfo';
import {showIframeDialog} from '../actions/windows';
import {zoomToExtent} from '../actions/map';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import Icon from './Icon';
import JSZip from 'jszip';
import './style/IdentifyViewer.css';

class IdentifyViewer extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        attributeCalculator: PropTypes.func,
        attributeTransform: PropTypes.func,
        displayResultTree: PropTypes.bool,
        enableExport: PropTypes.bool,
        featureInfoReturnsLayerName: PropTypes.bool,
        initialHeight: PropTypes.number,
        initialWidth: PropTypes.number,
        initiallyDocked: PropTypes.bool,
        layers: PropTypes.array,
        longAttributesDisplay: PropTypes.oneOf(['ellipsis', 'wrap']),
        mapcrs: PropTypes.string,
        missingResponses: PropTypes.number,
        onClose: PropTypes.func,
        removeLayer: PropTypes.func,
        responses: PropTypes.array,
        setActiveLayerInfo: PropTypes.func,
        showIframeDialog: PropTypes.func,
        theme: PropTypes.object,
        zoomToExtent: PropTypes.func
    }
    static defaultProps = {
        longAttributesDisplay: 'ellipsis',
        displayResultTree: true,
        attributeCalculator: (/* layer, feature */) => { return []; },
        attributeTransform: (name, value, layer, feature) => value,
        featureInfoReturnsLayerName: true
    }
    state = {
        expanded: {},
        resultTree: {},
        currentResult: null,
        currentLayer: null,
        displayFieldMap: {},
        exportFormat: 'json'
    }
    constructor(props) {
        super(props);
        this.currentResultElRef = null;
        this.scrollIntoView = false;
    }
    componentDidUpdate(prevProps, prevState) {
        const newState = {};
        if (prevProps.layers !== this.props.layers) {
            const displayFieldMap = {};
            for (const layer of this.props.layers) {
                this.populateDisplayFieldMap(displayFieldMap, layer);
            }
            newState.displayFieldMap = displayFieldMap;
        }
        if (this.props.missingResponses === 0 && prevProps.responses !== this.props.responses) {
            const result = {};
            const stats = {count: 0, lastResult: null};
            (this.props.responses || []).map(response => response.data ? this.parseResponse(response, result, stats) : null);
            Object.assign(newState, {
                expanded: {},
                resultTree: result,
                currentResult: stats.count === 1 ? stats.lastResult : null,
                currentLayer: stats.count === 1 ? stats.lastLayer : null
            });
        }
        if (!isEmpty(newState)) {
            this.setState(newState);
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
        this.props.removeLayer("identifyslection");
    }
    populateDisplayFieldMap = (displayFieldMap, item) => {
        if (item.sublayers) {
            item.sublayers.map(child => this.populateDisplayFieldMap(displayFieldMap, child));
        } else if (item.displayField) {
            displayFieldMap[item.name] = item.displayField;
            displayFieldMap[item.title] = item.displayField;
        }
    }
    parseResponse = (response, results, stats) => {
        let newResults = {};
        if (response.responseType === "application/json" || response.responseType === "GeoJSON") {
            newResults = IdentifyUtils.parseGeoJSONResponse(response.data, this.props.mapcrs);
        } else if (response.responseType === "text/xml") {
            newResults = IdentifyUtils.parseXmlResponse(response, this.props.mapcrs);
        } else if (response.responseType === "application/vnd.ogc.gml") {
            newResults = IdentifyUtils.parseGmlResponse(response, this.props.mapcrs);
        } else if (response.responseType === "text/plain") {
            newResults[response.request.metadata.layer] = [{type: "text", text: response.data, id: response.request.metadata.posstr}];
        } else if (response.responseType === "text/html") {
            newResults[response.request.metadata.layer] = [{type: "html", text: response.data, id: response.request.metadata.posstr}];
        }
        for (const key of Object.keys(newResults)) {
            for (const item of newResults[key]) {
                if (item.type === "Feature" && !item.bbox) {
                    item.crs = this.props.mapcrs;
                    item.bbox = geojsonBbox(item);
                }
                item.clickPos = response.request.metadata.pos;
            }
        }
        // Merge with previous
        Object.keys(newResults).map(layer => {
            if (layer in results) {
                newResults[layer].map(result => {
                    if (!results[layer].find(r => r.id === result.id)) {
                        results[layer].push(result);
                    }
                });
            } else {
                results[layer] = newResults[layer];
            }
        });
        // Stats
        Object.keys(results).map(layer => {
            const layerResults = results[layer];
            const numLayerResults = layerResults.length;
            if (numLayerResults > 0) {
                stats.count += numLayerResults;
                stats.lastResult = layerResults[numLayerResults - 1];
                stats.lastLayer = layer;
            }
        });
    }
    setHighlightedResults = (results, resultTree) => {
        if (!results) {
            results = Object.keys(resultTree).reduce((res, layer) => {
                return res.concat(resultTree[layer].map(result => ({...result, id: layer + "." + result.id})));
            }, []);
        }
        results = results.filter(result => result.type.toLowerCase() === "feature");
        if (!isEmpty(results)) {
            const layer = {
                id: "identifyslection",
                role: LayerRole.SELECTION
            };
            this.props.addLayerFeatures(layer, results, true);
        } else {
            this.props.removeLayer("identifyslection");
        }
    }
    getExpandedClass = (path, deflt) => {
        const expanded = this.state.expanded[path] !== undefined ? this.state.expanded[path] : deflt;
        return expanded ? "identify-layer-expandable identify-layer-expanded" : "identify-layer-expandable";
    }
    toggleExpanded = (path, deflt) => {
        const newstate = this.state.expanded[path] !== undefined ? !this.state.expanded[path] : !deflt;
        const diff = {};
        diff[path] = newstate;
        if (this.state.currentLayer === path && !newstate) {
            this.setState({...this.state, expanded: {...this.state.expanded, ...diff}, currentResult: null, currentLayer: null});
        } else {
            this.setState({...this.state, expanded: {...this.state.expanded, ...diff}});
        }
    }
    setCurrentResult = (layer, result) => {
        if (this.state.currentResult === result) {
            this.setState({currentResult: null, currentLayer: null});
        } else {
            this.setState({currentResult: result, currentLayer: layer});
            this.scrollIntoView = true;
        }
    }
    removeResult = (layer, result) => {
        const newResultTree = {...this.state.resultTree};
        newResultTree[layer] = this.state.resultTree[layer].filter(item => item !== result);
        this.setState({
            resultTree: newResultTree,
            currentResult: this.state.currentResult === result ? null : this.state.currentResult
        });
    }
    exportResult = (layer, result) => {
        this.export({[layer]: [result]});
    }
    removeResultLayer = (layer) => {
        const newResultTree = {...this.state.resultTree};
        delete newResultTree[layer];
        this.setState({
            resultTree: newResultTree,
            currentResult: this.state.currentLayer === layer ? null : this.state.currentResult,
            currentLayer: this.state.currentLayer === layer ? null : this.state.currentLayer
        });
    }
    exportResultLayer = (layer) => {
        this.export({[layer]: this.state.resultTree[layer]});
    }
    exportResults = () => {
        const filteredResults = {};
        Object.keys(this.state.resultTree).map(key => {
            if (!isEmpty(this.state.resultTree[key])) {
                filteredResults[key] = this.state.resultTree[key];
            }
        });
        this.export(filteredResults);
    }
    export = (json) => {
        if (this.state.exportFormat === 'json') {
            const data = JSON.stringify(json, null, ' ');
            FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), "results.json");
        } else if (this.state.exportFormat === 'geojson') {
            Object.entries(json).forEach(([layerName, features]) => {
                const data = {
                    type: "FeatureCollection",
                    features: features
                };
                FileSaver.saveAs(
                    new Blob(
                        [JSON.stringify(data, null, ' ')],
                        {type: "application/geo+json;charset=utf-8"}
                    ),
                    layerName + ".geojson");
            });
        } else if (this.state.exportFormat === 'csv') {
            let csv = "";
            Object.entries(json).forEach(([layerName, features]) => {
                features.forEach(feature => {
                    csv += layerName + ": " + this.resultDisplayName(layerName, feature) + "\n";
                    Object.entries(feature.properties || {}).forEach(([attrib, value]) => {
                        if (attrib !== "htmlContent") {
                            csv += '\t"' + attrib + '"\t"' + String(value).replace('"', '""') + '"\n';
                        }
                    });
                    if (feature.geometry) {
                        csv += '\t"geometry"\t"' + stringify(feature.geometry) + '"\n';
                    }
                });
                csv += "\n";
            });
            FileSaver.saveAs(new Blob([csv], {type: "text/plain;charset=utf-8"}), "results.csv");
        } else if (this.state.exportFormat === 'csvzip') {
            let first = true;
            let file = 0;
            const blobs = [];
            const filenames = [];
            Object.entries(json).forEach(([layerName, features]) => {
                let csv = "";
                file += 1;
                if (first) {
                    Object.entries(features[0].properties || {}).forEach(([attrib]) => {
                        if (attrib !== "htmlContent") {
                            csv += attrib  + ';' ;
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
                    Object.values(feature.properties || {}).forEach((value) => {
                        csv += String(value).replace('"', '""') + ';';
                    });
                    if (feature.geometry) {
                        csv += stringify(feature.geometry);
                    } else if (csv !== "") {
                        csv = csv.slice(0, -1); // Remove trailling semi column ;
                    }
                    csv += '\n';
                });
                first = true;
                const blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
                blobs.push(blob);
                filenames.push(layerName);
            });
            if (file > 1) {
                const zip = new JSZip();
                for (let i = 0; i < blobs.length; i++) {
                    zip.file(filenames[i] + ".csv", blobs[i]);
                }
                zip.generateAsync({type: "blob"}).then((blob) => { FileSaver.saveAs(blob, "results.zip"); });
            } else {
                FileSaver.saveAs(blobs[0], filenames[0] + ".csv");
            }
        }
    }
    resultDisplayName = (layer, result) => {
        let displayName = "";
        try {
            const displayFieldName = result.displayfield || this.state.displayFieldMap[layer];
            displayName = result.properties[displayFieldName];
        } catch (e) {
            /* Pass */
        }
        // Clear displayName if it contains HTML
        if (displayName && displayName[0] === "<") {
            displayName = "";
        }
        if (!displayName && result.properties) {
            displayName = result.properties.name || result.properties.Name || result.properties.NAME || "";
        }
        if (!displayName) {
            displayName = result.id;
        }
        return displayName;
    }
    renderResultAttributes = (layer, result, resultClass) => {
        if (!result) {
            return null;
        }
        let resultbox = null;
        let extraattribs = null;
        let featureReportTemplate = null;
        if (ConfigUtils.getConfigProp("featureReportService")) {
            featureReportTemplate = result.featurereport || this.findFeatureReportTemplate(layer);
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
                <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, result.text)} />
            );
        } else if (result.properties.htmlContent) {
            if (result.properties.htmlContentInline) {
                resultbox = (
                    <div className="identify-result-box" dangerouslySetInnerHTML={{__html: result.properties.htmlContent}} />
                );
            } else {
                resultbox = (
                    <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, result.properties.htmlContent)} />
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
            if (this.props.attributeCalculator) {
                rows = rows.concat(this.props.attributeCalculator(layer, result));
            }
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
                        {this.props.attributeCalculator ? this.props.attributeCalculator(layer, result) : null}
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
            zoomToFeatureButton = (<Icon icon="zoom" onClick={() => this.props.zoomToExtent(result.bbox, result.crs)} />);
        }
        return (
            <div className={resultClass} key="results-attributes">
                <div className="identify-result-title">
                    <span>{this.layerTitle(layer, result) + ": " + this.resultDisplayName(layer, result)}</span>
                    {zoomToFeatureButton}
                    <Icon icon="info-sign" onClick={() => this.showLayerInfo(layer, result)} />
                </div>
                <div className="identify-result-container">
                    {resultbox}
                    {extraattribs}
                </div>
            </div>
        );
    }
    setIframeContent = (iframe, html) => {
        if (iframe.getAttribute("identify-content-set")) {
            return;
        }
        iframe.setAttribute("identify-content-set", true);
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(html);
        iframe.contentWindow.document.close();
    }
    renderResult = (layer, result) => {
        const displayName = this.resultDisplayName(layer, result);
        const ref = this.state.currentResult === result && this.scrollIntoView ? el => { this.currentResultElRef = el; } : null;
        return (
            <div className="identify-result-entry"
                key={result.id}
                onMouseEnter={() => this.setHighlightedResults([result], this.state.resultTree)}
                onMouseLeave={() => this.setHighlightedResults(this.state.currentResult === null ? null : [this.state.currentResult], this.state.resultTree)}
            >
                <span className={this.state.currentResult === result ? "active clickable" : "clickable"} onClick={()=> this.setCurrentResult(layer, result)} ref={ref}>{displayName}</span>
                <Icon className="identify-remove-result" icon="minus-sign" onClick={() => this.removeResult(layer, result)} />
                {this.props.enableExport ? (<Icon className="identify-export-result" icon="export" onClick={() => this.exportResult(layer, result)} />) : null}
            </div>
        );
    }
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
                    <span className="clickable" onClick={()=> this.toggleExpanded(layer, true)}><b>{this.layerTitle(layer, {})}</b></span>
                    <Icon className="identify-remove-result" icon="minus-sign" onClick={() => this.removeResultLayer(layer)} />
                    {this.props.enableExport ? (<Icon className="identify-export-result" icon="export" onClick={() => this.exportResultLayer(layer)} />) : null}
                </div>
                <div className="identify-layer-entries">
                    {results.map(result => this.renderResult(layer, result))}
                </div>
            </div>
        );
    }
    render() {
        const tree = this.props.displayResultTree;
        let body = null;
        let haveResults = false;
        if (isEmpty(this.state.resultTree)) {
            if (this.props.missingResponses > 0) {
                body = (<div className="identify-body" role="body"><span className="identify-body-message">{LocaleUtils.tr("identify.querying")}</span></div>);
            } else {
                body = (<div className="identify-body" role="body"><span className="identify-body-message">{LocaleUtils.tr("identify.noresults")}</span></div>);
            }
        } else if (tree) {
            const contents = Object.keys(this.state.resultTree).map(layer => this.renderLayer(layer));
            const attributes = this.renderResultAttributes(this.state.currentLayer, this.state.currentResult, 'identify-result-tree-frame');
            const resultsContainerStyle = {
                maxHeight: attributes ? '10em' : 'initial'
            };
            body = [
                (<div className="identify-results-container" key="results-container" style={resultsContainerStyle}>{contents}</div>),
                attributes
            ];
            haveResults = true;
        } else {
            body = (
                <div className="identify-flat-results-list">
                    {Object.keys(this.state.resultTree).map(layer => {
                        const layerResults = this.state.resultTree[layer];
                        return layerResults.map(result => {
                            const resultClass = this.state.currentResult === result ? 'identify-result-frame-highlighted' : 'identify-result-frame-normal';
                            return (
                                <div key={result.id}
                                    onMouseEnter={() => this.setState({currentResult: result, currentLayer: layer})}
                                    onMouseLeave={() => this.setState({currentResult: null, currentLayer: null})}
                                >
                                    {this.renderResultAttributes(layer, result, resultClass)}
                                </div>
                            );
                        });
                    })}
                </div>
            );
            haveResults = true;
        }
        // "el.style.background='inherit'": HACK to trigger an additional repaint, since Safari/Chrome on iOS render the element cut off the first time
        return (
            <ResizeableWindow icon="info-sign"
                initialHeight={this.props.initialHeight} initialWidth={this.props.initialWidth}
                initialX={0} initialY={0} initiallyDocked={this.props.initiallyDocked}
                onClose={this.props.onClose} title={LocaleUtils.trmsg("identify.title")} zIndex={8}
            >
                <div className="identify-body" ref={el => { if (el) el.style.background = 'inherit'; } } role="body">
                    {body}
                    {haveResults && this.props.enableExport ? (
                        <div className="identify-buttonbox">
                            <div>
                                {LocaleUtils.tr("identify.exportformat")}&nbsp;
                                <select className="combo" onChange={ev => this.setState({exportFormat: ev.target.value})} value={this.state.exportFormat}>
                                    <option value="json">json</option>
                                    <option value="geojson">geojson</option>
                                    <option value="csv">csv</option>
                                    <option value="csvzip">csv + zip</option>
                                </select>
                                <button className="button" onClick={this.exportResults}>{LocaleUtils.tr("identify.export")}</button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </ResizeableWindow>
        );

    }
    collectFeatureReportTemplates = (entry) => {
        let reports = {};
        if (entry.sublayers) {
            for (const sublayer of entry.sublayers) {
                reports = {...reports, ...this.collectFeatureReportTemplates(sublayer)};
            }
        } else if (entry.featureReport) {
            reports[entry.title] = entry.featureReport;
        }
        return reports;
    }
    findFeatureReportTemplate = (layer) => {
        const themeLayer = this.props.layers.find(l => l.role === LayerRole.THEME);
        if (!themeLayer) {
            return null;
        }
        return this.collectFeatureReportTemplates(themeLayer)[layer] || null;
    }
    getFeatureReportUrl = (template, result) => {
        const serviceUrl = ConfigUtils.getConfigProp("featureReportService").replace(/\/$/, "");
        const params = {
            feature: result.id,
            x: result.clickPos[0],
            y: result.clickPos[1],
            crs: this.props.mapcrs
        };
        return serviceUrl + "/" + template + "?" + Object.keys(params).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key])).join("&");
    }
    layerTitle = (featureInfoLayerId, result) => {
        if (!this.props.featureInfoReturnsLayerName) {
            return featureInfoLayerId;
        }
        const layername = result.layername || featureInfoLayerId;
        // Search matching layer by technical name
        for (const layer of this.props.layers) {
            if (layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                const matchsublayer = LayerUtils.searchSubLayer(layer, 'name', layername);
                if (matchsublayer) {
                    return matchsublayer.title;
                }
            }
        }
        return layername;
    }
    showLayerInfo = (featureInfoLayerId, result) => {
        let matchlayer = null;
        let matchsublayer = null;
        const layername = result.layername || (this.props.featureInfoReturnsLayerName ? featureInfoLayerId : null);
        if (layername || result.layerinfo) {
            // Search matching layer by technical name
            for (const name of [layername, result.layerinfo]) {
                for (const layer of this.props.layers) {
                    if (layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                        matchsublayer = LayerUtils.searchSubLayer(layer, 'name', name);
                        if (matchsublayer) {
                            matchlayer = layer;
                            break;
                        }
                    }
                }
                if (matchsublayer) {
                    break;
                }
            }
        } else {
            // Search matching layer by title
            for (const layer of this.props.layers) {
                if (layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                    matchsublayer = LayerUtils.searchSubLayer(layer, 'title', featureInfoLayerId);
                    if (matchsublayer) {
                        matchlayer = layer;
                        break;
                    }
                }
            }
        }

        if (matchlayer && matchsublayer) {
            this.props.setActiveLayerInfo(matchlayer, matchsublayer);
        }
    }
    attribValue = (text, attrName, layer, result) => {
        text = "" + text; // Ensure text is a string
        text = this.props.attributeTransform(attrName, text, layer, result);
        text = MiscUtils.addLinkAnchors(text);
        return ReactHtmlParser(text, {transform: (node, index) => {
            if (node.name === "a") {
                return (
                    <a href={node.attribs.href} key={"a" + index} onClick={this.attributeLinkClicked} target={node.attribs.target || "_blank"}>
                        {node.children.map((child, idx) => (
                            <React.Fragment key={"f" + idx}>{convertNodeToElement(child, idx)}</React.Fragment>)
                        )}
                    </a>
                );
            }
            return undefined;
        }});
    }
    attributeLinkClicked = (ev) => {
        if (ev.target.target.startsWith(":")) {
            const target = ev.target.target.split(":");
            const options = target.slice(2).reduce((res, cur) => {
                const parts = cur.split("=");
                if (parts.length == 2) {
                    const value = parseFloat(parts[1]);
                    res[parts[0]] = isNaN(value) ? parts[1] : value;
                }
                return res;
            }, {});
            options.print = true;
            if (target[1] === "iframedialog") {
                this.props.showIframeDialog(target[2], ev.target.href, options);
                ev.preventDefault();
            }
        }
    }
}

const selector = (state) => ({
    theme: state.theme.current,
    layers: state.layers.flat,
    mapcrs: state.map.projection
});

export default connect(selector, {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer,
    setActiveLayerInfo: setActiveLayerInfo,
    showIframeDialog: showIframeDialog,
    zoomToExtent: zoomToExtent
})(IdentifyViewer);
