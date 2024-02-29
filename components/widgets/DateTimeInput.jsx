/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import InputContainer from '../InputContainer';

export default class DateTimeInput extends React.Component {
    static propTypes = {
        maxDate: PropTypes.string,
        minDate: PropTypes.string,
        name: PropTypes.string,
        onChange: PropTypes.func,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        style: PropTypes.object,
        value: PropTypes.string
    };
    render() {
        const parts = (this.props.value || "T").split("T");
        parts[1] = (parts[1] || "").replace(/\.\d+$/, ''); // Strip milliseconds
        return (
            <InputContainer>
                <input
                    max={this.props.maxDate} min={this.props.minDate}
                    onChange={ev => this.valueChanged(ev.target.value, parts[1])}
                    readOnly={this.props.readOnly} required={this.props.required} role="input"
                    style={this.props.style} type="date" value={parts[0]} />
                <input
                    disabled={!parts[0]}
                    onChange={ev => this.valueChanged(parts[0], ev.target.value)}
                    readOnly={this.props.readOnly} required={this.props.required}
                    role="input" step="1" style={{...this.props.style, maxWidth: '8em'}} type="time" value={parts[1]} />
                <input name={this.props.name} role="input" type="hidden" value={this.props.value} />
            </InputContainer>
        );
    }
    valueChanged = (date, time) => {
        if (time && time.length === 5) {
            time += ":00";
        }
        if (date && time) {
            this.props.onChange(date + "T" + time);
        } else if (date) {
            this.props.onChange(date);
        } else {
            this.props.onChange("");
        }
    };
}
