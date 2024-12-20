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
import ResizeableWindow from '../components/ResizeableWindow';
import LocaleUtils from '../utils/LocaleUtils';


/**
 * Displays a 3D map view.
 */
class View3D extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        /** Default window geometry. */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool
        }),
        mapBBox: PropTypes.object,
        /** Various configuration options */
        options: PropTypes.shape({
            /** Minimum scale denominator when zooming to search result. */
            searchMinScaleDenom: PropTypes.number
        }),
        setCurrentTask: PropTypes.func
    };
    static defaultProps = {
        geometry: {
            initialWidth: 600,
            initialHeight: 800,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true
        },
        options: {
            searchMinScaleDenom: 1000
        }
    };
    state = {
        enabled: false,
        componentLoaded: false
    };
    constructor(props) {
        super(props);
        this.map3dComponent = null;
        this.map3dComponentRef = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.enabled && !prevProps.enabled) {
            this.setState({enabled: true});
            this.props.setCurrentTask(null);
            import('../components/map3d/Map3D').then(component => {
                this.map3dComponent = component.default;
                this.map3dComponentRef = null;
                this.setState({componentLoaded: true});
            });
        } else if (!this.state.enabled && prevState.enabled) {
            this.map3dComponent = null;
            this.map3dComponentRef = null;
            this.setState({componentLoaded: false});
        }
    }
    render() {
        if (!this.state.enabled) {
            return null;
        }
        const extraControls = [{
            icon: "sync",
            callback: this.setViewToExtent,
            title: LocaleUtils.tr("map3d.syncview")
        }];
        const Map3D = this.map3dComponent;
        return (
            <ResizeableWindow
                extraControls={extraControls} icon="map3d"
                initialHeight={this.props.geometry.initialHeight}
                initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX}
                initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={this.onClose}
                onExternalWindowResized={this.redrawScene}
                splitScreenWhenDocked
                splitTopAndBottomBar
                title={LocaleUtils.tr("map3d.title")}
            >
                {this.state.componentLoaded ? (
                    <Map3D innerRef={this.setRef} options={this.props.options} role="body"/>
                ) : null}
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.setState({enabled: false});
    };
    setRef = (ref) => {
        this.map3dComponentRef = ref;
    };
    setViewToExtent = () => {
        if (this.map3dComponentRef) {
            this.map3dComponentRef.setViewToExtent(this.props.mapBBox.bounds, this.props.mapBBox.rotation);
        }
    };
    redrawScene = (ev) => {
        if (this.map3dComponentRef) {
            this.map3dComponentRef.redrawScene(ev);
        }
    };
}

export default connect((state) => ({
    enabled: state.task.id === 'View3D',
    mapBBox: state.map.bbox
}), {
    setCurrentTask: setCurrentTask
})(View3D);
