/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {Glyphicon} = require('react-bootstrap');
const assign = require('object-assign');
import classnames from 'classnames';
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {changeLayerProperties} = require('../../MapStore2/web/client/actions/layers')
const {toggleLayertree} = require('../actions/layertree');
const UrlParams = require("../utils/UrlParams");
require('./style/LayerTree.css');


const LayerTree = React.createClass({
    propTypes: {
        layers: React.PropTypes.array,
        expanded: React.PropTypes.bool,
        changeLayerProperties: React.PropTypes.func,
        toggleLayertree: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            layers: [],
            visible: false,
        };
    },
    getInitialState: function() {
        return {activemenu: null};
    },
    getLegendGraphicURL(layer, sublayer) {
        if(layer.type !== "wms") {
            return "";
        }
        return layer.url + "?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=" + sublayer;
    },
    renderSubLayers(layer) {
        let sublayers = layer.subLayers || [];
        let opacities = layer.opacities || [];
        while(opacities.length < sublayers.length) {
            opacities.push(255);
        }
        let activesublayers = layer.params && layer.params.LAYERS ? layer.params.LAYERS : [];
        return (
            sublayers.map((sublayer, idx) => {
                let checkclasses = classnames({
                    "layertree-item-checkbox": true,
                    "layertree-item-checkbox-unchecked": !activesublayers.includes(sublayer),
                    "layertree-item-checkbox-checked": activesublayers.includes(sublayer),
                });
                let editclasses = classnames({
                    "layertree-item-edit": true,
                    "layertree-item-edit-active": this.state.activemenu === layer.id + "/" + sublayer
                })
                return (
                    <li className="layertree-item" key={sublayer}>
                        <span className={checkclasses} onClick={() => this.sublayerToggled(layer, sublayer)}></span>
                        <span className="layertree-item-legend">
                            <img className="layertree-item-legend-tooltip" src={this.getLegendGraphicURL(layer, sublayer)} />
                            <img className="layertree-item-legend-thumbnail" src={this.getLegendGraphicURL(layer, sublayer)} />
                        </span>
                        <span>{sublayer}</span>
                        {layer.queryLayers.includes(sublayer) ? (<Glyphicon className="layertree-item-queryable" glyph="info-sign" />) : null}
                        <span className={editclasses}>
                            <Glyphicon glyph="cog" onClick={() => this.sublayerMenuToggled(layer.id + "/" + sublayer)}/>
                            <ul className="layertree-item-edit-menu">
                                <li>
                                    <span><Message msgId="layertree.transparency" /></span>
                                    <input type="range" min="0" max="255" step="1" defaultValue={255-opacities[idx]} onMouseUp={(ev) => this.sublayerTransparencyChanged(layer, sublayer, ev.target.value)} />
                                </li>
                            </ul>
                        </span>
                    </li>
                )
            })
        );
    },
    renderLayerTree(layer) {
        if(layer.group === 'background') {
            return null;
        }
        let checkclasses = classnames({
            "layertree-item-checkbox": true,
            "layertree-item-checkbox-unchecked": !layer.visibility,
            "layertree-item-checkbox-checked": layer.visibility,
        });
        return (
            <ul key={layer.name}>
                <li><span className={checkclasses} onClick={() => this.layerToggled(layer)}></span> {layer.title}
                    <ul>{layer.visibility ? this.renderSubLayers(layer) : null}</ul>
                </li>
            </ul>
        )
    },
    render() {
        let expanderIcon = this.props.expanded ? 'triangle-left' : 'triangle-right';
        let expandedClass = this.props.expanded ? 'expanded' : 'collapsed';
        return (
            <div id="LayerTree" className={expandedClass}>
                <div className="layertree-container">{this.props.layers.map(this.renderLayerTree)}</div>
                <div className="layertree-expander"><div><Glyphicon glyph={expanderIcon} onClick={this.layerTreeVisibilityToggled}/></div></div>
            </div>
        );
    },
    layerTreeVisibilityToggled() {
        this.props.toggleLayertree(!this.props.expanded);
    },
    layerToggled(layer) {
        let newlayerprops = assign({}, layer, {visibility: !layer.visibility});
        this.props.changeLayerProperties(layer.id, newlayerprops);
    },
    buildLayerParams(layer, visiblelayers) {
        let newparams = assign({}, layer.params, {LAYERS: [], OPACITIES: []});
        let layers = [];
        let opacities = [];
        for(let i = 0, n = layer.subLayers.length; i < n; ++i) {
            if(visiblelayers.includes(layer.subLayers[i])) {
                layers.push(layer.subLayers[i]);
                opacities.push(layer.opacities[i].toString());
            }
        }
        newparams.LAYERS = layers.join(",");
        newparams.OPACITIES = opacities.join(",");
        return newparams;
    },
    sublayerToggled(layer, sublayer) {
        let visiblelayers = layer.params && layer.params.LAYERS ? layer.params.LAYERS.split(",") : [];
        if(visiblelayers.includes(sublayer)) {
            visiblelayers.splice(visiblelayers.indexOf(sublayer), 1);
        } else {
            visiblelayers.push(sublayer);
        }
        UrlParams.updateParams({l: visiblelayers.join(",")});

        let newlayerprops = assign({}, layer, {params: this.buildLayerParams(layer, visiblelayers)});
        this.props.changeLayerProperties(layer.id, newlayerprops);
    },
    sublayerMenuToggled(name) {
        this.setState({activemenu: this.state.activemenu === name ? null : name});
    },
    sublayerTransparencyChanged(layer, sublayer, value) {
        let newlayerprops = assign({}, layer);
        let idx = newlayerprops.subLayers.indexOf(sublayer);
        if(idx != -1) {
            newlayerprops.opacities = [...layer.opacities.slice(0, idx), 255-value, ...layer.opacities.slice(idx+1)];
        }
        let sublayers = layer.params && layer.params.LAYERS ? layer.params.LAYERS : [];
        newlayerprops.params = this.buildLayerParams(layer, sublayers);
        this.props.changeLayerProperties(layer.id, newlayerprops);
    }
});

const selector = (state) => ({
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    expanded: state.layertree ? state.layertree.expanded : true
});

module.exports = {
    LayerTreePlugin: connect(selector, {
        changeLayerProperties: changeLayerProperties,
        toggleLayertree: toggleLayertree
    })(LayerTree),
    reducers: {
        layers: require('../../MapStore2/web/client/reducers/layers'),
        layertree: require('../reducers/layertree')
    }
};
