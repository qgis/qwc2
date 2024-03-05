/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import Sortable from 'react-sortablejs';

import classnames from 'classnames';
import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {setActiveLayerInfo} from '../actions/layerinfo';
import {LayerRole, changeLayerProperty, removeLayer, reorderLayer, setSwipe, addLayerSeparator} from '../actions/layers';
import {toggleMapTips, zoomToExtent} from '../actions/map';
import {setActiveServiceInfo} from '../actions/serviceinfo';
import Icon from '../components/Icon';
import ImportLayer from '../components/ImportLayer';
import LayerInfoWindow from '../components/LayerInfoWindow';
import ServiceInfoWindow from '../components/ServiceInfoWindow';
import SideBar from '../components/SideBar';
import Spinner from '../components/Spinner';
import {Image} from '../components/widgets/Primitives';
import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/LayerTree.css';


/**
 * Displays the map layer tree in a sidebar.
 *
 * The print legend functionality requires a template located by default at assets/templates/legendprint.html
 * with containing a container element with id=legendcontainer.
 */
class LayerTree extends React.Component {
    static propTypes = {
        /** Whether to allow adding separator entries in the layer tree, useful for organizing the tree. */
        addLayerSeparator: PropTypes.func,
        /** Whether to enable the compare function. Requires the `MapCompare` plugin. */
        allowCompare: PropTypes.bool,
        /** Whether to allow importing external layers. */
        allowImport: PropTypes.bool,
        /** Whether to allow enabling map tips. */
        allowMapTips: PropTypes.bool,
        /** Whether to allow selection of identifyable layers. The `showQueryableIcon` property should be `true` to be able to select identifyable layers. */
        allowSelectIdentifyableLayers: PropTypes.bool,
        /** Whether to display a BBOX dependent legend. Can be `true|false|"theme"`, latter means only for theme layers. */
        bboxDependentLegend: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        changeLayerProperty: PropTypes.func,
        /** Whether to enable the legend print functionality. */
        enableLegendPrint: PropTypes.bool,
        /** Whether to display a service info button to display the WMS service metadata. */
        enableServiceInfo: PropTypes.bool,
        /** Whether to display a button to filter invisible layers from the layertree. */
        enableVisibleFilter: PropTypes.bool,
        /** Additional parameters to pass to the GetLegendGraphics request- */
        extraLegendParameters: PropTypes.string,
        fallbackDrag: PropTypes.bool,
        /** Whether to display a flat layer tree, omitting any groups. */
        flattenGroups: PropTypes.bool,
        /** Whether to display unchecked layers gray in the layertree. */
        grayUnchecked: PropTypes.bool,
        /** Whether toggling a group also toggles all sublayers. */
        groupTogglesSublayers: PropTypes.bool,
        /** Whether to display the layer info button inside the layer settings menu rather than next to the layer title. */
        infoInSettings: PropTypes.bool,
        /** Default layer info window geometry with size, position and docking status. */
        layerInfoGeometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool
        }),
        layers: PropTypes.array,
        loadingLayers: PropTypes.array,
        map: PropTypes.object,
        mapScale: PropTypes.number,
        mapTipsEnabled: PropTypes.bool,
        mobile: PropTypes.bool,
        removeLayer: PropTypes.func,
        reorderLayer: PropTypes.func,
        /** Whether to display a scale dependent legend. Can be `true|false|"theme"`, latter means only for theme layers. */
        scaleDependentLegend: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        setActiveLayerInfo: PropTypes.func,
        setActiveServiceInfo: PropTypes.func,
        setSwipe: PropTypes.func,
        /** Whether to display legend icons. */
        showLegendIcons: PropTypes.bool,
        /** Whether to display the queryable icon to indicate that a layer is identifyable. */
        showQueryableIcon: PropTypes.bool,
        /** Whether to display the root entry of the layertree. */
        showRootEntry: PropTypes.bool,
        /** Whether to display a checkbox to toggle all layers. */
        showToggleAllLayersCheckbox: PropTypes.bool,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        swipe: PropTypes.number,
        /** Template location for the legend print functionality */
        templatePath: PropTypes.string,
        theme: PropTypes.object,
        toggleMapTips: PropTypes.func,
        transparencyIcon: PropTypes.bool,
        /** The initial width of the layertree, as a CSS width string. */
        width: PropTypes.string,
        zoomToExtent: PropTypes.func
    };
    static defaultProps = {
        layers: [],
        showLegendIcons: true,
        showRootEntry: true,
        showQueryableIcon: true,
        allowMapTips: true,
        allowCompare: true,
        allowImport: true,
        allowSelectIdentifyableLayers: false,
        groupTogglesSublayers: false,
        grayUnchecked: true,
        layerInfoGeometry: {
            initialWidth: 480,
            initialHeight: 480,
            initialX: null,
            initialY: null,
            initiallyDocked: false
        },
        bboxDependentLegend: false,
        flattenGroups: false,
        width: "25em",
        enableLegendPrint: true,
        enableVisibleFilter: true,
        enableServiceInfo: true,
        infoInSettings: true,
        showToggleAllLayersCheckbox: true,
        transparencyIcon: true,
        side: 'right',
        templatePath: ":/templates/legendprint.html"
    };
    state = {
        activemenu: null,
        activestylemenu: null,
        legendTooltip: null,
        sidebarwidth: null,
        importvisible: false,
        filtervisiblelayers: false
    };
    constructor(props) {
        super(props);
        this.legendPrintWindow = null;
        window.addEventListener('beforeunload', () => {
            if (this.legendPrintWindow && !this.legendPrintWindow.closed) {
                this.legendPrintWindow.close();
            }
        });
    }
    componentDidUpdate(prevProps) {
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
    };
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
        let omitqueryable;
        let identifyableClassName = "";
        const subtreequeryable = LayerUtils.computeLayerQueryable(group);
        if (subtreequeryable === 1) {
            identifyableClassName = "layertree-item-identifyable-checked";
            omitqueryable = false;
        } else if (subtreequeryable === 0) {
            identifyableClassName = "layertree-item-identifyable-unchecked";
            omitqueryable = true;
        } else {
            identifyableClassName = "layertree-item-identifyable-tristate";
            omitqueryable = true;
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
        const optMenuClasses = classnames({
            "layertree-item-menubutton": true,
            "layertree-item-menubutton-active": this.state.activemenu === group.uuid
        });
        const allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers", this.props.theme) === true || layer.role !== LayerRole.THEME;
        const allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true && !this.state.filtervisiblelayers;
        const sortable = allowReordering && ConfigUtils.getConfigProp("preventSplittingGroupsWhenReordering", this.props.theme) === true;
        return (
            <div className="layertree-item-container" data-id={JSON.stringify({layer: layer.uuid, path: path})} key={group.uuid}>
                <div className={classnames(itemclasses)}>
                    <Icon className="layertree-item-expander" icon={expanderstate} onClick={() => this.groupExpandedToggled(layer, path, group.expanded)} />
                    <Icon className="layertree-item-checkbox" icon={checkboxstate} onClick={() => this.itemVisibilityToggled(layer, path, visibility)} />
                    <span className="layertree-item-title" title={group.title}>{group.title}</span>
                    {this.props.allowSelectIdentifyableLayers ? (<Icon className={"layertree-item-identifyable " + identifyableClassName}  icon="info-sign" onClick={() => this.itemOmitQueryableToggled(layer, path, omitqueryable)} />) : null}
                    <span className="layertree-item-spacer" />
                    <Icon className={optMenuClasses} icon="cog" onClick={() => this.layerMenuToggled(group.uuid)}/>
                    {allowRemove ? (<Icon className="layertree-item-remove" icon="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                </div>
                {this.state.activemenu === group.uuid ? this.renderOptionsMenu(layer, group, path, allowRemove) : null}
                <Sortable onChange={this.onSortChange} options={{disabled: sortable === false, ghostClass: 'drop-ghost', delay: 200, forceFallback: this.props.fallbackDrag}}>
                    {sublayersContent}
                </Sortable>
            </div>
        );
    };
    renderLayer = (layer, sublayer, path, enabled = true, inMutuallyExclusiveGroup = false, skipExpanderPlaceholder = false) => {
        if (this.state.filtervisiblelayers && !sublayer.visibility) {
            return null;
        }
        if (Array.isArray(layer.layerTreeHiddenSublayers) && layer.layerTreeHiddenSublayers.includes(sublayer.name)) {
            return null;
        }
        const allowRemove = ConfigUtils.getConfigProp("allowRemovingThemeLayers", this.props.theme) === true || layer.role !== LayerRole.THEME;
        const allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true;
        let checkboxstate = sublayer.visibility === true ? 'checked' : 'unchecked';
        if (inMutuallyExclusiveGroup) {
            checkboxstate = 'radio_' + checkboxstate;
        }
        const optMenuClasses = classnames({
            "layertree-item-menubutton": true,
            "layertree-item-menubutton-active": this.state.activemenu === sublayer.uuid
        });
        const styleMenuClasses = classnames({
            "layertree-item-menubutton": true,
            "layertree-item-menubutton-active": this.state.activestylemenu === sublayer.uuid
        });
        const itemclasses = {
            "layertree-item": true,
            "layertree-item-disabled": layer.type !== "separator" && ((!this.props.groupTogglesSublayers && !enabled) || (this.props.grayUnchecked && !sublayer.visibility)),
            "layertree-item-separator": layer.type === "separator",
            "layertree-item-outsidescalerange": (sublayer.minScale !== undefined && this.props.mapScale < sublayer.minScale) || (sublayer.maxScale !== undefined && this.props.mapScale > sublayer.maxScale)
        };
        let infoButton = null;
        if (layer.type === "wms" || layer.type === "wfs" || layer.type === "wmts") {
            infoButton = (<Icon className="layertree-item-metadata" icon="info-sign" onClick={() => this.props.setActiveLayerInfo(layer, sublayer)}/>);
        }
        let legendicon = null;
        if (this.props.showLegendIcons) {
            const legendUrl = LayerUtils.getLegendUrl(layer, sublayer, this.props.mapScale, this.props.map, this.props.bboxDependentLegend, this.props.scaleDependentLegend, this.props.extraLegendParameters);
            if (legendUrl) {
                legendicon = (<Image className="layertree-item-legend-thumbnail" onMouseOut={this.hideLegendTooltip} onMouseOver={ev => this.showLegendTooltip(ev, legendUrl)} onTouchStart={ev => this.showLegendTooltip(ev, legendUrl)} src={legendUrl + "&TYPE=thumbnail"} />);
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
        let queryableicon = null;
        if (this.props.allowSelectIdentifyableLayers) {
            const identifyableClassName = !sublayer.omitFromQueryLayers ? "layertree-item-identifyable-checked" : "layertree-item-identifyable-unchecked";
            queryableicon = <Icon className={"layertree-item-identifyable " + identifyableClassName} icon="info-sign" onClick={() => this.itemOmitQueryableToggled(layer, path, sublayer.omitFromQueryLayers)}/>;
        } else {
            queryableicon = <Icon className="layertree-item-queryable" icon="info-sign"/>;
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
                    {sublayer.queryable && this.props.showQueryableIcon ? (queryableicon) : null}
                    {sublayer.name in (layer.filterParams || {}) || layer.filterGeom ? (<Icon icon="filter" />) : null}
                    {this.props.loadingLayers.includes(layer.id) ? (<Spinner />) : null}
                    <span className="layertree-item-spacer" />
                    {allowOptions && !this.props.infoInSettings ? infoButton : null}
                    {Object.keys(sublayer.styles || {}).length > 1 ? (<Icon className={styleMenuClasses} icon="paint" onClick={() => this.layerStyleMenuToggled(sublayer.uuid)}/>) : null}
                    {allowOptions ? (<Icon className={optMenuClasses} icon="cog" onClick={() => this.layerMenuToggled(sublayer.uuid)}/>) : null}
                    {allowRemove ? (<Icon className="layertree-item-remove" icon="trash" onClick={() => this.props.removeLayer(layer.id, path)}/>) : null}
                </div>
                {this.state.activemenu === sublayer.uuid ? this.renderOptionsMenu(layer, sublayer, path, allowRemove) : null}
                {this.state.activestylemenu === sublayer.uuid ? this.renderStyleMenu(layer, sublayer, path, allowOptions + allowRemove) : null}
            </div>
        );
    };
    renderOptionsMenu = (layer, sublayer, path, marginRight = 0) => {
        const allowReordering = ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) === true;
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
        let infoButton = null;
        if (layer.type === "wms" || layer.type === "wfs" || layer.type === "wmts") {
            infoButton = (<Icon className="layertree-item-metadata" icon="info-sign" onClick={() => this.props.setActiveLayerInfo(layer, sublayer)}/>);
        }
        return (
            <div className="layertree-item-optionsmenu" onMouseDown={this.preventLayerTreeItemDrag} style={{marginRight: (marginRight * 1.75) + 'em'}}>
                {zoomToLayerButton}
                {this.props.transparencyIcon ? (<Icon icon="transparency" />) : LocaleUtils.tr("layertree.transparency")}
                <input className="layertree-item-transparency-slider" max="255" min="0"
                    onChange={(ev) => this.layerTransparencyChanged(layer, path, ev.target.value, !isEmpty(sublayer.sublayers) ? 'children' : null)}
                    step="1" type="range" value={255 - LayerUtils.computeLayerOpacity(sublayer)} />
                {reorderButtons}
                {this.props.infoInSettings ? infoButton : null}
                {layer.type === 'vector' ? (<Icon icon="export" onClick={() => this.exportRedliningLayer(layer)} />) : null}
            </div>
        );
    };
    renderStyleMenu = (layer, sublayer, path, marginRight = 0) => {
        return (
            <div className="layertree-item-stylemenu" style={{marginRight: (marginRight * 1.75) + 'em'}}>
                {Object.entries(sublayer.styles).map(([name, title]) => (
                    <div key={name} onClick={() => this.layerStyleChanged(layer, path, name)}>
                        <Icon icon={sublayer.style === name ? "radio_checked" : "radio_unchecked"} />
                        <div>{title}</div>
                    </div>
                ))}
            </div>
        );
    };
    preventLayerTreeItemDrag = (ev) => {
        const draggableEl = ev.currentTarget.parentNode;
        if (draggableEl.draggable) {
            draggableEl.draggable = false;
            document.addEventListener('mouseup', () => {
                draggableEl.draggable = true;
            }, {once: true});
        }
    };
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
    };
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
        const haveMapCompare = ConfigUtils.havePlugin("MapCompare");
        let compareCheckbox = null;
        if (haveMapCompare && this.props.allowCompare && allowReordering) {
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
    };
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
                <Image className="layertree-item-legend-tooltip" onLoad={this.legendTooltipLoaded} onTouchStart={this.hideLegendTooltip} src={this.state.legendTooltip.img} style={style} />
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
            visibleFilterIcon = (<Icon className={classes} icon="eye" onClick={() => this.setState((state) => ({filtervisiblelayers: !state.filtervisiblelayers}))} title={visibleFilterTooltip}/>);
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
                <LayerInfoWindow bboxDependentLegend={this.props.bboxDependentLegend} layerInfoGeometry={this.props.layerInfoGeometry} scaleDependentLegend={this.props.scaleDependentLegend} />
                <ServiceInfoWindow layerInfoGeometry={this.props.layerInfoGeometry} />
            </div>
        );
    }
    legendTooltipLoaded = (ev) => {
        if (ev.target.naturalWidth > 1) {
            ev.target.style.visibility = 'visible';
        }
    };
    onSortChange = (order, sortable, ev) => {
        const moved = JSON.parse(order[ev.newIndex]);
        const layer = this.props.layers.find(l => l.uuid === moved.layer);
        if (layer) {
            this.props.reorderLayer(layer, moved.path, ev.newIndex - ev.oldIndex);
        }
    };
    toggleImportLayers = () => {
        this.setState((state) => {
            const visible = !state.importvisible;
            return {importvisible: visible, sidebarwidth: visible ? '40em' : null};
        });
    };
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
    };
    groupExpandedToggled = (layer, grouppath, oldexpanded) => {
        this.props.changeLayerProperty(layer.uuid, "expanded", !oldexpanded, grouppath);
    };
    itemVisibilityToggled = (layer, grouppath, oldvisibility) => {
        let recurseDirection = null;
        // If item becomes visible, also make parents visible
        if (this.props.groupTogglesSublayers) {
            recurseDirection = !oldvisibility ? "both" : "children";
        } else {
            recurseDirection = !oldvisibility ? "parents" : null;
        }
        this.props.changeLayerProperty(layer.uuid, "visibility", !oldvisibility, grouppath, recurseDirection);
    };
    itemOmitQueryableToggled = (layer, grouppath, oldomitqueryable) => {
        this.props.changeLayerProperty(layer.uuid, "omitFromQueryLayers", !oldomitqueryable, grouppath, "children");
    };
    layerTransparencyChanged = (layer, sublayerpath, value, recurse = null) => {
        this.props.changeLayerProperty(layer.uuid, "opacity", Math.max(1, 255 - value), sublayerpath, recurse);
    };
    layerStyleChanged = (layer, sublayerpath, value) => {
        this.props.changeLayerProperty(layer.uuid, "style", value, sublayerpath);
    };
    layerMenuToggled = (sublayeruuid) => {
        this.setState((state) => ({activemenu: state.activemenu === sublayeruuid ? null : sublayeruuid, activestylemenu: null}));
    };
    layerStyleMenuToggled = (sublayeruuid) => {
        this.setState((state) => ({activestylemenu: state.activestylemenu === sublayeruuid ? null : sublayeruuid, activemenu: null}));
    };
    showLegendTooltip = (ev, request) => {
        this.setState({
            legendTooltip: {
                x: ev.target.getBoundingClientRect().right,
                y: ev.target.getBoundingClientRect().top,
                img: request + "&TYPE=tooltip"
            }
        });
    };
    hideLegendTooltip = () => {
        this.setState({legendTooltip: undefined});
    };
    toggleMapTips = () => {
        this.props.toggleMapTips(!this.props.mapTipsEnabled);
    };
    toggleSwipe = () => {
        this.props.setSwipe(this.props.swipe !== null ? null : 50);
    };
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
                const request = LayerUtils.getLegendUrl(layer, {name: sublayer.name}, this.props.mapScale, this.props.map, this.props.bboxDependentLegend, this.props.scaleDependentLegend, this.props.extraLegendParameters);
                body = request ? '<div class="legend-entry"><img src="' + request + '" /></div>' : "";
            }
        }
        return body;
    };
    printLegend = () => {
        let body = '<p id="legendcontainerbody">';
        const printLabel = LocaleUtils.tr("layertree.printlegend");
        body += '<div id="print" style="margin-bottom: 1em">' +
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
            let templatePath = this.props.templatePath;
            if (templatePath.startsWith(":/")) {
                const assetsPath = ConfigUtils.getAssetsPath();
                templatePath = assetsPath + templatePath.substr(1);
            }
            this.legendPrintWindow = window.open(templatePath, "Legend", "toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes");
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
    };
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
    };
    toggleLayerTreeVisibility = (visibile) => {
        for (const layer of this.props.layers) {
            if (layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) {
                this.props.changeLayerProperty(layer.uuid, "visibility", visibile, [], this.props.groupTogglesSublayers ? "children" : null);
            }
        }
    };
    exportRedliningLayer = (layer) => {
        const data = JSON.stringify({
            type: "FeatureCollection",
            features: layer.features.map(feature => ({...feature, geometry: VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs || this.props.map.projection, 'EPSG:4326')}))
        }, null, ' ');
        FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), layer.title + ".json");
    };
}

const selector = (state) => ({
    mobile: state.browser.mobile,
    ie: state.browser.ie,
    fallbackDrag: state.browser.ie || (state.browser.platform === 'Win32' && state.browser.chrome),
    layers: state.layers.flat,
    loadingLayers: state.layers.loading,
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
