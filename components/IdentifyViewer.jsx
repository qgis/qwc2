/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const isEmpty = require('lodash.isempty');
const FileSaver = require('file-saver');
const {stringify} = require('wellknown');
const ReactHtmlParser = require('react-html-parser').default;
const {convertNodeToElement} = require('react-html-parser');
const ResizeableWindow = require("./ResizeableWindow");
const Message = require('./I18N/Message');
const ConfigUtils = require('../utils/ConfigUtils');
const {LayerRole, addLayerFeatures, removeLayer} = require('../actions/layers');
const {setActiveLayerInfo} = require('../actions/layerinfo');
const {showIframeDialog} = require('../actions/windows');
const {zoomToExtent} = require('../actions/map');
const IdentifyUtils = require('../utils/IdentifyUtils');
const LayerUtils = require('../utils/LayerUtils');
const MiscUtils = require('../utils/MiscUtils');
const Icon = require('./Icon');
const JSZip = require('jszip');
require('./style/IdentifyViewer.css');

class IdentifyViewer extends React.Component {
    static propTypes = {
        theme: PropTypes.object,
        layers: PropTypes.array,
        mapcrs: PropTypes.string,
        missingResponses: PropTypes.number,
        responses: PropTypes.array,
        addLayerFeatures: PropTypes.func,
        removeLayer: PropTypes.func,
        enableExport: PropTypes.bool,
        longAttributesDisplay: PropTypes.oneOf(['ellipsis', 'wrap']),
        displayResultTree: PropTypes.bool,
        attributeCalculator: PropTypes.func,
        setActiveLayerInfo: PropTypes.func,
        onClose: PropTypes.func,
        featureInfoReturnsLayerName: PropTypes.bool,
        showIframeDialog: PropTypes.func,
        zoomToExtent: PropTypes.func,
        initialWidth: PropTypes.number,
        initialHeight: PropTypes.number,
        initiallyDocked: PropTypes.bool
    }
    static defaultProps = {
        longAttributesDisplay: 'ellipsis',
        displayResultTree: true,
        attributeCalculator: (layer, feature) => { return []; },
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
    componentWillReceiveProps(nextProps) {
        if(nextProps.layers !== this.props.layers) {
            let displayFieldMap = {};
            for(let layer of nextProps.layers) {
                this.populateDisplayFieldMap(displayFieldMap, layer);
            }
            this.setState({displayFieldMap: displayFieldMap});
        }
        if(nextProps.missingResponses == 0 && nextProps.responses !== this.props.responses) {
            let result = {};
            let stats = {count: 0, lastResult: null};
            (nextProps.responses || []).map(response => response.data ? this.parseResponse(response, result, stats) : null);
            this.setState({
                expanded: {},
                resultTree: result,
                currentResult: stats.count === 1 ? stats.lastResult : null,
                currentLayer: stats.count === 1 ? stats.lastLayer : null});
        }
    }
    componentWillUpdate(nextProps, nextState) {
        if(nextState.currentResult !== this.state.currentResult || nextState.resultTree !== this.state.resultTree) {
            this.setHighlightedResults(nextState.currentResult === null ? null : [nextState.currentResult], nextState.resultTree)
        }
    }
    componentDidUpdate(prevProps, prevState) {
        // Scroll to selected result
        if(this.state.currentResult && this.state.currentResult !== prevState.currentResult &&
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
        if(item.sublayers) {
            item.sublayers.map(child => this.populateDisplayFieldMap(displayFieldMap, child));
        } else if(item.displayField){
            displayFieldMap[item.name] = item.displayField;
            displayFieldMap[item.title] = item.displayField;
        }
    }
    parseResponse = (response, results, stats) => {
        let newResults = {};
        if(response.responseType === "application/json" || response.responseType == "GeoJSON") {
            newResults = IdentifyUtils.parseGeoJSONResponse(response.data, this.props.mapcrs);
        } else if(response.responseType === "text/xml") {
            newResults = IdentifyUtils.parseXmlResponse(response, this.props.mapcrs);
        } else if(response.responseType === "text/plain") {
            newResults[response.request.metadata.layer] = [{type: "text", text: response.data, id: response.request.metadata.posstr}];
        } else if(response.responseType === "text/html") {
            newResults[response.request.metadata.layer] = [{type: "html", text: response.data, id: response.request.metadata.posstr}];
        }
        for(let key of Object.keys(newResults)) {
            for(let item of newResults[key]) {
                item["clickPos"] = response.request.metadata.pos;
            }
        }
        // Merge with previous
        Object.keys(newResults).map(layer => {
            if(layer in results) {
                newResults[layer].map(result => {
                    if(!results[layer].find(r => r.id === result.id)) {
                        results[layer].push(result);
                    }
                })
            } else {
                results[layer] = newResults[layer];
            }
        });
        // Stats
        Object.keys(results).map(layer => {
            let layerResults = results[layer];
            let numLayerResults = layerResults.length;
            if(numLayerResults > 0) {
                stats.count += numLayerResults;
                stats.lastResult = layerResults[numLayerResults - 1];
                stats.lastLayer = layer;
            }
        });
    }
    setHighlightedResults = (results, resultTree) => {
        if(!results) {
            results = Object.keys(resultTree).reduce((res, layer) => {
                return res.concat(resultTree[layer].map(result => assign({}, result, {id: layer + "." + result.id})));
            }, []);
        }
        results = results.filter(result => result.type.toLowerCase() === "feature");
        if(!isEmpty(results)) {
            const layer = {
                id: "identifyslection",
                role: LayerRole.SELECTION
            };
            this.props.addLayerFeatures(layer, results, true);
        }
    }
    getExpandedClass = (path, deflt) => {
        let expanded = this.state.expanded[path] !== undefined ? this.state.expanded[path] : deflt;
        return expanded ? "identify-layer-expandable identify-layer-expanded" : "identify-layer-expandable";
    }
    toggleExpanded = (path, deflt) => {
        let newstate = this.state.expanded[path] !== undefined ? !this.state.expanded[path] : !deflt;
        let diff = {};
        diff[path] = newstate;
        if (this.state.currentLayer == path && !newstate){
            this.setState(assign({}, this.state, {expanded: assign({}, this.state.expanded, diff), currentResult: null, currentLayer: null}));
        }
        else{
            this.setState(assign({}, this.state, {expanded: assign({}, this.state.expanded, diff)}));
        }
    }
    setCurrentResult = (layer, result) => {
        if(this.state.currentResult === result) {
            this.setState({currentResult: null, currentLayer: null});
        } else {
            this.setState({currentResult: result, currentLayer: layer});
            this.scrollIntoView = true;
        }
    }
    removeResult = (layer, result) => {
        let newResultTree = assign({}, this.state.resultTree);
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
        let newResultTree = assign({}, this.state.resultTree);
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
        let filteredResults = {};
        Object.keys(this.state.resultTree).map(key => {
            if(!isEmpty(this.state.resultTree[key])) {
                filteredResults[key] = this.state.resultTree[key];
            }
        });
        this.export(filteredResults);
    }
    export = (json) => {
        if(this.state.exportFormat === 'json') {
            let data = JSON.stringify(json, null, ' ');
            FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), "results.json");
        } else if(this.state.exportFormat === 'csv') {
            let csv = "";
            Object.entries(json).forEach(([layerName, features]) => {
                csv += layerName + "\n";
                features.forEach(feature => {
                    Object.entries(feature.properties || {}).forEach(([attrib, value]) => {
                        if(attrib !== "htmlContent") {
                            csv += '\t"' + attrib + '"\t"' + String(value).replace('"', '""') + '"\n';
                        }
                    });
                    if(feature.geometry) {
                        csv += '\t"geometry"\t"' + stringify(feature.geometry) + '"\n';
                    }
                });
                csv += "\n";
            })
            FileSaver.saveAs(new Blob([csv], {type: "text/plain;charset=utf-8"}), "results.csv");
        } else if(this.state.exportFormat === 'csvzip') {
            let first = true;
            let file = 0 ;
            let blobs = [];
            let filenames = [];
            Object.entries(json).forEach(([layerName, features]) => {
                let csv = "";
                file += 1;
                if (first) {
                    Object.entries(features[0].properties || {}).forEach(([attrib]) => {
                        if(attrib !== "htmlContent") {
                            csv += attrib  + ';' ;
                        }
                    });
                    if(features[0].geometry) {
                        csv += 'geometry';
                    } else if(csv !== ""){
                        csv = csv.slice(0, -1); // Remove trailling semi column ;
                    }
                    first = false;
                    csv += '\n';
                }
                features.forEach(feature => {
                    Object.entries(feature.properties || {}).forEach(([attrib, value]) => {
                        csv += String(value).replace('"', '""') + ';';
                    });
                    if(feature.geometry) {
                        csv += stringify(feature.geometry);
                    } else if(csv !== ""){
                        csv = csv.slice(0, -1); // Remove trailling semi column ;
                    }
                    csv += '\n';
                });
                first = true;
                let blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
                blobs.push(blob);
                filenames.push(layerName);
            })
            if (file > 1) {
                let zip = new JSZip();
                for (var i = 0; i < blobs.length; i++) {
                    zip.file(filenames[i] + ".csv", blobs[i]);
                }
                zip.generateAsync({type:"blob"}).then(function (blob){
                    saveAs(blob, "results.zip");
                });
            } else {
                FileSaver.saveAs(blobs[0], filenames[0] + ".csv");
            }
        }
    }
    resultDisplayName = (layer, result) => {
        let displayName = "";
        try {
            let displayFieldName = result.displayfield || this.state.displayFieldMap[layer];
            displayName = result.properties[displayFieldName];
        } catch(e) {
        }
        // Clear displayName if it contains HTML
        if(displayName && displayName[0] === "<") {
            displayName = "";
        }
        if(!displayName && result.properties) {
            displayName = result.properties.name || result.properties.Name || result.properties.NAME || "";
        }
        if(!displayName) {
            displayName = result.id;
        }
        return displayName;
    }
    renderResultAttributes = (layer, result, resultClass) => {
        if(!result) {
            return null;
        }
        let resultbox = null;
        let extraattribs = null;
        let featureReportTemplate = null;
        if(ConfigUtils.getConfigProp("featureReportService")) {
            featureReportTemplate = result.featurereport || this.findFeatureReportTemplate(layer);
        }
        let inlineExtaAttribs = false;
        if(result.type === "text") {
            resultbox = (
                <pre className="identify-result-box">
                    {result.text}
                </pre>
            );
        } else if(result.type === "html") {
            resultbox = (
                <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, result.text)}></iframe>
            );
        } else if(result.properties.htmlContent) {
            if(result.properties.htmlContentInline) {
                resultbox = (
                    <div className="identify-result-box" dangerouslySetInnerHTML={{__html: result.properties.htmlContent}}></div>
                );
            } else {
                resultbox = (
                    <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, result.properties.htmlContent)}></iframe>
                );
            }
        } else {
            inlineExtaAttribs = true;
            let properties = Object.keys(result.properties) || [];
            let rows = [];
            if(properties.length === 1 && result.properties["maptip"]) {
                rows = properties.map(attrib =>
                    <tr key={attrib}>
                        <td className="identify-attr-value">{this.attribValue(result.properties[attrib])}</td>
                    </tr>
                );
            } else {
                rows = properties.map(attrib => {
                    if(this.props.theme.skipEmptyFeatureAttributes && (result.properties[attrib] === "" || result.properties[attrib] === null || result.properties[attrib] === "NULL")) {
                        return null;
                    }
                    return (
                        <tr key={attrib}>
                            <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i>{attrib}</i></td>
                            <td className={"identify-attr-value " + this.props.longAttributesDisplay}>{this.attribValue(result.properties[attrib])}</td>
                        </tr>
                    );
                });
            }
            if(this.props.attributeCalculator) {
                rows = rows.concat(this.props.attributeCalculator(layer, result));
            }
            if(featureReportTemplate) {
                rows = rows.concat(
                    <tr key="__featurereport">
                        <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i><Message msgId="identify.featureReport" /></i></td>
                        <td className={"identify-attr-value " + this.props.longAttributesDisplay}><a href={this.getFeatureReportUrl(featureReportTemplate, result)}><Message msgId="identify.link" /></a></td>
                    </tr>
                );
            }
            if(isEmpty(rows)) {
                rows = (
                    <tr><td className="identify-attr-value"><i><Message msgId="identify.noattributes" /></i></td></tr>
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
        if(!inlineExtaAttribs && (this.props.attributeCalculator || featureReportTemplate)) {
            extraattribs = (
                <div className="identify-result-box">
                    <table className="attribute-list"><tbody>
                        {this.props.attributeCalculator ? this.props.attributeCalculator(layer, result) : null}
                        {featureReportTemplate ? (
                            <tr>
                                <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i><Message msgId="identify.featureReport" /></i></td>
                                <td className={"identify-attr-value " + this.props.longAttributesDisplay}><a href={this.getFeatureReportUrl(featureReportTemplate, result)}><Message msgId="identify.link" /></a></td>
                            </tr>
                        ) : null}
                    </tbody></table>
                </div>
            );
        }
        let zoomToFeatureButton = null;
        if(result.bbox && result.crs) {
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
        if(iframe.getAttribute("identify-content-set")) {
            return;
        }
        iframe.setAttribute("identify-content-set", true);
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(html);
        iframe.contentWindow.document.close();
    }
    renderResult = (layer, result) => {
        let displayName = this.resultDisplayName(layer, result);
        let ref = this.state.currentResult === result && this.scrollIntoView ? el => this.currentResultElRef = el : null;
        return (
            <div key={result.id}
                className="identify-result-entry"
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
        let results = this.state.resultTree[layer];
        if(results.length === 0) {
            return null;
        }
        return (
            <div key={layer} className={this.getExpandedClass(layer, true)}>
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
        let tree = this.props.displayResultTree;
        let body = null;
        if(isEmpty(this.state.resultTree)) {
            if(this.props.missingResponses > 0) {
                body = (<div className="identify-body" role="body"><Message msgId="identify.querying" /></div>);
            } else {
                body = (<div className="identify-body" role="body"><Message msgId="identify.noresults" /></div>);
            }
        } else if(tree) {
            let contents = Object.keys(this.state.resultTree).map(layer => this.renderLayer(layer));
            let resultsContainerStyle = {
                maxHeight: attributes ? '10em' : 'initial'
            };
            body = [
                (<div key="results-container" className="identify-results-container" style={resultsContainerStyle}>{contents}</div>),
                this.renderResultAttributes(this.state.currentLayer, this.state.currentResult, 'identify-result-tree-frame')
            ];
        } else {
            body = (
                <div className="identify-flat-results-list">
                    {Object.keys(this.state.resultTree).map(layer => {
                        let layerResults = this.state.resultTree[layer];
                        return layerResults.map(result => {
                            let resultClass = this.state.currentResult == result ? 'identify-result-frame-highlighted' : 'identify-result-frame-normal';
                            return (
                                <div key={result.id}
                                    onMouseEnter={() => this.setState({currentResult: result, currentLayer: layer})}
                                    onMouseLeave={() => this.setState({currentResult: null, currentLayer: null})}
                                >{this.renderResultAttributes(layer, result, resultClass)}</div>
                            );
                        });
                    })}
                </div>
            );
        }
        // "el.style.background='inherit'": HACK to trigger an additional repaint, since Safari/Chrome on iOS render the element cut off the first time
        return (
            <ResizeableWindow title="identify.title" icon="info-sign" onClose={this.props.onClose} initialX={0} initialY={0} initiallyDocked={this.props.initiallyDocked} initialWidth={this.props.initialWidth} initialHeight={this.props.initialHeight}>
                <div className="identify-body" role="body" ref={el => { if(el) el.style.background='inherit'; } }>
                    {body}
                    {this.props.enableExport ? (
                        <div className="identify-buttonbox">
                            <div>
                                <Message msgId="identify.exportformat" />&nbsp;
                                <select className="combo" value={this.state.exportFormat} onChange={ev => this.setState({exportFormat: ev.target.value})}>
                                    <option value="json">json</option>
                                    <option value="csv">csv</option>
                                    <option value="csvzip">csv + zip</option>
                                </select>
                                <button className="button" onClick={this.exportResults}><Message msgId="identify.export" /></button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </ResizeableWindow>
        );

    }
    collectFeatureReportTemplates = (entry) => {
        let reports = {};
        if(entry.sublayers) {
            for(let sublayer of entry.sublayers) {
                reports = assign({}, reports, this.collectFeatureReportTemplates(sublayer));
            }
        } else if(entry.featureReport) {
            reports[entry.title] = entry.featureReport;
        }
        return reports;
    }
    findFeatureReportTemplate = (layer) => {
        let themeLayer = this.props.layers.find(layer => layer.role === LayerRole.THEME);
        if(!themeLayer) {
            return null;
        }
        let reports = this.collectFeatureReportTemplates(themeLayer);
        return reports[layer] || null;
    }
    getFeatureReportUrl = (template, result) => {
        let serviceUrl = ConfigUtils.getConfigProp("featureReportService").replace(/\/$/, "");
        let params = {
            feature: result.id,
            x: result.clickPos[0],
            y: result.clickPos[1],
            crs: this.props.mapcrs
        };
        return serviceUrl + "/" + template + "?" + Object.keys(params).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key])).join("&");
    }
    layerTitle = (featureInfoLayerId, result) => {
        if(!this.props.featureInfoReturnsLayerName) {
            return featureInfoLayerId;
        }
        let layername = result.layername || featureInfoLayerId;
        // Search matching layer by technical name
        for(let layer of this.props.layers) {
            if(layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                matchsublayer = LayerUtils.searchSubLayer(layer, 'name', layername);
                if(matchsublayer) {
                    return matchsublayer.title;
                }
            }
        }
        return layername;
    }
    showLayerInfo = (featureInfoLayerId, result) => {
        let matchlayer = null;
        let matchsublayer = null;
        let layername = result.layername || (this.props.featureInfoReturnsLayerName ? featureInfoLayerId : null);
        if(layername || result.layerinfo) {
            // Search matching layer by technical name
            for(let name of [layername, result.layerinfo]) {
                for(let layer of this.props.layers) {
                    if(layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                        matchsublayer = LayerUtils.searchSubLayer(layer, 'name', name);
                        if(matchsublayer) {
                            matchlayer = layer;
                            break;
                        }
                    }
                }
                if(matchsublayer) {
                    break;
                }
            }
        } else {
            // Search matching layer by title
            for(let layer of this.props.layers) {
                if(layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                    matchsublayer = LayerUtils.searchSubLayer(layer, 'title', featureInfoLayerId);
                    if(matchsublayer) {
                        matchlayer = layer;
                        break;
                    }
                }
            }
        }

        if(matchlayer && matchsublayer) {
            this.props.setActiveLayerInfo(matchlayer, matchsublayer)
        }
    }
    attribValue = (text) => {
        text = "" + text; // Ensure text is a string
        text = MiscUtils.addLinkAnchors(text);
        return ReactHtmlParser(text, {transform: (node, index) => {
            if(node.name === "a") {
                return (<a key={"a"+index} href={node.attribs.href} target={node.attribs.target||"_blank"} onClick={this.attributeLinkClicked}>{node.children.map((child,idx) => (
                    <React.Fragment key={"f"+idx}>{convertNodeToElement(child, idx)}</React.Fragment>)
                )}</a>);
            }
            return undefined;
        }});
    }
    attributeLinkClicked = (ev) => {
        if(ev.target.target.startsWith(":")) {
            let target = ev.target.target.split(":");
            let options = target.slice(2).reduce((res, cur) => {
                let parts = cur.split("=");
                if(parts.length == 2) {
                    let value = parseFloat(parts[1]);
                    res[parts[0]] = isNaN(value) ? parts[1] : value;
                }
                return res;
            }, {});
            options["print"] = true;
            if(target[1] === "iframedialog") {
                this.props.showIframeDialog(target[2], ev.target.href, options);
                ev.preventDefault();
            }
        }
    }
};

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    layers: state.layers && state.layers.flat || [],
    mapcrs: state && state.map && state.map ? state.map.projection : undefined
});

module.exports = {
    IdentifyViewer: connect(selector, {
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
        setActiveLayerInfo: setActiveLayerInfo,
        showIframeDialog: showIframeDialog,
        zoomToExtent: zoomToExtent
    })(IdentifyViewer)
};
