/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {changeLayerProperties} = require('../actions/layers');
import classnames from 'classnames';
require('./style/BackgroundSwitcherMenu.css');

const BackgroundSwitcherMenu = React.createClass({
    propTypes: {
      visible: React.PropTypes.bool,
        layers: React.PropTypes.array,
        changeLayerProperties: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            visible: false
        };
    },
    render() {
        return (
            <div id="BackgroundSwitcherMenu" className={this.props.visible ? "visible" : ""}>
                {this.props.layers.map(layer => this.renderLayerItem(layer))}
            </div>);
    },
    renderLayerItem(layer) {
        let itemclasses = classnames({
            "background-layer-item": true,
            "background-layer-item-active": layer.visibility === true
        });
        return (
            <div key={layer.name} className={itemclasses} onClick={() => this.backgroudLayerClicked(layer)}>
                <span className="background-layer-thumbnail">
                    <object data={"./assets/img/mapthumbs/" + layer.name + ".jpg"} type="image/jpeg">
                        <img src="./assets/img/mapthumbs/default.jpg" />
                    </object>
                </span>
                <span className="background-layer-title">
                    {layer.title}
                </span>
            </div>
        );
    },
    backgroudLayerClicked(layer) {
        this.props.changeLayerProperties(layer.id, {visibility: true});
    }
});

const selector = (state) => ({
    layers: state.layers && state.layers.flat && state.layers.flat.filter((layer) => layer.group === "background") || [],
    visible: state.backgroundswicher && state.backgroundswicher.visible
});

module.exports = {
    BackgroundSwitcherMenuPlugin: connect(selector, {
      changeLayerProperties: changeLayerProperties
    })(BackgroundSwitcherMenu),
    reducers: {layers: require("../../MapStore2/web/client/reducers/layers")}
};
