/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from "react";

import PropTypes from "prop-types";

import LocaleUtils from "../utils/LocaleUtils";
import Icon from "./Icon";


export default class MeasureSwitcher extends React.PureComponent {
    static propTypes = {
        changeMeasureState: PropTypes.func,
        className: PropTypes.string,
        geomType: PropTypes.string,
        iconSize: PropTypes.string,
        measureState: PropTypes.shape({
            showmeasurements: PropTypes.bool,
            lenUnit: PropTypes.string,
            areaUnit: PropTypes.string
        })
    };
    render() {
        const style = {
            width: 'fit-content'
        };
        return (
            <div className={"controlgroup " + (this.props.className ?? "")}>
                <button className={"button" + (this.props.measureState.showmeasurements ? " pressed" : "")} onClick={() => this.props.changeMeasureState({showmeasurements: !this.props.measureState.showmeasurements})} title={LocaleUtils.tr("measureComponent.showmeasurements")}>
                    <Icon icon="measure" size={this.props.iconSize} />
                </button>
                {this.props.measureState.showmeasurements && ['LineString', 'Circle'].includes(this.props.geomType) ? (
                    <select className="controlgroup-fillitem" onChange={ev => this.props.changeMeasureState({lenUnit: ev.target.value})} style={style} value={this.props.measureState.lenUnit }>
                        <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                        <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                        <option value="m">m</option>
                        <option value="km">km</option>
                        <option value="ft">ft</option>
                        <option value="mi">mi</option>
                    </select>
                ) : null}
                {this.props.measureState.showmeasurements && ['Polygon', 'Ellipse', 'Square', 'Box'].includes(this.props.geomType) ? (
                    <select className="controlgroup-fillitem" onChange={ev => this.props.changeMeasureState({areaUnit: ev.target.value})} style={style} value={this.props.measureState.areaUnit}>
                        <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                        <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                        <option value="sqm">m&#178;</option>
                        <option value="ha">ha</option>
                        <option value="sqkm">km&#178;</option>
                        <option value="sqft">ft&#178;</option>
                        <option value="acre">acre</option>
                        <option value="sqmi">mi&#178;</option>
                    </select>
                ) : null}
            </div>
        );
    }
}
