/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

export default class Input extends React.Component {
    static propTypes = {
        allowEmpty: PropTypes.bool,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        max: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        min: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        onChange: PropTypes.func,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        step: PropTypes.number,
        type: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };
    static defaultProps = {
        allowEmpty: true
    };
    state = {
        value: "",
        curValue: "",
        changed: false
    };
    static getDerivedStateFromProps(nextProps, state) {
        const strValue = String(nextProps.value || "");
        if (state.value !== strValue) {
            return {value: strValue, curValue: strValue, changed: false};
        }
        return null;
    }
    render() {
        return (
            <input className={this.props.className} disabled={this.props.disabled}
                max={this.props.max} min={this.props.min}
                onBlur={this.onBlur} onChange={this.onChange} onKeyDown={this.onKeyDown}
                onMouseUp={this.onMouseUp} readOnly={this.props.readOnly} required={this.props.required}
                step={this.props.step} type={this.props.type} value={this.state.curValue} />
        );
    }
    onChange = (ev) => {
        this.setState({curValue: ev.target.value, changed: true});
        if (document.activeElement !== ev.target) {
            this.setState({value: ev.target.value});
            this.props.onChange(ev.target.value);
        }
    };
    onBlur = () => {
        this.commit();
    };
    onKeyDown = (ev) => {
        if (ev.key === 'Enter') {
            this.commit();
        }
    };
    onMouseUp = (ev) => {
        if (this.props.type === "range") {
            this.commit();
        }
    };
    commit = () => {
        if (this.state.changed) {
            this.setState(state => {
                const newValue = state.curValue === "" && !this.props.allowEmpty ? this.props.value : state.curValue;
                this.props.onChange(newValue);
                return {value: newValue, curValue: newValue, changed: false};
            });
        }
    };
}
