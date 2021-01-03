/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {createSelector} from 'reselect';
import isEmpty from 'lodash.isempty';
import proj4js from 'proj4';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import measureUtils from '../utils/MeasureUtils';
import {changeMeasurementState} from '../actions/measurement.js';
import displayCrsSelector from '../selectors/displaycrs';
import TaskBar from '../components/TaskBar';
import ButtonBar from '../components/widgets/ButtonBar';
import './style/Measure.css';

class Measure extends React.Component {
    static propTypes = {
        changeMeasurementState: PropTypes.func,
        displaycrs: PropTypes.string,
        mapcrs: PropTypes.string,
        measureState: PropTypes.object,
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
        if (geomType !== this.props.measureState.geomType) {
            this.props.changeMeasurementState({geomType: geomType});
        }
    }
    changeLengthUnit = (ev) => {
        this.props.changeMeasurementState({...this.props.measureState, lenUnit: ev.target.value});
    }
    changeAreaUnit = (ev) => {
        this.props.changeMeasurementState({...this.props.measureState, areaUnit: ev.target.value});
    }
    renderModeSwitcher = () => {
        if (!this.props.showMeasureModeSwitcher) {
            return null;
        }
        const buttons = [
            {key: "Point", label: LocaleUtils.trmsg("measureComponent.pointLabel")},
            {key: "LineString", label: LocaleUtils.trmsg("measureComponent.lengthLabel")},
            {key: "Polygon", label: LocaleUtils.trmsg("measureComponent.areaLabel")},
            {key: "Bearing", label: LocaleUtils.trmsg("measureComponent.bearingLabel")}
        ];
        return (
            <ButtonBar active={this.props.measureState.geomType} buttons={buttons} onClick={this.setMeasureMode} />
        );
    }
    renderResult = () => {
        let resultBody = null;
        if (this.props.measureState.geomType === "Point") {
            const digits = proj4js.defs(this.props.displaycrs).units === 'degrees' ? 4 : 0;
            let text = "0 0";
            if (!isEmpty(this.props.measureState.coordinates)) {
                const coo = CoordinatesUtils.reproject(this.props.measureState.coordinates, this.props.mapcrs, this.props.displaycrs);
                text = LocaleUtils.toLocaleFixed(coo[0], digits) + " " + LocaleUtils.toLocaleFixed(coo[1], digits);
            }
            resultBody = (<div className="resultbody"><span>{text}</span></div>);
        } else if (this.props.measureState.geomType === "LineString") {
            const length = (this.props.measureState.length || []).reduce((tot, num) => tot + num, 0);
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
        } else if (this.props.measureState.geomType === "Polygon") {
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
        } else if (this.props.measureState.geomType === "Bearing") {
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
            <TaskBar onHide={this.onHide} onShow={this.onShow} task="Measure">
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
}

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    measureState: state.measurement,
    mapcrs: state.map.projection,
    displaycrs: displaycrs
}));

export default connect(selector, {
    changeMeasurementState: changeMeasurementState
})(Measure);
