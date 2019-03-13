/**
* Copyright 2017, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const NumericInput = require('react-numeric-input');
const assign = require('object-assign');
const classnames = require('classnames');
const uuid = require('uuid');
const isEmpty = require('lodash.isempty');
const Mousetrap = require('mousetrap');
const LocaleUtils = require('../utils/LocaleUtils');
const Message = require('../components/I18N/Message');
const {changeRedliningState} = require('../actions/redlining');
const {LayerRole,addLayer,addLayerFeatures} = require('../actions/layers');
const Icon = require('../components/Icon');
const {TaskBar} = require('../components/TaskBar');
const ButtonBar = require('../components/widgets/ButtonBar');
const ColorButton = require('../components/widgets/ColorButton');
const VectorLayerUtils = require('../utils/VectorLayerUtils');

require('./style/Redlining.css');

class RedliningLayerPicker extends React.Component {
    static propTypes = {
        value: PropTypes.string,
        layers: PropTypes.array,
        onChange: PropTypes.func,
        addLayer: PropTypes.func
    }
    render() {
        return (
            <div className="redlining-layer-selector">
                <select className="combo" value={this.props.value} onChange={ev => this.props.onChange(this.props.layers.find(layer => layer.id === ev.target.value))}>
                    {this.props.layers.map(layer => (<option key={layer.id} value={layer.id}>{layer.title}</option>))}
                </select>
                <button className="button" onClick={this.addLayer} style={{borderLeftWidth: 0}}><Icon icon="plus" /></button>
            </div>
        );
    }
    addLayer = () => {
        let name = prompt("Enter layer name");
        if(name) {
            let layer = {
                id: uuid.v4(),
                title: name,
                role: LayerRole.USERLAYER,
                type: 'vector'
            };
            this.props.addLayer(layer);
            this.props.onChange(layer);
        }
    }
};


class _RedliningBufferControls extends React.Component {
    static propTypes = {
        projection: PropTypes.string,
        layers: PropTypes.array,
        redlining: PropTypes.object,
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func
    }
    state = {
        bufferDistance: 0,
        bufferLayer: null
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    componentWillMount() {
        this.setState({bufferLayer: {
            id: "buffer",
            title: LocaleUtils.getMessageById(this.context.messages, "redlining.buffer"),
            role: LayerRole.USERLAYER
        }});
    }
    componentWillReceiveProps(newProps) {
        if(this.state.bufferLayer && !newProps.layers.find(layer => layer.id === this.state.bufferLayer.id)) {
            this.setState({bufferLayer: {
                id: "buffer",
                title: LocaleUtils.getMessageById(this.context.messages, "redlining.buffer"),
                role: LayerRole.USERLAYER
            }});
        }
    }
    render() {
        if(!this.props.redlining.selectedFeature) {
            return (
                <div className="redlining-message">
                    <Message msgId="redlining.bufferselectfeature" />
                </div>
            );
        }
        let enabled = this.state.bufferDistance != 0;
        let layers = this.props.layers;
        // Ensure list contains current  target layer
        if(!layers.find(layer => layer.id === this.state.bufferLayer.id)) {
            layers = [this.state.bufferLayer, ...layers];
        }
        return (
            <div className="redlining-controlsbar">
                <span>
                    <span><Message msgId="redlining.bufferdistance" /> [m]:&nbsp;</span>
                        <NumericInput mobile strict
                            min={-99999} max={99999} precision={0} step={1}
                            value={this.state.bufferDistance} onChange={(nr) => this.setState({bufferDistance: nr})}/>
                </span>
                <span>
                    <span><Message msgId="redlining.bufferlayer" />:&nbsp;</span>
                    <RedliningLayerPicker
                        value={this.state.bufferLayer.id} layers={layers}
                        onChange={layer => this.setState({bufferLayer: layer})}
                        addLayer={this.props.addLayer} />
                </span>
                <span>
                    <button onClick={this.computeBuffer} className="button" disabled={!enabled}>
                        <Message msgId="redlining.buffercompute" />
                    </button>
                </span>
            </div>
        );
    }
    computeBuffer = () => {
        const buffer = require('@turf/buffer').default;

        let feature = this.props.redlining.selectedFeature;
        if(!feature || !feature.geometry || !this.state.bufferLayer) {
            return;
        }
        let wgsGeometry = VectorLayerUtils.reprojectGeometry(feature.geometry, this.props.projection, "EPSG:4326");
        let wgsFeature = assign({}, feature, {geometry: wgsGeometry});
        let output = buffer(wgsFeature, this.state.bufferDistance, {units: 'meters'});
        if(output && output.geometry) {
            output.geometry = VectorLayerUtils.reprojectGeometry(output.geometry, "EPSG:4326", this.props.projection);
            output.id = uuid.v4();
            output.styleName = 'default';
            output.styleOptions = {
                fillColor: [0, 0, 255, 0.5],
                strokeColor: [0, 0, 255, 1]
            };
            this.props.addLayerFeatures(this.state.bufferLayer, [output]);
        }
    }
};

RedliningBufferControls = connect((state) => ({
    projection: state.map.projection
}), {
    addLayerFeatures: addLayerFeatures,
    addLayer: addLayer
})(_RedliningBufferControls);


class Redlining extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        redlining: PropTypes.object,
        mobile: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        changeRedliningState: PropTypes.func,
        addLayer: PropTypes.func,
        allowGeometryLabels: PropTypes.bool,
        enableBuffer: PropTypes.bool
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    static defaultProps = {
        allowGeometryLabels: true,
        enableBuffer: false
    }
    state = {
        selectText: false,
    }
    constructor(props) {
        super(props);
        this.labelInput = null;
    }
    componentWillReceiveProps(newProps) {
        if(newProps.redlining.geomType !== this.props.redlining.geomType && newProps.redlining.geomType === 'Text') {
            this.setState({selectText: true});
        }
        if(!newProps.layers.find(layer => layer.id === newProps.redlining.layer) && newProps.redlining.layer !== 'redlining') {
            this.props.changeRedliningState({layer: 'redlining', layerTitle: 'Redlining'});
        }
    }
    onShow = (mode) => {
        this.props.changeRedliningState({action: mode || 'Pick', geomType: null});
        Mousetrap.bind('del', this.triggerDelete);
    }
    onHide = () => {
        this.props.changeRedliningState({action: null, geomType: null, featureSelected: false});
        Mousetrap.unbind('del', this.triggerDelete);
    }
    updateRedliningState = (diff) => {
        let newState = assign({}, this.props.redlining, diff)
        this.props.changeRedliningState(newState);
    }
    updateRedliningStyle = (diff) => {
        let newStyle = assign({}, this.props.redlining.style, diff);
        this.updateRedliningState({style: newStyle});
    }
    renderBody = () => {
        let activeButton = ["Pick", "Buffer"].includes(this.props.redlining.action) ? this.props.redlining.action : this.props.redlining.geomType;
        let drawButtons = [
            {key: "Point", tooltip: "redlining.point", icon: "point", data: {action: "Draw", geomType: "Point", text: ""}},
            {key: "LineString", tooltip: "redlining.line", icon: "line", data: {action: "Draw", geomType: "LineString", text: ""}},
            {key: "Polygon", tooltip: "redlining.polygon", icon: "polygon", data: {action: "Draw", geomType: "Polygon", text: ""}},
            {key: "Text", tooltip: "redlining.text", icon: "text", data: {action: "Draw", geomType: "Text", text: ""}},
        ];
        let editButtons = [
            {key: "Pick", tooltip: "redlining.pick", icon: "pick", data: {action: "Pick", geomType: null, text: ""}},
            {key: "Delete", tooltip: "redlining.delete", icon: "trash", data: {action: "Delete", geomType: null}, disabled: !this.props.redlining.selectedFeature}
        ];
        if(this.props.enableBuffer) {
            editButtons.push({key: "Buffer", tooltip: "redlining.buffer", icon: "buffer", data: {action: "Buffer", geomType: null}});
        }
        let vectorLayers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER);
        // Ensure list always contains "Redlining" layer
        if(!vectorLayers.find(layer => layer.id === 'redlining')) {
            vectorLayers = [{id: 'redlining', title: 'Redlining'}, ...vectorLayers];
        }

        return (
            <div>
                <div className="redlining-buttongroups">
                    <div className="redlining-group">
                        <div><Message msgId="redlining.layer" /></div>
                        <RedliningLayerPicker
                            value={this.props.redlining.layer} layers={vectorLayers}
                            addLayer={this.props.addLayer} onChange={this.changeRedliningLayer} />
                    </div>
                    <div className="redlining-group">
                        <div><Message msgId="redlining.draw" /></div>
                        <ButtonBar buttons={drawButtons} active={activeButton} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                    <div className="redlining-group">
                        <div><Message msgId="redlining.edit" /></div>
                        <ButtonBar buttons={editButtons} active={activeButton} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                </div>
                {this.props.redlining.action !== 'Buffer' ? this.renderStandardControls() : (<RedliningBufferControls layers={vectorLayers} redlining={this.props.redlining} />)}
            </div>
        );
    }
    renderStandardControls = () => {
        let sizeLabel = LocaleUtils.getMessageById(this.context.messages, "redlining.size");
        if(this.props.redlining.geomType === "LineString") {
            sizeLabel = LocaleUtils.getMessageById(this.context.messages, "redlining.width");
        } else if(this.props.redlining.geomType === "Polygon") {
            sizeLabel = LocaleUtils.getMessageById(this.context.messages, "redlining.border");
        }
        let labelPlaceholder = LocaleUtils.getMessageById(this.context.messages, "redlining.label");
        if(this.props.redlining.geomType === "Text") {
            labelPlaceholder = LocaleUtils.getMessageById(this.context.messages, "redlining.text");
        }

        return (
            <div className="redlining-controlsbar">
                <span>
                    <span><Message msgId="redlining.outline" />:&nbsp;</span>
                    <ColorButton color={this.props.redlining.style.borderColor} onColorChanged={(color) => this.updateRedliningStyle({borderColor: color})} />
                </span>
                {this.props.redlining.geomType === 'LineString' ? null : (
                    <span>
                        <span><Message msgId="redlining.fill" />:&nbsp;</span>
                        <ColorButton color={this.props.redlining.style.fillColor} onColorChanged={(color) => this.updateRedliningStyle({fillColor: color})} />
                    </span>
                )}
                <span>
                    <span>{sizeLabel}:&nbsp;</span>
                    <NumericInput mobile strict
                        min={1} max={99} precision={0} step={1}
                        value={this.props.redlining.style.size} onChange={(nr) => this.updateRedliningStyle({size: nr})}/>
                </span>
                {(this.props.redlining.geomType === 'Text' || this.props.allowGeometryLabels) ? (
                    <span>
                        <input ref={el => this.setLabelRef(el)} className="redlining-label" type="text" placeholder={labelPlaceholder} value={this.props.redlining.style.text} onChange={(ev) => this.updateRedliningStyle({text: ev.target.value})}/>
                    </span>
                ) : null}
            </div>
        );
    }
    render() {
        return (
            <TaskBar task="Redlining" onShow={this.onShow} onHide={this.onHide}>
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
    setLabelRef = (el) => {
        this.labelInput = el;
        if(el && this.state.selectText) {
            el.focus();
            el.select();
            this.setState({selectText: false});
        }
    }
    triggerDelete = () => {
        this.updateRedliningState({action: "Delete", geomType: null});
    }
    actionChanged = (data) => {
        if(data.action === "Draw" && data.geomType === "Text") {
            data = assign({}, data, {text: LocaleUtils.getMessageById(this.context.messages, "redlining.text")});
        }
        this.updateRedliningState({...data, featureSelected: false});
    }
    changeRedliningLayer = (layer) => {
        this.updateRedliningState({layer: layer.id, layerTitle: layer.title});
    }
};

const selector = (state) => ({
    layers: state.layers.flat,
    redlining: state.redlining,
    mobile: state.browser ? state.browser.mobile : false,
});

module.exports = {
    RedliningPlugin: connect(selector, {
        changeRedliningState: changeRedliningState,
        addLayer: addLayer
    })(Redlining),
    reducers: {
        redlining: require('../reducers/redlining')
    }
}
