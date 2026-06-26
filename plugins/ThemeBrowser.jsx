/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import Sortable from 'react-sortablejs';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import {LayerRole, changeLayerProperty, reorderLayer, removeLayer} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import {setBlankTheme, setCurrentTheme} from '../actions/theme';
import Icon from '../components/Icon';
import ImportLayer from '../components/ImportLayer';
import SideBar from '../components/SideBar';
import {Image} from '../components/widgets/Primitives';
import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils, {ToggleSet} from '../utils/MiscUtils';

import './ThemeBrowser.css';


/**
 * Theme browser panel.
 *
 * An alternative to the ThemeSwitcher and LayerTree, allows navigating themes
 * and controlling layers in a single interface.
 */
class ThemeBrowser extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        activeTheme: PropTypes.string,
        /** Whether to allow removing theme layers. */
        allowRemovingThemeLayers: PropTypes.bool,
        /** Whether to display a BBOX dependent legend. Can be `true|false|"theme"`, latter means only for theme layers. */
        bboxDependentLegend: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        changeLayerProperty: PropTypes.func,
        /** Whether to use the fallback logic for drag-and-drop. */
        fallbackDrag: PropTypes.bool,
        /** Make panel fill screen width if wider than the specified screen width percentage. */
        fillIfWiderThanPerc: PropTypes.number,
        layers: PropTypes.array,
        map: PropTypes.object,
        /** Maximum width of panel (ignored `fillIfWiderThanPerc` is set). */
        maxWidth: PropTypes.string,
        removeLayer: PropTypes.func,
        reorderLayer: PropTypes.func,
        /** Whether to display a scale dependent legend. Can be `true|false|"theme"`, latter means only for theme layers. */
        scaleDependentLegend: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        setBlankTheme: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        themes: PropTypes.array
    };
    static defaultProps = {
        side: 'right'
    };
    state = {
        active: false,
        expandedEntries: new ToggleSet(),
        showDelete: false,
        width: '15em',
        maxWidth: '50%'
    };
    constructor(props) {
        super(props);
        this.maxLayerTitleLength = undefined;
        this.sidebar = null;
    }
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        if (this.props.active && !prevProps.active) {
            this.setState(state => ({active: !state.active}));
            this.props.setCurrentTask(null);
        }
    }
    render() {
        this.maxLayerTitleLength = 0;
        this.measureCanvas = document.createElement('canvas');
        this.measureContext = this.measureCanvas.getContext('2d');
        this.measureContext.font = getComputedStyle(document.body).font;
        const result = (
            <SideBar icon="list-alt"
                id="ThemeBrowser" maxWidth={this.props.fillIfWiderThanPerc ? undefined : this.props.maxWidth} onHide={this.onClose}
                side={this.props.side} splitScreen
                title={LocaleUtils.tr("appmenu.items.ThemeBrowser")}
                visible={this.state.active} width={this.state.width}
            >
                <div className="themebrowser-body" role="body">
                    {this.renderThemes(this.props.themes)}
                </div>
            </SideBar>
        );
        let width = this.maxLayerTitleLength + "px";
        if (this.props.fillIfWiderThanPerc && this.maxLayerTitleLength > window.innerWidth * this.props.fillIfWiderThanPerc / 100) {
            width = '100%';
        }
        this.measureCanvas = undefined;
        this.measureContext = undefined;
        if (width !== this.state.width) {
            this.setState({width});
        }
        return result;
    }
    renderThemes = (group) => {
        const children = (group?.items ?? []).map(item => (
            <div className="themebrowser-theme-container" key={item.id}>
                <div className="themebrowser-theme" onClick={() => this.toggleTheme(item)} onKeyDown={MiscUtils.checkKeyActivate} tabIndex={0}>
                    <span>{item.title}</span>
                    {item.id === this.props.activeTheme ? (<Icon icon="list-alt" onClick={this.toggleLegend} size="large" />) : null}
                </div>
                {item.id === this.props.activeTheme ? this.renderLayerTree(item) : null}
                {item.id === this.props.activeTheme && this.state.showDelete ? (
                    <div className="themebrowser-theme-trashdrop" onDragEnter={this.onTrashDropEnter} onDragLeave={this.onTrashDropLeave}><Icon icon="trash" size="large" /></div>
                ) : null}
            </div>
        ));
        (group?.subdirs ?? []).map(subdir => children.push(...this.renderThemes(subdir)));
        return children;
    };
    renderLayerTree = (theme) => {
        const sortable = ConfigUtils.getConfigProp("allowReorderingLayers", theme) && ConfigUtils.getConfigProp("preventSplittingGroupsWhenReordering", theme);
        const treelayers = this.props.layers.filter(layer => layer.role !== LayerRole.BACKGROUND && !layer.layertreehidden);
        const addEntryClasses = classNames({
            "themebrowser-tree-entry": true,
            "themebrowser-tree-entry-visible": this.state.addVisible,
            "themebrowser-tree-entry-detailsvisible": this.state.addVisible
        });
        if (this.state.addVisible) {
            this.maxLayerTitleLength = Math.max(this.maxLayerTitleLength, MiscUtils.convertEmToPx(20));
        }
        return (
            <div className="themebrowser-tree">
                <Sortable onChange={this.onSortChange} options={{disabled: !sortable, ghostClass: 'drop-ghost', forceFallback: this.props.fallbackDrag, handle: '.themebrowser-tree-entry-drag', onEnd: this.onDragEnd}}>
                    {treelayers.map(layer => {
                        if (layer.role === LayerRole.THEME && layer.sublayers?.length) {
                            return layer.sublayers.map((sublayer, idx) => this.renderLayerTreeEntry(layer, sublayer, [idx], sortable));
                        } else {
                            return this.renderLayerTreeEntry(layer, layer, [], sortable);
                        }
                    })}
                </Sortable>
                <div className="themebrowser-tree-entry-container">
                    <div className={addEntryClasses} onClick={() => this.setState(state => ({addVisible: !state.addVisible}))}>
                        <Icon icon={this.state.addVisible ? "remove" : "plus"} />
                        <span className="themebrowser-tree-entry-title">{LocaleUtils.tr("common.add")}</span>
                    </div>
                    {this.state.addVisible ? (
                        <div className="themebrowser-tree-entry-details">
                            <ImportLayer theme={theme} />
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };
    renderLayerTreeEntry = (layer, entry, path, sortable, parentVisibility = true) => {
        const opacity = LayerUtils.computeLayerOpacity(entry);
        const entryClasses = classNames({
            "themebrowser-tree-entry": true,
            "themebrowser-tree-entry-transparent": entry.visibility && opacity < 255,
            "themebrowser-tree-entry-visible": entry.visibility,
            "themebrowser-tree-entry-inactive": !parentVisibility,
            "themebrowser-tree-entry-detailsvisible": this.state.expandedEntries.has(layer.id + ":" + entry.name)
        });
        const plusClasses = classNames({
            "themebrowser-tree-entry-plus": true,
            "themebrowser-tree-entry-plus-remove": entry.visibility
        });
        const entryStyle = {
            backgroundColor: entry.visibility ? `rgb(from var(--border-color) r g b / ${opacity / 255})` : '',
            color: entry.visibility && opacity > 96 ? "white" : `var(--border-color)`
        };
        this.maxLayerTitleLength = Math.max(this.maxLayerTitleLength, this.measureContext.measureText(entry.title).width + path.length * MiscUtils.convertEmToPx(1) + MiscUtils.convertEmToPx(6));
        return (
            <div className="themebrowser-tree-entry-container" data-id={JSON.stringify({layerId: layer.id, path: path})} key={layer.id + ":" + entry.name}>
                <div className={entryClasses} onKeyDown={ev => this.adjustEntryOpacity(ev, entry, layer.id, path)} onPointerDown={ev => this.adjustEntryOpacity(ev, entry, layer.id, path)} style={entryStyle} tabIndex={0}>
                    <Icon className={plusClasses} icon="plus" onPointerDown={() => this.toggleEntryVisibility(entry, layer.id, path)} />
                    <span className="themebrowser-tree-entry-title" onKeyDown={MiscUtils.checkKeyActivate} onPointerDown={ev => this.toggleEntryExpanded(ev, entry, layer.id, path)} tabIndex={0} title={entry.title}>{entry.title}</span>
                    {entry.visibility ? (<span className="themebrowser-tree-entry-opacity">{Math.round(opacity / 255 * 100) + "%"}</span>) : null}
                    <span className="themebrowser-tree-entry-drag" onKeyDown={(ev) => this.onKeySort(ev, layer.id, path)} onPointerDown={() => this.onDragStart(layer, path)} onPointerUp={this.onDragEnd} tabIndex={0}><Icon icon="drag" /></span>
                </div>
                {entry.sublayers && entry.expanded ? (
                    <div className="themebrowser-tree-entry-children">
                        <Sortable onChange={this.onSortChange} options={{disabled: !sortable, ghostClass: 'drop-ghost', forceFallback: this.props.fallbackDrag, handle: '.themebrowser-tree-entry-drag', onEnd: this.onDragEnd}}>
                            {entry.sublayers.map((sublayer, idx) => this.renderLayerTreeEntry(layer, sublayer, [...path, idx], parentVisibility && entry.visibility))}
                        </Sortable>
                    </div>
                ) : null}
                {this.state.expandedEntries.has(layer.id + ":" + entry.name) ? this.renderLayerTreeEntryDetails(layer, entry) : null}
            </div>
        );
    };
    renderLayerTreeEntryDetails = (layer, entry) => {
        let legend = null;
        const scale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
        const legendUrl = LayerUtils.getLegendUrl(layer, entry, scale, this.props.map, this.props.bboxDependentLegend, this.props.scaleDependentLegend);
        if (legendUrl) {
            legend = (<Image className="themebrowser-tree-entry-legend" src={legendUrl} />);
        } else if (layer.color) {
            legend = (
                <div className="themebrowser-tree-entry-legend">
                    <span style={{backgroundColor: layer.color}} /><span>{entry.title}</span>
                </div>
            );
        }
        return (
            <div className="themebrowser-tree-entry-details">
                {legend}
            </div>
        );
    };
    toggleTheme = (theme) => {
        this.setState({expandedEntries: new ToggleSet(), addVisible: false});
        if (this.props.activeTheme === theme.id) {
            this.props.setBlankTheme(this.props.themes);
        } else {
            this.props.setCurrentTheme(theme, this.props.themes, true);
        }
    };
    toggleLegend = (ev) => {
        MiscUtils.killEvent(ev);
        this.props.setCurrentTask("MapLegend", null, null, {toggle: true});
    };
    toggleEntryExpanded = (ev, entry, layerId, path) => {
        let cancel = false;
        const cancelAction = () => { cancel = true; };
        ev.view.addEventListener("pointermove", cancelAction);
        ev.view.addEventListener("pointerup", () => {
            ev.view.removeEventListener("pointermove", cancelAction);
            if (!cancel) {
                if (entry.sublayers) {
                    this.props.changeLayerProperty(layerId, "expanded", !entry.expanded, path);
                } else {
                    this.setState(state => ({expandedEntries: state.expandedEntries.toggle(layerId + ":" + entry.name)}));
                }
            }
        }, {once: true});
    };
    toggleEntryVisibility = (entry, layerId, path) => {
        this.props.changeLayerProperty(layerId, "visibility", !entry.visibility, path, !entry.visibility ? "parents" : null);
    };
    adjustEntryOpacity = (ev, entry, layerId, path) => {
        if (ev.target.matches('.themebrowser-tree-entry-drag') || !entry.visibility || this.adjusting || this.dragging) {
            return;
        }
        // Only adjust opacities when dragging from areas other than the opacity arrows icon if entry is not fully opaque
        if (ev.type === "pointerdown" && entry.opacity === 255 && !ev.target.matches('.themebrowser-tree-entry-opacity')) {
            return;
        }
        const startOpacity = LayerUtils.computeLayerOpacity(entry);
        if (ev.type === "keydown" && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
            this.adjusting = true;
            const delta = ev.key === "ArrowLeft" ? -1 : +1;
            let newOpacity = startOpacity;
            let adjustInterval = null;
            const startTimeout = setTimeout(() => {
                adjustInterval = setInterval(() => {
                    newOpacity = Math.max(0, Math.min(255, newOpacity + delta));
                    this.props.changeLayerProperty(layerId, "opacity", newOpacity, path, "children");
                }, 15);
            }, 100);
            ev.view.addEventListener('keyup', () => {
                clearTimeout(startTimeout);
                clearInterval(adjustInterval);
                this.adjusting = false;
            }, {once: true});
        } else if (ev.type === "pointerdown") {
            this.adjusting = true;
            const startMouseX = ev.clientX;
            let newOpacity = startOpacity;
            const computeNewOpacity = (event) => {
                newOpacity = Math.max(0, Math.min(255, startOpacity + (event.clientX - startMouseX)));
                this.props.changeLayerProperty(layerId, "opacity", newOpacity, path, "children");
            };
            const resizeOverlay = document.createElement('div');
            resizeOverlay.className = 'themebrowser-resize-overlay';
            ev.view.document.body.appendChild(resizeOverlay);
            ev.view.document.body.style.userSelect = 'none';
            ev.view.addEventListener("pointermove", computeNewOpacity);
            ev.view.addEventListener("pointerup", () => {
                ev.view.document.body.removeChild(resizeOverlay);
                ev.view.document.body.style.userSelect = '';
                ev.view.removeEventListener("pointermove", computeNewOpacity);
                this.adjusting = false;
            }, {once: true});
        }
    };
    onClose = () => {
        this.setState({active: false});
    };
    onSortChange = (order, sortable, ev) => {
        const moved = JSON.parse(order[ev.newIndex]);
        this.props.reorderLayer(moved.layerId, moved.path, ev.newIndex - ev.oldIndex);
    };
    onDragStart = (layer, path) => {
        this.dragging = true;
        if (layer.role !== LayerRole.THEME || this.props.allowRemovingThemeLayers) {
            this.setState({showDelete: true});
        }
    };
    onDragEnd = (ev) => {
        this.dragging = false;
        this.setState({showDelete: false});
        if (this.trashDrop && ev.item) {
            const layerData = JSON.parse(ev.item.dataset.id);
            this.props.removeLayer(layerData.layerId, layerData.path);
        }
    };
    onTrashDropEnter = (ev) => {
        this.trashDrop = true;
        ev.target.classList.add("themebrowser-theme-trashdrop-over");
    };
    onTrashDropLeave = (ev) => {
        this.trashDrop = false;
        ev.target.classList.remove("themebrowser-theme-trashdrop-over");
    };
    onKeySort = (ev, layerId, path) => {
        if (ev.key === "ArrowDown") {
            this.props.reorderLayer(layerId, path, 1);
            MiscUtils.killEvent(ev);
        } else if (ev.key === "ArrowUp") {
            this.props.reorderLayer(layerId, path, -1);
            MiscUtils.killEvent(ev);
        }
    };
}

const selector = (state) => ({
    active: state.task.id === "ThemeBrowser",
    activeTheme: state.theme.current?.id,
    layers: state.layers.flat,
    map: state.map,
    themes: state.theme.themes
});

export default connect(selector, {
    changeLayerProperty: changeLayerProperty,
    reorderLayer: reorderLayer,
    removeLayer: removeLayer,
    setBlankTheme: setBlankTheme,
    setCurrentTask: setCurrentTask,
    setCurrentTheme: setCurrentTheme
})(ThemeBrowser);
