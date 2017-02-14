/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const classnames = require('classnames');
const {Button, Glyphicon} = require('react-bootstrap');
const {setCurrentTask} = require('../actions/task');
require('./style/BackgroundSwitcher.css');

const LayersButton = React.createClass({
    propTypes: {
        position: React.PropTypes.number,
        visible: React.PropTypes.bool,
        setCurrentTask: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            visible: false,
            position: 1
        };
    },
    render() {
        let activeClass = this.props.visible ? 'active' : '';
        return (
            <div>
                <Button id="LayersBtn" className={activeClass} onClick={this.buttonClicked}
                    onClick={this.buttonClicked} style={{bottom: (5 + 4 * this.props.position) + 'em'}}>
                    <Glyphicon glyph="list-alt"/>
                </Button>
            </div>
        );
    },
    buttonClicked() {
        this.props.setCurrentTask(this.props.visible ? null : 'LayerTree');
    },
});

const selector = (state) => ({
    visible: state.task ? state.task.current === 'LayerTree' : false
});

module.exports = {
    LayersButtonPlugin: connect(selector, {
      setCurrentTask: setCurrentTask,
  })(LayersButton),
    reducers: {
    }
};
