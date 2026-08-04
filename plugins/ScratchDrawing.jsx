/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole, addLayerFeatures, removeLayer, clearLayer} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import {changeRedliningState, resetRedliningState} from '../actions/redlining';
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
        resetRedliningState: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setSnappingConfig: PropTypes.func,
        task: PropTypes.object
    };
    constructor(props) {
        super(props);
        this.submitted = false;
        this.layerId = null;
    }
    componentDidUpdate(prevProps) {
        if (this.props.task.id === "ScratchDrawing" && prevProps.task.id !== "ScratchDrawing") {
            const data = this.props.task.data;
            this.layerId = this.createDrawLayer(data);
            this.props.setSnappingConfig(data.snapping, data.snappingActive);
            this.props.changeRedliningState({action: 'PickDraw', geomType: data.geomType, layer: this.layerId, layerTitle: null, drawMultiple: data.drawMultiple, style: this.drawingStyle(data.style)});
        } else if (prevProps.task.id === "ScratchDrawing" && this.props.task !== prevProps.task) {
            this.props.resetRedliningState();
            if (!this.submitted) {
                prevProps.task.data.callback(null, null);
            }
            this.submitted = false;
        } else if (this.props.redlining.layer === null && prevProps.redlining.layer === this.layerId) {
            this.props.removeLayer(this.layerId);
            if (this.props.task.id === "ScratchDrawing") {
                const data = this.props.task.data;
                this.layerId = this.createDrawLayer(data);
                this.props.setSnappingConfig(data.snapping, data.snappingActive);
                this.props.changeRedliningState({action: 'PickDraw', geomType: data.geomType, layer: this.layerId, layerTitle: null, drawMultiple: data.drawMultiple, style: this.drawingStyle(data.style)});
            }
        }
    }
    createDrawLayer = (data) => {
        const layerId = uuidv4();
        const features = (data.initialFeatures || []).map(feature => ({
            ...feature,
            id: uuidv4(),
            shape: feature.geometry.type,
            styleName: 'default',
            styleOptions: this.styleOptions(this.drawingStyle(data.style))
        }));
        const layer = {
            id: layerId,
            role: LayerRole.USERLAYER,
            type: 'vector'
        };
        this.props.addLayerFeatures(layer, features, true);
        return layerId;
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
    render() {
        return (
            <TaskBar task="ScratchDrawing">
                <div className="scratch-drawing-taskbar-body" role="body">
                    <span>{this.props.task.data?.message}</span>
                    <button className="button" onClick={() => this.submitGeometry()}>
                        {LocaleUtils.tr("scratchdrawing.finish")}
                    </button>
                </div>
            </TaskBar>
        );
    }
    submitGeometry = () => {
        let features = this.props.layers.find(l => l.id === this.layerId)?.features || [];
        if (this.props.redlining.selectedFeature) {
            features = features.filter(f => f.id !== this.props.redlining.selectedFeature.id);
            features.push(this.props.redlining.selectedFeature);
        }
        this.props.task.data.callback(features, this.props.projection);
        this.submitted = true;
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
    resetRedliningState: resetRedliningState,
    setCurrentTask: setCurrentTask,
    setSnappingConfig: setSnappingConfig
})(ScratchDrawing);
