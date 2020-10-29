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
const isEmpty = require('lodash.isempty');
const NumericInput = require('react-numeric-input');
const uuid = require('uuid');
const Message = require('../components/I18N/Message');
const {changeRedliningState} = require('../actions/redlining');
const {LayerRole,addLayer,removeLayer} = require('../actions/layers');
const {setCurrentTask} = require('../actions/task');
const {TaskBar} = require('../components/TaskBar');
const ButtonBar = require('../components/widgets/ButtonBar');
const LocaleUtils = require('../utils/LocaleUtils');

require('./style/Redlining.css');
require('./style/ScratchDrawing.css');


class ScratchDrawing extends React.Component {
    static propTypes = {
        task: PropTypes.object,
        layers: PropTypes.array,
        redlining: PropTypes.object,
        projection: PropTypes.string,
        setCurrentTask: PropTypes.func,
        changeRedliningState: PropTypes.func,
        addLayer: PropTypes.func,
        removeLayer: PropTypes.func
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    constructor(props) {
        super(props);
        window.addEventListener('keydown', this.keyPressed);
        this.submitted = false;
    }
    componentWillUnmount() {
        window.removeEventListener('keydown', this.keyPressed);
    }
    componentWillReceiveProps(newProps, newState) {
        // Remove layers when not used anymore
        if(this.props.redlining.layer === "__scratchdrawing" && newProps.redlining.layer != "__scratchdrawing") {
            this.props.removeLayer("__scratchdrawing");
        }
        // Call callback if task unset
        if(newProps.task.id !== this.props.task.id && this.props.task.id == "ScratchDrawing" && !this.submitted) {
            this.props.task.data.callback(null);
        }
    }
    keyPressed = (ev) => {
        if(ev.keyCode === 27) {
            if(this.props.redlining.action === 'Draw' && !this.props.redlining.selectedFeature) {
                this.props.changeRedliningState({action: 'Delete'});
            }
        }
    };
    onShow = (mode) => {
        let data = this.props.task.data || {};
        let layer = {
            id: "__scratchdrawing",
            role: LayerRole.USERLAYER,
            type: 'vector'
        };
        this.props.addLayer(layer);
        this.props.changeRedliningState({action: 'Draw', geomType: data.geomType, layer: '__scratchdrawing', layerTitle: null});
        this.submitted = false;
        Mousetrap.bind('del', this.triggerDelete);
    }
    onHide = () => {
        this.props.changeRedliningState({action: null, geomType: null, featureSelected: false, layer: null, layerTitle: null});
        Mousetrap.unbind('del', this.triggerDelete);
        this.submitted = false;
    }
    updateRedliningState = (diff) => {
        let newState = assign({}, this.props.redlining, diff)
        this.props.changeRedliningState(newState);
    }
    renderBody = () => {
        return (
            <div className="scratch-drawing-taskbar-body">
                <span>{this.props.task.data.message}</span>
                <button className="button" onClick={ev => this.submitGeometry()}>
                    {LocaleUtils.getMessageById(this.context.messages, "scratchdrawing.finish")}
                </button>
            </div>
        );
    }
    render() {
        return (
            <TaskBar task="ScratchDrawing" onShow={this.onShow} onHide={this.onHide}>
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
        let layer = this.props.layers.find(layer => layer.id === "__scratchdrawing");
        features = (layer || {}).features || [];
        this.submitted = true;
        this.props.task.data.callback(features);
        this.props.setCurrentTask(null);
    }
};

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
        removeLayer: removeLayer,
        setCurrentTask: setCurrentTask
    })(ScratchDrawing),
    reducers: {
        redlining: require('qwc2/reducers/redlining')
    }
};
