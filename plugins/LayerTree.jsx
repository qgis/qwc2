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
const classnames = require('classnames');
const isEmpty = require('lodash.isempty');
const Sortable = require('react-sortablejs');
const Message = require('../components/I18N/Message');
const {LayerRole, changeLayerProperties, removeLayer, reorderLayer, setSwipe} = require('../actions/layers')
const {setActiveLayerInfo} = require('../actions/layerinfo');
const {toggleMapTips} = require('../actions/map');
const ConfigUtils = require("../utils/ConfigUtils");
const LocaleUtils = require("../utils/LocaleUtils");
const Icon = require('../components/Icon');
const ImportLayer = require('../components/ImportLayer');
const LayerInfoWindow = require('../components/LayerInfoWindow');
const {SideBar} = require('../components/SideBar');
const Spinner = require('../components/Spinner');
const LayerUtils = require('../utils/LayerUtils');
const ThemeUtils = require('../utils/ThemeUtils');
require('./style/LayerTree.css');


class LayerTree extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        swipe: PropTypes.number,
        mobile: PropTypes.bool,
        ie: PropTypes.bool,
        theme: PropTypes.object,
        mapTipsEnabled: PropTypes.bool,
        changeLayerProperties: PropTypes.func,
        removeLayer: PropTypes.func,
        reorderLayer: PropTypes.func,
        toggleMapTips: PropTypes.func,
        showLegendIcons: PropTypes.bool,
        showRootEntry: PropTypes.bool,
        showQueryableIcon: PropTypes.bool,
        allowMapTips: PropTypes.bool,
        allowCompare: PropTypes.bool,
        allowImport: PropTypes.bool,
        groupTogglesSublayers: PropTypes.bool,
        grayUnchecked: PropTypes.bool,
        layerInfoWindowSize: PropTypes.object,
        bboxDependentLegend: PropTypes.bool,
        flattenGroups: PropTypes.bool,
        setSwipe: PropTypes.func,
        setActiveLayerInfo: PropTypes.func,
        width: PropTypes.string,
        enableLegendPrint: PropTypes.bool,
        infoInSettings: PropTypes.bool
    }
    static defaultProps = {
        layers: [],
        showLegendIcons: true,
        showRootEntry: true,
        showQueryableIcon: true,
        allowMapTips: true,
        allowCompare: true,
        allowImport: true,
        groupTogglesSublayers: false,
        grayUnchecked: true,
        layerInfoWindowSize: {width: 320, height: 480},
        bboxDependentLegend: false,
        flattenGroups: false,
        width: "20em",
        enableLegendPrint: true,
        infoInSettings: true
    }
    state = {
        activemenu: null,
        legendTooltip: null,
        sidebarwidth: null,
        importvisible: false
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    constructor(props) {
        super(props);
        this.legendPrintWindow = null;
        window.addEventListener('beforeunload', (ev) => {
            if(this.legendPrintWindow && !this.legendPrintWindow.closed) {
                this.legendPrintWindow.close();
            }
        });
    }
    componentWillReceiveProps(newProps) {
        if(newProps.theme.mapTips !== undefined && newProps.theme.mapTips !== this.props.theme.mapTips) {
            this.props.toggleMapTips(newProps.theme.mapTips);
        }
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
        let visibility = true;
        let checkboxstate;
        if(this.props.groupTogglesSublayers) {
            visibility = subtreevisibility > 0;
            checkboxstate = subtreevisibility === 1 ? 'checked' : subtreevisibility === 0 ? 'unchecked' : 'tristate';
        } else {
            visibility = group.visibility === undefined ? true : group.visibility;
            checkboxstate = visibility === true ? subtreevisibility === 1 ? 'checked' : 'tristate' : 'unchecked';
        }
        if(inMutuallyExclusiveGroup) {
            checkboxstate = 'radio_' + checkboxstate;
        }
        let expanderstate = group.expanded ? 'tree_minus' : 'tree_plus';
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
        let allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers") === true || layer.role !== LayerRole.THEME;
        return (
            <div className="layertree-item-container" key={group.uuid}>
                <div className={classnames(itemclasses)}>
                    <Icon className="layertree-item-expander" icon={expanderstate} onClick={() => this.groupExpandendToggled(layer, path, group.expanded)} />
                    <Icon className="layertree-item-checkbox" icon={checkboxstate} onClick={() => this.groupToggled(layer, path, visibility, inMutuallyExclusiveGroup)} />
                    <span className="layertree-item-title" title={group.title}>{group.title}</span>
                    <span className="layertree-item-spacer"></span>
                    {allowRemove ? (<Icon className="layertree-item-remove" icon="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                </div>
                {sublayersContent}
            </div>
        );
    }
    renderLayer = (layer, sublayer, path, enabled=true, inMutuallyExclusiveGroup=false) => {
        let allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers") === true || layer.role !== LayerRole.THEME;
        let checkboxstate = sublayer.visibility === true ? 'checked' : 'unchecked';
        if(inMutuallyExclusiveGroup) {
            checkboxstate = 'radio_' + checkboxstate;
        }
        let cogclasses = classnames({
            "layertree-item-cog": true,
            "layertree-item-cog-active": this.state.activemenu === sublayer.uuid
        })
        let itemclasses = {
            "layertree-item": true,
            "layertree-item-disabled": (!this.props.groupTogglesSublayers && !enabled) || (this.props.grayUnchecked && !sublayer.visibility)
        };
        let editframe = null;
        let infoButton = null;
        if(layer.type === "wms" || layer.type === "wfs") {
            infoButton = (<Icon className="layertree-item-metadata" icon="info-sign" onClick={() => this.props.setActiveLayerInfo(layer, sublayer)}/>);
        }
        if(this.state.activemenu === sublayer.uuid) {
            let reorderButtons = null;
            if(ThemeUtils.layerReorderingAllowed(this.props.theme) === true) {
                reorderButtons = [
                    (<Icon key="layertree-item-move-down" className="layertree-item-move" icon="arrow-down" onClick={() => this.props.reorderLayer(layer, path, +1)} />),
                    (<Icon key="layertree-item-move-up" className="layertree-item-move" icon="arrow-up" onClick={() => this.props.reorderLayer(layer, path, -1)} />)
                ];
            }
            editframe = (
                <div className="layertree-item-edit-frame" style={{marginRight: allowRemove ? '1.75em' : 0}}>
                    <span className="layertree-item-transparency-label"><Message msgId="layertree.transparency" /></span>
                    <input className="layertree-item-transparency-slider" type="range" min="0" max="255" step="1" defaultValue={255-sublayer.opacity} onMouseUp={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value)} onTouchEnd={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value)} />
                    {reorderButtons}
                    {this.props.infoInSettings ? infoButton : null}
                </div>
            );
        }
        let legendicon = null;
        if(this.props.showLegendIcons) {
            if(layer.legendUrl) {
                let request = layer.legendUrl + (layer.legendUrl.indexOf('?') === -1 ? '?' : '&') + "SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=" + (layer.version || "1.3.0") + "&FORMAT=image/png&LAYER=" + sublayer.name;
                legendicon = (<img className="layertree-item-legend-thumbnail" src={request + "&TYPE=thumbnail"} onMouseOver={ev => this.showLegendTooltip(ev, request)} onMouseOut={this.hideLegendTooltip} onTouchStart={ev => this.showLegendTooltip(ev, request)} />);
            } else if(layer.color) {
                legendicon = (<span className="layertree-item-legend-coloricon" style={{backgroundColor: layer.color}} />);
            }
        }
        let checkbox = null;
        if(layer.type === "placeholder") {
            checkbox = (<Spinner />);
        } else {
            checkbox = (<Icon className="layertree-item-checkbox" icon={checkboxstate} onClick={() => this.layerToggled(layer, path, sublayer.visibility, inMutuallyExclusiveGroup)} />);
        }
        let title = sublayer.title;
        let allowOptions = layer.type !== "placeholder";
        return (
            <div className="layertree-item-container" key={sublayer.uuid} data-id={JSON.stringify({layer: layer.uuid, path: path})}>
                <div className={classnames(itemclasses)}>
                    {this.props.flattenGroups ? null : (<span className="layertree-item-expander"></span>)}
                    {checkbox}
                    {legendicon}
                    <span className="layertree-item-title" title={title}>{title}</span>
                    {sublayer.queryable && this.props.showQueryableIcon ? (<Icon className="layertree-item-queryable" icon="info-sign" />) : null}
                    <span className="layertree-item-spacer"></span>
                    {allowOptions && !this.props.infoInSettings ? infoButton : null}
                    {allowOptions ? (<Icon className={cogclasses} icon="cog" onClick={() => this.layerMenuToggled(sublayer.uuid)}/>) : null}
                    {allowRemove ? (<Icon className="layertree-item-remove" icon="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                </div>
                {editframe}
            </div>
        );
    }
    renderLayerTree = (layer) => {
        if(layer.role === LayerRole.BACKGROUND || layer.layertreehidden) {
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
    renderBody = () => {
        let maptipcheckboxstate = this.props.mapTipsEnabled === true ? 'checked' : 'unchecked';
        let maptipCheckbox = null;
        let maptipsEnabled = false;
        if(this.props.theme.mapTips !== undefined) {
            maptipsEnabled = this.props.theme.mapTips !== null;
        } else {
            maptipsEnabled = this.props.allowMapTips;
        }

        if(!this.props.mobile && maptipsEnabled) {
            maptipCheckbox = (
                <div className="layertree-option">
                    <Icon className="layertree-item-checkbox" icon={maptipcheckboxstate} onClick={this.toggleMapTips} />
                    <span onClick={this.toggleMapTips}><Message msgId="layertree.maptip" /></span>
                </div>
            );
        }
        let compareCheckbox = null;
        if(this.props.allowCompare && ThemeUtils.layerReorderingAllowed(this.props.theme)) {
            let swipecheckboxstate = this.props.swipe || this.props.swipe === 0 ? 'checked' : 'unchecked';
            compareCheckbox = (
                <div className="layertree-option">
                    <Icon className="layertree-item-checkbox" icon={swipecheckboxstate} onClick={this.toggleSwipe} />
                    <span onClick={this.toggleSwipe}><Message msgId="layertree.compare" /></span>
                </div>
            );
        }
        let layerImportExpander = null;
        if(this.props.allowImport) {
            layerImportExpander = (
                <div className="layertree-option" onClick={this.toggleImportLayers}>
                    <Icon icon={this.state.importvisible ? 'collapse' : 'expand'} /> <Message msgId="layertree.importlayer" />
                </div>
            );
        }
        let sortable = ThemeUtils.layerReorderingAllowed(this.props.theme) === true;
        return (
            <div role="body" className="layertree-container-wrapper">
                <div className="layertree-container">
                    <div className="layertree-tree"
                        onTouchStart={ev => { if(this.props.flattenGroups) ev.stopPropagation(); }}
                        onTouchMove={ev => { if(this.props.flattenGroups) ev.stopPropagation(); }}
                        onTouchEnd={ev => { if(this.props.flattenGroups) ev.stopPropagation(); }}
                        onContextMenuCapture={ev => {ev.stopPropagation(); ev.preventDefault(); return false; }}>
                        <Sortable options={{disabled: sortable === false || this.props.flattenGroups !== true, ghostClass: 'drop-ghost', delay: 200, forceFallback: this.props.ie}} onChange={this.onSortChange}>
                            {this.props.layers.map(this.renderLayerTree)}
                        </Sortable>
                    </div>
                    {maptipCheckbox}
                    {compareCheckbox}
                    {layerImportExpander}
                    {this.state.importvisible ? (<ImportLayer />) : null}
                </div>
            </div>
        );
    }
    render() {
        let legendTooltip = null;
        if(this.state.legendTooltip) {
            let style = {
                left: this.state.legendTooltip.x,
                top: this.state.legendTooltip.y,
                maxWidth: (window.innerWidth - this.state.legendTooltip.x - 2),
                maxHeight: (window.innerHeight - this.state.legendTooltip.y - 2),
                visibility: 'hidden'
            };
            legendTooltip = (
                <img className="layertree-item-legend-tooltip" style={style} src={this.state.legendTooltip.img} onTouchStart={this.hideLegendTooltip} onLoad={this.legendTooltipLoaded}></img>
            );
        }

        let extraTitlebarContent = null;
        if(this.props.enableLegendPrint) {
            let printLegendTooltip = LocaleUtils.getMessageById(this.context.messages, "layertree.printlegend");
            extraTitlebarContent = (<Icon title={printLegendTooltip} className="layertree-print-legend" icon="print" onClick={this.printLegend}/>);
        }
        return (
            <div>
                <SideBar id="LayerTree" width={this.state.sidebarwidth || this.props.width}
                    title="appmenu.items.LayerTree" icon="layers"
                    onHide={this.hideLegendTooltip} extraTitlebarContent={extraTitlebarContent}>
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
                {legendTooltip}
                <LayerInfoWindow windowSize={this.props.layerInfoWindowSize} bboxDependentLegend={this.props.bboxDependentLegend} />
            </div>
        );
    }
    legendTooltipLoaded = (ev) => {
        if(ev.target.naturalWidth > 1) {
            ev.target.style.visibility = 'visible';
        }
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
        this.setState({importvisible: visible, sidebarwidth: visible ? '40em' : null});
    }
    propagateOptions = (layer, options, path=null) => {
        if(layer.sublayers) {
            layer.sublayers = layer.sublayers.map((sublayer, idx) => {
                if(path === null || (!isEmpty(path) && path[0] == idx)) {
                    let newsublayer = assign({}, sublayer, options);
                    this.propagateOptions(newsublayer, options, path ? path.slice(1) : null);
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
            let {newlayer, newsublayer} = LayerUtils.cloneLayer(layer, grouppath);
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
            let {newlayer, newsublayer} = LayerUtils.cloneLayer(layer, grouppath);
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
            let {newlayer, newsublayer} = LayerUtils.cloneLayer(layer, sublayerpath);
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
            let {newlayer, newsublayer} = LayerUtils.cloneLayer(layer, parentPath);
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
        let {newlayer, newsublayer} = LayerUtils.cloneLayer(layer, sublayerpath);
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
                img: request + "&TYPE=tooltip"
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
        let printLabel = LocaleUtils.getMessageById(this.context.messages, "layertree.printlegend");
        body += '<div id="print">' +
                '<style type="text/css">@media print{ #print { display: none; }}</style>' +
                '<button onClick="(function(){window.print();})()">' + printLabel + '</button>' +
                '</div>';
        body += this.props.layers.map(layer => {
            if(!layer.visibility) {
                return "";
            } else if(layer.legendUrl) {
                return layer.params.LAYERS ? layer.params.LAYERS.split(",").reverse().map(sublayer => {
                    let request = layer.legendUrl + (layer.legendUrl.indexOf('?') === -1 ? '?' : '&') + "SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=" + (layer.version || "1.3.0") + "&FORMAT=image/png&LAYER=" + sublayer;
                    return '<div><img src="' + request + '" /></div>';
                }).join("\n") : "";
            } else if(layer.color) {
                return '<div><span style="display: inline-block; width: 1em; height: 1em; box-shadow: inset 0 0 0 1000px ' + layer.color + '; margin: 0.25em; border: 1px solid black;">&nbsp;</span>' + (layer.title || layer.name) + '</div>';
            } else {
                return "";
            }
        }).join("");
        body += "</p>";
        let setLegendPrintContent = () => {
            let container = this.legendPrintWindow.document.getElementById("legendcontainer");
            if(container) {
                container.innerHTML = body;
            } else {
                this.legendPrintWindow.document.body.innerHTML = "Broken template. An element with id=legendcontainer must exist.";
            }
        };

        if(this.legendPrintWindow && !this.legendPrintWindow.closed) {
            let container = this.legendPrintWindow.document.getElementById("legendcontainer");
            setLegendPrintContent();
            this.legendPrintWindow.focus();
        } else {
            let assetsPath = ConfigUtils.getConfigProp("assetsPath");
            this.legendPrintWindow = window.open(assetsPath + "/templates/legendprint.html", "Legend", "toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes");
            if(window.navigator.userAgent.indexOf('Trident/') > 0) {
                // IE...
                let interval = setInterval(() => {
                    if (this.legendPrintWindow.document.readyState === 'complete') {
                        setLegendPrintContent();
                        clearInterval(interval);
                    }
                });
            } else {
                this.legendPrintWindow.addEventListener('load', setLegendPrintContent, false);
            }
        }
    }
};

const selector = (state) => ({
    mobile: state.browser ? state.browser.mobile : false,
    ie: state.browser ? state.browser.ie : false,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    swipe: state.layers && state.layers.swipe || undefined,
    theme: state.theme.current || {},
    mapTipsEnabled: state.map && state.map.maptips
});

module.exports = {
    LayerTreePlugin: connect(selector, {
        changeLayerProperties: changeLayerProperties,
        removeLayer: removeLayer,
        reorderLayer: reorderLayer,
        toggleMapTips: toggleMapTips,
        setSwipe: setSwipe,
        setActiveLayerInfo: setActiveLayerInfo
    })(LayerTree),
    reducers: {
        layers: require('../reducers/layers'),
        layerinfo: require('../reducers/layerinfo'),
    }
};
