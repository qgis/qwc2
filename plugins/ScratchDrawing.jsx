/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import Mousetrap from 'mousetrap';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole, addLayerFeatures, removeLayer, clearLayer} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import {changeRedliningState} from '../actions/redlining';
import {setCurrentTask} from '../actions/task';
import TaskBar from '../components/TaskBar';
import LocaleUtils from '../utils/LocaleUtils';

import './style/Redlining.css';
import './style/ScratchDrawing.css';


/**
 * Task which which can be invoked by other tools to draw a geometry and pass it to a callback.
 *
 * Only useful for third-party code, i.e. over the JavaScript API.
 *
 * Invoke as `setCurrentTask("ScratchDrawing", null, null, {callback: <function(features, crs)>});`
 */
class ScratchDrawing extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        changeRedliningState: PropTypes.func,
        clearLayer: PropTypes.func,
        layers: PropTypes.array,
        projection: PropTypes.string,
        redlining: PropTypes.object,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setSnappingConfig: PropTypes.func,
        task: PropTypes.object
    };
    constructor(props) {
        super(props);
        window.addEventListener('keydown', this.keyPressed);
        this.submitted = false;
        this.prevstyle = null;
    }
    componentWillUnmount() {
        window.removeEventListener('keydown', this.keyPressed);
    }
    componentDidUpdate(prevProps) {
        // Remove layers when not used anymore
        if (prevProps.redlining.layer === "__scratchdrawing" && this.props.redlining.layer !== "__scratchdrawing") {
            this.props.removeLayer("__scratchdrawing");
        }
        // Setup redlining state when task is set
        if (this.props.task.id !== prevProps.task.id && this.props.task.id === "ScratchDrawing") {
            this.prevstyle = this.props.redlining.style;
            const data = this.props.task.data || {};
            this.createDrawLayer(data);
            this.props.setSnappingConfig(data.snapping, data.snappingActive);
            this.props.changeRedliningState({action: 'PickDraw', geomType: data.geomType, layer: '__scratchdrawing', layerTitle: null, drawMultiple: data.drawMultiple, style: this.drawingStyle(data.style)});
            this.submitted = false;
            Mousetrap.bind('del', this.triggerDelete);
        }
        // Call callback and reset redlining state if task unset
        if (this.props.task.id !== prevProps.task.id && prevProps.task.id === "ScratchDrawing") {
            if (!this.submitted) {
                prevProps.task.data.callback(null, null);
            }
            this.props.changeRedliningState({action: null, geomType: null, layer: null, layerTitle: null, drawMultiple: true, style: this.prevstyle || this.props.redlining.style});
            this.prevstyle = null;
            Mousetrap.unbind('del', this.triggerDelete);
        }
        this.submitted = false;
        // Reset drawing mode if task data changes
        if (this.props.task.id === "ScratchDrawing" && prevProps.task.id === "ScratchDrawing" && this.props.task.data !== prevProps.task.data) {
            const data = this.props.task.data || {};
            this.createDrawLayer(data);
            this.props.setSnappingConfig(data.snapping, data.snappingActive);
            this.props.changeRedliningState({action: 'PickDraw', geomType: data.geomType, layer: '__scratchdrawing', layerTitle: null, drawMultiple: data.drawMultiple, style: this.drawingStyle(data.style)});
        }
    }
    createDrawLayer = (data) => {
        const features = (data.initialFeatures || []).map(feature => ({
            ...feature,
            id: uuidv1(),
            shape: feature.geometry.type,
            styleName: 'default',
            styleOptions: this.styleOptions(this.drawingStyle(data.style))
        }));
        const layer = {
            id: "__scratchdrawing",
            role: LayerRole.USERLAYER,
            type: 'vector'
        };
        this.props.addLayerFeatures(layer, features, true);
    };
    drawingStyle = (style) => {
        return {
            borderColor: [255, 0, 0, 1],
            size: 2,
            fillColor: [255, 255, 255, 0.5],
            text: "",
            ...style
        };
    };
    styleOptions = (styleProps) => {
        return {
            strokeColor: styleProps.borderColor,
            strokeWidth: 1 + 0.5 * styleProps.size,
            fillColor: styleProps.fillColor,
            circleRadius: 5 + styleProps.size,
            strokeDash: [],
            headmarker: styleProps.headmarker,
            tailmarker: styleProps.tailmarker
        };
    };
    keyPressed = (ev) => {
        if (this.props.task.id === "ScratchDrawing" && ev.keyCode === 27) {
            if (this.props.redlining.action === 'PickDraw' && !this.props.redlining.selectedFeature) {
                this.props.changeRedliningState({action: 'Delete'});
            }
        }
    };
    updateRedliningState = (diff) => {
        const newState = {...this.props.redlining, ...diff};
        this.props.changeRedliningState(newState);
    };
    renderBody = () => {
        return (
            <div className="scratch-drawing-taskbar-body">
                <span>{this.props.task.data.message}</span>
                <button className="button" onClick={() => this.submitGeometry()}>
                    {LocaleUtils.tr("scratchdrawing.finish")}
                </button>
            </div>
        );
    };
    render() {
        return (
            <TaskBar task="ScratchDrawing">
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
    triggerDelete = () => {
        this.updateRedliningState({action: "Delete", geomType: null});
    };
    submitGeometry = () => {
        const layer = this.props.layers.find(l => l.id === "__scratchdrawing");
        const features = (layer || {}).features || [];
        this.submitted = true;
        this.props.task.data.callback(features, this.props.projection);
        this.props.setCurrentTask(null);
    };
}

export default connect((state) => ({
    task: state.task,
    layers: state.layers.flat,
    redlining: state.redlining,
    projection: state.map.projection,
    theme: state.theme.current
}), {
    changeRedliningState: changeRedliningState,
    addLayerFeatures: addLayerFeatures,
    clearLayer: clearLayer,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask,
    setSnappingConfig: setSnappingConfig
})(ScratchDrawing);
