/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const assign = require('object-assign');
const isEmpty = require('lodash.isempty');
const proj4js = require('proj4').default;
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const LocaleUtils = require('../utils/LocaleUtils');
const Message = require('../components/I18N/Message');
const measureUtils = require('../utils/MeasureUtils');
const {changeMeasurementState} = require('../actions/measurement.js');
const displayCrsSelector = require('../selectors/displaycrs');
const {TaskBar} = require('../components/TaskBar');
const ButtonBar = require('../components/widgets/ButtonBar');
require('./style/Measure.css');

class Measure extends React.Component {
    static propTypes = {
        measureState: PropTypes.object,
        mapcrs: PropTypes.string,
        displaycrs: PropTypes.string,
        changeMeasurementState: PropTypes.func,
        showMeasureModeSwitcher: PropTypes.bool
    }
    static defaultProps = {
        showMeasureModeSwitcher: true
    }
    onShow = (mode) => {
        this.props.changeMeasurementState({geomType: mode || 'Point'});
    }
    onHide = () => {
        this.props.changeMeasurementState({geomType: null});
    }
    setMeasureMode = (geomType) => {
        if(geomType !== this.props.measureState.geomType) {
            this.props.changeMeasurementState({geomType: geomType});
        }
    }
    changeLengthUnit = (ev) => {
        this.props.changeMeasurementState(assign({}, this.props.measureState, {lenUnit: ev.target.value}));
    }
    changeAreaUnit = (ev) => {
        this.props.changeMeasurementState(assign({}, this.props.measureState, {areaUnit: ev.target.value}));
    }
    renderModeSwitcher = () => {
        if(!this.props.showMeasureModeSwitcher) {
            return null;
        }
        let buttons = [
            {key: "Point", label: "measureComponent.pointLabel"},
            {key: "LineString", label: "measureComponent.lengthLabel"},
            {key: "Polygon", label: "measureComponent.areaLabel"},
            {key: "Bearing", label: "measureComponent.bearingLabel"}
        ];
        return (
            <ButtonBar buttons={buttons} active={this.props.measureState.geomType} onClick={this.setMeasureMode} />
        );
    }
    renderResult = () => {
        let resultBody = null;
        let decimalFormat = {style: "decimal", minimumIntegerDigits: 1, maximumFractionDigits: 2, minimumFractionDigits: 2};
        if(this.props.measureState.geomType === "Point") {
            let digits = proj4js.defs(this.props.displaycrs).units === 'degrees'? 4 : 0;
            let text = "0 0";
            if(!isEmpty(this.props.measureState.coordinates)) {
                let coo = CoordinatesUtils.reproject(this.props.measureState.coordinates, this.props.mapcrs, this.props.displaycrs);
                text = LocaleUtils.toLocaleFixed(coo[0], digits) + " " + LocaleUtils.toLocaleFixed(coo[1], digits);
            }
            resultBody = (<div className="resultbody"><span>{text}</span></div>);
        } else if(this.props.measureState.geomType === "LineString") {
            let length = (this.props.measureState.length || []).reduce((tot, num) => tot + num, 0);
            resultBody = (
                <div className="resultbody">
                    <span>{LocaleUtils.toLocaleFixed(measureUtils.getFormattedLength(this.props.measureState.lenUnit, length), 2)}</span>
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
                    <span>{LocaleUtils.toLocaleFixed(measureUtils.getFormattedArea(this.props.measureState.areaUnit, this.props.measureState.area), 2)}</span>
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
    }
    renderBody = () => {
        return (
            <span>
                {this.renderModeSwitcher()}
                {this.renderResult()}
            </span>
        );
    }
    render() {
        return (
            <TaskBar task="Measure" onShow={this.onShow} onHide={this.onHide}>
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
};

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    measureState: state.measurement,
    mapcrs: state.map.projection,
    displaycrs: displaycrs
}));

module.exports = {
    MeasurePlugin: connect(selector, {
        changeMeasurementState: changeMeasurementState
    })(Measure),
    reducers: {
        measurement: require('../reducers/measurement')
    }
}
