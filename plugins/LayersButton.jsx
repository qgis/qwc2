/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const classnames = require('classnames');
const {setCurrentTask} = require('../actions/task');
const Icon = require('../components/Icon');
require('./style/BackgroundSwitcher.css');

class LayersButton extends React.Component {
    static propTypes = {
        position: PropTypes.number,
        visible: PropTypes.bool,
        setCurrentTask: PropTypes.func
    }
    static defaultProps = {
        visible: false,
        position: 1
    }
    render() {
        let classes = classnames({
            "Button": true,
            "button-active": this.props.visible
        });
        return (
            <div>
                <button className={classes} onClick={this.buttonClicked}
                    onClick={this.buttonClicked} style={{bottom: (5 + 4 * this.props.position) + 'em'}}>
                    <Icon icon="list-alt"/>
                </button>
            </div>
        );
    }
    buttonClicked = () => {
        this.props.setCurrentTask(this.props.visible ? null : 'LayerTree');
    }
};

const selector = (state) => ({
    visible: state.task ? state.task.id === 'LayerTree' : false
});

module.exports = {
    LayersButtonPlugin: connect(selector, {
      setCurrentTask: setCurrentTask,
  })(LayersButton),
    reducers: {
    }
};
