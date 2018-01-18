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
const {Glyphicon} = require('react-bootstrap');
const Swipeable = require('react-swipeable');
const assign = require('object-assign');
const classnames = require('classnames');
const isEmpty = require('lodash.isempty');
const Sortable = require('react-sortablejs');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {changeLayerProperties, removeLayer, reorderLayer} = require('../actions/layers')
const {setSwipe, toggleMapTips} = require('../actions/map');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const LocaleUtils = require("../../MapStore2Components/utils/LocaleUtils");
const ImportLayer = require('../components/ImportLayer');
const LayerInfoWindow = require('../components/LayerInfoWindow');
const {SideBar} = require('../components/SideBar');
const LayerUtils = require('../utils/LayerUtils');
require('./style/LayerTree.css');


class LayerTree extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        map: PropTypes.object,
        mobile: PropTypes.bool,
        mapTipsEnabled: PropTypes.bool,
        changeLayerProperties: PropTypes.func,
        removeLayer: PropTypes.func,
        reorderLayer: PropTypes.func,
        toggleMapTips: PropTypes.func,
        showLegendIcons: PropTypes.bool,
        showRootEntry: PropTypes.bool,
        showQueryableIcon: PropTypes.bool,
        allowMapTips: PropTypes.bool,
        groupTogglesSublayers: PropTypes.bool,
        layerInfoWindowSize: PropTypes.object,
        flattenGroups: PropTypes.bool,
        setSwipe: PropTypes.func
    }
    static defaultProps = {
        layers: [],
        showLegendIcons: true,
        showRootEntry: true,
        showQueryableIcon: true,
        allowMapTips: true,
        groupTogglesSublayers: false,
        layerInfoWindowSize: {width: 400, height: 480},
        flattenGroups: false
    }
    state = {
        activemenu: null,
        legendTooltip: null,
        activeinfo: null,
        sidebarwidth: "20em",
        importvisible: false
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    getGroupVisibility = (group) => {
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
    }
    renderSubLayers = (layer, group, path, enabled) => {
        return (group.sublayers || []).map((sublayer, idx) => {
            let subpath = [...path, idx];
            if(sublayer.sublayers) {
                return this.renderLayerGroup(layer, sublayer, subpath, enabled)
            } else {
                return this.renderLayer(layer, sublayer, subpath, enabled);
            }
        });
    }
    renderLayerGroup = (layer, group, path, enabled) => {
        if(this.props.flattenGroups) {
            return this.renderSubLayers(layer, group, path, enabled);
        }
        let subtreevisibility = this.getGroupVisibility(group);
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let visibility = true;
        let checkboxstate;
        if(this.props.groupTogglesSublayers) {
            visibility = subtreevisibility > 0;
            checkboxstate = subtreevisibility === 1 ? 'checked' : subtreevisibility === 0 ? 'unchecked' : 'tristate';
        } else {
            visibility = group.visibility === undefined ? true : group.visibility;
            checkboxstate = visibility === true ? subtreevisibility === 1 ? 'checked' : 'tristate' : 'unchecked';
        }
        let checkboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + checkboxstate + '.svg)'
        };
        let expanderstate = group.expanded ? 'minus' : 'plus';
        let expanderstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + expanderstate + '.svg)'
        };
        let itemclasses = {"layertree-item": true};
        if(!this.props.groupTogglesSublayers) {
            itemclasses["layertree-item-disabled"] = !enabled;
        }
        let sublayersContent = null;
        if(group.expanded) {
            sublayersContent = this.renderSubLayers(layer, group, path, enabled && visibility);
        }
        return (
            <div className="layertree-item-container" key={group.uuid}>
                <div className={classnames(itemclasses)}>
                    <span className="layertree-item-expander" style={expanderstyle} onClick={() => this.groupExpandendToggled(layer, path, group.expanded)}></span>
                    <span className="layertree-item-checkbox" style={checkboxstyle} onClick={() => this.groupToggled(layer, path, visibility)}></span>
                    <span className="layertree-item-title" title={group.title}>{group.title}</span>
                </div>
                {sublayersContent}
            </div>
        );
    }
    renderLayer = (layer, sublayer, path, enabled=true) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let checkboxstate = sublayer.visibility === true ? 'checked' : 'unchecked';
        let checkboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + checkboxstate + '.svg)'
        };
        let cogclasses = classnames({
            "layertree-item-cog": true,
            "layertree-item-cog-active": this.state.activemenu === sublayer.uuid
        })
        let itemclasses = {"layertree-item": true};
        if(!this.props.groupTogglesSublayers) {
            itemclasses["layertree-item-disabled"] = !enabled;
        }
        let editframe = null;
        if(this.state.activemenu === sublayer.uuid) {
            let reorderButtons = null;
            if(ConfigUtils.getConfigProp("allowReorderingLayers") === true) {
                reorderButtons = [
                    (<Glyphicon key="layertree-item-move-down" className="layertree-item-move" glyph="arrow-down" onClick={() => this.props.reorderLayer(layer, path, +1, this.props.map.swipe !== undefined)} />),
                    (<Glyphicon key="layertree-item-move-up" className="layertree-item-move" glyph="arrow-up" onClick={() => this.props.reorderLayer(layer, path, -1, this.props.map.swipe !== undefined)} />)
                ];
            }
            let infoButton = null;
            if(layer.type === "wms") {
                infoButton = (<Glyphicon className="layertree-item-metadata" glyph="info-sign" onClick={() => this.setState({activeinfo: {layer, sublayer}})}/>);
            }
            editframe = (
                <div className="layertree-item-edit-frame">
                    <span className="layertree-item-transparency-label"><Message msgId="layertree.transparency" /></span>
                    <input className="layertree-item-transparency-slider" type="range" min="0" max="255" step="1" defaultValue={255-sublayer.opacity} onMouseUp={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value)} />
                    {reorderButtons}
                    {infoButton}
                </div>
            );
        }
        let legendicon = null;
        if(this.props.showLegendIcons) {
            if(sublayer.legendUrl) {
                legendicon = (<img className="layertree-item-legend-thumbnail" src={sublayer.legendUrl} onMouseOver={this.showLegendTooltip} onMouseOut={this.hideLegendTooltip} onTouchStart={this.showLegendTooltip} />);
            } else if(sublayer.color) {
                legendicon = (<span className="layertree-item-legend-coloricon" style={{backgroundColor: sublayer.color}} />);
            }
        }
        let title = sublayer.title;
        return (
            <div className="layertree-item-container" key={sublayer.uuid} data-id={JSON.stringify({layer: layer.uuid, path: path})}>
                <div className={classnames(itemclasses)}>
                    <span className="layertree-item-expander"></span>
                    <span className="layertree-item-checkbox" style={checkboxstyle} onClick={() => this.layerToggled(layer, path)}></span>
                    {legendicon}
                    <span className="layertree-item-title" title={title}>{title}</span>
                    {sublayer.queryable && this.props.showQueryableIcon ? (<Glyphicon className="layertree-item-queryable" glyph="info-sign" />) : null}
                    <span className="layertree-item-spacer"></span>
                    {layer.isThemeLayer ? null : (<Glyphicon className="layertree-item-remove" glyph="trash" onClick={() => this.props.removeLayer(layer.id)}/>)}
                    <Glyphicon className={cogclasses} glyph="cog" onClick={() => this.layerMenuToggled(sublayer.uuid)}/>
                </div>
                {editframe}
            </div>
        );
    }
    renderLayerTree = (layer) => {
        if(layer.group === 'background' || layer.layertreehidden) {
            return null;
        } else if(!layer.sublayers) {
            return this.renderLayer(layer, layer, []);
        } else if(this.props.showRootEntry) {
            return this.renderLayerGroup(layer, layer, [], true);
        } else {
            return layer.sublayers.map((sublayer, idx) => {
                let subpath = [idx];
                if(sublayer.sublayers) {
                    return this.renderLayerGroup(layer, sublayer, subpath, true)
                } else {
                    return this.renderLayer(layer, sublayer, subpath, true);
                }
            });
        }
    }
    render() {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let maptipcheckboxstate = this.props.mapTipsEnabled === true ? 'checked' : 'unchecked';
        let maptipcheckboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + maptipcheckboxstate + '.svg)'
        };
        let maptipCheckbox = null;
        if(!this.props.mobile && this.props.allowMapTips) {
            maptipCheckbox = (
                <div className="layertree-option">
                    <span className="layertree-item-checkbox" style={maptipcheckboxstyle} onClick={this.toggleMapTips}></span>
                    <span onClick={this.toggleMapTips}><Message msgId="layertree.maptip" /></span>
                </div>
            );
        }
        let swipecheckboxstate = this.props.map.swipe || this.props.map.swipe === 0 ? 'checked' : 'unchecked';
        let swipecheckboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + swipecheckboxstate + '.svg)'
        };
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
        let infoWindow = null;
        if(this.state.activeinfo) {
            infoWindow = (
                <LayerInfoWindow onClose={() => this.setState({activeinfo: null})}
                    layer={this.state.activeinfo.layer} sublayer={this.state.activeinfo.sublayer} windowSize={this.props.layerInfoWindowSize}/>
            );
        }
        let printLegendTooltip = LocaleUtils.getMessageById(this.context.messages, "layertree.printlegend");
        let extraTitlebarContent = (<Glyphicon title={printLegendTooltip} className="layertree-print-legend" glyph="print" onClick={this.printLegend}/>)
        return (
            <div>
                <SideBar id="LayerTree" width={this.state.sidebarwidth}  title="appmenu.items.LayerTree"
                    icon={assetsPath + "/img/layers_white.svg"}
                    onHide={this.hideLegendTooltip}
                    extraTitlebarContent={extraTitlebarContent}>
                    <div role="body" className="layertree-container">
                        <div className="layertree-tree">
                            <Sortable options={{disabled: this.props.flattenGroups !== true}} onChange={this.onSortChange}>
                                {this.props.layers.map(this.renderLayerTree)}
                            </Sortable>
                        </div>
                        {maptipCheckbox}
                        <div className="layertree-option">
                            <span className="layertree-item-checkbox" style={swipecheckboxstyle} onClick={this.toggleSwipe}></span>
                            <span onClick={this.toggleSwipe}><Message msgId="layertree.compare" /></span>
                        </div>
                        <div className="layertree-import" onClick={this.toggleImportLayers}><img src={assetsPath + '/img/' + (this.state.importvisible ? 'collapse.svg' : 'expand.svg')} /> <Message msgId="layertree.importlayer" /></div>
                        {this.state.importvisible ? (<ImportLayer />) : null}
                    </div>
                </SideBar>
                {legendTooltip}
                {infoWindow}
            </div>
        );
    }
    onSortChange = (order, sortable, ev) => {
        let moved = JSON.parse(order[ev.newIndex]);
        let layer = this.props.layers.find(layer => layer.uuid === moved.layer);
        if(layer) {
            this.props.reorderLayer(layer, moved.path, ev.newIndex - ev.oldIndex, this.props.map.swipe !== undefined);
        }
    }
    toggleImportLayers = () => {
        let visible = !this.state.importvisible;
        this.setState({importvisible: visible, sidebarwidth: visible ? '40em' : '20em'});
    }
    cloneLayer = (layer, sublayerpath) => {
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
    }
    propagateOptions = (layer, options, path=[]) => {
        if(layer.sublayers) {
            layer.sublayers = layer.sublayers.map((sublayer, idx) => {
                if(isEmpty(path) || path[0] == idx) {
                    let newsublayer = assign({}, sublayer, options);
                    this.propagateOptions(newsublayer, options, path.slice(1));
                    return newsublayer;
                } else {
                    return sublayer;
                }
            });
        }
    }
    groupExpandendToggled = (layer, grouppath, oldexpanded) => {
        if(grouppath.length === 0) {
            // Toggle entire layer
            let newlayer = assign({}, layer, {expanded: !oldexpanded});
            this.props.changeLayerProperties(layer.id, newlayer);
        } else {
            // Toggle group
            let {newlayer, newsublayer} = this.cloneLayer(layer, grouppath);
            newsublayer.expanded = !oldexpanded;
            this.props.changeLayerProperties(layer.id, newlayer);
        }
    }
    groupToggled = (layer, grouppath, oldvisibility) => {
        if(grouppath.length === 0) {
            if(this.props.groupTogglesSublayers) {
                // Toggle group and all sublayers
                let newlayer = assign({}, layer, {visibility: !oldvisibility});
                this.propagateOptions(newlayer, {visibility: !oldvisibility});
                this.props.changeLayerProperties(layer.id, newlayer);
            } else {
                // Toggle entire layer
                let newlayer = assign({}, layer, {visibility: !oldvisibility});
                this.props.changeLayerProperties(layer.id, newlayer);
            }
        } else {
            if(this.props.groupTogglesSublayers) {
                // Toggle group and all sublayers
                let {newlayer, newsublayer} = this.cloneLayer(layer, grouppath);
                newsublayer.visibility = !oldvisibility;
                this.propagateOptions(newsublayer, {visibility: !oldvisibility});
                if(newsublayer.visibility){
                    this.propagateOptions(newlayer, {visibility: true}, grouppath);
                }
                this.props.changeLayerProperties(layer.id, newlayer);
            } else {
                // Toggle just the group
                let {newlayer, newsublayer} = this.cloneLayer(layer, grouppath);
                newsublayer.visibility = !oldvisibility;
                this.props.changeLayerProperties(layer.id, newlayer);
            }
        }
    }
    layerToggled = (layer, sublayerpath) => {
        let {newlayer, newsublayer} = this.cloneLayer(layer, sublayerpath);
        newsublayer.visibility = !newsublayer.visibility;
        if(newsublayer.visibility){
            this.propagateOptions(newlayer, {visibility: true}, sublayerpath);
        }
        this.props.changeLayerProperties(layer.id, newlayer);
    }
    layerTransparencyChanged = (layer, sublayerpath, value) => {
        let {newlayer, newsublayer} = this.cloneLayer(layer, sublayerpath);
        newsublayer.opacity = Math.max(1, 255 - value);
        this.props.changeLayerProperties(layer.id, newlayer);
    }
    layerMenuToggled = (sublayeruuid) => {
        this.setState({activemenu: this.state.activemenu === sublayeruuid ? null : sublayeruuid});
    }
    showLegendTooltip = (ev) => {
        this.setState({
            legendTooltip: {
                x: ev.target.getBoundingClientRect().right,
                y: ev.target.getBoundingClientRect().top,
                img: ev.target.src
            }
        });
    }
    hideLegendTooltip = (ev) => {
        this.setState({legendTooltip: undefined});
    }
    toggleMapTips = () => {
        this.props.toggleMapTips(!this.props.mapTipsEnabled)
    }
    toggleSwipe = () => {
        let newSwipe = this.props.map.swipe || this.props.map.swipe === 0 ? undefined : 50;
        this.props.reorderLayer(null, null, null, newSwipe !== undefined)
        this.props.setSwipe(newSwipe);
    }
    printLegend = () => {
        let body = '<p id="legendcontainerbody">';
        body += this.props.layers.map(layer => {
            if(layer.legendUrl) {
                return '<div><img src="' + layer.legendUrl + '" /></div>';
            } else if(layer.color) {
                return '<div><span style="display: inline-block; width: 1em; height: 1em; box-shadow: inset 0 0 0 1000px ' + layer.color + '; margin: 0.25em; border: 1px solid black;">&nbsp;</span>' + (layer.title || layer.name) + '</div>';
            } else {
                return "";
            }
        }).join("");
        body += "</p>";
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");

        // Ugliest code you have ever seen (it's 2017 and there still is no way to reliably know when a popup has really finished loading...)
        let win = window.open(assetsPath + "/templates/legendprint.html", "Legend", "toolbar=no, location=no, directories=no, status=no, menubar=no");
        let elapsed = 0;
        let readyStateCheckInterval = setInterval(() => {
            if (win.document.readyState === 'complete') {
                // Chrome appears to fire readyState = 'complete' too early, give it an additional 100ms to complete
                if(!win.document.getElementById("legendcontainer") && elapsed < 100) {
                    elapsed += 10;
                } else {
                    clearInterval(readyStateCheckInterval);
                    if(win.document.getElementById("legendcontainer")) {
                        win.document.getElementById("legendcontainer").innerHTML = body;
                        let printInterval = setInterval(() => {
                            clearInterval(printInterval);
                            win.focus();
                            win.print();
                            win.close();
                        }, 100);
                    } else {
                        win.document.body.innerHTML = "Broken template. An element with id=legendcontainer must exist.";
                    }
                }
            }
        }, 10);
        win.focus();
    }
};

const selector = (state) => ({
    map: state.map,
    mobile: state.browser ? state.browser.mobile : false,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    mapTipsEnabled: state.map && state.map.maptips
});

module.exports = {
    LayerTreePlugin: connect(selector, {
        changeLayerProperties: changeLayerProperties,
        removeLayer: removeLayer,
        reorderLayer: reorderLayer,
        toggleMapTips: toggleMapTips,
        setSwipe: setSwipe
    })(LayerTree),
    reducers: {
        layers: require('../reducers/layers')
    }
};
