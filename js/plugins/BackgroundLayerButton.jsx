/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const ToggleButton = require('../../MapStore2/web/client/components/buttons/ToggleButton');
const {Button, Glyphicon, OverlayTrigger} = require('react-bootstrap');
const {toggleControl} = require('../../MapStore2/web/client/actions/controls');

const BackgroundLayerButton = React.createClass({
  propTypes: {
    onClick: React.PropTypes.func,
    className: React.PropTypes.string,
  },
  getDefaultProps() {
    return {
      onClick: () => {},
      className: ''
    };
  },
  render() {
    return (
      <Button id="background-layer-button" className={this.props.className} onClick={this.props.onClick}>
        <Glyphicon glyph="book"/>
      </Button>
    );
  }
});

const selector = (state) => ({
    className: state.controls.BackgroundLayerButton.enabled ? 'pressed' : ''
  });

module.exports = {
    BackgroundLayerButtonPlugin: connect(selector, {
      onClick: toggleControl.bind(null, 'BackgroundLayerButton', null)
    })(BackgroundLayerButton),
    reducers: { controls: require("../../MapStore2/web/client/reducers/controls")}
};
