/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, changeLayerProperty} from '../actions/layers';
import Icon from '../components/Icon';
import MapButton from '../components/MapButton';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/BackgroundSwitcher.css';


/**
 * Map button for switching the background layer.
 */
export class BackgroundSwitcher extends React.Component {
    static propTypes = {
        changeLayerVisibility: PropTypes.func,
        layers: PropTypes.array,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        nobgMsgId: PropTypes.string,
        position: PropTypes.number
    };
    static defaultProps = {
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
            this.listEl?.firstElementChild?.focus?.();
        } else if (!this.state.visible && prevState.visible) {
            this.buttonEl?.focus?.();
        }
    }
    render() {
        const backgroundLayers = this.props.layers.slice(0).reverse();
        // Re-sort layers, ensuring grouped layers are grouped together
        let idx = 0;
        const indices = backgroundLayers.reduce((res, l) => {
            const name = l.group || l.name;
            if (!res[name]) {
                res[name] = ++idx;
            }
            return res;
        }, {});
        backgroundLayers.sort((a, b) => indices[a.group || a.name] - indices[b.group || b.name]);
        const entries = backgroundLayers.reduce((res, layer) => {
            if (!isEmpty(res) && layer.group && layer.group === res[res.length - 1].group) {
                res[res.length - 1].layers.push(layer);
            } else if (layer.group) {
                res.push({
                    group: layer.group,
                    layers: [layer]
                });
            } else {
                res.push(layer);
            }
            return res;
        }, []);
        if (entries.length > 0) {
            return (
                <MapButton
                    active={this.state.visible}
                    buttonRef={el => {this.buttonEl = el;}}
                    icon="bglayer"
                    onClick={this.buttonClicked}
                    position={this.props.position}
                    tooltip={LocaleUtils.tr("tooltip.background")}
                >
                    <div className={"background-switcher " + (this.state.visible ? 'background-switcher-active' : '')} ref={el => { this.listEl = el; }}>
                        {this.renderLayerItem(null, backgroundLayers.filter(layer => layer.visibility === true).length === 0)}
                        {entries.map(entry => entry.group ? this.renderGroupItem(entry) : this.renderLayerItem(entry, entry.visibility === true))}
                    </div>
                </MapButton>
            );
        }
        return null;
    }
    itemTitle = (item) => {
        return item.titleMsgId ? LocaleUtils.tr(item.titleMsgId) : item.title ?? item.name;
    };
    renderLayerItem = (layer, visible) => {
        const assetsPath = ConfigUtils.getAssetsPath();
        const itemclasses = classnames({
            "background-switcher-item": true,
            "background-switcher-item-active": visible
        });
        return (
            <div
                className={itemclasses} key={layer ? layer.name : "empty"} onClick={() => this.backgroundLayerClicked(layer)}
                onKeyDown={this.KeyNav} tabIndex={this.state.visible ? 0 : -1}
            >
                <div className="background-switcher-item-title">
                    {layer ? (<span tabIndex={-1} title={this.itemTitle(layer)}>{this.itemTitle(layer)}</span>) : (<span>{LocaleUtils.tr(this.props.nobgMsgId)}</span>)}
                </div>
                <div className="background-switcher-item-thumbnail">
                    <img src={layer ? assetsPath + "/" + layer.thumbnail : "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="} />
                </div>
            </div>
        );
    };
    renderGroupItem = (entry) => {
        const assetsPath = ConfigUtils.getAssetsPath();
        const layer = (entry.layers.find(l => l.visibility === true) || entry.layers.find(l => l.default === true)) || entry.layers[entry.layers.length - 1];

        const itemclasses = classnames({
            "background-switcher-item": true,
            "background-switcher-item-active": layer.visibility
        });
        return (
            <div className={itemclasses} key={layer.name} onKeyDown={this.KeyNav} tabIndex={this.state.visible ? 0 : -1}>
                <div className="background-switcher-item-title">
                    <span tabIndex="-1" title={this.itemTitle(layer)}>{this.itemTitle(layer)}</span><Icon icon="chevron-down" />
                </div>
                <div className="background-switcher-item-thumbnail">
                    <img onClick={() => this.backgroundLayerClicked(layer)} src={assetsPath + "/" + layer.thumbnail} />
                </div>
                <div className="background-switcher-group">
                    {entry.layers.map(l => {
                        const menuitemclasses = classnames({
                            "background-switcher-group-item": true,
                            "background-switcher-group-item-active": l.visibility
                        });
                        return (
                            <div className={menuitemclasses} key={l.name}
                                onBlur={ev => this.updateGroupItem(ev, layer)}
                                onClick={() => this.backgroundLayerClicked(l)}
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
    buttonClicked = () => {
        this.setState((state) => ({visible: !state.visible}));
    };
    backgroundLayerClicked = (layer) => {
        if (layer) {
            this.props.changeLayerVisibility(layer, true);
        } else {
            const visible = this.props.layers.find(l => l.visibility);
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

const selector = (state) => ({
    layers: state.layers.flat.filter(layer => layer.role === LayerRole.BACKGROUND)
});

export default connect(selector, {
    changeLayerVisibility: (layer, visibility) => {
        return changeLayerProperty(layer.id, "visibility", visibility);
    }
})(BackgroundSwitcher);
