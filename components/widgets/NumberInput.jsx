/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

export default class NumberInput extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        decimals: PropTypes.number,
        disabled: PropTypes.bool,
        max: PropTypes.number,
        min: PropTypes.number,
        name: PropTypes.string,
        onChange: PropTypes.func,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        style: PropTypes.object,
        value: PropTypes.number
    };
    state = {
        value: "",
        curValue: "",
        changed: false
    };
    static getDerivedStateFromProps(nextProps, state) {
        if (state.value !== nextProps.value) {
            return {value: nextProps.value, curValue: (typeof nextProps.value === "number") ? nextProps.value.toFixed(nextProps.decimals) : "", changed: false};
        }
        return null;
    }
    constructor(props) {
        super(props);
        this.focused = false;
    }
    render() {
        const step = Math.pow(10, -this.props.decimals || 0);
        return (
            <input className={this.props.className} disabled={this.props.disabled}
                max={this.props.max} min={this.props.min} name={this.props.name}
                onBlur={this.onBlur} onChange={this.onChange} onFocus={this.onFocus}
                onKeyDown={this.onKeyDown} placeholder={this.props.placeholder}
                readOnly={this.props.readOnly} required={this.props.required} step={step}
                style={this.props.style} type="number" value={this.state.curValue} />
        );
    }
    onChange = (ev) => {
        const value = parseFloat(ev.target.value);
        if (!this.focused) {
            this.props.onChange(Number.isNaN(value) ? null : value);
        } else if (!Number.isNaN(value)) {
            const factor = Math.pow(10, this.props.decimals || 0);
            this.setState({curValue: Math.round(value * factor) / factor, changed: true});
        } else {
            this.setState({curValue: "", changed: true});
        }
    };
    onFocus = () => {
        this.focused = true;
    };
    onBlur = () => {
        this.commit();
        this.focused = false;
    };
    onKeyDown = (ev) => {
        if (ev.keyCode === 13) {
            this.commit();
        }
    };
    commit = () => {
        if (this.state.changed) {
            this.props.onChange(this.state.curValue === "" ? null : this.state.curValue);
        }
    };
}
