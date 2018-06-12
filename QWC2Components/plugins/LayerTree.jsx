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
const assign = require('object-assign');
const classnames = require('classnames');
const isEmpty = require('lodash.isempty');
const Sortable = require('react-sortablejs');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {changeLayerProperties, removeLayer, reorderLayer, setSwipe} = require('../actions/layers')
const {toggleMapTips} = require('../actions/map');
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
        swipe: PropTypes.number,
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
        grayUnchecked: PropTypes.bool,
        layerInfoWindowSize: PropTypes.object,
        flattenGroups: PropTypes.bool,
        setSwipe: PropTypes.func,
        legendThumbnail: PropTypes.string
    }
    static defaultProps = {
        layers: [],
        showLegendIcons: true,
        showRootEntry: true,
        showQueryableIcon: true,
        allowMapTips: true,
        groupTogglesSublayers: false,
        grayUnchecked: true,
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
        if(isEmpty(group.sublayers)) {
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
    renderSubLayers = (layer, group, path, enabled, inMutuallyExclusiveGroup=false) => {
        return (group.sublayers || []).map((sublayer, idx) => {
            let subpath = [...path, idx];
            if(sublayer.sublayers) {
                return this.renderLayerGroup(layer, sublayer, subpath, enabled, inMutuallyExclusiveGroup)
            } else {
                return this.renderLayer(layer, sublayer, subpath, enabled, inMutuallyExclusiveGroup);
            }
        });
    }
    renderLayerGroup = (layer, group, path, enabled, inMutuallyExclusiveGroup=false) => {
        if(this.props.flattenGroups) {
            return this.renderSubLayers(layer, group, path, enabled, false);
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
            backgroundImage: 'url(' + assetsPath + '/img/' + (inMutuallyExclusiveGroup ? 'radio_' : '') + checkboxstate + '.svg)'
        };
        let expanderstate = group.expanded ? 'minus' : 'plus';
        let expanderstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + expanderstate + '.svg)'
        };
        let itemclasses = {
            "layertree-item": true,
            "layertree-item-disabled": (!this.props.groupTogglesSublayers && !enabled) || (this.props.grayUnchecked && !visibility)
        };
        let sublayersContent = null;
        if(group.expanded) {
            sublayersContent = this.renderSubLayers(layer, group, path, enabled && visibility, group.mutuallyExclusive === true);
        }
        let cogclasses = classnames({
            "layertree-item-cog": true,
            "layertree-item-cog-active": this.state.activemenu === group.uuid
        });
        let allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers") === true || !layer.isThemeLayer;
        return (
            <div className="layertree-item-container" key={group.uuid}>
                <div className={classnames(itemclasses)}>
                    <span className="layertree-item-expander" style={expanderstyle} onClick={() => this.groupExpandendToggled(layer, path, group.expanded)}></span>
                    <span className="layertree-item-checkbox" style={checkboxstyle} onClick={() => this.groupToggled(layer, path, visibility, inMutuallyExclusiveGroup)}></span>
                    <span className="layertree-item-title" title={group.title}>{group.title}</span>
                    <span className="layertree-item-spacer"></span>
                    {allowRemove ? (<Glyphicon className="layertree-item-remove" glyph="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                </div>
                {sublayersContent}
            </div>
        );
    }
    renderLayer = (layer, sublayer, path, enabled=true, inMutuallyExclusiveGroup=false) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let checkboxstate = sublayer.visibility === true ? 'checked' : 'unchecked';
        let checkboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + (inMutuallyExclusiveGroup ? 'radio_' : '') + checkboxstate + '.svg)'
        };
        let cogclasses = classnames({
            "layertree-item-cog": true,
            "layertree-item-cog-active": this.state.activemenu === sublayer.uuid
        })
        let itemclasses = {
            "layertree-item": true,
            "layertree-item-disabled": (!this.props.groupTogglesSublayers && !enabled) || (this.props.grayUnchecked && !sublayer.visibility)
        };
        let editframe = null;
        if(this.state.activemenu === sublayer.uuid) {
            let reorderButtons = null;
            if(ConfigUtils.getConfigProp("allowReorderingLayers") === true) {
                reorderButtons = [
                    (<Glyphicon key="layertree-item-move-down" className="layertree-item-move" glyph="arrow-down" onClick={() => this.props.reorderLayer(layer, path, +1)} />),
                    (<Glyphicon key="layertree-item-move-up" className="layertree-item-move" glyph="arrow-up" onClick={() => this.props.reorderLayer(layer, path, -1)} />)
                ];
            }
            let infoButton = null;
            if(layer.type === "wms") {
                infoButton = (<Glyphicon className="layertree-item-metadata" glyph="info-sign" onClick={() => this.setState({activeinfo: {layer, sublayer}})}/>);
            }
            editframe = (
                <div className="layertree-item-edit-frame" draggable="true" ref={el => this.regEventListeners(el)}>
                    <span className="layertree-item-transparency-label"><Message msgId="layertree.transparency" /></span>
                    <input className="layertree-item-transparency-slider" type="range" min="0" max="255" step="1" defaultValue={255-sublayer.opacity} onMouseUp={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value)} onTouchEnd={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value)} />
                    {reorderButtons}
                    {infoButton}
                </div>
            );
        }
        let legendicon = null;
        if(this.props.showLegendIcons) {
            if(layer.legendUrl) {
                let request = layer.legendUrl + (layer.legendUrl.indexOf('?') === -1 ? '?' : '&') + "SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=" + (layer.version || "1.3.0") + "&FORMAT=image/png&LAYER=" + sublayer.name + "&STYLE=default";
                let src = this.props.legendThumbnail ? ConfigUtils.getConfigProp("assetsPath") + '/img/' + this.props.legendThumbnail : request;
                legendicon = (<img className="layertree-item-legend-thumbnail" src={src} onMouseOver={ev => this.showLegendTooltip(ev, request)} onMouseOut={this.hideLegendTooltip} onTouchStart={ev => this.showLegendTooltip(ev, request)} />);
            } else if(layer.color) {
                legendicon = (<span className="layertree-item-legend-coloricon" style={{backgroundColor: sublayer.color}} />);
            }
        }
        let title = sublayer.title;
        let allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers") === true || !layer.isThemeLayer;
        return (
            <div className="layertree-item-container" key={sublayer.uuid} data-id={JSON.stringify({layer: layer.uuid, path: path})}>
                <div className={classnames(itemclasses)}>
                    {this.props.flattenGroups ? null : (<span className="layertree-item-expander"></span>)}
                    <span className="layertree-item-checkbox" style={checkboxstyle} onClick={() => this.layerToggled(layer, path, sublayer.visibility, inMutuallyExclusiveGroup)}></span>
                    {legendicon}
                    <span className="layertree-item-title" title={title}>{title}</span>
                    {sublayer.queryable && this.props.showQueryableIcon ? (<Glyphicon className="layertree-item-queryable" glyph="info-sign" />) : null}
                    <span className="layertree-item-spacer"></span>
                    {allowRemove ? (<Glyphicon className="layertree-item-remove" glyph="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                    <Glyphicon className={cogclasses} glyph="cog" onClick={() => this.layerMenuToggled(sublayer.uuid)}/>
                </div>
                {editframe}
            </div>
        );
    }
    regEventListeners = (el) => {
        if(!el) {
            return;
        }
        let killEvent = (ev) => { ev.stopPropagation(); }
        el.addEventListener('touchstart', killEvent, {passive: false});
        el.addEventListener('dragstart', ev => {ev.preventDefault(); ev.stopPropagation();}, {passive: false});
        el.addEventListener('pointerdown', killEvent, {passive: false});
        el.addEventListener('mousedown', killEvent, {passive: false});
    }
    renderLayerTree = (layer) => {
        if(layer.group === 'background' || layer.layertreehidden) {
            return null;
        } else if(!Array.isArray(layer.sublayers)) {
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
        let swipecheckboxstate = this.props.swipe || this.props.swipe === 0 ? 'checked' : 'unchecked';
        let swipecheckboxstyle = {
            backgroundImage: 'url(' + assetsPath + '/img/' + swipecheckboxstate + '.svg)'
        };
        let legendTooltip = null;
        if(this.state.legendTooltip) {
            let style = {
                left: this.state.legendTooltip.x,
                top: this.state.legendTooltip.y,
                maxWidth: (window.innerWidth - this.state.legendTooltip.x - 2),
                maxHeight: (window.innerHeight - this.state.legendTooltip.y - 2)
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
                        <div className="layertree-tree" onTouchMove={ev => { if(this.props.flattenGroups) ev.stopPropagation(); }}>
                            <Sortable options={{disabled: this.props.flattenGroups !== true, ghostClass: 'drop-ghost'}} onChange={this.onSortChange}>
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
            this.props.reorderLayer(layer, moved.path, ev.newIndex - ev.oldIndex);
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
            this.props.changeLayerProperties(layer.uuid, newlayer);
        } else {
            // Toggle group
            let {newlayer, newsublayer} = this.cloneLayer(layer, grouppath);
            newsublayer.expanded = !oldexpanded;
            this.props.changeLayerProperties(layer.uuid, newlayer);
        }
    }
    groupToggled = (layer, grouppath, oldvisibility, inMutuallyExclusiveGroup) => {
        if(inMutuallyExclusiveGroup) {
            this.toggleMutuallyExclusive(layer, grouppath, oldvisibility);
        } else if(grouppath.length === 0) {
            if(this.props.groupTogglesSublayers) {
                // Toggle group and all sublayers
                let newlayer = assign({}, layer, {visibility: !oldvisibility});
                this.propagateOptions(newlayer, {visibility: !oldvisibility});
                this.props.changeLayerProperties(layer.uuid, newlayer);
            } else {
                // Toggle entire layer
                let newlayer = assign({}, layer, {visibility: !oldvisibility});
                this.props.changeLayerProperties(layer.uuid, newlayer);
            }
        } else {
            let {newlayer, newsublayer} = this.cloneLayer(layer, grouppath);
            newsublayer.visibility = !oldvisibility;
            if(this.props.groupTogglesSublayers) {
                // Toggle group and all sublayers
                 if(!newsublayer.mutuallyExclusive) {
                     this.propagateOptions(newsublayer, {visibility: !oldvisibility});
                 } else {
                     this.propagateOptions(newsublayer, {visibility: false});
                     if(newsublayer.visibility && newsublayer.sublayers.length > 0) {
                         newsublayer.sublayers[0] = assign({}, newsublayer.sublayers[0], {visibility: true});
                     }
                 }
            }
            // If item becomes visible, ensure all parents are visible
            if(newsublayer.visibility){
                newlayer.visibility = true;
                this.propagateOptions(newlayer, {visibility: true}, grouppath);
            }
            this.props.changeLayerProperties(layer.uuid, newlayer);
        }
    }
    layerToggled = (layer, sublayerpath, oldvisibility, inMutuallyExclusiveGroup) => {
        if(inMutuallyExclusiveGroup) {
            this.toggleMutuallyExclusive(layer, sublayerpath, oldvisibility);
        } else {
            let {newlayer, newsublayer} = this.cloneLayer(layer, sublayerpath);
            newsublayer.visibility = !newsublayer.visibility;
            if(newsublayer.visibility){
                newlayer.visibility = true;
                this.propagateOptions(newlayer, {visibility: true}, sublayerpath);
            }
            this.props.changeLayerProperties(layer.uuid, newlayer);
        }
    }
    toggleMutuallyExclusive = (layer, path, oldvisibility) => {
        if(oldvisibility || path.length < 1) {
            // Don't allow de-selectig selected item in mutually exclusive group
            // (You need to click on another item to change the visible item)
            return;
        } else {
            let parentPath = path.slice(0, path.length - 1);
            let {newlayer, newsublayer} = this.cloneLayer(layer, parentPath);
            let visibleIdx = path[path.length - 1];
            let newsublayers = [];
            for(let i = 0; i < newsublayer.sublayers.length; ++i) {
                newsublayers.push(assign({}, newsublayer.sublayers[i], {visibility: i === visibleIdx}));
            }
            newsublayer.sublayers = newsublayers;
            // If item becomes visible, ensure all parents are visible
            if(!oldvisibility){
                newlayer.visibility = true;
                this.propagateOptions(newlayer, {visibility: true}, path);
            }
            this.props.changeLayerProperties(layer.uuid, newlayer);
        }
    }
    layerTransparencyChanged = (layer, sublayerpath, value) => {
        let {newlayer, newsublayer} = this.cloneLayer(layer, sublayerpath);
        newsublayer.opacity = Math.max(1, 255 - value);
        this.props.changeLayerProperties(layer.uuid, newlayer);
    }
    layerMenuToggled = (sublayeruuid) => {
        this.setState({activemenu: this.state.activemenu === sublayeruuid ? null : sublayeruuid});
    }
    showLegendTooltip = (ev, request) => {
        this.setState({
            legendTooltip: {
                x: ev.target.getBoundingClientRect().right,
                y: ev.target.getBoundingClientRect().top,
                img: request
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
        this.props.setSwipe(this.props.swipe || this.props.swipe === 0 ? undefined : 50);
    }
    printLegend = () => {
        let body = '<p id="legendcontainerbody">';
        body += this.props.layers.map(layer => {
            if(layer.legendUrl) {
                return layer.params.LAYERS.split(",").map(sublayer => {
                    let request = layer.legendUrl + (layer.legendUrl.indexOf('?') === -1 ? '?' : '&') + "SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=" + (layer.version || "1.3.0") + "&FORMAT=image/png&LAYER=" + sublayer + "&STYLE=default";
                    return '<div><img src="' + request + '" /></div>';
                }).join("\n");
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
    mobile: state.browser ? state.browser.mobile : false,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    swipe: state.layers && state.layers.swipe || undefined,
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
