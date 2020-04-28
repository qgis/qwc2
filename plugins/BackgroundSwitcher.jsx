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
const classnames = require('classnames');
const isEmpty = require('lodash.isempty');
const sortBy = require('lodash.sortby');
const ConfigUtils = require("../utils/ConfigUtils");
const Message = require('../components/I18N/Message');
const LocaleUtils = require('../utils/LocaleUtils');
const {LayerRole, changeLayerProperty} = require('../actions/layers');
const Icon = require('../components/Icon');
require('./style/BackgroundSwitcher.css');

class BackgroundSwitcher extends React.Component {
    static propTypes = {
        position: PropTypes.number,
        layers: PropTypes.array,
        toggleBackgroundswitcher: PropTypes.func,
        changeLayerProperty: PropTypes.func
    }
    static defaultProps = {
        position: 0
    }
    state = {
        visible: false
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        let tooltip = LocaleUtils.getMessageById(this.context.messages, "tooltip.background");
        let classes = classnames({
            "map-button": true,
            "map-button-active": this.state.visible
        });
        let backgroundLayers = this.props.layers.filter(layer => layer.role === LayerRole.BACKGROUND).slice(0).reverse();
        // Re-sort layers, ensuring grouped layers are grouped together
        let idx = 0;
        let indices = backgroundLayers.reduce((res, l) => {
            let name = l.group || l.name;
            if(!res[name]) {
                res[name] = ++idx;
            }
            return res;
        }, {});
        backgroundLayers = sortBy(backgroundLayers, entry => indices[entry.group || entry.name]);
        let entries = backgroundLayers.reduce((res, layer) => {
            if(!isEmpty(res) && layer.group && layer.group === res[res.length - 1].group) {
                res[res.length - 1].layers.push(layer);
            } else if(layer.group) {
                res.push({
                    group: layer.group,
                    layers: [layer]
                });
            } else {
                res.push(layer)
            }
            return res;
        }, []);
        if(entries.length > 0){
             return (
                <div>
                    <button className={classes} title={tooltip}
                        onClick={this.buttonClicked} style={{bottom: (5 + 4 * this.props.position) + 'em'}}>
                        <Icon icon="bglayer" />
                    </button>
                    <div id="BackgroundSwitcher" className={this.state.visible ? 'bgswitcher-active' : ''}>
                        {this.renderLayerItem(null, backgroundLayers.filter(layer => layer.visibility === true).length === 0)}
                        {entries.map(entry => entry.group ? this.renderGroupItem(entry) : this.renderLayerItem(entry, entry.visibility === true))}
                    </div>
                </div>
            );
        }
        return null;
    }
    renderLayerItem = (layer, visible) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let itemclasses = classnames({
            "background-switcher-item": true,
            "background-switcher-item-active": visible
        });
        return (
            <div key={layer ? layer.name : "empty"} className={itemclasses} onClick={() => this.backgroundLayerClicked(layer)}>
                <div className="background-layer-title">
                    {layer ? (<span>{layer.title}</span>) : (<Message msgId={"bgswitcher.nobg"} />)}
                </div>
                <div className="background-layer-thumbnail">
                    <img src={layer ? assetsPath + "/" + layer.thumbnail : "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="} />
                </div>
            </div>
        );
    }
    renderGroupItem = (entry) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let layer = layer = (entry.layers.find(layer => layer.visibility === true) || entry.layers.find(layer => layer.default === true)) || entry.layers[entry.layers.length-1];

        let itemclasses = classnames({
            "background-switcher-item": true,
            "background-switcher-item-active": layer.visibility
        });
        return (
            <div key={layer.name} className={itemclasses}>
                <div className="background-layer-title">
                    <span>{layer.title}</span><Icon icon="chevron-down" />
                </div>
                <div className="background-layer-thumbnail">
                    <img src={assetsPath + "/" + layer.thumbnail} onClick={() => this.backgroundLayerClicked(layer)} />
                </div>
                <div className="background-group-menu">
                    {entry.layers.map(l => (
                        <div key={l.name} className={l.visibility === true ? "background-group-menu-item-active" : ""}
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
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        ev.target.parentElement.parentElement.childNodes[0].firstChild.innerText = layer.title;
        ev.target.parentElement.parentElement.childNodes[1].firstChild.src = assetsPath + "/" + layer.thumbnail;
    }
    buttonClicked = () => {
        this.setState({visible: !this.state.visible});
    }
    backgroundLayerClicked = (layer) => {
        if(layer) {
            this.props.changeLayerProperty(layer.uuid, "visibility", true);
        } else {
            let visible = this.props.layers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility);
            if(visible) {
                this.props.changeLayerProperty(visible.uuid, "visibility", false);
            }
        }
        this.setState({visible: false});
    }
};

const selector = (state) => ({
    layers: state.layers.flat || []
});

module.exports = {
    BackgroundSwitcherPlugin: connect(selector, {
      changeLayerProperty: changeLayerProperty
    })(BackgroundSwitcher),
    reducers: {
    }
};
