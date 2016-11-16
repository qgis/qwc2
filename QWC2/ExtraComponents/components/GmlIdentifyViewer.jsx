/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {addLayer, removeLayer, changeLayerProperties} = require('../../MapStore2/web/client/actions/layers');
const IdentifyUtils = require('../utils/IdentifyUtils');
require('./style/GmlIdentifyViewer.css');

const GmlIdentifyViewer = React.createClass({
    propTypes: {
        missingResponses: React.PropTypes.number,
        responses: React.PropTypes.array,
        layers: React.PropTypes.array,
        addLayer: React.PropTypes.func,
        removeLayer: React.PropTypes.func,
        changeLayerProperties: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            layers: []
        };
    },
    getInitialState: function() {
        return {expanded: {}, resultTree: {}, currentFeature: null};
    },
    parseResponse(response, result, stats) {
        result[response.layerMetadata.title] = IdentifyUtils.parseGmlResponsesGroupedByLayer(response.response, stats);
    },
    componentWillReceiveProps(nextProps) {
        if(nextProps.responses !== this.props.responses) {
            let result = {};
            let stats = {count: 0, lastFeature: null};
            (nextProps.responses || []).map(response => this.parseResponse(response, result, stats));
            this.setState({expanded: {}, resultTree: result, currentFeature: stats.count === 1 ? stats.lastFeature : null});
        }
    },
    componentWillUpdate(nextProps, nextState) {
        if(nextState.currentFeature !== this.state.currentFeature) {
            let haveLayer = this.props.layers.find(layer => layer.id === 'identifyselection') !== undefined;
            if(!nextState.currentFeature && haveLayer) {
                this.props.removeLayer('identifyselection');
            } else if(nextState.currentFeature && !haveLayer) {
                let layer = {
                    id: 'identifyselection',
                    name: 'identifyselection',
                    title: 'Selection',
                    type: "vector",
                    features: IdentifyUtils.gmlFeatureGeometryAsGeoJson(nextState.currentFeature),
                    featuresCrs: "EPSG:3857",
                    visibility: true,
                    queryable: false
                };
                this.props.addLayer(layer, true);
            } else if(nextState.currentFeature && haveLayer) {
                let diff = {
                    visibility: true,
                    features: IdentifyUtils.gmlFeatureGeometryAsGeoJson(nextState.currentFeature)
                };
                let newlayerprops = assign({}, this.props.layer, diff);
                this.props.changeLayerProperties('identifyselection', newlayerprops);
            }
        }
    },
    componentWillUnmount() {
        this.props.removeLayer('identifyselection');
    },
    getExpandedClass(path, deflt) {
        let expanded = this.state.expanded[path] !== undefined ? this.state.expanded[path] : deflt;
        return expanded ? "expandable expanded" : "expandable";
    },
    toggleExpanded(path, deflt) {
        let newstate = this.state.expanded[path] !== undefined ? !this.state.expanded[path] : !deflt;
        let diff = {};
        diff[path] = newstate;
        this.setState(assign({}, this.state, {expanded: assign({}, this.state.expanded, diff)}));
    },
    setCurrentFeature(feature) {
        this.setState(assign({}, this.state, {currentFeature: feature}));
    },
    renderFeatureAttributes() {
        let feature = this.state.currentFeature;
        if(!feature) {
            return null;
        }
        let attribs = [].slice.call(feature.childNodes).filter(node => node.nodeName !== "gml:boundedBy" && node.nodeName != "qgs:geometry" && node.nodeName != "#text");
        if(attribs.length === 0) {
            return null;
        }
        return (
            <ul className="attribute-list">
                {attribs.map(attrib => {
                    return (
                        <li key={attrib.nodeName}>
                            <span className="identify-attr-title"><i>{attrib.nodeName.substr(attrib.nodeName.indexOf(':') + 1)}</i></span>
                            <span className="identify-attr-value">{attrib.textContent}</span>
                        </li>
                    );
                })}
            </ul>
        );
    },
    renderFeature(feature) {
        let featureid = feature.attributes.fid.value;
        return (
            <li key={featureid} className={this.state.currentFeature === feature ? "active clickable" : "clickable" }>
                <span onClick={()=> this.setCurrentFeature(feature)}><Message msgId="identify.feature" /> <b>{featureid}</b></span>
            </li>
        );
    },
    renderSublayer(layer, sublayer) {
        let path = layer + "/" + sublayer;
        let features = this.state.resultTree[layer][sublayer];
        if(features.length === 0) {
            return null;
        }
        return (
            <li key={sublayer} className={this.getExpandedClass(path, true)}>
                <span onClick={()=> this.toggleExpanded(path, true)}><Message msgId="identify.layer" /> <b>{layer.substr(layer.indexOf(':') + 1)}</b></span>
                <ul>
                    {features.map(feature => this.renderFeature(feature))}
                </ul>
            </li>
        );
    },
    renderLayer(layer) {
        let keys = Object.keys(this.state.resultTree[layer]);
        if(keys.length === 0) {
            return null;
        }
        let layerContents = keys.map(sublayer => this.renderSublayer(layer, sublayer));
        return (
            <ul key={layer}>
                <li className={this.getExpandedClass(layer, true)}>
                    <span onClick={()=> this.toggleExpanded(layer, true)}><Message msgId="identify.theme" /> <b>{layer}</b></span>
                    <ul>{layerContents}</ul>
                </li>
            </ul>
        );
    },
    render() {
        let contents = Object.keys(this.state.resultTree).map(layer => this.renderLayer(layer));
        if(contents.every(item => item == null)) {
            if(this.props.missingResponses > 0) {
                contents = (<Message msgId="identify.querying" />);
            } else {
                contents = (<Message msgId="noFeatureInfo" />);
            }
        }
        return (
            <div id="IdentifyViewer">
                {contents}
                {this.renderFeatureAttributes()}
            </div>
        );
    }
});

const selector = (state) => ({
    layers: state.layers && state.layers.flat || []
});
module.exports = {
    GmlIdentifyViewer: connect(selector, {
        addLayer: addLayer,
        removeLayer: removeLayer,
        changeLayerProperties: changeLayerProperties
    })(GmlIdentifyViewer)
};
