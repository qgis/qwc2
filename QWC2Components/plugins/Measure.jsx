/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const FormattedNumber = require('react-intl').FormattedNumber;
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const assign = require('object-assign');
const proj4js = require('proj4');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const measureUtils = require('../../MapStore2/web/client/utils/MeasureUtils');
const {changeMeasurement, changeMeasurementState} = require('../../MapStore2/web/client/actions/measurement.js');
const displayCrsSelector = require('../selectors/displaycrs');
const {TaskBar} = require('../components/TaskBar');
require('./style/Measure.css');

const Measure = React.createClass({
    propTypes: {
        measureState: React.PropTypes.object,
        displaycrs: React.PropTypes.string,
        changeMeasurement: React.PropTypes.func,
        changeMeasurementState: React.PropTypes.func,
        showMeasureModeSwitcher: React.PropTypes.bool
    },
    getDefaultProps() {
        return {
            measureState: {
                geomType: "Point",
                point: null,
                len: 0,
                area: 0,
                bearing: 0,
                lenUnit: 'm',
                areaUnit: 'sqm'
            },
            showMeasureModeSwitcher: true
        }
    },
    onClose() {
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
    renderModeSwitcher() {
        if(!this.props.showMeasureModeSwitcher) {
            return null;
        }
        return (
            <div className="buttonbar">
                <span onClick={()=>{this.setMeasureMode("Point");}} className={this.props.measureState.geomType === "Point" ? "active" : ""}><Message msgId="measureComponent.pointLabel" /></span>
                <span onClick={()=>{this.setMeasureMode("LineString");}} className={this.props.measureState.geomType === "LineString" ? "active" : ""}><Message msgId="measureComponent.lengthLabel" /></span>
                <span onClick={()=>{this.setMeasureMode("Polygon");}} className={this.props.measureState.geomType === "Polygon" ? "active" : ""}><Message msgId="measureComponent.areaLabel" /></span>
                <span onClick={()=>{this.setMeasureMode("Bearing");}} className={this.props.measureState.geomType === "Bearing" ? "active" : ""}><Message msgId="measureComponent.bearingLabel" /></span>
            </div>
        );
    },
    renderBody() {
        let resultBody = null;
        let decimalFormat = {style: "decimal", minimumIntegerDigits: 1, maximumFractionDigits: 2, minimumFractionDigits: 2};
        if(this.props.measureState.geomType === "Point") {
            let digits = proj4js.defs(this.props.displaycrs).units === 'degrees'? 4 : 0;
            let text = "0 0";
            if(this.props.measureState.point) {
                let {x, y} = CoordinatesUtils.reproject([this.props.measureState.point.x, this.props.measureState.point.y], this.props.measureState.point.srs, this.props.displaycrs);
                text = x.toFixed(digits) + " " + y.toFixed(digits);
            }
            resultBody = (<div className="resultbody"><span>{text}</span></div>);
        } else if(this.props.measureState.geomType === "LineString") {
            resultBody = (
                <div className="resultbody">
                    <FormattedNumber {...decimalFormat} value={measureUtils.getFormattedLength(this.props.measureState.lenUnit, this.props.measureState.len)} />
                    <select onChange={this.changeLengthUnit} value={this.props.measureState.lenUnit}>
                        <option value="m">m</option>
                        <option value="ft">ft</option>
                        <option value="km">km</option>
                        <option value="mi">mi</option>
                    </select>
                </div>
            );
        } else if(this.props.measureState.geomType === "Polygon") {
            resultBody = (
                <div className="resultbody">
                    <FormattedNumber {...decimalFormat} value={measureUtils.getFormattedArea(this.props.measureState.areaUnit, this.props.measureState.area)} />
                    <select onChange={this.changeAreaUnit} value={this.props.measureState.areaUnit}>
                        <option value="sqm">m&#178;</option>
                        <option value="sqft">ft&#178;</option>
                        <option value="sqkm">km&#178;</option>
                        <option value="sqmi">mi&#178;</option>
                    </select>
                </div>
            );
        } else if(this.props.measureState.geomType === "Bearing") {
            resultBody = (
                <div className="resultbody">
                    <span>{measureUtils.getFormattedBearingValue(this.props.measureState.bearing)}</span>
                </div>
            );
        }
        return resultBody;
    },
    render() {
        return (
            <TaskBar task="Measure" onClose={this.onClose}>
                <span role="body">
                    {this.renderModeSwitcher()}
                    {this.renderBody()}
                </span>
            </TaskBar>
        );
    }
});

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    measureState: {
        geomType: state.measurement ? state.measurement.geomType : null,
        point: state.measurement ? state.measurement.point : null,
        len: state.measurement ? state.measurement.len : 0,
        area: state.measurement ? state.measurement.area : 0,
        bearing: state.measurement ? state.measurement.bearing : 0,
        lenUnit: state.measurement && state.measurement.lenUnit ? state.measurement.lenUnit : 'm',
        areaUnit: state.measurement && state.measurement.areaUnit ? state.measurement.areaUnit : 'sqm'
    },
    displaycrs: displaycrs
}));

module.exports = {
    MeasurePlugin: connect(selector, {
        changeMeasurement: changeMeasurement,
        changeMeasurementState: changeMeasurementState
    })(Measure),
    reducers: {
        measurement: require('../../MapStore2/web/client/reducers/measurement')
    }
}
