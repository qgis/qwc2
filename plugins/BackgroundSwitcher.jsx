/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, changeLayerProperty} from '../actions/layers';
import Icon from '../components/Icon';
import MapButton from '../components/MapButton';
import {MapButtonPortalContext} from '../components/PluginsContainer';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/BackgroundSwitcher.css';


/**
 * Map button for switching the background layer.
 */
export class BackgroundSwitcher extends React.Component {
    static contextType = MapButtonPortalContext;
    static propTypes = {
        backgroundLayers: PropTypes.array,
        /** The button click action, either `select` or `cycle`. */
        buttonClickAction: PropTypes.string,
        /** The button display mode, either `button` or `thumbnail`. */
        buttonDisplayMode: PropTypes.string,
        changeLayerVisibility: PropTypes.func,
        nobgMsgId: PropTypes.string,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        /** Whether to show the thumbnails of the group children when hovering a group item. */
        showGroupThumbnails: PropTypes.bool
    };
    static defaultProps = {
        buttonClickAction: 'select',
        buttonDisplayMode: 'button',
        position: 0,
        nobgMsgId: "bgswitcher.nobg"
    };
    state = {
        visible: false
    };
    constructor(props) {
        super(props);
        this.buttonEl = null;
        this.listEl = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.visible && !prevState.visible) {
            if (this.listEl) {
                (Array.from(this.listEl.children).find(el => el.classList.contains("background-switcher-item-active")) ?? this.listEl.firstElementChild)?.focus?.();
            }
        } else if (!this.state.visible && prevState.visible) {
            this.buttonEl?.focus?.();
        }
    }
    render() {
        if (isEmpty(this.props.backgroundLayers)) {
            return null;
        }
        const flatLayers = this.props.backgroundLayers.flat();
        const currentIndex = flatLayers.findIndex(l => l.visibility === true);
        let nextIndex = (currentIndex + 1) % flatLayers.length;
        while (nextIndex !== currentIndex && flatLayers[nextIndex].omitFromCycle) {
            nextIndex = (nextIndex + 1) % flatLayers.length;
        }
        const visibleBgLayer = flatLayers[currentIndex] ?? null;
        const nextLayer = flatLayers[nextIndex] ?? null;
        const backgroundLayers = [null, ...this.props.backgroundLayers];
        if (this.props.buttonDisplayMode === 'thumbnail') {
            // const currentIndex = backgroundLayers.findIndex(bl => Array.isArray(bl) ? bl.includes(visibleBgLayer) : bl === visibleBgLayer);
            const assetsPath = ConfigUtils.getAssetsPath();
            let thumbnail = null;
            if (this.props.buttonClickAction === "cycle") {
                thumbnail = nextLayer?.thumbnail ? assetsPath + "/" + nextLayer.thumbnail : "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";
            } else {
                thumbnail = visibleBgLayer?.thumbnail ? assetsPath + "/" + visibleBgLayer.thumbnail : "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";
            }
            return ReactDOM.createPortal((
                <div
                    className="background-switcher-thumbnail" data-slot={this.props.position}
                    onClick={() => this.buttonClicked(nextLayer)} onKeyDown={MiscUtils.checkKeyActivate}
                    onMouseEnter={() => this.setSwitcherVisible(true)} onMouseLeave={() => this.setSwitcherVisible(false)}
                    ref={el => {this.buttonEl = el;}} style={{order: this.props.position}} tabIndex={0}
                >
                    <img src={thumbnail} />
                    {this.renderSwitcher(backgroundLayers, visibleBgLayer)}
                </div>
            ), this.context);
        } else {
            return (
                <MapButton
                    active={this.state.visible} buttonRef={el => {this.buttonEl = el;}}
                    icon="bglayer" onClick={() => this.buttonClicked(nextLayer)}
                    onMouseEnter={this.props.buttonClickAction === "cycle" ? () => this.setSwitcherVisible(true) : null}
                    onMouseLeave={this.props.buttonClickAction === "cycle" ? () => this.setSwitcherVisible(false) : null}
                    position={this.props.position} tooltip={LocaleUtils.tr("tooltip.background")}
                >
                    {this.renderSwitcher(backgroundLayers, visibleBgLayer)}
                </MapButton>
            );
        }
    }
    renderSwitcher = (backgroundLayers, visibleBgLayer) => {
        return (
            <div className={"background-switcher " + (this.state.visible ? 'background-switcher-active' : '')} ref={el => { this.listEl = el; }}>
                {backgroundLayers.filter(entry => !entry?.omitFromSelect).map(entry => {
                    return Array.isArray(entry) ? this.renderGroupItem(entry, visibleBgLayer) : this.renderLayerItem(entry, visibleBgLayer);
                })}
            </div>
        );
    };
    itemTitle = (item) => {
        return item.titleMsgId ? LocaleUtils.tr(item.titleMsgId) : item.title ?? item.name;
    };
    renderLayerItem = (layer, visibleBgLayer) => {
        if (layer?.omitFromSelect) {
            return null;
        }
        const assetsPath = ConfigUtils.getAssetsPath();
        const itemclasses = classnames({
            "background-switcher-item": true,
            "background-switcher-item-active": layer === visibleBgLayer
        });
        return (
            <div
                className={itemclasses} key={layer ? layer.name : "empty"} onClick={(ev) => this.backgroundLayerClicked(ev, layer)}
                onKeyDown={this.KeyNav} tabIndex={this.state.visible ? 0 : -1}
            >
                <div className="background-switcher-item-title">
                    {layer ? (<span tabIndex={-1} title={this.itemTitle(layer)}>{this.itemTitle(layer)}</span>) : (<span>{LocaleUtils.tr(this.props.nobgMsgId)}</span>)}
                </div>
                <div className="background-switcher-item-thumbnail">
                    <img src={layer?.thumbnail ? assetsPath + "/" + layer.thumbnail : "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="} />
                </div>
            </div>
        );
    };
    renderGroupItem = (layers, visibleBgLayer) => {
        const selLayers = layers.filter(layer => !layer.omitFromSelect);
        if (selLayers.length === 0) {
            return null;
        }
        const assetsPath = ConfigUtils.getAssetsPath();
        const layer = (selLayers.find(l => l === visibleBgLayer) || selLayers.find(l => l.default === true)) || selLayers[selLayers.length - 1];
        const otherLayers = selLayers.filter(l => l !== layer);

        const itemclasses = classnames({
            "background-switcher-item": true,
            "background-switcher-item-active": layer === visibleBgLayer
        });
        const groupclasses = classnames({
            "background-switcher-group": true,
            "background-switcher-group-menu": !this.props.showGroupThumbnails
        });
        return (
            <div className={itemclasses} key={layer.name} onClick={(ev) => this.backgroundLayerClicked(ev, layer)} onKeyDown={this.KeyNav} tabIndex={this.state.visible ? 0 : -1}>
                <div className="background-switcher-item-title">
                    <span tabIndex="-1" title={this.itemTitle(layer)}>{this.itemTitle(layer)}</span><Icon icon="chevron-down" />
                </div>
                <div className="background-switcher-item-thumbnail">
                    <img src={assetsPath + "/" + layer.thumbnail} />
                </div>
                <div className={groupclasses}>
                    {this.props.showGroupThumbnails ? otherLayers.map(l => this.renderLayerItem(l, visibleBgLayer)) : otherLayers.map(l => {
                        const menuitemclasses = classnames({
                            "background-switcher-group-item": true,
                            "background-switcher-group-item-active": l === visibleBgLayer
                        });
                        return (
                            <div className={menuitemclasses} key={l.name}
                                onBlur={ev => this.updateGroupItem(ev, layer)}
                                onClick={(ev) => this.backgroundLayerClicked(ev, l)}
                                onFocus={ev => this.updateGroupItem(ev, l)}
                                onKeyDown={this.KeyNav}
                                onMouseEnter={ev => this.updateGroupItem(ev, l)}
                                onMouseLeave={ev => this.updateGroupItem(ev, layer)}
                                tabIndex={0}
                                title={this.itemTitle(l)}
                            >{this.itemTitle(l)}</div>
                        );
                    })}
                </div>
            </div>
        );
    };
    updateGroupItem = (ev, layer) => {
        const assetsPath = ConfigUtils.getAssetsPath();
        ev.target.parentElement.parentElement.childNodes[0].firstChild.innerText = this.itemTitle(layer);
        ev.target.parentElement.parentElement.childNodes[1].firstChild.src = assetsPath + "/" + layer.thumbnail;
    };
    KeyNav = (ev) => {
        if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
            let group = null;
            if (ev.target.parentElement.classList.contains("background-switcher-group")) {
                group = ev.target.parentElement;
            } else {
                group = ev.target.getElementsByClassName("background-switcher-group")[0];
            }
            if (!group) {
                return;
            }

            const childCount = group.children.length;
            const delta = ev.key === 'ArrowUp' ? -1 : 1;
            let currentIndex = Array.from(group.children).findIndex(el => document.activeElement === el || el.contains(document.activeElement));
            if (currentIndex === -1) {
                currentIndex = Array.from(group.children).findIndex(el => el.classList.contains("background-switcher-group-item-active"));
                if (currentIndex === -1 && delta === -1) {
                    currentIndex = childCount;
                }
            } else if (currentIndex + delta >= childCount || currentIndex + delta < 0) {
                group.parentElement.focus();
                MiscUtils.killEvent(ev);
                return;
            }
            let next = (currentIndex + childCount + delta) % childCount;
            while (group.children[next].tabIndex !== 0 && next !== currentIndex) {
                next = (next + childCount + delta) % childCount;
            }
            if (next !== currentIndex) {
                group.children[next].focus();
            }
            MiscUtils.killEvent(ev);
        } else if (ev.key === "Tab") {
            // Move to next tile
            const current = [...this.listEl.children].find(el => el === document.activeElement || el.contains(document.activeElement));
            if (current) {
                if (ev.shiftKey) {
                    if (current.previousElementSibling) {
                        current.previousElementSibling.focus();
                    } else {
                        this.listEl.children[this.listEl.children.length - 1].focus();
                    }
                } else {
                    if (current.nextElementSibling) {
                        current.nextElementSibling.focus();
                    } else {
                        this.listEl.children[0].focus();
                    }
                }
            }
            MiscUtils.killEvent(ev);
        } else {
            MiscUtils.checkKeyActivate(ev, this.hide);
        }
    };
    setSwitcherVisible = (visible) => {
        if (this.props.buttonClickAction === "cycle") {
            clearTimeout(this.visibleTimeout);
            this.visibleTimeout = setTimeout(() => this.setState({visible: visible}), 500);
        }
    };
    buttonClicked = (nextLayer) => {
        if (this.props.buttonClickAction === 'cycle') {
            this.props.changeLayerVisibility(nextLayer, true);
        } else {
            this.setState((state) => ({visible: !state.visible}));
        }
    };
    backgroundLayerClicked = (ev, layer) => {
        MiscUtils.killEvent(ev);
        if (layer) {
            this.props.changeLayerVisibility(layer, true);
        } else {
            const visible = this.props.backgroundLayers.flat().find(l => l.visibility === true);
            if (visible) {
                this.props.changeLayerVisibility(visible, false);
            }
        }
        this.setState({visible: false});
    };
    hide = () => {
        this.setState({visible: false});
    };
}

const selector = (state) => {
    const backgroundLayers = Object.values(state.layers.flat.filter(layer => layer.role === LayerRole.BACKGROUND).reduce((res, l) => {
        return {...res, ["_" + (l.group || l.name)]: l.group ? [...(res["_" + l.group] || []), l] : l};
    }, {}));
    return {
        backgroundLayers: backgroundLayers
    };
};

export default connect(selector, {
    changeLayerVisibility: (layer, visibility) => {
        return changeLayerProperty(layer.id, "visibility", visibility);
    }
})(BackgroundSwitcher);
