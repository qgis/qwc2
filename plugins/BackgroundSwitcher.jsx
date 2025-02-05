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
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';

import './style/BackgroundSwitcher.css';


/**
 * Map button for switching the background layer.
 */
export class BackgroundSwitcher extends React.Component {
    static propTypes = {
        bottombarHeight: PropTypes.number,
        changeLayerVisibility: PropTypes.func,
        layers: PropTypes.array,
        mapMargins: PropTypes.object,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number
    };
    static defaultProps = {
        bottombarHeight: 0,
        position: 0,
        mapMargins: {left: 0, right: 0, top: 0, bottom: 0}
    };
    state = {
        visible: false
    };
    render() {
        const tooltip = LocaleUtils.tr("tooltip.background");
        const classes = classnames({
            "map-button": true,
            "map-button-active": this.state.visible
        });
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
            const right = this.props.mapMargins.right;
            const bottom = this.props.mapMargins.bottom + this.props.bottombarHeight;
            const style = {
                right: 'calc(1.5em + ' + right + 'px)',
                bottom: 'calc(' + bottom + 'px + ' + (3 + 4 * this.props.position) + 'em)'
            };
            const bgswitcherStyle = {
                right: 'calc(5em + ' + right + 'px)',
                bottom: 'calc(' + bottom + 'px + ' + (1.5 + 4 * this.props.position) + 'em)'
            };
            return (
                <div>
                    <button className={classes} onClick={this.buttonClicked}
                        style={style} title={tooltip}>
                        <Icon icon="bglayer" title={tooltip} />
                    </button>
                    <div className={this.state.visible ? 'bgswitcher-active' : ''} id="BackgroundSwitcher" style={bgswitcherStyle}>
                        {this.renderLayerItem(null, backgroundLayers.filter(layer => layer.visibility === true).length === 0)}
                        {entries.map(entry => entry.group ? this.renderGroupItem(entry) : this.renderLayerItem(entry, entry.visibility === true))}
                    </div>
                </div>
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
            <div className={itemclasses} key={layer ? layer.name : "empty"} onClick={() => this.backgroundLayerClicked(layer)}>
                <div className="background-layer-title">
                    {layer ? (<span>{this.itemTitle(layer)}</span>) : (<span>{LocaleUtils.tr("bgswitcher.nobg")}</span>)}
                </div>
                <div className="background-layer-thumbnail">
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
            <div className={itemclasses} key={layer.name}>
                <div className="background-layer-title">
                    <span>{this.itemTitle(layer)}</span><Icon icon="chevron-down" />
                </div>
                <div className="background-layer-thumbnail">
                    <img onClick={() => this.backgroundLayerClicked(layer)} src={assetsPath + "/" + layer.thumbnail} />
                </div>
                <div className="background-group-menu">
                    {entry.layers.map(l => {
                        const menuitemclasses = classnames({
                            "background-group-menu-item": true,
                            "background-group-menu-item-active": l.visibility
                        });
                        return (
                            <div className={menuitemclasses} key={l.name}
                                onClick={() => this.backgroundLayerClicked(l)}
                                onMouseEnter={ev => this.updateGroupItem(ev, l)}
                                onMouseLeave={ev => this.updateGroupItem(ev, layer)}
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
}

const selector = (state) => ({
    bottombarHeight: state.windows.bottombarHeight,
    layers: state.layers.flat.filter(layer => layer.role === LayerRole.BACKGROUND),
    mapMargins: state.windows.mapMargins
});

export default connect(selector, {
    changeLayerVisibility: (layer, visibility) => {
        return changeLayerProperty(layer.uuid, "visibility", visibility);
    }
})(BackgroundSwitcher);
