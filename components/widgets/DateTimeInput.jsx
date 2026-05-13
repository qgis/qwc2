/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import InputContainer from './InputContainer';

import './style/DateTimeInput.css';


export default class DateTimeInput extends React.Component {
    static propTypes = {
        maxDate: PropTypes.string,
        minDate: PropTypes.string,
        name: PropTypes.string,
        onChange: PropTypes.func,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        style: PropTypes.object,
        value: PropTypes.string,
        valueHasTz: PropTypes.bool
    };
    render() {
        const date = new Date(this.props.valueHasTz ? this.props.value : this.props.value.slice(0, 19));
        let datestr = "";
        let timestr = "";
        if (!Number.isNaN(date.getTime())) {
            const pad = n => String(n).padStart(2, "0");
            datestr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
            timestr = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        }
        return (
            <InputContainer className="DateTimeInput">
                <input
                    max={this.props.maxDate} min={this.props.minDate}
                    onChange={ev => this.valueChanged(ev.target.value, timestr)}
                    readOnly={this.props.readOnly} required={this.props.required} role="input"
                    style={this.props.style} type="date" value={datestr} />
                <input
                    onChange={ev => this.valueChanged(datestr, ev.target.value)}
                    readOnly={this.props.readOnly} required={this.props.required}
                    role="input" step="1" style={{...this.props.style, maxWidth: '8em'}} type="time" value={timestr} />
                <input name={this.props.name} role="input" type="hidden" value={this.props.value} />
            </InputContainer>
        );
    }
    valueChanged = (datestr, timestr) => {
        const date = new Date();
        if (datestr) {
            const [year, month, day] = datestr.split("-").map(Number);
            date.setFullYear(year);
            date.setMonth(month - 1);
            date.setDate(day);
        }
        if (timestr) {
            timestr = timestr + ":00:00";
            const [hours, minutes, seconds] = timestr.split(":").slice(0, 3).map(Number);
            date.setHours(hours);
            date.setMinutes(minutes);
            date.setSeconds(seconds);
        } else {
            date.setHours(0);
            date.setMinutes(0);
            date.setSeconds(0);
        }
        if (datestr || timestr) {
            if (this.props.valueHasTz) {
                this.props.onChange(date.toISOString());
            } else {
                const pad = n => String(n).padStart(2, "0");
                this.props.onChange(
                    date.getFullYear() +
                    "-" + pad(date.getMonth() + 1) +
                    "-" + pad(date.getDate()) +
                    "T" + pad(date.getHours()) +
                    ":" + pad(date.getMinutes()) +
                    ":" + pad(date.getSeconds())
                );
            }
        } else {
            this.props.onChange("");
        }
    };
}
