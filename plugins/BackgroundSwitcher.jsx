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
const ConfigUtils = require("../utils/ConfigUtils");
const Message = require('../components/I18N/Message');
const LocaleUtils = require('../utils/LocaleUtils');
const {LayerRole, changeLayerProperties} = require('../actions/layers');
const Icon = require('../components/Icon');
require('./style/BackgroundSwitcher.css');

class BackgroundSwitcher extends React.Component {
    static propTypes = {
        position: PropTypes.number,
        layers: PropTypes.array,
        toggleBackgroundswitcher: PropTypes.func,
        changeLayerProperties: PropTypes.func
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
        if(backgroundLayers.length > 0){
             return (
                <div>
                    <button className={classes} title={tooltip}
                        onClick={this.buttonClicked} style={{bottom: (5 + 4 * this.props.position) + 'em'}}>
                        <Icon icon="bglayer" />
                    </button>
                    <div id="BackgroundSwitcher" className={this.state.visible ? 'bgswitcher-active' : ''}>
                        {this.renderLayerItem(null, backgroundLayers.filter(layer => layer.visibility === true).length === 0)}
                        {backgroundLayers.map(layer => this.renderLayerItem(layer, layer.visibility === true))}
                    </div>
                </div>
            );
        }
        return null;
    }
    renderLayerItem = (layer, visible) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let itemclasses = classnames({
            "background-layer-item": true,
            "background-layer-item-active": visible
        });
        return (
            <div key={layer ? layer.name : "empty"} className={itemclasses} onClick={() => this.backgroundLayerClicked(layer)}>
                <div className="background-layer-title">
                    {layer ? layer.title : (<Message msgId={"bgswitcher.nobg"} />)}
                </div>
                <div className="background-layer-thumbnail">
                    <img src={layer ? assetsPath + "/" + layer.thumbnail : "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="} />
                </div>
            </div>
        );
    }
    buttonClicked = () => {
        this.setState({visible: !this.state.visible});
    }
    backgroundLayerClicked = (layer) => {
        if(layer) {
            this.props.changeLayerProperties(layer.uuid, {visibility: true});
        } else {
            let visible = this.props.layers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility);
            if(visible) {
                this.props.changeLayerProperties(visible.uuid, {visibility: false});
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
      changeLayerProperties: changeLayerProperties
    })(BackgroundSwitcher),
    reducers: {
    }
};
