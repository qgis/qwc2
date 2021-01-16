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
const FileSaver = require('file-saver');
const Message = require('../components/I18N/Message');
const {LayerRole, changeLayerProperty, removeLayer, reorderLayer, setSwipe, addLayerSeparator} = require('../actions/layers')
const {setActiveLayerInfo} = require('../actions/layerinfo');
const {setActiveServiceInfo} = require('../actions/serviceinfo');
const {toggleMapTips, zoomToExtent} = require('../actions/map');
const ConfigUtils = require("../utils/ConfigUtils");
const LocaleUtils = require("../utils/LocaleUtils");
const Icon = require('../components/Icon');
const ImportLayer = require('../components/ImportLayer');
const LayerInfoWindow = require('../components/LayerInfoWindow');
const ServiceInfoWindow = require('../components/ServiceInfoWindow');
const {SideBar} = require('../components/SideBar');
const Spinner = require('../components/Spinner');
const LayerUtils = require('../utils/LayerUtils');
const ThemeUtils = require('../utils/ThemeUtils');
const MapUtils = require('../utils/MapUtils');
const VectorLayerUtils = require('../utils/VectorLayerUtils');
require('./style/LayerTree.css');


class LayerTree extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        mapCrs: PropTypes.string,
        mapScale: PropTypes.number,
        swipe: PropTypes.number,
        mobile: PropTypes.bool,
        fallbackDrag: PropTypes.bool,
        theme: PropTypes.object,
        mapTipsEnabled: PropTypes.bool,
        changeLayerProperty: PropTypes.func,
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
        enableServiceInfo: PropTypes.bool,
        enableVisibleFilter: PropTypes.bool,
        infoInSettings: PropTypes.bool,
        showToggleAllLayersCheckbox: PropTypes.bool,
        addLayerSeparator: PropTypes.func,
        zoomToExtent: PropTypes.func,
        transparencyIcon: PropTypes.bool
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
        width: "25em",
        enableLegendPrint: true,
        enableVisibleFilter: true,
        enableServiceInfo: true,
        infoInSettings: true,
        showToggleAllLayersCheckbox: true,
        transparencyIcon: true
    }
    state = {
        activemenu: null,
        legendTooltip: null,
        sidebarwidth: null,
        importvisible: false,
        filtervisiblelayers: false
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
            this.props.toggleMapTips(newProps.theme.mapTips && !this.props.mobile);
        }
    }
    getGroupVisibility = (group) => {
        if(isEmpty(group.sublayers) || group.visibility === false) {
            return 0;
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
        let flattenGroups = ConfigUtils.getConfigProp("flattenLayerTreeGroups", this.props.theme) || this.props.flattenGroups;
        if(flattenGroups) {
            return this.renderSubLayers(layer, group, path, enabled, false);
        }
        let subtreevisibility = this.getGroupVisibility(group);
        if(subtreevisibility === 0 && this.state.filtervisiblelayers) {
            return null;
        }
        let visibility = true;
        let checkboxstate;
        if(this.props.groupTogglesSublayers && !inMutuallyExclusiveGroup) {
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
        let editframe = null;
        let allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers", this.props.theme) === true || layer.role !== LayerRole.THEME;
        let allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true && !this.state.filtervisiblelayers;
        let sortable = allowReordering && ConfigUtils.getConfigProp("preventSplittingGroupsWhenReordering", this.props.theme) === true;
        if(this.state.activemenu === group.uuid && allowReordering) {
            editframe = (
                <div className="layertree-item-edit-frame" style={{marginRight: allowRemove ? '1.75em' : 0}}>
                    <div className="layertree-item-edit-items">
                        <Icon className="layertree-item-move" icon="arrow-down" onClick={() => this.props.reorderLayer(layer, path, +1)} />
                        <Icon className="layertree-item-move" icon="arrow-up" onClick={() => this.props.reorderLayer(layer, path, -1)} />
                    </div>
                </div>
            );
        }
        return (
            <div className="layertree-item-container" key={group.uuid} data-id={JSON.stringify({layer: layer.uuid, path: path})}>
                <div className={classnames(itemclasses)}>
                    <Icon className="layertree-item-expander" icon={expanderstate} onClick={() => this.groupExpandedToggled(layer, path, group.expanded)} />
                    <Icon className="layertree-item-checkbox" icon={checkboxstate} onClick={() => this.itemVisibilityToggled(layer, path, visibility)} />
                    <span className="layertree-item-title" title={group.title}>{group.title}</span>
                    <span className="layertree-item-spacer"></span>
                    {allowReordering ? (<Icon className={cogclasses} icon="cog" onClick={() => this.layerMenuToggled(group.uuid)}/>) : null}
                    {allowRemove ? (<Icon className="layertree-item-remove" icon="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                </div>
                {editframe}
                <Sortable options={{disabled: sortable === false, ghostClass: 'drop-ghost', delay: 200, forceFallback: this.props.fallbackDrag}} onChange={this.onSortChange}>
                    {sublayersContent}
                </Sortable>
            </div>
        );
    }
    renderLayer = (layer, sublayer, path, enabled=true, inMutuallyExclusiveGroup=false, skipExpanderPlaceholder=false) => {
        if(this.state.filtervisiblelayers && !sublayer.visibility) {
            return null;
        }
        let allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers", this.props.theme) === true || layer.role !== LayerRole.THEME;
        let allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true;
        let checkboxstate = sublayer.visibility === true ? 'checked' : 'unchecked';
        if(inMutuallyExclusiveGroup) {
            checkboxstate = 'radio_' + checkboxstate;
        }
        let cogclasses = classnames({
            "layertree-item-cog": true,
            "layertree-item-cog-active": this.state.activemenu === sublayer.uuid
        });
        let itemclasses = {
            "layertree-item": true,
            "layertree-item-disabled": layer.type !== "separator" && ((!this.props.groupTogglesSublayers && !enabled) || (this.props.grayUnchecked && !sublayer.visibility)),
            "layertree-item-separator": layer.type === "separator",
            "layertree-item-outsidescalerange": (sublayer.minScale !== undefined && this.props.mapScale < sublayer.minScale) || (sublayer.maxScale !== undefined && this.props.mapScale > sublayer.maxScale)
        };
        let editframe = null;
        let infoButton = null;
        if(layer.type === "wms" || layer.type === "wfs" || layer.type === "wmts") {
            infoButton = (<Icon className="layertree-item-metadata" icon="info-sign" onClick={() => this.props.setActiveLayerInfo(layer, sublayer)}/>);
        }
        if(this.state.activemenu === sublayer.uuid) {
            let reorderButtons = null;
            if(allowReordering && !this.state.filtervisiblelayers) {
                reorderButtons = [
                    (<Icon key="layertree-item-move-down" className="layertree-item-move" icon="arrow-down" onClick={() => this.props.reorderLayer(layer, path, +1)} />),
                    (<Icon key="layertree-item-move-up" className="layertree-item-move" icon="arrow-up" onClick={() => this.props.reorderLayer(layer, path, -1)} />)
                ];
            }
            let zoomToLayerButton = null;
            if(sublayer.bbox && sublayer.bbox.bounds && sublayer.bbox.crs) {
                let zoomToLayerTooltip = LocaleUtils.getMessageById(this.context.messages, "layertree.zoomtolayer");
                zoomToLayerButton = (
                    <Icon icon="zoom" title={zoomToLayerTooltip} onClick={() => this.props.zoomToExtent(sublayer.bbox.bounds, sublayer.bbox.crs)} />
                )
            }
            editframe = (
                <div className="layertree-item-edit-frame" style={{marginRight: allowRemove ? '1.75em' : 0}}>
                    <div className="layertree-item-edit-items">
                        {zoomToLayerButton}
                        {this.props.transparencyIcon ? (<Icon icon="transparency" />) : (<Message msgId="layertree.transparency" />)}
                        <input className="layertree-item-transparency-slider" type="range" min="0" max="255" step="1" defaultValue={255-sublayer.opacity} onMouseUp={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value)} onTouchEnd={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value)} />
                        {reorderButtons}
                        {this.props.infoInSettings ? infoButton : null}
                        {layer.type === 'vector' ? (<Icon icon="export" onClick={() => this.exportRedliningLayer(layer)} />) : null}
                    </div>
                </div>
            );
        }
        let legendicon = null;
        if (this.props.showLegendIcons) {
            const legendUrl = LayerUtils.getLegendUrl(layer, sublayer, this.props.mapScale, this.props.mapCrs);
            if (legendUrl) {
                legendicon = (<img className="layertree-item-legend-thumbnail" onMouseOut={this.hideLegendTooltip} onMouseOver={ev => this.showLegendTooltip(ev, legendUrl)} onTouchStart={ev => this.showLegendTooltip(ev, legendUrl)} src={legendUrl + "&TYPE=thumbnail"} />);
            } else if (layer.color) {
                legendicon = (<span className="layertree-item-legend-coloricon" style={{backgroundColor: layer.color}} />);
            }
        }
        let checkbox = null;
        if(layer.type === "placeholder") {
            checkbox = (<Spinner />);
        } else if(layer.type === "separator") {
            checkbox = null;
        } else {
            checkbox = (<Icon className="layertree-item-checkbox" icon={checkboxstate} onClick={() => this.itemVisibilityToggled(layer, path, sublayer.visibility)} />);
        }
        let title = null;
        if(layer.type === "separator") {
            title = (<input value={sublayer.title} onChange={ev => this.props.changeLayerProperty(layer.uuid, "title", ev.target.value)}/>);
        } else {
            title = (<span className="layertree-item-title" title={sublayer.title}>{sublayer.title}</span>);
        }
        let allowOptions = layer.type !== "placeholder" && layer.type !== "separator";
        let flattenGroups = ConfigUtils.getConfigProp("flattenLayerTreeGroups", this.props.theme) || this.props.flattenGroups;
        let allowSeparators = flattenGroups && allowReordering && ConfigUtils.getConfigProp("allowLayerTreeSeparators", this.props.theme);
        let separatorTitle = LocaleUtils.getMessageById(this.context.messages, "layertree.separator");
        let separatorTooltip = LocaleUtils.getMessageById(this.context.messages, "layertree.separatortooltip");
        return (
            <div className="layertree-item-container" key={sublayer.uuid} data-id={JSON.stringify({layer: layer.uuid, path: path})}>
                {allowSeparators ? (<div title={separatorTooltip} className="layertree-item-addsep" onClick={() => this.props.addLayerSeparator(separatorTitle, layer.id, path)}></div>) : null}
                <div className={classnames(itemclasses)}>
                    {(flattenGroups || skipExpanderPlaceholder) ? null : (<span className="layertree-item-expander"></span>)}
                    {checkbox}
                    {legendicon}
                    {title}
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
            return this.renderLayer(layer, layer, [], layer.visibility);
        } else if(this.props.showRootEntry) {
            return this.renderLayerGroup(layer, layer, [], layer.visibility);
        } else {
            return layer.sublayers.map((sublayer, idx) => {
                let subpath = [idx];
                if(sublayer.sublayers) {
                    return this.renderLayerGroup(layer, sublayer, subpath, layer.visibility)
                } else {
                    return this.renderLayer(layer, sublayer, subpath, layer.visibility, false, true);
                }
            });
        }
    }
    renderBody = () => {
        let maptipcheckboxstate = this.props.mapTipsEnabled === true ? 'checked' : 'unchecked';
        let maptipCheckbox = null;
        let maptipsEnabled = false;
        if(this.props.theme.mapTips !== undefined) {
            maptipsEnabled = this.props.theme.mapTips !== null && this.props.allowMapTips;
        } else {
            maptipsEnabled = this.props.allowMapTips;
        }

        if(!this.props.mobile && maptipsEnabled) {
            maptipCheckbox = (
                <div className="layertree-option">
                    <Icon icon={maptipcheckboxstate} onClick={this.toggleMapTips} />
                    <span onClick={this.toggleMapTips}><Message msgId="layertree.maptip" /></span>
                </div>
            );
        }
        let allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true && !this.state.filtervisiblelayers;
        let compareCheckbox = null;
        if(this.props.allowCompare && allowReordering) {
            let swipecheckboxstate = this.props.swipe || this.props.swipe === 0 ? 'checked' : 'unchecked';
            compareCheckbox = (
                <div className="layertree-option">
                    <Icon icon={swipecheckboxstate} onClick={this.toggleSwipe} />
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
        let flattenGroups = ConfigUtils.getConfigProp("flattenLayerTreeGroups", this.props.theme) || this.props.flattenGroups;
        let sortable = allowReordering && (ConfigUtils.getConfigProp("preventSplittingGroupsWhenReordering", this.props.theme) === true || flattenGroups === true);
        return (
            <div role="body" className="layertree-container-wrapper">
                <div className="layertree-container">
                    <div className="layertree-tree"
                        onTouchStart={ev => { ev.stopPropagation(); }}
                        onTouchMove={ev => { ev.stopPropagation(); }}
                        onTouchEnd={ev => { ev.stopPropagation(); }}
                        onContextMenuCapture={ev => {ev.stopPropagation(); ev.preventDefault(); return false; }}>
                        <Sortable options={{disabled: sortable === false, ghostClass: 'drop-ghost', delay: 200, forceFallback: this.props.fallbackDrag}} onChange={this.onSortChange}>
                            {this.props.layers.map(this.renderLayerTree)}
                        </Sortable>
                    </div>
                    {maptipCheckbox}
                    {compareCheckbox}
                    {layerImportExpander}
                    {this.state.importvisible ? (<ImportLayer theme={this.props.theme} />) : null}
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

        let legendPrintIcon = null;
        if(this.props.enableLegendPrint) {
            let printLegendTooltip = LocaleUtils.getMessageById(this.context.messages, "layertree.printlegend");
            legendPrintIcon = (<Icon title={printLegendTooltip} className="layertree-print-legend" icon="print" onClick={this.printLegend}/>);
        }
        let visibleFilterIcon = null;
        if(this.props.enableVisibleFilter) {
            let visibleFilterTooltip = LocaleUtils.getMessageById(this.context.messages, "layertree.visiblefilter");
            let classes = classnames({
                "layertree-visible-filter": true,
                "layertree-visible-filter-active": this.state.filtervisiblelayers
            });
            visibleFilterIcon = (<Icon title={visibleFilterTooltip} className={classes} icon="eye" onClick={ev => this.setState({filtervisiblelayers: !this.state.filtervisiblelayers})}/>);
        }
        let deleteAllLayersIcon = null;
        if(ConfigUtils.getConfigProp("allowRemovingThemeLayers") === true) {
            let deleteAllLayersTooltip = LocaleUtils.getMessageById(this.context.messages, "layertree.deletealllayers");
            deleteAllLayersIcon = (<Icon title={deleteAllLayersTooltip} className="layertree-delete-legend" icon="trash" onClick={this.deleteAllLayers}/>);
        }
        let serviceInfoIcon = null;
        if(this.props.enableServiceInfo) {
            serviceInfoIcon = (<Icon className="layertree-theme-metadata" icon="info-sign" onClick={() => this.props.setActiveServiceInfo(this.props.theme)}/>);
        }

        let extraTitlebarContent = null;
        if(legendPrintIcon || deleteAllLayersIcon || visibleFilterIcon || infoIcon) {
            extraTitlebarContent = (
                <span>
                    {legendPrintIcon}
                    {visibleFilterIcon}
                    {deleteAllLayersIcon}
                    {serviceInfoIcon}
                </span>
            );
        }

        let visibilities = [];
        for(let layer of this.props.layers) {
            if(layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                visibilities.push(isEmpty(layer.sublayers) ? layer.visibility : this.getGroupVisibility(layer));
            }
        }
        let vis = visibilities.reduce((sum, x) => sum + x, 0) / (visibilities.length || 1);
        let visibilityCheckbox = this.props.showToggleAllLayersCheckbox ? (<Icon className="layertree-tree-visibility" icon={vis === 0 ? "unchecked" : vis === 1 ? "checked" : "tristate"} onClick={() => this.toggleLayerTreeVisibility(vis === 0)}/>) : null;

        return (
            <div>
                <SideBar id="LayerTree" width={this.state.sidebarwidth || this.props.width}
                    title="appmenu.items.LayerTree" icon="layers"
                    extraBeforeContent={visibilityCheckbox}
                    onHide={this.hideLegendTooltip} extraTitlebarContent={extraTitlebarContent}>
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
                {legendTooltip}
                <LayerInfoWindow windowSize={this.props.layerInfoWindowSize} bboxDependentLegend={this.props.bboxDependentLegend} />
                <ServiceInfoWindow windowSize={this.props.layerInfoWindowSize} />
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
    groupExpandedToggled = (layer, grouppath, oldexpanded) => {
        this.props.changeLayerProperty(layer.uuid, "expanded", !oldexpanded, grouppath);
    }
    itemVisibilityToggled = (layer, grouppath, oldvisibility) => {
        let recurseDirection = null;
        // If item becomes visible, also make parents visible
        if(this.props.groupTogglesSublayers) {
            recurseDirection = !oldvisibility ? "both" : "children";
        } else {
            recurseDirection = !oldvisibility ? "parents" : null;
        }
        this.props.changeLayerProperty(layer.uuid, "visibility", !oldvisibility, grouppath, recurseDirection);
    }
    layerTransparencyChanged = (layer, sublayerpath, value) => {
        this.props.changeLayerProperty(layer.uuid, "opacity", Math.max(1, 255 - value), sublayerpath);
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
                    const request = LayerUtils.getLegendUrl(layer, {name: sublayer}, this.props.mapScale, this.props.mapCrs);
                    return request ? '<div><img src="' + request + '" /></div>' : "";
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
    deleteAllLayers = () => {
        for(let layer of this.props.layers) {
            if(layer.role === LayerRole.THEME) {
                let sublayers = layer.sublayers || [];
                for(let i = sublayers.length - 1; i >= 0; --i) {
                    this.props.removeLayer(layer.id, [i]);
                }
            } else if(layer.role === LayerRole.USERLAYER) {
                this.props.removeLayer(layer.id);
            }
        }
    }
    toggleLayerTreeVisibility = (visibile) => {
        for(let layer of this.props.layers) {
            if(layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                this.props.changeLayerProperty(layer.uuid, "visibility", visibile, [], this.props.groupTogglesSublayers ? "children" : null);
            }
        }
    }
    exportRedliningLayer = (layer) => {
        let data = JSON.stringify({
            type: "FeatureCollection",
	        features: layer.features.map(feature => ({...feature, geometry: VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs || this.props.mapCrs, 'EPSG:4326')}))
        }, null, ' ');
        FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), layer.title + ".json");
    }
};

const selector = (state) => ({
    mobile: state.browser ? state.browser.mobile : false,
    ie: state.browser ? state.browser.ie : false,
    fallbackDrag: state.browser.ie || (state.browser.platform === 'Win32' && state.browser.chrome),
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    mapCrs: state.map.projection,
    mapScale: MapUtils.computeForZoom(state.map.scales, state.map.zoom),
    swipe: state.layers && state.layers.swipe || undefined,
    theme: state.theme.current || {},
    mapTipsEnabled: state.map && state.map.maptips
});

module.exports = {
    LayerTreePlugin: connect(selector, {
        addLayerSeparator: addLayerSeparator,
        changeLayerProperty: changeLayerProperty,
        removeLayer: removeLayer,
        reorderLayer: reorderLayer,
        toggleMapTips: toggleMapTips,
        setSwipe: setSwipe,
        setActiveLayerInfo: setActiveLayerInfo,
        setActiveServiceInfo: setActiveServiceInfo,
        zoomToExtent: zoomToExtent
    })(LayerTree),
    reducers: {
        layers: require('../reducers/layers'),
        layerinfo: require('../reducers/layerinfo'),
        serviceinfo: require('../reducers/serviceinfo')
    }
};
