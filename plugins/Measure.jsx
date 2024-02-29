/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import {createSelector} from 'reselect';

import {setSnappingConfig} from '../actions/map.js';
import {changeMeasurementState} from '../actions/measurement.js';
import TaskBar from '../components/TaskBar';
import ButtonBar from '../components/widgets/ButtonBar';
import CopyButton from '../components/widgets/CopyButton';
import displayCrsSelector from '../selectors/displaycrs';
import LocaleUtils from '../utils/LocaleUtils';
import MeasureUtils from '../utils/MeasureUtils';

import './style/Measure.css';


/**
 * Allows measuring points/lines/areas on the map.
 */
class Measure extends React.Component {
    static propTypes = {
        changeMeasurementState: PropTypes.func,
        displaycrs: PropTypes.string,
        mapcrs: PropTypes.string,
        measureState: PropTypes.object,
        setSnappingConfig: PropTypes.func,
        /** Whether to show the widget to switch between measure modes. */
        showMeasureModeSwitcher: PropTypes.bool,
        /** Whether snapping is available when editing. */
        snapping: PropTypes.bool,
        /** Whether snapping is enabled by default when editing.
         *  Either `false`, `edge`, `vertex` or `true` (i.e. both vertex and edge). */
        snappingActive: PropTypes.oneOfType([PropTypes.bool, PropTypes.string])
    };
    static defaultProps = {
        showMeasureModeSwitcher: true,
        snapping: true,
        snappingActive: true
    };
    onShow = (mode) => {
        this.props.changeMeasurementState({geomType: mode || 'Point'});
        this.props.setSnappingConfig(this.props.snapping, this.props.snappingActive);
    };
    onHide = () => {
        this.props.changeMeasurementState({geomType: null});
    };
    setMeasureMode = (geomType) => {
        if (geomType !== this.props.measureState.geomType) {
            this.props.changeMeasurementState({geomType: geomType});
        }
    };
    changeLengthUnit = (ev) => {
        this.props.changeMeasurementState({...this.props.measureState, lenUnit: ev.target.value});
    };
    changeAreaUnit = (ev) => {
        this.props.changeMeasurementState({...this.props.measureState, areaUnit: ev.target.value});
    };
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
    };
    renderResult = () => {
        let resultBody = null;
        if (this.props.measureState.geomType === "Point") {
            const coo = this.props.measureState.coordinates || [0, 0];
            const text = MeasureUtils.getFormattedCoordinate(coo, this.props.mapcrs, this.props.displaycrs);
            resultBody = (
                <div className="measure-body">
                    <span className="measure-result">{text}</span>
                    <CopyButton buttonClass="copy-measure-button" text={text} />
                </div>
            );
        } else if (this.props.measureState.geomType === "LineString") {
            const length = this.props.measureState.length || 0;
            const text = MeasureUtils.formatMeasurement(length, false, this.props.measureState.lenUnit, this.props.measureState.decimals);
            resultBody = (
                <div className="measure-body">
                    <span className="measure-result">{text}</span>
                    <select onChange={this.changeLengthUnit} value={this.props.measureState.lenUnit}>
                        <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                        <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                        <option value="m">m</option>
                        <option value="km">km</option>
                        <option value="ft">ft</option>
                        <option value="mi">mi</option>
                    </select>
                    <CopyButton buttonClass="copy-measure-button" text={text} />
                </div>
            );
        } else if (this.props.measureState.geomType === "Polygon") {
            const area = this.props.measureState.area || 0;
            const text = MeasureUtils.formatMeasurement(area, true, this.props.measureState.areaUnit, this.props.measureState.decimals);
            resultBody = (
                <div className="measure-body">
                    <span className="measure-result">{text}</span>
                    <select onChange={this.changeAreaUnit} value={this.props.measureState.areaUnit}>
                        <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                        <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                        <option value="sqm">m&#178;</option>
                        <option value="ha">ha</option>
                        <option value="sqkm">km&#178;</option>
                        <option value="sqft">ft&#178;</option>
                        <option value="acre">acre</option>
                        <option value="sqmi">mi&#178;</option>
                    </select>
                    <CopyButton buttonClass="copy-measure-button" text={text} />
                </div>
            );
        } else if (this.props.measureState.geomType === "Bearing") {
            const text = MeasureUtils.getFormattedBearingValue(this.props.measureState.bearing);
            resultBody = (
                <div className="measure-body">
                    <span className="measure-result">{text}</span>
                    <CopyButton buttonClass="copy-measure-button" text={text} />
                </div>
            );
        }
        return resultBody;
    };
    renderBody = () => {
        return (
            <span>
                {this.renderModeSwitcher()}
                {this.renderResult()}
            </span>
        );
    };
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
    changeMeasurementState: changeMeasurementState,
    setSnappingConfig: setSnappingConfig
})(Measure);
