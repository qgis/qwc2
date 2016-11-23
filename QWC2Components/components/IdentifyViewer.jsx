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
const {Glyphicon} = require('react-bootstrap');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {addLayer, removeLayer, changeLayerProperties} = require('../../MapStore2/web/client/actions/layers');
const IdentifyUtils = require('../utils/IdentifyUtils');
require('./style/IdentifyViewer.css');

const IdentifyViewer = React.createClass({
    propTypes: {
        theme: React.PropTypes.object,
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
        return {expanded: {}, resultTree: {}, currentFeature: null, displayFieldMap: null};
    },
    populateDisplayFieldMap(displayFieldMap, item) {
        if(item.sublayers) {
            item.sublayers.map(child => this.populateDisplayFieldMap(displayFieldMap, child));
        } else if(item.displayField){
            displayFieldMap[item.title] = item.displayField;
        }
    },
    parseResponse(response, result, stats) {
        let newResult = IdentifyUtils.parseXmlResponse(response.response);
        // Merge with previous
        Object.keys(newResult).map(layer => {
            if(layer in result) {
                newResult[layer].map(feature => {
                    if(!result[layer].find(f => f.id === feature.id)) {
                        result[layer].push(feature);
                    }
                })
            } else {
                result[layer] = newResult[layer];
            }
        });
        // Stats
        Object.keys(result).map(layer => {
            result[layer].map(feature => {
                stats.count += 1;
                stats.lastFeature = feature;
            })
        })
    },
    componentWillReceiveProps(nextProps) {
        if(nextProps.theme && !this.state.displayFieldMap) {
            let displayFieldMap = {};
            if(nextProps.theme) {
                this.populateDisplayFieldMap(displayFieldMap, nextProps.theme);
            }
            this.setState({displayFieldMap: displayFieldMap});
        }
        if(nextProps.responses !== this.props.responses) {
            let result = {};
            let stats = {count: 0, lastFeature: null};
            (nextProps.responses || []).map(response => this.parseResponse(response, result, stats));
            this.setState({expanded: {}, resultTree: result, currentFeature: stats.count === 1 ? stats.lastFeature : null});
        }
    },
    componentWillUpdate(nextProps, nextState) {
        if(nextState.currentFeature !== this.state.currentFeature) {
            this.setVisibleFeatureGeometry(nextState.currentFeature);
        }
    },
    setVisibleFeatureGeometry(feature) {
        let haveLayer = this.props.layers.find(layer => layer.id === 'identifyselection') !== undefined;
        if(!feature && haveLayer) {
            this.props.removeLayer('identifyselection');
        } else if(feature && !haveLayer) {
            let layer = {
                id: 'identifyselection',
                name: 'identifyselection',
                title: 'Selection',
                type: "vector",
                features: [IdentifyUtils.wktToGeoJSON(feature.geometry)],
                featuresCrs: feature.bbox.srs,
                visibility: true,
                queryable: false
            };
            this.props.addLayer(layer, true);
        } else if(feature && haveLayer) {
            let newlayerprops = {
                visibility: true,
                features: [IdentifyUtils.wktToGeoJSON(feature.geometry)],
                featuresCrs: feature.bbox.srs
            };
            this.props.changeLayerProperties('identifyselection', newlayerprops);
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
        let attributes = Object.keys(feature.attributes);
        if(attributes.length === 0) {
            return null;
        }
        return (
            <div className="attribute-list-box">
                <table className="attribute-list"><tbody>
                    {attributes.map(attrib => {
                        return (
                            <tr key={attrib}>
                                <td className="identify-attr-title"><i>{attrib}</i></td>
                                <td className="identify-attr-value" dangerouslySetInnerHTML={{__html: feature.attributes[attrib]}}></td>
                            </tr>
                        );
                    })}
                </tbody></table>
            </div>
        );
    },
    renderFeature(layer, feature) {
        let displayName = "";
        try {
            let displayFieldName = this.state.displayFieldMap[layer];
            displayName = feature.attributes[displayFieldName];
        } catch(e) {
        }
        if(!displayName || displayName[0] === "<") {
            displayName = feature.attributes.name || feature.attributes.Name || feature.attributes.NAME || feature.id;
        }
        return (
            <li key={feature.id}
                className="identify-feature-result"
                onMouseOver={() => this.setVisibleFeatureGeometry(feature)}
                onMouseOut={() => this.setVisibleFeatureGeometry(this.state.currentFeature)}
            >
                <span className={this.state.currentFeature === feature ? "active clickable" : "clickable"} onClick={()=> this.setCurrentFeature(feature)}><b>{displayName}</b></span>
                <Glyphicon className="identify-remove-result" glyph="minus" onClick={() => this.removeResult(layer, feature)} />
            </li>
        );
    },
    renderLayer(layer) {
        let features = this.state.resultTree[layer];
        if(features.length === 0) {
            return null;
        }
        return (
            <li key={layer} className={this.getExpandedClass(layer, true)}>
                <span onClick={()=> this.toggleExpanded(layer, true)}><b>{layer}</b></span>
                <ul>
                    {features.map(feature => this.renderFeature(layer, feature))}
                </ul>
            </li>
        );
    },
    render() {
        let contents = Object.keys(this.state.resultTree).map(layer => this.renderLayer(layer));
        if(contents.every(item => item === null)) {
            if(this.props.missingResponses > 0) {
                return (<div id="IdentifyViewer"><Message msgId="identify.querying" /></div>);
            } else {
                return (<div id="IdentifyViewer"><Message msgId="noFeatureInfo" /></div>);
            }
        }
        return (
            <div id="IdentifyViewer">
                <div className="identify-results-container">
                    <ul>{contents}</ul>
                </div>
                {this.renderFeatureAttributes()}
            </div>
        );
    },
    removeResult(layer, feature) {
        let newResultTree = assign({}, this.state.resultTree);
        newResultTree[layer] = this.state.resultTree[layer].filter(item => item !== feature);
        this.setState({
            resultTree: newResultTree,
            currentFeature: this.state.currentFeature === feature ? null : this.state.currentFeature
        });
    }
});

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    layers: state.layers && state.layers.flat || []
});
module.exports = {
    IdentifyViewer: connect(selector, {
        addLayer: addLayer,
        removeLayer: removeLayer,
        changeLayerProperties: changeLayerProperties
    })(IdentifyViewer)
};
