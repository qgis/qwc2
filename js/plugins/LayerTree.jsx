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
const Swipeable = require('react-swipeable');
const assign = require('object-assign');
import classnames from 'classnames';
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {changeLayerProperties} = require('../../MapStore2/web/client/actions/layers')
const {toggleLayertree, toggleMapTips} = require('../actions/layertree');
const UrlParams = require("../utils/UrlParams");
const LayerUtils = require('../utils/LayerUtils');
require('./style/LayerTree.css');


const LayerTree = React.createClass({
    propTypes: {
        mobile: React.PropTypes.bool,
        layers: React.PropTypes.array,
        expanded: React.PropTypes.bool,
        mapTipsEnabled: React.PropTypes.bool,
        changeLayerProperties: React.PropTypes.func,
        toggleLayertree: React.PropTypes.func,
        toggleMapTips: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            layers: []
        };
    },
    getInitialState: function() {
        return {activemenu: null};
    },
    getLegendGraphicURL(layer, sublayer) {
        if(layer.type !== "wms") {
            return "";
        }
        return layer.url + "?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=" + sublayer.name;
    },
    getGroupVisibility(group) {
        if(!group.sublayers || group.sublayers.length === 0) {
            return 1;
        }
        let visible = 0;
        group.sublayers.map(sublayer => {
            let sublayervisibility = sublayer.visibility === undefined ? true : sublayer.visibility;
            if(sublayer.sublayers && sublayervisibility) {
                visible += this.getGroupVisibility(sublayer);
            } else {
                visible += sublayervisibility ? 1 : 0;
            }
        });
        return visible / group.sublayers.length;
    },
    renderLayerGroup(layer, group, path) {
        let visibility = group.visibility === undefined ? true : group.visibility;
        let subtreevisibility = this.getGroupVisibility(group);
        let checkclasses = classnames({
            "layertree-item-checkbox": true,
            "layertree-item-checkbox-unchecked": visibility === false,
            "layertree-item-checkbox-checked": visibility === true && subtreevisibility === 1,
            "layertree-item-checkbox-tristate": visibility === true && subtreevisibility < 1,
        });
        let sublayersContent = null;
        if(visibility > 0 && group.sublayers) {
            sublayersContent = group.sublayers.map((sublayer, idx) => {
                let subpath = [...path, idx];
                if(sublayer.sublayers) {
                    return this.renderLayerGroup(layer, sublayer, subpath)
                } else {
                    return this.renderSubLayer(layer, sublayer, subpath);
                }
            });
        }
        return (
            <div key={group.name} className="layertree-item"><span className={checkclasses} onClick={() => this.groupToggled(layer, path, visibility)}></span> <span title={group.title}>{group.title}</span>
                <div className="layertree-group">
                    {sublayersContent}
                </div>
            </div>
        )
    },
    renderSubLayer(layer, sublayer, path) {
        let pathstr = layer.id + "/" + path.join("/");
        let checkclasses = classnames({
            "layertree-item-checkbox": true,
            "layertree-item-checkbox-unchecked": !sublayer.visibility,
            "layertree-item-checkbox-checked": sublayer.visibility,
        });
        let editclasses = classnames({
            "layertree-item-edit": true,
            "layertree-item-edit-active": this.state.activemenu === pathstr
        })
        return (
            <div className="layertree-item" key={sublayer.name}>
                <span className={checkclasses} onClick={() => this.sublayerToggled(layer, path)}></span>
                <span className="layertree-item-legend">
                    <img className="layertree-item-legend-thumbnail" src={this.getLegendGraphicURL(layer, sublayer)} />
                    <img className="layertree-item-legend-tooltip" src={this.getLegendGraphicURL(layer, sublayer)} />
                </span>
                <span className="layertree-item-title" title={sublayer.title}>{sublayer.title}</span>
                {sublayer.queryable ? (<Glyphicon className="layertree-item-queryable" glyph="info-sign" />) : null}
                <span className={editclasses}>
                    <Glyphicon glyph="cog" onClick={() => this.sublayerMenuToggled(pathstr)}/>
                    <ul className="layertree-item-edit-menu">
                        <li>
                            <span><Message msgId="layertree.transparency" /></span>
                            <input type="range" min="0" max="255" step="1" defaultValue={255-sublayer.opacity} onMouseUp={(ev) => this.sublayerTransparencyChanged(layer, path, ev.target.value)} />
                        </li>
                    </ul>
                </span>
            </div>
        )
    },
    renderLayerTree(layer) {
        return layer.group === 'background' ? null: this.renderLayerGroup(layer, layer, []);
    },
    render() {
        let expanderIcon = this.props.expanded ? 'triangle-left' : 'triangle-right';
        let expandedClass = this.props.expanded ? 'expanded' : 'collapsed';
        let maptipcheckclasses = classnames({
            "layertree-item-checkbox": true,
            "layertree-item-checkbox-unchecked": !this.props.mapTipsEnabled,
            "layertree-item-checkbox-checked": this.props.mapTipsEnabled,
        });
        let maptipCheckbox = null;
        if(!this.props.mobile) {
            maptipCheckbox = (
                <div className="laytree-maptip-option">
                    <span className={maptipcheckclasses} onClick={this.toggleMapTips}></span>
                    <span onClick={this.toggleMapTips}><Message msgId="layertree.maptip" /></span>
                </div>
            );
        }
        return (
            <Swipeable onSwipedLeft={this.hideLayerTree} onSwipedRight={this.showLayerTree}>
                <div id="LayerTree" className={expandedClass}>
                    <div className="layertree-container">
                        <div className="layertree-tree">{this.props.layers.map(this.renderLayerTree)}</div>
                        {maptipCheckbox}
                    </div>
                    <div className="layertree-expander"><div><Glyphicon glyph={expanderIcon} onClick={this.layerTreeVisibilityToggled}/></div></div>
                </div>
            </Swipeable>
        );
    },
    layerTreeVisibilityToggled() {
        this.props.toggleLayertree(!this.props.expanded);
    },
    hideLayerTree() {
        if(this.props.expanded) {
            this.props.toggleLayertree(false);
        }
    },
    showLayerTree() {
        if(!this.props.expanded) {
            this.props.toggleLayertree(true);
        }
    },
    cloneLayerTree(layer, sublayerpath)
    {
        let newlayer = assign({}, layer);
        let cur = newlayer;
        for(let i = 0; i < sublayerpath.length; ++i) {
            let idx = sublayerpath[i];
            cur.sublayers = [
                ...cur.sublayers.slice(0, idx),
                assign({}, cur.sublayers[idx]),
                ...cur.sublayers.slice(idx + 1)];
            cur = cur.sublayers[idx];
        }
        return {newlayer, newsublayer: cur};
    },
    groupToggled(layer, grouppath, oldvisibility) {
        if(grouppath.length === 0) {
            // Toggle entire layer
            let newlayer = assign({}, layer, {visibility: !oldvisibility});
            this.props.changeLayerProperties(layer.id, newlayer);
        } else {
            // Toggle group
            let {newlayer, newsublayer} = this.cloneLayerTree(layer, grouppath);
            newsublayer.visibility = !oldvisibility;
            let {params, queryLayers} = LayerUtils.buildLayerParams(newlayer.sublayers);
            assign(newlayer, {params: params, queryLayers: queryLayers});
            this.props.changeLayerProperties(layer.id, newlayer);
        }
    },
    sublayerToggled(layer, sublayerpath) {
        let {newlayer, newsublayer} = this.cloneLayerTree(layer, sublayerpath);
        newsublayer.visibility = !newsublayer.visibility;
        let {params, queryLayers} = LayerUtils.buildLayerParams(newlayer.sublayers);
        assign(newlayer, {params: params, queryLayers: queryLayers});
        UrlParams.updateParams({l: params.LAYERS});
        this.props.changeLayerProperties(layer.id, newlayer);
    },
    sublayerTransparencyChanged(layer, sublayerpath, value) {
        let {newlayer, newsublayer} = this.cloneLayerTree(layer, sublayerpath);
        newsublayer.opacity = 255 - value;
        assign(newlayer, {params: LayerUtils.buildLayerParams(newlayer.sublayers)});
        this.props.changeLayerProperties(layer.id, newlayer);
    },
    sublayerMenuToggled(sublayerpath) {
        this.setState({activemenu: this.state.activemenu === sublayerpath ? null : sublayerpath});
    },
    toggleMapTips() {
        this.props.toggleMapTips(!this.props.mapTipsEnabled)
    }
});

const selector = (state) => ({
    mobile: state.browser ? state.browser.mobile : false,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    expanded: state.layertree && state.layertree.expanded !== undefined ? state.layertree.expanded : state.browser ? !state.browser.mobile : true,
    mapTipsEnabled: state.layertree && state.layertree.maptips
});

module.exports = {
    LayerTreePlugin: connect(selector, {
        changeLayerProperties: changeLayerProperties,
        toggleLayertree: toggleLayertree,
        toggleMapTips: toggleMapTips
    })(LayerTree),
    reducers: {
        layers: require('../../MapStore2/web/client/reducers/layers'),
        layertree: require('../reducers/layertree')
    }
};
