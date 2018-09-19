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
const LocaleUtils = require('../../MapStore2Components/utils/LocaleUtils');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {changeRedliningState} = require('../actions/redlining');
const {TaskBar} = require('../components/TaskBar');
const ButtonBar = require('../components/widgets/ButtonBar');
const ColorButton = require('../components/widgets/ColorButton');


require('./style/Redlining.css');

class Redlining extends React.Component {
    static propTypes = {
        redlining: PropTypes.object,
        mobile: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        changeRedliningState: PropTypes.func,
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
    }
    onShow = (mode) => {
        this.props.changeRedliningState({action: mode || 'Pick', geomType: null});
    }
    onHide = () => {
        this.props.changeRedliningState({action: null, geomType: null});
    }
    updateRedliningState = (diff) => {
        let newState = assign({}, this.props.redlining, diff)
        this.props.changeRedliningState(newState);
    }
    colorPicked = (diff) => {
        this.updateRedliningState(diff);
    }
    renderBody = () => {
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
        let buttons = [
            {key: "Pick", label: "redlining.pick", icon: "pick", data: {action: "Pick", geomType: null, text: ""}},
            {key: "Point", label: "redlining.point", icon: "point", data: {action: "Draw", geomType: "Point", text: ""}},
            {key: "LineString", label: "redlining.line", icon: "line", data: {action: "Draw", geomType: "LineString", text: ""}},
            {key: "Polygon", label: "redlining.polygon", icon: "polygon", data: {action: "Draw", geomType: "Polygon", text: ""}},
            {key: "Text", label: "redlining.text", icon: "text", data: {action: "Draw", geomType: "Text", text: ""}},
            {key: "Delete", icon: "trash", data: {action: "Delete", geomType: null}}
        ];
        let activeButton = this.props.redlining.action === "Pick" ? "Pick" : this.props.redlining.geomType;
        return (
            <div>
                <ButtonBar buttons={buttons} active={activeButton} onClick={(key, data) => this.actionChanged(data)} />
                <div className="redlining-controlsbar">
                    <span>
                        <span><Message msgId="redlining.outline" />:&nbsp;</span>
                        <ColorButton color={this.props.redlining.borderColor} onColorChanged={(color) => this.colorPicked({borderColor: color})} />
                    </span>
                    {this.props.redlining.geomType === 'LineString' ? null : (
                        <span>
                            <span><Message msgId="redlining.fill" />:&nbsp;</span>
                            <ColorButton color={this.props.redlining.fillColor} onColorChanged={(color) => this.colorPicked({fillColor: color})} />
                        </span>
                    )}
                    <span>
                        <span>{sizeLabel}:&nbsp;</span>
                        <NumericInput mobile min={1} max={99} value={this.props.redlining.size} onChange={(nr) => this.updateRedliningState({size: nr})}/>
                    </span>
                    {(this.props.redlining.geomType === 'Text' || this.props.allowGeometryLabels) ? (
                        <span>
                            <input ref={el => this.setLabelRef(el)} className="redlining-label" type="text" placeholder={labelPlaceholder} value={this.props.redlining.text} onChange={(ev) => this.updateRedliningState({text: ev.target.value})}/>
                        </span>
                    ) : null}
                </div>
            </div>
        );
    }
    render() {
        return (
            <TaskBar task="Redlining" onShow={this.onShow} onHide={this.onHide}>
                <span role="body">
                    {this.renderBody()}
                </span>
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
    actionChanged = (data) => {
        if(data.action === "Draw" && data.geomType === "Text") {
            data = assign({}, data, {text: LocaleUtils.getMessageById(this.context.messages, "redlining.text")});
        }
        this.updateRedliningState(data);
    }
};

const selector = (state) => ({
    redlining: state.redlining,
    mobile: state.browser ? state.browser.mobile : false,
});

module.exports = {
    RedliningPlugin: connect(selector, {
        changeRedliningState: changeRedliningState,
    })(Redlining),
    reducers: {
        redlining: require('../reducers/redlining')
    }
}
