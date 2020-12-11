/**
* Copyright 2020, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Mousetrap = require('mousetrap');
const {changeRedliningState} = require('../actions/redlining');
const {LayerRole, addLayer, removeLayer, clearLayer} = require('../actions/layers');
const {setCurrentTask} = require('../actions/task');
const {TaskBar} = require('../components/TaskBar');
const LocaleUtils = require('../utils/LocaleUtils');

require('./style/Redlining.css');
require('./style/ScratchDrawing.css');


class ScratchDrawing extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        changeRedliningState: PropTypes.func,
        clearLayer: PropTypes.func,
        layers: PropTypes.array,
        projection: PropTypes.string,
        redlining: PropTypes.object,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        task: PropTypes.object
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    constructor(props) {
        super(props);
        window.addEventListener('keydown', this.keyPressed);
        this.submitted = false;
        this.prevstyle = null;
    }
    componentWillUnmount() {
        window.removeEventListener('keydown', this.keyPressed);
    }
    componentDidUpdate(prevProps, prevState) {
        // Remove layers when not used anymore
        if (prevProps.redlining.layer === "__scratchdrawing" && this.props.redlining.layer !== "__scratchdrawing") {
            this.props.removeLayer("__scratchdrawing");
        }
        // Call callback if task unset
        if (this.props.task.id !== prevProps.task.id && prevProps.task.id === "ScratchDrawing" && !this.submitted) {
            prevProps.task.data.callback(null, null);
        }
        this.submitted = false;
        // Change drawing mode if task data changes
        if (this.props.task.id === "ScratchDrawing" && this.props.task.data !== prevProps.task.data) {
            const data = this.props.task.data || {};
            this.props.changeRedliningState({action: 'Draw', geomType: data.geomType, layer: '__scratchdrawing', layerTitle: null, drawMultiple: data.drawMultiple, style: this.drawingStyle(data.style)});
        }
        if (this.props.task.id === "ScratchDrawing" && this.props.redlining.geomType !== prevProps.redlining.geomType) {
            this.props.clearLayer('__scratchdrawing');
        }
    }
    drawingStyle = (style) => {
        return assign({}, {
            borderColor: [255, 0, 0, 1],
            size: 2,
            fillColor: [255, 255, 255, 0.5],
            text: ""
        }, style);
    }
    keyPressed = (ev) => {
        if (ev.keyCode === 27) {
            if (this.props.redlining.action === 'Draw' && !this.props.redlining.selectedFeature) {
                this.props.changeRedliningState({action: 'Delete'});
            }
        }
    };
    onShow = () => {
        this.prevstyle = this.props.redlining.style;
        const data = this.props.task.data || {};
        const layer = {
            id: "__scratchdrawing",
            role: LayerRole.USERLAYER,
            type: 'vector'
        };
        this.props.addLayer(layer);
        this.props.changeRedliningState({action: 'Draw', geomType: data.geomType, layer: '__scratchdrawing', layerTitle: null, drawMultiple: data.drawMultiple, style: this.drawingStyle(data.style)});
        this.submitted = false;
        Mousetrap.bind('del', this.triggerDelete);
    }
    onHide = () => {
        this.props.changeRedliningState({action: null, geomType: null, featureSelected: false, layer: null, layerTitle: null, drawMultiple: true, style: this.prevstyle || this.props.redlining.style});
        this.prevstyle = null;
        Mousetrap.unbind('del', this.triggerDelete);
    }
    updateRedliningState = (diff) => {
        const newState = assign({}, this.props.redlining, diff);
        this.props.changeRedliningState(newState);
    }
    renderBody = () => {
        return (
            <div className="scratch-drawing-taskbar-body">
                <span>{this.props.task.data.message}</span>
                <button className="button" onClick={() => this.submitGeometry()}>
                    {LocaleUtils.getMessageById(this.context.messages, "scratchdrawing.finish")}
                </button>
            </div>
        );
    }
    render() {
        return (
            <TaskBar onHide={this.onHide} onShow={this.onShow} task="ScratchDrawing">
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
    triggerDelete = () => {
        this.updateRedliningState({action: "Delete", geomType: null});
    }
    submitGeometry = () => {
        const layer = this.props.layers.find(l => l.id === "__scratchdrawing");
        const features = (layer || {}).features || [];
        this.submitted = true;
        this.props.task.data.callback(features, this.props.projection);
        this.props.setCurrentTask(null);
    }
}

module.exports = {
    ScratchDrawingPlugin: connect((state) => ({
        task: state.task,
        layers: state.layers.flat,
        redlining: state.redlining,
        projection: state.map.projection,
        theme: state.theme.current
    }), {
        changeRedliningState: changeRedliningState,
        addLayer: addLayer,
        clearLayer: clearLayer,
        removeLayer: removeLayer,
        setCurrentTask: setCurrentTask
    })(ScratchDrawing),
    reducers: {
        redlining: require('qwc2/reducers/redlining')
    }
};
