import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';

import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MeasureUtils from '../utils/MeasureUtils';
import Icon from './Icon';
import {BottomToolPortalContext} from './PluginsContainer';
import NumberInput from './widgets/NumberInput';

import './style/SegmentInput.css';

const DefaultUnit = {metric: 'm', imperial: 'ft'};

export default class SegmentInput extends React.Component {
    static contextType = BottomToolPortalContext;
    static propTypes = {
        constraintInteraction: PropTypes.object,
        lenUnit: PropTypes.string
    };
    state = {
        enabled: false,
        distance: null,
        unit: DefaultUnit[this.props.lenUnit] ?? this.props.lenUnit ?? 'm'
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.props.constraintInteraction !== prevProps.constraintInteraction || this.state !== prevState) {
            const {enabled, distance, unit} = this.state;
            this.props.constraintInteraction.setDistance(
                enabled && distance !== null ? MeasureUtils.convertLength(distance, unit, 'm') : null
            );
        }
    }
    render() {
        const decimals = ConfigUtils.getConfigProp("measurementPrecision", null, 2);
        const label = LocaleUtils.tr("redlining.segmentdistance");
        return ReactDOM.createPortal((
            <div className="segment-input">
                <span className="segment-input-label">{label}</span>
                <div className="controlgroup">
                    <button className={"button" + (this.state.enabled ? " pressed" : "")} onClick={this.toggle} title={label}>
                        <Icon icon="measure_line" />
                    </button>
                    {this.state.enabled ? (
                        <NumberInput decimals={decimals} max={99999} min={Math.pow(10, -decimals)} onChange={distance => this.setState({distance})} value={this.state.distance} />
                    ) : null}
                    {this.state.enabled ? (
                        <select onChange={ev => this.setState({unit: ev.target.value})} value={this.state.unit}>
                            <option value="m">m</option>
                            <option value="ft">ft</option>
                            <option value="km">km</option>
                            <option value="mi">mi</option>
                        </select>
                    ) : null}
                </div>
            </div>
        ), this.context);
    }
    toggle = () => {
        this.setState(state => ({enabled: !state.enabled}));
    };
}
