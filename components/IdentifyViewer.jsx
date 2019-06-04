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
const Message = require('../components/I18N/Message');
const ConfigUtils = require('../utils/ConfigUtils');
const {LayerRole, addLayerFeatures, removeLayer} = require('../actions/layers');
const {setActiveLayerInfo} = require('../actions/layerinfo');
const IdentifyUtils = require('../utils/IdentifyUtils');
const LayerUtils = require('../utils/LayerUtils');
const MiscUtils = require('../utils/MiscUtils');
const Icon = require('./Icon');
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
        exportFormat: PropTypes.string,
        longAttributesDisplay: PropTypes.oneOf(['ellipsis', 'wrap']),
        displayResultTree: PropTypes.bool,
        attributeCalculator: PropTypes.func,
        setActiveLayerInfo: PropTypes.func
    }
    static defaultProps = {
        longAttributesDisplay: 'ellipsis',
        displayResultTree: true,
        attributeCalculator: (layer, feature) => { return []; }
    }
    state = {
        expanded: {},
        resultTree: {},
        currentResult: null,
        currentLayer: null,
        displayFieldMap: {}
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
        if(response.request.params.info_format === "application/json" || response.request.params.outputformat == "GeoJSON") {
            newResults = IdentifyUtils.parseGeoJSONResponse(response.data, this.props.mapcrs);
        } else if(response.request.params.info_format === "text/xml") {
            newResults = IdentifyUtils.parseXmlResponse(response, this.props.mapcrs);
        } else if(response.request.params.info_format === "text/plain") {
            newResults[response.request.metadata.layer] = [{type: "text", text: response.data, id: response.request.metadata.posstr}];
        } else if(response.request.params.info_format === "text/html") {
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
        return expanded ? "expandable expanded" : "expandable";
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
        this.export(result);
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
        this.export(this.state.resultTree[layer]);
    }
    exportResults = (results) => {
        let filteredResults = {};
        Object.keys(this.state.resultTree).map(key => {
            if(!isEmpty(this.state.resultTree[key])) {
                filteredResults[key] = this.state.resultTree[key];
            }
        });
        this.export(filteredResults);
    }
    export = (json) => {
        if(this.props.exportFormat.toLowerCase() === 'json') {
            let data = JSON.stringify(json, null, ' ');
            FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), "results.json");
        } else if(this.props.exportFormat.toLowerCase() === 'csv') {
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
                    <div className="identify-result-box inline-html-content" dangerouslySetInnerHTML={{__html: result.properties.htmlContent}}></div>
                );
            } else {
                resultbox = (
                    <iframe className="identify-result-box" onLoad={ev => this.setIframeContent(ev.target, result.properties.htmlContent)}></iframe>
                );
            }
            if(this.props.attributeCalculator) {
                extraattribs = (
                    <div className="identify-result-box">
                        <table className="attribute-list"><tbody>
                            {this.props.attributeCalculator(layer, result)}
                        </tbody></table>
                    </div>
                );
            }
        } else {
            let properties = Object.keys(result.properties) || [];
            let rows = [];
            if(properties.length === 1 && result.properties["maptip"]) {
                rows = properties.map(attrib =>
                    <tr key={attrib}>
                        <td className="identify-attr-value" dangerouslySetInnerHTML={{__html: MiscUtils.addLinkAnchors(result.properties[attrib])}}></td>
                    </tr>
                );
            } else {
                rows = properties.map(attrib => {
                    if(this.props.theme.skipEmptyFeatureAttributes && (!result.properties[attrib] || result.properties[attrib] === "NULL")) {
                        return null;
                    }
                    return (
                        <tr key={attrib}>
                            <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i>{attrib}</i></td>
                            <td className={"identify-attr-value " + this.props.longAttributesDisplay} dangerouslySetInnerHTML={{__html: MiscUtils.addLinkAnchors(result.properties[attrib])}}></td>
                        </tr>
                    );
                });
            }
            if(this.props.attributeCalculator) {
                rows = rows.concat(this.props.attributeCalculator(layer, result));
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
        let featureReportTemplate = null;
        if(ConfigUtils.getConfigProp("featureReportService")) {
            featureReportTemplate = result.featurereport || this.findFeatureReportTemplate(layer);
        }
        return (
            <div className={resultClass}>
                <div className="identify-result-title">
                    <span>{layer + ": " + this.resultDisplayName(layer, result)}</span>
                    <Icon icon="info-sign" onClick={() => this.showLayerInfo(layer, result)} />
                </div>
                {resultbox}
                {extraattribs}
                {featureReportTemplate ? (<div className="identify-result-feature-report-frame">
                    <a target="_blank" href={this.getFeatureReportUrl(featureReportTemplate, result)} ><Message msgId="identify.featureReport" /></a>
                </div>) : null}
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
            <li key={result.id}
                className="identify-feature-result"
                onMouseEnter={() => this.setHighlightedResults([result], this.state.resultTree)}
                onClick={() => this.setHighlightedResults([result], this.state.resultTree)}
                onMouseLeave={() => this.setHighlightedResults(this.state.currentResult === null ? null : [this.state.currentResult], this.state.resultTree)}
            >
                <span className={this.state.currentResult === result ? "active clickable" : "clickable"} onClick={()=> this.setCurrentResult(layer, result)} ref={ref}>{displayName}</span>
                <Icon className="identify-remove-result" icon="minus-sign" onClick={() => this.removeResult(layer, result)} />
                {this.props.exportFormat ? (<Icon className="identify-export-result" icon="export" onClick={() => this.exportResult(layer, result)} />) : null}
            </li>
        );
    }
    renderLayer = (layer) => {
        let results = this.state.resultTree[layer];
        if(results.length === 0) {
            return null;
        }
        return (
            <li key={layer} className={this.getExpandedClass(layer, true)}>
                <div className="identify-layer-result"
                onMouseEnter={() => this.setHighlightedResults(results, this.state.resultTree)}
                onMouseLeave={() => this.setHighlightedResults(this.state.currentResult === null ? null : [this.state.currentResult], this.state.resultTree)}
                >
                    <span className="clickable" onClick={()=> this.toggleExpanded(layer, true)}><b>{layer}</b></span>
                    <Icon className="identify-remove-result" icon="minus-sign" onClick={() => this.removeResultLayer(layer)} />
                    {this.props.exportFormat ? (<Icon className="identify-export-result" icon="export" onClick={() => this.exportResultLayer(layer)} />) : null}
                </div>
                <ul>
                    {results.map(result => this.renderResult(layer, result))}
                </ul>
            </li>
        );
    }
    render() {
        let tree = this.props.displayResultTree;
        if(isEmpty(this.state.resultTree)) {
            if(this.props.missingResponses > 0) {
                return (<div id="IdentifyViewer"><Message msgId="identify.querying" /></div>);
            } else {
                return (<div id="IdentifyViewer"><Message msgId="identify.noresults" /></div>);
            }
        }
        if(tree) {
            let contents = Object.keys(this.state.resultTree).map(layer => this.renderLayer(layer));
            let attributes = this.renderResultAttributes(this.state.currentLayer, this.state.currentResult, 'identify-result-frame');
            let resultsContainerStyle = {
                maxHeight: attributes ? '7em' : 'initial'
            };
            return (
                <div id="IdentifyViewer">
                    <div className="identify-results-container" style={resultsContainerStyle}>
                        <ul>{contents}</ul>
                    </div>
                    {attributes}
                    <div className="identify-buttonbox">
                        {this.props.exportFormat ? (<button className="button" onClick={this.exportResults}><Message msgId="identify.export" /></button>) : null}
                    </div>
                </div>
            );
        } else {
            // "el.style.background='inherit'": HACK to trigger an additional repaint, since Safari/Chrome on iOS render the element cut off the first time
            return (
                <div id="IdentifyViewer" ref={el => { if(el) el.style.background='inherit'; } }>
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
                    <div className="identify-buttonbox">
                        {this.props.exportFormat ? (<button className="button" onClick={this.exportResults}><Message msgId="identify.export" /></button>) : null}
                    </div>
                </div>
            );
        }

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
    showLayerInfo = (layertitle, result) => {
        let matchlayer = null;
        let matchsublayer = null;
        if(result.layername || result.layerinfo) {
            // Search matching layer by technical name
            for(let name of [result.layername, result.layerinfo]) {
                for(let layer of this.props.layers) {
                    if(layer.role === LayerRole.THEME) {
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
                if(layer.role === LayerRole.THEME) {
                    matchsublayer = LayerUtils.searchSubLayer(layer, 'title', layertitle);
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
        setActiveLayerInfo: setActiveLayerInfo
    })(IdentifyViewer)
};
