/**
* Copyright 2017, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const {TwitterPicker} = require('react-color');
const {connect} = require('react-redux');
const NumericInput = require('react-numeric-input');
const assign = require('object-assign');
const classnames = require('classnames');
const LocaleUtils = require('../../MapStore2Components/utils/LocaleUtils');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {changeRedliningState} = require('../actions/redlining');
const {TaskBar} = require('../components/TaskBar');
const ButtonBar = require('../components/widgets/ButtonBar');


require('./style/Redlining.css');

class Redlining extends React.Component {
    static propTypes = {
        redlining: PropTypes.object,
        mobile: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        changeRedliningState: PropTypes.func
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    state = {
        openColorPicker: null
    }
    constructor(props) {
        super(props);
        this.labelInput = null;
    }
    onShow = (mode) => {
        this.props.changeRedliningState({action: mode || 'Pick', geomType: null});
    }
    onHide = () => {
        this.props.changeRedliningState({action: null, geomType: null});
        this.setState({openColorPicker: null});
    }
    updateRedliningState = (diff) => {
        let newState = assign({}, this.props.redlining, diff)
        this.props.changeRedliningState(newState);
    }
    togglePicker = (picker) => {
        this.setState({openColorPicker: this.state.openColorPicker === picker ? null : picker});
    }
    colorPicked = (diff) => {
        this.togglePicker(null);
        this.updateRedliningState(diff);
    }
    renderBody = () => {
        let borderClasses = classnames({
            "redlining-colorpicker": true,
            "redlining-colorpicker-collapsed": this.state.openColorPicker !== "border"
        });
        let fillClasses = classnames({
            "redlining-colorpicker": true,
            "redlining-colorpicker-collapsed": this.state.openColorPicker !== "fill"
        });
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
            {key: "Pick", label: "redlining.pick", icon: "pick.svg", data: {action: "Pick", geomType: null, text: ""}},
            {key: "Point", label: "redlining.point", icon: "point.svg", data: {action: "Draw", geomType: "Point", text: ""}},
            {key: "LineString", label: "redlining.line", icon: "line.svg", data: {action: "Draw", geomType: "LineString", text: ""}},
            {key: "Polygon", label: "redlining.polygon", icon: "polygon.svg", data: {action: "Draw", geomType: "Polygon", text: ""}},
            {key: "Text", label: "redlining.text", icon: "text.svg", data: {action: "Draw", geomType: "Text", text: ""}},
            {key: "Delete", icon: "trash.svg", data: {action: "Delete", geomType: null}}
        ];
        let activeButton = this.props.redlining.action === "Pick" ? "Pick" : this.props.redlining.geomType;
        return (
            <div>
                <ButtonBar buttons={buttons} active={activeButton} onClick={(key, data) => this.actionChanged(data)} />
                <div className="redlining-controlsbar">
                    <span>
                        <span><Message msgId="redlining.outline" />:</span>
                        <span className={borderClasses}>
                            <span className="redlining-colorpicker-icon" style={{backgroundColor: this.props.redlining.borderColor}} onClick={() => this.togglePicker('border')}></span>
                            <TwitterPicker color={this.props.redlining.borderColor} onChangeComplete={(color) => this.colorPicked({borderColor: color.hex})} />
                        </span>
                    </span>
                    <span>
                        <span><Message msgId="redlining.fill" />:</span>
                        <span className={fillClasses}>
                            <span className="redlining-colorpicker-icon" style={{backgroundColor: this.props.redlining.fillColor}} onClick={() => this.togglePicker('fill')}></span>
                            <TwitterPicker color={this.props.redlining.fillColor} onChangeComplete={(color) => this.colorPicked({fillColor: color.hex})} />
                        </span>
                    </span>
                    <span>
                        <span>{sizeLabel}:</span>
                        <NumericInput mobile min={0} max={99} value={this.props.redlining.size} onChange={(nr) => this.updateRedliningState({size: nr})}/>
                    </span>
                    <span>
                        <input ref={el => this.labelInput = el} className="redlining-label" type="text" placeholder={labelPlaceholder} value={this.props.redlining.text} onChange={(ev) => this.updateRedliningState({text: ev.target.value})}/>
                    </span>
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
    actionChanged = (data) => {
        if(data.action === "Draw" && data.geomType === "Text" && this.labelInput) {
            this.labelInput.focus();
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
