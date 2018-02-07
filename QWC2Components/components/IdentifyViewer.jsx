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
const {Glyphicon} = require('react-bootstrap');
const isEmpty = require('lodash.isempty');
const FileSaver = require('file-saver');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {LayerRole, addLayerFeatures, removeLayer} = require('../actions/layers');
const IdentifyUtils = require('../utils/IdentifyUtils');
require('./style/IdentifyViewer.css');

let urlRegEx = /((http(s)?|(s)?ftp):\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g;

class IdentifyViewer extends React.Component {
    static propTypes = {
        theme: PropTypes.object,
        missingResponses: PropTypes.number,
        responses: PropTypes.array,
        addLayerFeatures: PropTypes.func,
        removeLayer: PropTypes.func,
        enableExport: PropTypes.bool
    }
    static defaultProps = {
        enableExport: true
    }
    state = {
        expanded: {},
        resultTree: {},
        currentResult: null,
        currentLayer: null,
        displayFieldMap: {}

    }
    componentWillReceiveProps(nextProps) {
        if(nextProps.theme && nextProps.theme != this.props.theme) {
            let displayFieldMap = {};
            this.populateDisplayFieldMap(displayFieldMap, nextProps.theme);
            this.setState({displayFieldMap: displayFieldMap});
        }
        if(nextProps.missingResponses == 0 && nextProps.responses !== this.props.responses) {
            let result = {};
            let stats = {count: 0, lastResult: null};
            (nextProps.responses || []).map(response => this.parseResponse(response, result, stats));
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
    componentWillUnmount() {
        this.props.removeLayer("identifyslection");
    }
    populateDisplayFieldMap = (displayFieldMap, item) => {
        if(item.sublayers) {
            item.sublayers.map(child => this.populateDisplayFieldMap(displayFieldMap, child));
        } else if(item.displayField){
            displayFieldMap[item.name] = item.displayField;
        }
    }
    parseResponse = (response, results, stats) => {
        var newResults = {};
        if(response.request.params.info_format === "application/json" || response.request.params.outputformat == "GeoJSON") {
            newResults = IdentifyUtils.parseGeoJSONResponse(response.data, this.props.mapcrs);
        } else if(response.request.params.info_format === "text/xml") {
            newResults = IdentifyUtils.parseXmlResponse(response.data, this.props.mapcrs);
        } else if(response.request.params.info_format === "text/plain") {
            newResults[response.request.metadata.layer] = [{type: "text", text: response.data, id: response.request.metadata.posstr}];
        } else if(response.request.params.info_format === "text/html") {
            newResults[response.request.metadata.layer] = [{type: "html", text: response.data, id: response.request.metadata.posstr}];
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
            this.setState(assign({}, this.state, {currentResult: null, currentLayer: null}));
        } else {
            this.setState(assign({}, this.state, {currentResult: result, currentLayer: layer}));
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
        let data = JSON.stringify(json, null, ' ');
        FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), "results.json");
    }
    htmlEncode = (text) => {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    addLinkAnchors = (text) => {
        let value = text;
        while(match = urlRegEx.exec(value)) {
            // If URL is part of a HTML attribute, don't add anchor
            if(value.substring(match.index - 2, match.index).match(/^=['"]$/) === null) {
                let url = match[0];
                let protoUrl = url;
                if(match[1] === undefined) {
                    if(match[0].indexOf('@') !== -1) {
                        protoUrl = "mailto:" + url;
                    } else {
                        protoUrl = "http://" + url;
                    }
                }
                let anchor = "<a href=\"" + this.htmlEncode(protoUrl) + "\" target=\"_blank\">" + this.htmlEncode(url) + "</a>";
                value = value.substring(0, match.index) + anchor + value.substring(match.index + url.length);
                urlRegEx.lastIndex = match.index + anchor.length;
            }
        }
        // Reset
        urlRegEx.lastIndex = 0;
        return value;
    }
    renderResultAttributes = () => {
        let result = this.state.currentResult;
        if(!result) {
            return null;
        }
        if(result.type === "text") {
            return (
                <pre className="identify-result-box">
                    {result.text}
                </pre>
            );
        } else if(result.type === "html") {
            return (
                <iframe className="identify-result-box" src={"data:text/html," + encodeURIComponent(result.text)}></iframe>
            );
        }
        let properties = Object.keys(result.properties);
        if(properties.length === 0) {
            return null;
        }
        return (
            <div className="identify-result-box">
                <table className="attribute-list"><tbody>
                    {properties.map(attrib => {
                        if(this.props.theme.skipEmptyFeatureAttributes && (!result.properties[attrib] || result.properties[attrib] === "NULL")) {
                            return null;
                        }
                        if(properties.length === 1 && result.properties["maptip"]) {
                            return (
                                <tr key={attrib}>
                                    <td className="identify-attr-value" dangerouslySetInnerHTML={{__html: this.addLinkAnchors(result.properties[attrib])}}></td>
                                </tr>
                            );
                        } else {
                            return (
                                <tr key={attrib}>
                                    <td className="identify-attr-title"><i>{attrib}</i></td>
                                    <td className="identify-attr-value" dangerouslySetInnerHTML={{__html: this.addLinkAnchors(result.properties[attrib])}}></td>
                                </tr>
                            );
                        }
                    })}
                </tbody></table>
            </div>
        );
    }
    renderResult = (layer, result) => {
        let displayName = "";
        try {
            let displayFieldName = this.state.displayFieldMap[layer];
            displayName = result.properties[displayFieldName];
        } catch(e) {
        }
        if((!displayName || displayName[0] === "<") && result.properties) {
            displayName = result.properties.name || result.properties.Name || result.properties.NAME || "";
        }
        if(!displayName) {
            displayName = result.id;
        }
        return (
            <li key={result.id}
                className="identify-feature-result"
                onMouseOver={() => this.setHighlightedResults([result], this.state.resultTree)}
                onMouseOut={() => this.setHighlightedResults(this.state.currentResult === null ? null : [this.state.currentResult], this.state.resultTree)}
            >
                <span className={this.state.currentResult === result ? "active clickable" : "clickable"} onClick={()=> this.setCurrentResult(layer, result)}>{displayName}</span>
                <Glyphicon className="identify-remove-result" glyph="minus-sign" onClick={() => this.removeResult(layer, result)} />
                {this.props.enableExport ? (<Glyphicon className="identify-export-result" glyph="export" onClick={() => this.exportResult(layer, result)} />) : null}
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
                onMouseOver={() => this.setHighlightedResults(results, this.state.resultTree)}
                onMouseOut={() => this.setHighlightedResults(this.state.currentResult === null ? null : [this.state.currentResult], this.state.resultTree)}
                >
                    <span className="clickable" onClick={()=> this.toggleExpanded(layer, true)}><b>{layer}</b></span>
                    <Glyphicon className="identify-remove-result" glyph="minus-sign" onClick={() => this.removeResultLayer(layer)} />
                    {this.props.enableExport ? (<Glyphicon className="identify-export-result" glyph="export" onClick={() => this.exportResultLayer(layer)} />) : null}
                </div>
                <ul>
                    {results.map(result => this.renderResult(layer, result))}
                </ul>
            </li>
        );
    }
    render() {
        let contents = Object.keys(this.state.resultTree).map(layer => this.renderLayer(layer));
        if(contents.every(item => item === null)) {
            if(this.props.missingResponses > 0) {
                return (<div id="IdentifyViewer"><Message msgId="identify.querying" /></div>);
            } else {
                return (<div id="IdentifyViewer"><Message msgId="noFeatureInfo" /></div>);
            }
        }
        let attributes = this.renderResultAttributes();
        let resultsContainerStyle = {
            maxHeight: attributes ? '7em' : 'initial'
        };
        return (
            <div id="IdentifyViewer">
                <div className="identify-results-container" style={resultsContainerStyle}>
                    <ul>{contents}</ul>
                </div>
                {attributes}
                {this.props.enableExport ? (<div className="identify-buttonbox">
                    <button onClick={this.exportResults}>Export</button>
                </div>) : null}
            </div>
        );
    }
};

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    mapcrs: state && state.map && state.map ? state.map.projection : undefined
});

module.exports = {
    IdentifyViewer: connect(selector, {
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
    })(IdentifyViewer)
};
