/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {Button, Glyphicon} = require('react-bootstrap');
const {toggleBackgroundswitcher} = require('../actions/backgroundswitcher');
require('./style/Buttons.css');

const BackgroundSwitcherButton = React.createClass({
    propTypes: {
        pressed: React.PropTypes.bool,
        onClick: React.PropTypes.func,
    },
    getDefaultProps() {
        return {
            visible: false
        };
    },
    render() {
        return (
            <Button id="BackgroundSwitcherButton" className={this.props.pressed ? 'pressed' : ''} onClick={this.buttonClicked}>
                <Glyphicon glyph="book"/>
            </Button>
        );
    },
    buttonClicked() {
        this.props.onClick(!this.props.pressed);
    }
});

const selector = (state) => ({
    pressed: state.backgroundswicher && state.backgroundswicher.visible
});

module.exports = {
    BackgroundSwitcherButtonPlugin: connect(selector, {
      onClick: toggleBackgroundswitcher
    })(BackgroundSwitcherButton),
    reducers: {
        backgroundswicher: require('../reducers/backgroundswitcher')
    }
};
