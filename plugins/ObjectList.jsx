/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import AttributeTableWidget from '../components/AttributeTableWidget';
import ResizeableWindow from '../components/ResizeableWindow';
import EditingInterface from '../utils/EditingInterface';
import LocaleUtils from '../utils/LocaleUtils';


/**
 * Display layer object lists in a dialog.
 *
 * The object list is similar to the attribute table, but displays only the display field for each object and contains no edit functionality.
 *
 * To make a layer available in the object list, create a a data resource and matching permissions for it in the `qwc-admin-gui`.
 *
 * This plugin queries the dataset via the editing service specified by
 * `editServiceUrl` in `config.json` (by default the `qwc-data-service`).
 */
class ObjectList extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        iface: PropTypes.object,
        /** Whether to limit to the extent by default. */
        limitToExtent: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        /** Whether to show the "Limit to extent" checkbox */
        showLimitToExtent: PropTypes.bool,
        taskData: PropTypes.object,
        /** The zoom level for zooming to point features. */
        zoomLevel: PropTypes.number
    };
    static defaultProps = {
        limitToExtent: false,
        zoomLevel: 1000,
        showHiddenFields: true,
        showLimitToExtent: true
    };
    render() {
        if (!this.props.active) {
            return null;
        }
        return (
            <ResizeableWindow dockable="bottom" icon="editing" initialHeight={480} initialWidth={800} initiallyDocked onClose={this.onClose} splitScreenWhenDocked title={LocaleUtils.tr("appmenu.items.ObjectList")}>
                <AttributeTableWidget
                    iface={this.props.iface} initialLayer={this.props.taskData?.layer} limitToExtent={this.props.limitToExtent}
                    readOnly showDisplayFieldOnly showEditFormButton={false}
                    showHiddenFields={false} showLimitToExtent={this.props.showLimitToExtent}
                    zoomLevel={this.props.zoomLevel}
                />
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.props.setCurrentTask(null);
    };
}

export default (iface = EditingInterface) => {
    return connect((state) => ({
        active: state.task.id === "ObjectList",
        iface: iface,
        taskData: state.task.id === "ObjectList" ? state.task.data : null
    }), {
        setCurrentTask: setCurrentTask
    })(ObjectList);
};
