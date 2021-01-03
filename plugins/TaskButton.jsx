/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import classnames from 'classnames';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import './style/BackgroundSwitcher.css';

class TaskButton extends React.Component {
    static propTypes = {
        currentTask: PropTypes.string,
        icon: PropTypes.string,
        mapClickAction: PropTypes.string,
        mode: PropTypes.string,
        position: PropTypes.number,
        setCurrentTask: PropTypes.func,
        task: PropTypes.string
    }
    static defaultProps = {
        position: 1
    }
    render() {
        const classes = classnames({
            "map-button": true,
            "button-active": this.props.currentTask === this.props.task
        });
        return (
            <button className={classes} onClick={this.buttonClicked}
                style={{bottom: (5 + 4 * this.props.position) + 'em'}}>
                <Icon icon={this.props.icon} />
            </button>
        );
    }
    buttonClicked = () => {
        this.props.setCurrentTask(this.props.currentTask === this.props.task ? null : this.props.task, this.props.mode, this.props.mapClickAction);
    }
}

const selector = (state) => ({
    currentTask: state.task.id
});

export default connect(selector, {
    setCurrentTask: setCurrentTask
})(TaskButton);
