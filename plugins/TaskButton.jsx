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

class TaskButton extends React.Component {
    static propTypes = {
        task: PropTypes.string,
        mode: PropTypes.string,
        icon: PropTypes.string,
        position: PropTypes.number,
        currentTask: PropTypes.string,
        setCurrentTask: PropTypes.func,
        mapClickAction: PropTypes.string,
    }
    static defaultProps = {
        mode: null,
        position: 1
    }
    render() {
        let classes = classnames({
            "map-button": true,
            "button-active": this.props.currentTask === this.props.task
        });
        return (
            <button className={classes} onClick={this.buttonClicked}
                onClick={this.buttonClicked} style={{bottom: (5 + 4 * this.props.position) + 'em'}}>
                <Icon icon={this.props.icon} />
            </button>
        );
    }
    buttonClicked = () => {
        this.props.setCurrentTask(this.props.currentTask === this.props.task ? null : this.props.task, this.props.mode, this.props.mapClickAction);
    }
};

const selector = (state) => ({
    currentTask: state.task && state.task.id || null
});

module.exports = {
    TaskButtonPlugin: connect(selector, {
      setCurrentTask: setCurrentTask,
  })(TaskButton),
    reducers: {
    }
};
