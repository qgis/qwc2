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
import sortBy from 'lodash.sortby';
import {LayerRole, changeLayerProperty} from '../actions/layers';
import Icon from '../components/Icon';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/BackgroundSwitcher.css';

class BackgroundSwitcher extends React.Component {
    static propTypes = {
        changeLayerProperty: PropTypes.func,
        layers: PropTypes.array,
        position: PropTypes.number,
        toggleBackgroundswitcher: PropTypes.func
    }
    static defaultProps = {
        position: 0
    }
    state = {
        visible: false
    }
    render() {
        const tooltip = LocaleUtils.tr("tooltip.background");
        const classes = classnames({
            "map-button": true,
            "map-button-active": this.state.visible
        });
        let backgroundLayers = this.props.layers.filter(layer => layer.role === LayerRole.BACKGROUND).slice(0).reverse();
        // Re-sort layers, ensuring grouped layers are grouped together
        let idx = 0;
        const indices = backgroundLayers.reduce((res, l) => {
            const name = l.group || l.name;
            if (!res[name]) {
                res[name] = ++idx;
            }
            return res;
        }, {});
        backgroundLayers = sortBy(backgroundLayers, entry => indices[entry.group || entry.name]);
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
                <div>
                    <button className={classes} onClick={this.buttonClicked}
                        style={{bottom: (5 + 4 * this.props.position) + 'em'}} title={tooltip}>
                        <Icon icon="bglayer" title={tooltip} />
                    </button>
                    <div className={this.state.visible ? 'bgswitcher-active' : ''} id="BackgroundSwitcher">
                        {this.renderLayerItem(null, backgroundLayers.filter(layer => layer.visibility === true).length === 0)}
                        {entries.map(entry => entry.group ? this.renderGroupItem(entry) : this.renderLayerItem(entry, entry.visibility === true))}
                    </div>
                </div>
            );
        }
        return null;
    }
    renderLayerItem = (layer, visible) => {
        const assetsPath = ConfigUtils.getAssetsPath();
        const itemclasses = classnames({
            "background-switcher-item": true,
            "background-switcher-item-active": visible
        });
        return (
            <div className={itemclasses} key={layer ? layer.name : "empty"} onClick={() => this.backgroundLayerClicked(layer)}>
                <div className="background-layer-title">
                    {layer ? (<span>{layer.title}</span>) : (<span>{LocaleUtils.tr("bgswitcher.nobg")}</span>)}
                </div>
                <div className="background-layer-thumbnail">
                    <img src={layer ? assetsPath + "/" + layer.thumbnail : "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="} />
                </div>
            </div>
        );
    }
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
                    <span>{layer.title}</span><Icon icon="chevron-down" />
                </div>
                <div className="background-layer-thumbnail">
                    <img onClick={() => this.backgroundLayerClicked(layer)} src={assetsPath + "/" + layer.thumbnail} />
                </div>
                <div className="background-group-menu">
                    {entry.layers.map(l => (
                        <div className={l.visibility === true ? "background-group-menu-item-active" : ""} key={l.name}
                            onClick={() => this.backgroundLayerClicked(l)}
                            onMouseEnter={ev => this.updateGroupItem(ev, l)}
                            onMouseLeave={ev => this.updateGroupItem(ev, layer)}
                        >{l.title}</div>
                    ))}
                </div>
            </div>
        );
    }
    updateGroupItem = (ev, layer) => {
        const assetsPath = ConfigUtils.getAssetsPath();
        ev.target.parentElement.parentElement.childNodes[0].firstChild.innerText = layer.title;
        ev.target.parentElement.parentElement.childNodes[1].firstChild.src = assetsPath + "/" + layer.thumbnail;
    }
    buttonClicked = () => {
        this.setState({visible: !this.state.visible});
    }
    backgroundLayerClicked = (layer) => {
        if (layer) {
            this.props.changeLayerProperty(layer.uuid, "visibility", true);
        } else {
            const visible = this.props.layers.find(l => l.role === LayerRole.BACKGROUND && l.visibility);
            if (visible) {
                this.props.changeLayerProperty(visible.uuid, "visibility", false);
            }
        }
        this.setState({visible: false});
    }
}

const selector = (state) => ({
    layers: state.layers.flat
});

export default connect(selector, {
    changeLayerProperty: changeLayerProperty
})(BackgroundSwitcher);
