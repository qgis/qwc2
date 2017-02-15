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
const classnames = require('classnames');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {changeLayerProperties} = require('../../MapStore2/web/client/actions/layers')
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const {toggleMapTips} = require('../actions/layertree');
const {SideBar} = require('../components/SideBar');
const UrlParams = require("../utils/UrlParams");
const LayerUtils = require('../utils/LayerUtils');
require('./style/LayerTree.css');


const LayerTree = React.createClass({
    propTypes: {
        layers: React.PropTypes.array,
        mobile: React.PropTypes.bool,
        mapTipsEnabled: React.PropTypes.bool,
        changeLayerProperties: React.PropTypes.func,
        toggleMapTips: React.PropTypes.func,
        showLegendIcons: React.PropTypes.bool
    },
    getDefaultProps() {
        return {
            layers: [],
            showLegendIcons: true
        };
    },
    getInitialState: function() {
        return {
            activemenu: null,
            legendTooltip: undefined
        };
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
        if(layer.layertreehidden) {
            return null;
        }
        let visibility = group.visibility === undefined ? true : group.visibility;
        let subtreevisibility = this.getGroupVisibility(group);
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let checkboxstate = visibility === true ? subtreevisibility === 1 ? 'checked' : 'tristate' : 'unchecked';
        let checkboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + checkboxstate + '.svg)'
        };
        let expanderstate = group.expanded ? 'minus' : 'plus';
        let expanderstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + expanderstate + '.svg)'
        };
        let sublayersContent = null;
        if(group.sublayers && group.expanded) {
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
            <div className="layertree-item-container" key={group.name}>
                <div className="layertree-item">
                    <span className="layertree-item-expander" style={expanderstyle} onClick={() => this.groupExpandendToggled(layer, path, group.expanded)}></span>
                    <span className="layertree-item-checkbox" style={checkboxstyle} onClick={() => this.groupToggled(layer, path, visibility)}></span>
                    <span className="layertree-item-title" title={group.title}>{group.title}</span>
                </div>
                {sublayersContent}
            </div>
        )
    },
    renderSubLayer(layer, sublayer, path) {
        let pathstr = layer.id + "/" + path.join("/");
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let checkboxstate = sublayer.visibility === true ? 'checked' : 'unchecked';
        let checkboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + checkboxstate + '.svg)'
        };
        let cogclasses = classnames({
            "layertree-item-cog": true,
            "layertree-item-cog-active": this.state.activemenu === pathstr
        })
        let editframe = null;
        if(this.state.activemenu === pathstr) {
            editframe = (
                <div className="layertree-item-edit-frame">
                    <span><Message msgId="layertree.transparency" /></span><input type="range" min="0" max="255" step="1" defaultValue={255-sublayer.opacity} onMouseUp={(ev) => this.sublayerTransparencyChanged(layer, path, ev.target.value)} />
                </div>
            );
        }
        let legendicon = null;
        if(this.props.showLegendIcons) {
            legendicon = (
                <span className="layertree-item-legend">
                    <img className="layertree-item-legend-thumbnail" src={this.getLegendGraphicURL(layer, sublayer)} onMouseOver={this.showLegendTooltip} onMouseOut={this.hideLegendTooltip} onTouchStart={this.showLegendTooltip} />
                </span>
            );
        }
        return (
            <div className="layertree-item-container" key={sublayer.name}>
                <div className="layertree-item">
                    <span className="layertree-item-expander"></span>
                    <span className="layertree-item-checkbox" style={checkboxstyle} onClick={() => this.sublayerToggled(layer, path)}></span>
                    {legendicon}
                    <span className="layertree-item-title" title={sublayer.title}>{sublayer.title}</span>
                    {sublayer.queryable ? (<Glyphicon className="layertree-item-queryable" glyph="info-sign" />) : null}
                    <span className="layertree-item-spacer"></span>
                    <span className={cogclasses}><Glyphicon glyph="cog" onClick={() => this.sublayerMenuToggled(pathstr)}/></span>
                </div>
                {editframe}
            </div>
        )
    },
    renderLayerTree(layer) {
        return layer.group === 'background' ? null: this.renderLayerGroup(layer, layer, []);
    },
    render() {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let checkboxstate = this.props.mapTipsEnabled === true ? 'checked' : 'unchecked';
        let checkboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + checkboxstate + '.svg)'
        };
        let maptipCheckbox = null;
        if(!this.props.mobile) {
            maptipCheckbox = (
                <div className="laytree-maptip-option">
                    <span className="layertree-item-checkbox" style={checkboxstyle} onClick={this.toggleMapTips}></span>
                    <span onClick={this.toggleMapTips}><Message msgId="layertree.maptip" /></span>
                </div>
            );
        }
        let legendTooltip = null;
        if(this.state.legendTooltip) {
            let style = {
                left: this.state.legendTooltip.x,
                top: this.state.legendTooltip.y
            };
            legendTooltip = (
                <img className="layertree-item-legend-tooltip" style={style} src={this.state.legendTooltip.img} onTouchStart={this.hideLegendTooltip}></img>
            );
        }
        return (
            <div>
                <SideBar id="LayerTree" width="20em"  title="appmenu.items.LayerTree"
                    icon={assetsPath + "/img/layers_white.svg"}
                    extraClasses={this.props.mobile ? "" : "desktop"}
                    onHide={this.hideLegendTooltip}>
                    <div role="body" className="layertree-container">
                        <div className="layertree-tree">{this.props.layers.map(this.renderLayerTree)}</div>
                        {maptipCheckbox}
                    </div>
                </SideBar>
                {legendTooltip}
            </div>
        );
    },
    cloneLayerTree(layer, sublayerpath) {
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
    groupExpandendToggled(layer, grouppath, oldexpanded) {
        if(grouppath.length === 0) {
            // Toggle entire layer
            let newlayer = assign({}, layer, {expanded: !oldexpanded});
            this.props.changeLayerProperties(layer.id, newlayer);
        } else {
            // Toggle group
            let {newlayer, newsublayer} = this.cloneLayerTree(layer, grouppath);
            newsublayer.expanded = !oldexpanded;
            this.props.changeLayerProperties(layer.id, newlayer);
        }
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
            assign(newlayer, LayerUtils.buildLayerParams(newlayer.sublayers, newlayer.drawingOrder));
            this.props.changeLayerProperties(layer.id, newlayer);
        }
    },
    sublayerToggled(layer, sublayerpath) {
        let {newlayer, newsublayer} = this.cloneLayerTree(layer, sublayerpath);
        newsublayer.visibility = !newsublayer.visibility;
        let {params, queryLayers} = LayerUtils.buildLayerParams(newlayer.sublayers, newlayer.drawingOrder);
        assign(newlayer, {params: params, queryLayers: queryLayers});
        UrlParams.updateParams({l: LayerUtils.constructUrlParam(newlayer)});
        this.props.changeLayerProperties(layer.id, newlayer);
    },
    sublayerTransparencyChanged(layer, sublayerpath, value) {
        let {newlayer, newsublayer} = this.cloneLayerTree(layer, sublayerpath);
        newsublayer.opacity = Math.max(1, 255 - value);
        assign(newlayer, LayerUtils.buildLayerParams(newlayer.sublayers, newlayer.drawingOrder));
        UrlParams.updateParams({l: LayerUtils.constructUrlParam(newlayer)});
        this.props.changeLayerProperties(layer.id, newlayer);
    },
    sublayerMenuToggled(sublayerpath) {
        this.setState({activemenu: this.state.activemenu === sublayerpath ? null : sublayerpath});
    },
    showLegendTooltip(ev) {
        this.setState({
            legendTooltip: {
                x: ev.target.getBoundingClientRect().right,
                y: ev.target.getBoundingClientRect().top,
                img: ev.target.src
            }
        });
    },
    hideLegendTooltip(ev) {
        this.setState({legendTooltip: undefined});
    },
    toggleMapTips() {
        this.props.toggleMapTips(!this.props.mapTipsEnabled)
    }
});

const selector = (state) => ({
    mobile: state.browser ? state.browser.mobile : false,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    mapTipsEnabled: state.layertree && state.layertree.maptips
});

module.exports = {
    LayerTreePlugin: connect(selector, {
        changeLayerProperties: changeLayerProperties,
        toggleMapTips: toggleMapTips
    })(LayerTree),
    reducers: {
        layers: require('../../MapStore2/web/client/reducers/layers'),
        layertree: require('../reducers/layertree')
    }
};
