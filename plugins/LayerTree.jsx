/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import Sortable from 'react-sortablejs';
import FileSaver from 'file-saver';
import {LayerRole, changeLayerProperty, removeLayer, reorderLayer, setSwipe, addLayerSeparator} from '../actions/layers';
import {setActiveLayerInfo} from '../actions/layerinfo';
import {setActiveServiceInfo} from '../actions/serviceinfo';
import {toggleMapTips, zoomToExtent} from '../actions/map';
import Icon from '../components/Icon';
import ImportLayer from '../components/ImportLayer';
import LayerInfoWindow from '../components/LayerInfoWindow';
import ServiceInfoWindow from '../components/ServiceInfoWindow';
import SideBar from '../components/SideBar';
import Spinner from '../components/Spinner';
import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import './style/LayerTree.css';


class LayerTree extends React.Component {
    static propTypes = {
        addLayerSeparator: PropTypes.func,
        allowCompare: PropTypes.bool,
        allowImport: PropTypes.bool,
        allowMapTips: PropTypes.bool,
        bboxDependentLegend: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        changeLayerProperty: PropTypes.func,
        enableLegendPrint: PropTypes.bool,
        enableServiceInfo: PropTypes.bool,
        enableVisibleFilter: PropTypes.bool,
        fallbackDrag: PropTypes.bool,
        flattenGroups: PropTypes.bool,
        grayUnchecked: PropTypes.bool,
        groupTogglesSublayers: PropTypes.bool,
        infoInSettings: PropTypes.bool,
        layerInfoWindowSize: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        mapScale: PropTypes.number,
        mapTipsEnabled: PropTypes.bool,
        mobile: PropTypes.bool,
        removeLayer: PropTypes.func,
        reorderLayer: PropTypes.func,
        scaleDependentLegend: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        setActiveLayerInfo: PropTypes.func,
        setActiveServiceInfo: PropTypes.func,
        setSwipe: PropTypes.func,
        showLegendIcons: PropTypes.bool,
        showQueryableIcon: PropTypes.bool,
        showRootEntry: PropTypes.bool,
        showToggleAllLayersCheckbox: PropTypes.bool,
        side: PropTypes.string,
        swipe: PropTypes.number,
        theme: PropTypes.object,
        toggleMapTips: PropTypes.func,
        transparencyIcon: PropTypes.bool,
        width: PropTypes.string,
        zoomToExtent: PropTypes.func
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
        transparencyIcon: true,
        side: 'right'
    }
    state = {
        activemenu: null,
        legendTooltip: null,
        sidebarwidth: null,
        importvisible: false,
        filtervisiblelayers: false
    }
    constructor(props) {
        super(props);
        this.legendPrintWindow = null;
        window.addEventListener('beforeunload', () => {
            if (this.legendPrintWindow && !this.legendPrintWindow.closed) {
                this.legendPrintWindow.close();
            }
        });
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme.mapTips !== undefined && this.props.theme.mapTips !== prevProps.theme.mapTips) {
            this.props.toggleMapTips(this.props.theme.mapTips && !prevProps.mobile);
        }
    }
    renderSubLayers = (layer, group, path, enabled, inMutuallyExclusiveGroup = false) => {
        return (group.sublayers || []).map((sublayer, idx) => {
            const subpath = [...path, idx];
            if (sublayer.sublayers) {
                return this.renderLayerGroup(layer, sublayer, subpath, enabled, inMutuallyExclusiveGroup);
            } else {
                return this.renderLayer(layer, sublayer, subpath, enabled, inMutuallyExclusiveGroup);
            }
        });
    }
    renderLayerGroup = (layer, group, path, enabled, inMutuallyExclusiveGroup = false) => {
        const flattenGroups = ConfigUtils.getConfigProp("flattenLayerTreeGroups", this.props.theme) || this.props.flattenGroups;
        if (flattenGroups) {
            return this.renderSubLayers(layer, group, path, enabled, false);
        }
        const subtreevisibility = LayerUtils.computeLayerVisibility(group);
        if (subtreevisibility === 0 && this.state.filtervisiblelayers) {
            return null;
        }
        let visibility = true;
        let checkboxstate = "";
        if (this.props.groupTogglesSublayers && !inMutuallyExclusiveGroup) {
            visibility = subtreevisibility > 0;
            if (subtreevisibility === 1) {
                checkboxstate = "checked";
            } else if (subtreevisibility === 0) {
                checkboxstate = "unchecked";
            } else {
                checkboxstate = "tristate";
            }
        } else {
            visibility = group.visibility === undefined ? subtreevisibility > 0 : group.visibility;
            if (visibility) {
                checkboxstate = subtreevisibility === 1 ? 'checked' : 'tristate';
            } else {
                checkboxstate = 'unchecked';
            }
        }
        if (inMutuallyExclusiveGroup) {
            checkboxstate = 'radio_' + checkboxstate;
        }
        const expanderstate = group.expanded ? 'tree_minus' : 'tree_plus';
        const itemclasses = {
            "layertree-item": true,
            "layertree-item-disabled": (!this.props.groupTogglesSublayers && !enabled) || (this.props.grayUnchecked && !visibility)
        };
        let sublayersContent = null;
        if (group.expanded) {
            sublayersContent = this.renderSubLayers(layer, group, path, enabled && visibility, group.mutuallyExclusive === true);
        }
        const cogclasses = classnames({
            "layertree-item-cog": true,
            "layertree-item-cog-active": this.state.activemenu === group.uuid
        });
        let editframe = null;
        let infoButton = null;
        if (layer.type === "wms" || layer.type === "wfs" || layer.type === "wmts") {
            infoButton = (<Icon className="layertree-item-metadata" icon="info-sign" onClick={() => this.props.setActiveLayerInfo(layer, group)}/>);
        }
        const allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers", this.props.theme) === true || layer.role !== LayerRole.THEME;
        const allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true && !this.state.filtervisiblelayers;
        const sortable = allowReordering && ConfigUtils.getConfigProp("preventSplittingGroupsWhenReordering", this.props.theme) === true;
        if (this.state.activemenu === group.uuid && allowReordering) {
            editframe = (
                <div className="layertree-item-edit-frame" style={{marginRight: allowRemove ? '1.75em' : 0}}>
                    <div className="layertree-item-edit-items">
                        <Icon className="layertree-item-move" icon="arrow-down" onClick={() => this.props.reorderLayer(layer, path, +1)} />
                        <Icon className="layertree-item-move" icon="arrow-up" onClick={() => this.props.reorderLayer(layer, path, -1)} />
                        {infoButton}
                    </div>
                </div>
            );
        }
        return (
            <div className="layertree-item-container" data-id={JSON.stringify({layer: layer.uuid, path: path})} key={group.uuid}>
                <div className={classnames(itemclasses)}>
                    <Icon className="layertree-item-expander" icon={expanderstate} onClick={() => this.groupExpandedToggled(layer, path, group.expanded)} />
                    <Icon className="layertree-item-checkbox" icon={checkboxstate} onClick={() => this.itemVisibilityToggled(layer, path, visibility)} />
                    <span className="layertree-item-title" title={group.title}>{group.title}</span>
                    <span className="layertree-item-spacer" />
                    {allowReordering ? (<Icon className={cogclasses} icon="cog" onClick={() => this.layerMenuToggled(group.uuid)}/>) : null}
                    {allowRemove ? (<Icon className="layertree-item-remove" icon="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                </div>
                {editframe}
                <Sortable onChange={this.onSortChange} options={{disabled: sortable === false, ghostClass: 'drop-ghost', delay: 200, forceFallback: this.props.fallbackDrag}}>
                    {sublayersContent}
                </Sortable>
            </div>
        );
    }
    renderLayer = (layer, sublayer, path, enabled = true, inMutuallyExclusiveGroup = false, skipExpanderPlaceholder = false) => {
        if (this.state.filtervisiblelayers && !sublayer.visibility) {
            return null;
        }
        const allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers", this.props.theme) === true || layer.role !== LayerRole.THEME;
        const allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true;
        let checkboxstate = sublayer.visibility === true ? 'checked' : 'unchecked';
        if (inMutuallyExclusiveGroup) {
            checkboxstate = 'radio_' + checkboxstate;
        }
        const cogclasses = classnames({
            "layertree-item-cog": true,
            "layertree-item-cog-active": this.state.activemenu === sublayer.uuid
        });
        const itemclasses = {
            "layertree-item": true,
            "layertree-item-disabled": layer.type !== "separator" && ((!this.props.groupTogglesSublayers && !enabled) || (this.props.grayUnchecked && !sublayer.visibility)),
            "layertree-item-separator": layer.type === "separator",
            "layertree-item-outsidescalerange": (sublayer.minScale !== undefined && this.props.mapScale < sublayer.minScale) || (sublayer.maxScale !== undefined && this.props.mapScale > sublayer.maxScale)
        };
        let editframe = null;
        let infoButton = null;
        if (layer.type === "wms" || layer.type === "wfs" || layer.type === "wmts") {
            infoButton = (<Icon className="layertree-item-metadata" icon="info-sign" onClick={() => this.props.setActiveLayerInfo(layer, sublayer)}/>);
        }
        if (this.state.activemenu === sublayer.uuid) {
            let reorderButtons = null;
            if (allowReordering && !this.state.filtervisiblelayers) {
                reorderButtons = [
                    (<Icon className="layertree-item-move" icon="arrow-down" key="layertree-item-move-down" onClick={() => this.props.reorderLayer(layer, path, +1)} />),
                    (<Icon className="layertree-item-move" icon="arrow-up" key="layertree-item-move-up" onClick={() => this.props.reorderLayer(layer, path, -1)} />)
                ];
            }
            let zoomToLayerButton = null;
            if (sublayer.bbox && sublayer.bbox.bounds) {
                const zoomToLayerTooltip = LocaleUtils.tr("layertree.zoomtolayer");
                const crs = sublayer.bbox.crs || this.props.map.projection;
                zoomToLayerButton = (
                    <Icon icon="zoom" onClick={() => this.props.zoomToExtent(sublayer.bbox.bounds, crs)} title={zoomToLayerTooltip} />
                );
            }
            editframe = (
                <div className="layertree-item-edit-frame" style={{marginRight: allowRemove ? '1.75em' : 0}}>
                    <div className="layertree-item-edit-items">
                        {zoomToLayerButton}
                        {this.props.transparencyIcon ? (<Icon icon="transparency" />) : LocaleUtils.tr("layertree.transparency")}
                        <input className="layertree-item-transparency-slider" max="255" min="0"
                            onChange={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value)}
                            step="1" type="range" value={255 - sublayer.opacity} />
                        {reorderButtons}
                        {this.props.infoInSettings ? infoButton : null}
                        {layer.type === 'vector' ? (<Icon icon="export" onClick={() => this.exportRedliningLayer(layer)} />) : null}
                    </div>
                </div>
            );
        }
        let legendicon = null;
        if (this.props.showLegendIcons) {
            const legendUrl = LayerUtils.getLegendUrl(layer, sublayer, this.props.mapScale, this.props.map, this.props.bboxDependentLegend, this.props.scaleDependentLegend);
            if (legendUrl) {
                legendicon = (<img className="layertree-item-legend-thumbnail" onMouseOut={this.hideLegendTooltip} onMouseOver={ev => this.showLegendTooltip(ev, legendUrl)} onTouchStart={ev => this.showLegendTooltip(ev, legendUrl)} src={legendUrl + "&TYPE=thumbnail"} />);
            } else if (layer.color) {
                legendicon = (<span className="layertree-item-legend-coloricon" style={{backgroundColor: layer.color}} />);
            }
        }
        let checkbox = null;
        if (layer.type === "placeholder") {
            checkbox = (<Spinner />);
        } else if (layer.type === "separator") {
            checkbox = null;
        } else {
            checkbox = (<Icon className="layertree-item-checkbox" icon={checkboxstate} onClick={() => this.itemVisibilityToggled(layer, path, sublayer.visibility)} />);
        }
        let title = null;
        if (layer.type === "separator") {
            title = (<input onChange={ev => this.props.changeLayerProperty(layer.uuid, "title", ev.target.value)} value={sublayer.title}/>);
        } else {
            title = (<span className="layertree-item-title" title={sublayer.title}>{sublayer.title}</span>);
        }
        const allowOptions = layer.type !== "placeholder" && layer.type !== "separator";
        const flattenGroups = ConfigUtils.getConfigProp("flattenLayerTreeGroups", this.props.theme) || this.props.flattenGroups;
        const allowSeparators = flattenGroups && allowReordering && ConfigUtils.getConfigProp("allowLayerTreeSeparators", this.props.theme);
        const separatorTitle = LocaleUtils.tr("layertree.separator");
        const separatorTooltip = LocaleUtils.tr("layertree.separatortooltip");
        return (
            <div className="layertree-item-container" data-id={JSON.stringify({layer: layer.uuid, path: path})} key={sublayer.uuid}>
                {allowSeparators ? (<div className="layertree-item-addsep" onClick={() => this.props.addLayerSeparator(separatorTitle, layer.id, path)} title={separatorTooltip} />) : null}
                <div className={classnames(itemclasses)}>
                    {(flattenGroups || skipExpanderPlaceholder) ? null : (<span className="layertree-item-expander" />)}
                    {checkbox}
                    {legendicon}
                    {title}
                    {sublayer.queryable && this.props.showQueryableIcon ? (<Icon className="layertree-item-queryable" icon="info-sign" />) : null}
                    {layer.loading ? (<Spinner />) : null}
                    <span className="layertree-item-spacer" />
                    {allowOptions && !this.props.infoInSettings ? infoButton : null}
                    {allowOptions ? (<Icon className={cogclasses} icon="cog" onClick={() => this.layerMenuToggled(sublayer.uuid)}/>) : null}
                    {allowRemove ? (<Icon className="layertree-item-remove" icon="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                </div>
                {editframe}
            </div>
        );
    }
    renderLayerTree = (layer) => {
        if (layer.role === LayerRole.BACKGROUND || layer.layertreehidden) {
            return null;
        } else if (!Array.isArray(layer.sublayers)) {
            return this.renderLayer(layer, layer, [], layer.visibility);
        } else if (this.props.showRootEntry) {
            return this.renderLayerGroup(layer, layer, [], layer.visibility);
        } else {
            return layer.sublayers.map((sublayer, idx) => {
                const subpath = [idx];
                if (sublayer.sublayers) {
                    return this.renderLayerGroup(layer, sublayer, subpath, layer.visibility);
                } else {
                    return this.renderLayer(layer, sublayer, subpath, layer.visibility, false, true);
                }
            });
        }
    }
    renderBody = () => {
        const maptipcheckboxstate = this.props.mapTipsEnabled === true ? 'checked' : 'unchecked';
        let maptipCheckbox = null;
        let maptipsEnabled = false;
        if (this.props.theme.mapTips !== undefined) {
            maptipsEnabled = this.props.theme.mapTips !== null && this.props.allowMapTips;
        } else {
            maptipsEnabled = this.props.allowMapTips;
        }

        if (!this.props.mobile && maptipsEnabled) {
            maptipCheckbox = (
                <div className="layertree-option">
                    <Icon icon={maptipcheckboxstate} onClick={this.toggleMapTips} />
                    <span onClick={this.toggleMapTips}>{LocaleUtils.tr("layertree.maptip")}</span>
                </div>
            );
        }
        const allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true && !this.state.filtervisiblelayers;
        let compareCheckbox = null;
        if (this.props.allowCompare && allowReordering) {
            const swipecheckboxstate = this.props.swipe || this.props.swipe === 0 ? 'checked' : 'unchecked';
            compareCheckbox = (
                <div className="layertree-option">
                    <Icon icon={swipecheckboxstate} onClick={this.toggleSwipe} />
                    <span onClick={this.toggleSwipe}>{LocaleUtils.tr("layertree.compare")}</span>
                </div>
            );
        }
        let layerImportExpander = null;
        if (this.props.allowImport) {
            layerImportExpander = (
                <div className="layertree-option" onClick={this.toggleImportLayers}>
                    <Icon icon={this.state.importvisible ? 'collapse' : 'expand'} /> {LocaleUtils.tr("layertree.importlayer")}
                </div>
            );
        }
        const flattenGroups = ConfigUtils.getConfigProp("flattenLayerTreeGroups", this.props.theme) || this.props.flattenGroups;
        const sortable = allowReordering && (ConfigUtils.getConfigProp("preventSplittingGroupsWhenReordering", this.props.theme) === true || flattenGroups === true);
        return (
            <div className="layertree-container-wrapper" role="body">
                <div className="layertree-container">
                    <div className="layertree-tree"
                        onContextMenuCapture={ev => {
                            // Prevent context menu on drag-sort
                            ev.stopPropagation(); ev.preventDefault(); return false;
                        }}
                        onTouchEnd={ev => {
                            const target = ev.currentTarget;
                            clearTimeout(target.preventScrollTimeout);
                            target.preventScrollTimeout = null;
                            target.removeEventListener("touchmove", MiscUtils.killEvent);
                        }}
                        onTouchStart={ev => {
                            // Prevent touch-scroll after sortable trigger delay
                            const target = ev.currentTarget;
                            target.preventScrollTimeout = setTimeout(() => {
                                target.addEventListener("touchmove", MiscUtils.killEvent, {passive: false});
                            }, 200);
                        }}
                        ref={MiscUtils.setupKillTouchEvents}
                    >
                        <Sortable onChange={this.onSortChange} options={{disabled: sortable === false, ghostClass: 'drop-ghost', delay: 200, forceFallback: this.props.fallbackDrag}}>
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
        if (this.state.legendTooltip) {
            const style = {
                left: this.state.legendTooltip.x,
                top: this.state.legendTooltip.y,
                maxWidth: (window.innerWidth - this.state.legendTooltip.x - 2),
                maxHeight: (window.innerHeight - this.state.legendTooltip.y - 2),
                visibility: 'hidden'
            };
            legendTooltip = (
                <img className="layertree-item-legend-tooltip" onLoad={this.legendTooltipLoaded} onTouchStart={this.hideLegendTooltip} src={this.state.legendTooltip.img} style={style} />
            );
        }

        let legendPrintIcon = null;
        if (this.props.enableLegendPrint) {
            const printLegendTooltip = LocaleUtils.tr("layertree.printlegend");
            legendPrintIcon = (<Icon className="layertree-print-legend" icon="print" onClick={this.printLegend} title={printLegendTooltip}/>);
        }
        let visibleFilterIcon = null;
        if (this.props.enableVisibleFilter) {
            const visibleFilterTooltip = LocaleUtils.tr("layertree.visiblefilter");
            const classes = classnames({
                "layertree-visible-filter": true,
                "layertree-visible-filter-active": this.state.filtervisiblelayers
            });
            visibleFilterIcon = (<Icon className={classes} icon="eye" onClick={() => this.setState({filtervisiblelayers: !this.state.filtervisiblelayers})} title={visibleFilterTooltip}/>);
        }
        let deleteAllLayersIcon = null;
        if (ConfigUtils.getConfigProp("allowRemovingThemeLayers") === true) {
            const deleteAllLayersTooltip = LocaleUtils.tr("layertree.deletealllayers");
            deleteAllLayersIcon = (<Icon className="layertree-delete-legend" icon="trash" onClick={this.deleteAllLayers} title={deleteAllLayersTooltip}/>);
        }
        let serviceInfoIcon = null;
        if (this.props.enableServiceInfo) {
            serviceInfoIcon = (<Icon className="layertree-theme-metadata" icon="info-sign" onClick={() => this.props.setActiveServiceInfo(this.props.theme)}/>);
        }

        let extraTitlebarContent = null;
        if (legendPrintIcon || deleteAllLayersIcon || visibleFilterIcon) {
            extraTitlebarContent = (
                <span>
                    {legendPrintIcon}
                    {visibleFilterIcon}
                    {deleteAllLayersIcon}
                    {serviceInfoIcon}
                </span>
            );
        }

        const visibilities = [];
        for (const layer of this.props.layers) {
            if (layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                visibilities.push(LayerUtils.computeLayerVisibility(layer));
            }
        }
        const vis = visibilities.reduce((sum, x) => sum + x, 0) / (visibilities.length || 1);
        let visibilityIcon = "tristate";
        if (vis === 0) {
            visibilityIcon = "unchecked";
        } else if (vis === 1) {
            visibilityIcon = "checked";
        }
        const visibilityCheckbox = this.props.showToggleAllLayersCheckbox ? (<Icon className="layertree-tree-visibility" icon={visibilityIcon} onClick={() => this.toggleLayerTreeVisibility(vis === 0)}/>) : null;

        return (
            <div>
                <SideBar extraBeforeContent={visibilityCheckbox} extraTitlebarContent={extraTitlebarContent}
                    icon="layers"
                    id="LayerTree" onHide={this.hideLegendTooltip}
                    side={this.props.side}
                    title="appmenu.items.LayerTree" width={this.state.sidebarwidth || this.props.width}>
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
                {legendTooltip}
                <LayerInfoWindow bboxDependentLegend={this.props.bboxDependentLegend} scaleDependentLegend={this.props.scaleDependentLegend} windowSize={this.props.layerInfoWindowSize} />
                <ServiceInfoWindow windowSize={this.props.layerInfoWindowSize} />
            </div>
        );
    }
    legendTooltipLoaded = (ev) => {
        if (ev.target.naturalWidth > 1) {
            ev.target.style.visibility = 'visible';
        }
    }
    onSortChange = (order, sortable, ev) => {
        const moved = JSON.parse(order[ev.newIndex]);
        const layer = this.props.layers.find(l => l.uuid === moved.layer);
        if (layer) {
            this.props.reorderLayer(layer, moved.path, ev.newIndex - ev.oldIndex);
        }
    }
    toggleImportLayers = () => {
        const visible = !this.state.importvisible;
        this.setState({importvisible: visible, sidebarwidth: visible ? '40em' : null});
    }
    propagateOptions = (layer, options, path = null) => {
        if (layer.sublayers) {
            layer.sublayers = layer.sublayers.map((sublayer, idx) => {
                if (path === null || (!isEmpty(path) && path[0] === idx)) {
                    const newsublayer = {...sublayer, ...options};
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
        if (this.props.groupTogglesSublayers) {
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
    hideLegendTooltip = () => {
        this.setState({legendTooltip: undefined});
    }
    toggleMapTips = () => {
        this.props.toggleMapTips(!this.props.mapTipsEnabled);
    }
    toggleSwipe = () => {
        this.props.setSwipe(this.props.swipe !== null ? null : 50);
    }
    printLayerLegend = (layer, sublayer) => {
        let body = "";
        if (sublayer.sublayers) {
            if (sublayer.visibility) {
                body = '<div class="legend-group">' +
                       '<h3 class="legend-group-title">' + (sublayer.title || sublayer.name) + '</h3>' +
                       '<div class="legend-group-body">' +
                       sublayer.sublayers.map(subsublayer => this.printLayerLegend(layer, subsublayer)).join("\n") +
                       '</div>' +
                       '</div>';
            }
        } else {
            if (sublayer.visibility && LayerUtils.layerScaleInRange(sublayer, this.props.mapScale)) {
                const request = LayerUtils.getLegendUrl(layer, {name: sublayer.name}, this.props.mapScale, this.props.map, this.props.bboxDependentLegend, this.props.scaleDependentLegend);
                body = request ? '<div class="legend-entry"><img src="' + request + '" /></div>' : "";
            }
        }
        return body;
    }
    printLegend = () => {
        let body = '<p id="legendcontainerbody">';
        const printLabel = LocaleUtils.tr("layertree.printlegend");
        body += '<div id="print">' +
                '<style type="text/css">@media print{ #print { display: none; }}</style>' +
                '<button onClick="(function(){window.print();})()">' + printLabel + '</button>' +
                '</div>';
        body += this.props.layers.map(layer => {
            if (!layer.visibility) {
                return "";
            } else if (layer.legendUrl) {
                return this.printLayerLegend(layer, layer);
            } else if (layer.color) {
                return '<div class="legend-entry"><span style="display: inline-block; width: 1em; height: 1em; box-shadow: inset 0 0 0 1000px ' + layer.color + '; margin: 0.25em; border: 1px solid black;">&nbsp;</span>' + (layer.title || layer.name) + '</div>';
            } else {
                return "";
            }
        }).join("");
        body += "</p>";
        const setLegendPrintContent = () => {
            const container = this.legendPrintWindow.document.getElementById("legendcontainer");
            if (container) {
                container.innerHTML = body;
            } else {
                this.legendPrintWindow.document.body.innerHTML = "Broken template. An element with id=legendcontainer must exist.";
            }
        };

        if (this.legendPrintWindow && !this.legendPrintWindow.closed) {
            setLegendPrintContent();
            this.legendPrintWindow.focus();
        } else {
            const assetsPath = ConfigUtils.getAssetsPath();
            this.legendPrintWindow = window.open(assetsPath + "/templates/legendprint.html", "Legend", "toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes");
            if (window.navigator.userAgent.indexOf('Trident/') > 0) {
                // IE...
                const interval = setInterval(() => {
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
        for (const layer of this.props.layers) {
            if (layer.role === LayerRole.THEME) {
                const sublayers = layer.sublayers || [];
                for (let i = sublayers.length - 1; i >= 0; --i) {
                    this.props.removeLayer(layer.id, [i]);
                }
            } else if (layer.role === LayerRole.USERLAYER) {
                this.props.removeLayer(layer.id);
            }
        }
    }
    toggleLayerTreeVisibility = (visibile) => {
        for (const layer of this.props.layers) {
            if (layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                this.props.changeLayerProperty(layer.uuid, "visibility", visibile, [], this.props.groupTogglesSublayers ? "children" : null);
            }
        }
    }
    exportRedliningLayer = (layer) => {
        const data = JSON.stringify({
            type: "FeatureCollection",
            features: layer.features.map(feature => ({...feature, geometry: VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs || this.props.map.projection, 'EPSG:4326')}))
        }, null, ' ');
        FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), layer.title + ".json");
    }
}

const selector = (state) => ({
    mobile: state.browser.mobile,
    ie: state.browser.ie,
    fallbackDrag: state.browser.ie || (state.browser.platform === 'Win32' && state.browser.chrome),
    layers: state.layers.flat,
    map: state.map,
    mapScale: MapUtils.computeForZoom(state.map.scales, state.map.zoom),
    swipe: state.layers.swipe,
    theme: state.theme.current || {},
    mapTipsEnabled: state.map.maptips
});

export default connect(selector, {
    addLayerSeparator: addLayerSeparator,
    changeLayerProperty: changeLayerProperty,
    removeLayer: removeLayer,
    reorderLayer: reorderLayer,
    toggleMapTips: toggleMapTips,
    setSwipe: setSwipe,
    setActiveLayerInfo: setActiveLayerInfo,
    setActiveServiceInfo: setActiveServiceInfo,
    zoomToExtent: zoomToExtent
})(LayerTree);
