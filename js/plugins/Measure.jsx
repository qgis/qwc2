/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const FormattedNumber = require('react-intl').FormattedNumber;
const {Glyphicon} = require('react-bootstrap');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Dialog = require('../../MapStore2/web/client/components/misc/Dialog');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const measureUtils = require('../../MapStore2/web/client/utils/MeasureUtils');
const {changeMeasurement, changeMeasurementState} = require('../../MapStore2/web/client/actions/measurement.js');
const {setCurrentTask} = require('../actions/task');
const MessageBar = require('../components/MessageBar');
require('./style/Dialog.css');
require('./style/Measure.css');

const Measure = React.createClass({
    propTypes: {
        setCurrentTask: React.PropTypes.func,
        measureState: React.PropTypes.object,
        changeMeasurement: React.PropTypes.func,
        changeMeasurementState: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            measureState: {
                geomType: "LineString",
                len: 0,
                area: 0,
                bearing: 0,
                lenUnit: 'm',
                areaUnit: 'sqm'
            }
        }
    },
    onClose() {
        this.props.setCurrentTask(null);
        this.props.changeMeasurement(assign({}, this.props.measureState, {geomType: null}));
    },
    setMeasureMode(geomType) {
        if(geomType !== this.props.measureState.geomType) {
            this.props.changeMeasurement(assign({}, this.props.measureState, {geomType: geomType}));
        }
    },
    changeLengthUnit(ev) {
        this.props.changeMeasurementState(assign({}, this.props.measureState, {lenUnit: ev.target.value}));
    },
    changeAreaUnit(ev) {
        this.props.changeMeasurementState(assign({}, this.props.measureState, {areaUnit: ev.target.value}));
    },
    render() {
        if(!this.props.measureState.geomType) {
            return null;
        }
        let decimalFormat = {style: "decimal", minimumIntegerDigits: 1, maximumFractionDigits: 2, minimumFractionDigits: 2};
        if(this.props.measureState.geomType === "LineString") {
            var resultBody = (
                <span className="resultbody">
                    <span><Message msgId="measureComponent.lengthLabel" />: </span>
                    <span><FormattedNumber {...decimalFormat} value={measureUtils.getFormattedLength(this.props.measureState.lenUnit, this.props.measureState.len)} /> </span>
                    <select onChange={this.changeLengthUnit} value={this.props.measureState.lenUnit}>
                        <option value="m">m</option>
                        <option value="ft">ft</option>
                        <option value="km">km</option>
                        <option value="mi">mi</option>
                    </select>
                </span>
            );
        } else if(this.props.measureState.geomType === "Polygon") {
            var resultBody = (
                <span className="resultbody">
                    <span><Message msgId="measureComponent.areaLabel" />: </span>
                    <span><FormattedNumber {...decimalFormat} value={measureUtils.getFormattedArea(this.props.measureState.areaUnit, this.props.measureState.area)} /> </span>
                    <select onChange={this.changeAreaUnit} value={this.props.measureState.areaUnit}>
                        <option value="sqm">m&#178;</option>
                        <option value="sqft">ft&#178;</option>
                        <option value="sqkm">km&#178;</option>
                        <option value="sqmi">mi&#178;</option>
                    </select>
                </span>
            );
        } else if(this.props.measureState.geomType === "Bearing") {
            var resultBody = (
                <span className="resultbody">
                    <span><Message msgId="measureComponent.bearingLabel" />: </span>
                    <span>{measureUtils.getFormattedBearingValue(this.props.measureState.bearing)}</span>
                </span>
            );
        }

        return (
            <MessageBar name="Measure" onClose={this.onClose}>
                <span role="body">
                    <span className="buttonbar">
                        <span onClick={()=>{this.setMeasureMode("LineString");}} className={this.props.measureState.geomType === "LineString" ? "active" : ""}><Message msgId="measureComponent.lengthLabel" /></span>
                        <span onClick={()=>{this.setMeasureMode("Polygon");}} className={this.props.measureState.geomType === "Polygon" ? "active" : ""}><Message msgId="measureComponent.areaLabel" /></span>
                        <span onClick={()=>{this.setMeasureMode("Bearing");}} className={this.props.measureState.geomType === "Bearing" ? "active" : ""}><Message msgId="measureComponent.bearingLabel" /></span>
                    </span>
                    {resultBody}
                </span>
            </MessageBar>
        );
    }
});

const selector = (state) => ({
    measureState: {
        geomType: state.measurement ? state.measurement.geomType : null,
        len: state.measurement ? state.measurement.len : 0,
        area: state.measurement ? state.measurement.area : 0,
        bearing: state.measurement ? state.measurement.bearing : 0,
        lenUnit: state.measurement && state.measurement.lenUnit ? state.measurement.lenUnit : 'm',
        areaUnit: state.measurement && state.measurement.areaUnit ? state.measurement.areaUnit : 'sqm'
    }
});

module.exports = {
    MeasurePlugin: connect(selector, {
        setCurrentTask: setCurrentTask,
        changeMeasurement: changeMeasurement,
        changeMeasurementState: changeMeasurementState
    })(Measure),
    reducers: {
        measurement: require('../../MapStore2/web/client/reducers/measurement')
    }
}
