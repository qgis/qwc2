/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const BackgroundSwitcher = require('../../MapStore2/web/client/components/TOC/background/BackgroundSwitcher');
const {changeLayerProperties} = require('../actions/layers');
require('./style/BackgroundSwitcherMenu.css');

const BackgroundSwitcherMenu = React.createClass({
  propTypes: {
    visible: React.PropTypes.bool,
    layers: React.PropTypes.array,
    propertiesChangeHandler: React.PropTypes.func
  },
  getDefaultProps() {
      return {
          visible: false
      };
  },
  render() {
      return (<div id="background-switcher-menu" className={this.props.visible === true ? "visible" : ""}>
        <BackgroundSwitcher layers={this.props.layers} propertiesChangeHandler={this.props.propertiesChangeHandler} />
        </div>);
  }
});

const selector = (state) => ({
    layers: state.layers && state.layers.flat && state.layers.flat.filter((layer) => layer.group === "background") || [],
    visible: state.controls.BackgroundLayerButton.enabled
});

module.exports = {
    BackgroundSwitcherMenuPlugin: connect(selector, {
      propertiesChangeHandler: changeLayerProperties
    })(BackgroundSwitcherMenu),
    reducers: {layers: require("../../MapStore2/web/client/reducers/layers")}
};
