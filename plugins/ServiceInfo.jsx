/**
 * Copyright 2026 Oslandia
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import ServiceInfoWindow from '../components/ServiceInfoWindow';


/**
 * Displays Service info window with theme informations.
 */
class ServiceInfo extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        /** Default window geometry with size, position and docking status. A locked window is not closeable and not resizeable. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        setCurrentTask: PropTypes.func,
        /** Whether to show LayerTree alongside the plugin. Default: `false`. */
        showLayerTree: PropTypes.bool,
        theme: PropTypes.object
    };
    static defaultProps = {
        geometry: {
            initialWidth: 480,
            initialHeight: 480,
            initialX: null,
            initialY: null,
            initiallyDocked: false
        },
        openLayerTree: false
    };
    state = {
        visible: false
    };
    componentDidUpdate(prevProps) {
        if (this.props.active && !prevProps.active) {
            this.setState({visible: true});
            if (this.props.showLayerTree) this.props.setCurrentTask("LayerTree");
        }
    }
    render() {
        if (!this.state.visible) {
            return null;
        }
        return (
            <ServiceInfoWindow layerInfoGeometry={this.props.geometry} onClose={this.onClose} service={this.props.theme} />
        );
    }
    onClose = () => {
        this.setState({visible: false});
        this.props.setCurrentTask(null);
    };
}

export default connect(state => ({
    active: state.task.id === "ServiceInfo",
    theme: state.theme.current
}), {
    setCurrentTask: setCurrentTask
})(ServiceInfo);
