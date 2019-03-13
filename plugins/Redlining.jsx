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
const Mousetrap = require('mousetrap');
const LocaleUtils = require('../utils/LocaleUtils');
const Message = require('../components/I18N/Message');
const {changeRedliningState} = require('../actions/redlining');
const {LayerRole,addLayer} = require('../actions/layers');
const Icon = require('../components/Icon');
const {TaskBar} = require('../components/TaskBar');
const ButtonBar = require('../components/widgets/ButtonBar');
const ColorButton = require('../components/widgets/ColorButton');


require('./style/Redlining.css');

class Redlining extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        redlining: PropTypes.object,
        mobile: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        changeRedliningState: PropTypes.func,
        addLayer: PropTypes.func,
        allowGeometryLabels: PropTypes.bool
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    static defaultProps = {
        allowGeometryLabels: true
    }
    state = {
        selectText: false
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
        let activeButton = this.props.redlining.action === "Pick" ? "Pick" : this.props.redlining.geomType;
        let drawButtons = [
            {key: "Point", icon: "point", data: {action: "Draw", geomType: "Point", text: ""}},
            {key: "LineString", icon: "line", data: {action: "Draw", geomType: "LineString", text: ""}},
            {key: "Polygon", icon: "polygon", data: {action: "Draw", geomType: "Polygon", text: ""}},
            {key: "Text", icon: "text", data: {action: "Draw", geomType: "Text", text: ""}},
        ];
        let editButtons = [
            {key: "Pick", icon: "pick", data: {action: "Pick", geomType: null, text: ""}},
            {key: "Delete", icon: "trash", data: {action: "Delete", geomType: null}, disabled: !this.props.redlining.featureSelected}
        ];
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
                        <div className="redlining-layer-selector">
                            <select className="combo" value={this.props.redlining.layer} onChange={(ev) => this.changeRedliningLayer(ev.target.value, vectorLayers)}>
                                {vectorLayers.map(layer => (<option key={layer.id} value={layer.id}>{layer.title}</option>))}
                            </select>
                            <button className="button" onClick={this.addLayer} style={{borderLeftWidth: 0}}><Icon icon="plus" /></button>
                        </div>
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
                {this.renderStandardControls()}
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
    changeRedliningLayer = (id, vectorLayers) => {
        this.updateRedliningState({layer: id, layerTitle: vectorLayers.find(layer => layer.id === id).title});
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
            this.updateRedliningState({layer: layer.id, layerTitle: layer.title});
        }
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
