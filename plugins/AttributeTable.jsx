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

import {setCurrentTask} from 'qwc2/actions/task';

import AttributeTableWidget from 'qwc2/components/AttributeTableWidget';
import ResizeableWindow from 'qwc2/components/ResizeableWindow';
import EditingInterface from 'qwc2/utils/EditingInterface';
import LocaleUtils from 'qwc2/utils/LocaleUtils';

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
        /** Default window geometry with size, position and docking status. A locked window is not closeable and not resizeable. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        /** Whether to hide the id (primary key) column. */
        hideIdColumn: PropTypes.bool,
        iface: PropTypes.object,
        /** Whether to limit to the extent by default. */
        limitToExtent: PropTypes.bool,
        /** Whether the attribute table window remains visible after activation. */
        lockedWindow: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        /** Whether to show a button to open the edit form for selected layer. Requires the Editing plugin to be enabled. */
        showEditFormButton: PropTypes.bool,
        /** Whether to show hidden fields. */
        showHiddenFields: PropTypes.bool,
        /** Whether to show the "Limit to extent" checkbox */
        showLimitToExtent: PropTypes.bool,
        taskData: PropTypes.object,
        /** The zoom level for zooming to point features. */
        zoomLevel: PropTypes.number
    };
    static defaultProps = {
        limitToExtent: false,
        zoomLevel: 1000,
        showEditFormButton: true,
        showHiddenFields: true,
        showLimitToExtent: true,
        geometry: {
            initialWidth: 800,
            initialHeight: 480,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true,
            side: 'bottom'
        }
    };

    state = {
            visible: false
    };
    
    componentDidUpdate(prevProps) {
        if (this.props.active && !prevProps.active) {
            this.setState({visible: true});
        }
    }    
    
    render() {
        if (!this.props.active && (!this.props.lockedWindow || !this.state.visible)) {
            return null;
        }

        return (
            <ResizeableWindow dockable={this.props.lockedWindow ? false : this.props.geometry.side} icon="editing" initialHeight={this.props.geometry.initialHeight}
                initialWidth={this.props.geometry.initialWidth} initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked} onClose={this.onClose} splitScreenWhenDocked={!this.props.lockedWindow} title={LocaleUtils.tr("attribtable.title")}
            >
                <AttributeTableWidget allowAddForGeometryLayers={this.props.allowAddForGeometryLayers} hideIdColumn={this.props.hideIdColumn}
                    iface={this.props.iface} initialLayer={this.props.taskData?.layer} limitToExtent={this.props.limitToExtent}
                    showEditFormButton={this.props.showEditFormButton} showHiddenFields={this.props.showHiddenFields}
                    showLimitToExtent={this.props.showLimitToExtent} zoomLevel={this.props.zoomLevel}
                />
            </ResizeableWindow>
        );
    }

    onClose = () => {
        this.setState({visible: false});

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
