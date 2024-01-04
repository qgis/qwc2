/**
 * Copyright 2017-2024 Sourcepole AG
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
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from "../utils/LocaleUtils";
import './style/BackgroundSwitcher.css';

/**
 * Generic map button to launch a task.
 */
class TaskButton extends React.Component {
    static propTypes = {
        currentTask: PropTypes.string,
        /** The icon name.  */
        icon: PropTypes.string,
        /** The task mode. */
        mode: PropTypes.string,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        setCurrentTask: PropTypes.func,
        splitScreen: PropTypes.object,
        /** The task name. */
        task: PropTypes.string
    };
    static defaultProps = {
        position: 1
    };
    render() {
        const splitWindows = Object.values(this.props.splitScreen);
        const right = splitWindows.filter(entry => entry.side === 'right').reduce((res, e) => Math.max(e.size, res), 0);
        const bottom = splitWindows.filter(entry => entry.side === 'bottom').reduce((res, e) => Math.max(e.size, res), 0);
        const style = {
            right: 'calc(1.5em + ' + right + 'px)',
            bottom: 'calc(' + bottom + 'px + ' + (5 + 4 * this.props.position) + 'em)'
        };
        const classes = classnames({
            "map-button": true,
            "button-active": this.props.currentTask === this.props.task
        });
        const title = LocaleUtils.tr("appmenu.items." + this.props.task + (this.props.mode || ""));
        return (
            <button className={classes} onClick={this.buttonClicked}
                style={style} title={title}>
                <Icon icon={this.props.icon} />
            </button>
        );
    }
    buttonClicked = () => {
        const mapClickAction = ConfigUtils.getPluginConfig(this.props.task).mapClickAction;
        this.props.setCurrentTask(this.props.currentTask === this.props.task ? null : this.props.task, this.props.mode, mapClickAction);
    };
}

const selector = (state) => ({
    currentTask: state.task.id,
    splitScreen: state.windows.splitScreen
});

export default connect(selector, {
    setCurrentTask: setCurrentTask
})(TaskButton);
