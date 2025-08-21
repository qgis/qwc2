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
 * Display the attribute table of layers in a dialog.
 *
 * To make a layer available in the attribute table, create a a data resource and matching permissions for it in the `qwc-admin-gui`.
 *
 * The attribute table works for both read-only as well as read-write data resources.
 *
 * This plugin queries the dataset via the editing service specified by
 * `editServiceUrl` in `config.json` (by default the `qwc-data-service`).
 */
class AttributeTable extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        /** Whether to allow adding records for datasets which have a geometry column. */
        allowAddForGeometryLayers: PropTypes.bool,
        blocked: PropTypes.bool,
        iface: PropTypes.object,
        setCurrentTask: PropTypes.func,
        /** Whether to show a button to open the edit form for selected layer. Requires the Editing plugin to be enabled. */
        showEditFormButton: PropTypes.bool,
        /** Whether to show the "Limit to extent" checkbox */
        showLimitToExtent: PropTypes.bool,
        taskData: PropTypes.object,
        /** The zoom level for zooming to point features. */
        zoomLevel: PropTypes.number
    };
    static defaultProps = {
        zoomLevel: 1000,
        showEditFormButton: true,
        showLimitToExtent: true
    };
    render() {
        if (!this.props.active) {
            return null;
        }
        return (
            <ResizeableWindow dockable="bottom" icon="editing" initialHeight={480} initialWidth={800} initiallyDocked onClose={this.onClose} splitScreenWhenDocked title={LocaleUtils.tr("attribtable.title")}>
                <AttributeTableWidget allowAddForGeometryLayers={this.props.allowAddForGeometryLayers}
                    iface={this.props.iface} initialLayer={this.props.taskData?.layer}
                    role="body" showEditFormButton={this.props.showEditFormButton}
                    showLimitToExtent={this.props.showLimitToExtent} zoomLevel={this.props.zoomLevel}
                />
            </ResizeableWindow>
        );
    }
    onClose = () => {
        if (!this.props.blocked) {
            this.props.setCurrentTask(null);
        }
    };
}

export default (iface = EditingInterface) => {
    return connect((state) => ({
        active: state.task.id === "AttributeTable",
        blocked: state.task.id === "AttributeTable" && state.task.blocked,
        iface: iface,
        taskData: state.task.id === "AttributeTable" ? state.task.data : null
    }), {
        setCurrentTask: setCurrentTask
    })(AttributeTable);
};
