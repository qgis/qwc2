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
const objectPath = require('object-path');
const classnames = require('classnames');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const LocaleUtils = require('../../MapStore2Components/utils/LocaleUtils');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {changeRedliningState} = require('../actions/redlining');
const {TaskBar} = require('../components/TaskBar');


require('./style/Redlining.css');

class Redlining extends React.Component {
    static propTypes = {
        redlining: PropTypes.object,
        setCurrentTask: PropTypes.func,
        changeRedliningState: PropTypes.func
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    state = {
        openColorPicker: null
    }
    onClose = () => {
        this.props.changeRedliningState(assign({}, this.props.redlining, {action: null, geomType: null}));
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
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let borderClasses = classnames({
            "redlining-colorpicker": true,
            "redlining-colorpicker-collapsed": this.state.openColorPicker !== "border"
        });
        let fillClasses = classnames({
            "redlining-colorpicker": true,
            "redlining-colorpicker-collapsed": this.state.openColorPicker !== "fill"
        });
        let sizeLabel = "Size";
        if(this.props.redlining.geomType === "LineString") {
            sizeLabel = "Width";
        } else if(this.props.redlining.geomType === "Polygon") {
            sizeLabel = "Border";
        }
        return (
            <div>
                <div className="buttonbar">
                    <span onClick={() => this.updateRedliningState({action: "Pick", geomType: null})} className={this.props.redlining.action === "Pick" ? "active" : ""}>
                        <img src={assetsPath + "/img/pick.svg"} /><Message msgId="redlining.pick" />
                    </span>
                    <span onClick={() => this.updateRedliningState({action: "Draw", geomType: "Point"})} className={this.props.redlining.action === "Draw" && this.props.redlining.geomType === "Point" ? "active" : ""}>
                        <img src={assetsPath + "/img/point.svg"} /><Message msgId="redlining.point" />
                    </span>
                    <span onClick={() => this.updateRedliningState({action: "Draw", geomType: "LineString"})} className={this.props.redlining.action === "Draw" && this.props.redlining.geomType === "LineString" ? "active" : ""}>
                        <img src={assetsPath + "/img/line.svg"} /><Message msgId="redlining.line" />
                    </span>
                    <span onClick={() => this.updateRedliningState({action: "Draw", geomType: "Polygon"})} className={this.props.redlining.action === "Draw" && this.props.redlining.geomType === "Polygon" ? "active" : ""}>
                        <img src={assetsPath + "/img/polygon.svg"} /><Message msgId="redlining.polygon" />
                    </span>
                    <span className="redlining-trash" onClick={() => this.updateRedliningState({action: "Delete", geomType: null})}>
                        <img src={assetsPath + "/img/trash.svg"} />
                    </span>
                </div>
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
                        <input className="redlining-label" type="text" placeholder={LocaleUtils.getMessageById(this.context.messages, "redlining.label")} value={this.props.redlining.text} onChange={(ev) => this.updateRedliningState({text: ev.target.value})}/>
                    </span>
                </div>
            </div>
        );
    }
    render() {
        return (
            <TaskBar task="Redlining" onClose={this.onClose}>
                <span role="body">
                    {this.renderBody()}
                </span>
            </TaskBar>
        );
    }
};

const selector = (state) => ({
    redlining: state.redlining
});

module.exports = {
    RedliningPlugin: connect(selector, {
        changeRedliningState: changeRedliningState,
    })(Redlining),
    reducers: {
        redlining: require('../reducers/redlining')
    }
}
