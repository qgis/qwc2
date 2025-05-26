/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import MapButton from '../components/MapButton';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from "../utils/LocaleUtils";
import ThemeUtils from '../utils/ThemeUtils';

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
        /** The task name. */
        task: PropTypes.string,
        theme: PropTypes.object,
        /** Omit the button in themes matching one of these flags. */
        themeFlagBlacklist: PropTypes.arrayOf(PropTypes.string),
        /** Only show the button in themes matching one of these flags. */
        themeFlagWhitelist: PropTypes.arrayOf(PropTypes.string)
    };
    static defaultProps = {
        position: 1
    };
    render() {
        if (!ThemeUtils.themeFlagsAllowed(this.props.theme, this.props.themeFlagWhitelist, this.props.themeFlagBlacklist)) {
            return null;
        }
        const title = LocaleUtils.tr("appmenu.items." + this.props.task + (this.props.mode || ""));
        return (
            <MapButton icon={this.props.icon} onClick={this.buttonClicked}
                position={this.props.position} tooltip={title} />
        );
    }
    buttonClicked = () => {
        const mapClickAction = ConfigUtils.getPluginConfig(this.props.task).mapClickAction;
        this.props.setCurrentTask(this.props.currentTask === this.props.task ? null : this.props.task, this.props.mode, mapClickAction);
    };
}

const selector = (state) => ({
    currentTask: state.task.id,
    theme: state.theme.current
});

export default connect(selector, {
    setCurrentTask: setCurrentTask
})(TaskButton);
