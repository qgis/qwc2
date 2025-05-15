/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import Icon from '../Icon';

import './style/NumberInput.css';


export default class NumberInput extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        decimals: PropTypes.number,
        disabled: PropTypes.bool,
        max: PropTypes.number,
        min: PropTypes.number,
        mobile: PropTypes.bool,
        name: PropTypes.string,
        onChange: PropTypes.func,
        placeholder: PropTypes.string,
        prefix: PropTypes.string,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        step: PropTypes.number,
        style: PropTypes.object,
        suffix: PropTypes.string,
        value: PropTypes.number
    };
    static defaultProps = {
        className: "",
        decimals: 0,
        mobile: false,
        prefix: "",
        suffix: ""
    };
    state = {
        propValue: "",
        value: "",
        changed: false,
        valid: false
    };
    static getDerivedStateFromProps(nextProps, state) {
        if (state.propValue !== nextProps.value) {
            return {propValue: nextProps.value, value: (typeof nextProps.value === "number") ? nextProps.value.toFixed(nextProps.decimals) : "", changed: false};
        }
        return null;
    }
    render() {
        const className = classNames({
            "number-input": true,
            "number-input-mobile": this.props.mobile,
            "number-input-normal": !this.props.mobile,
            "number-input-disabled": this.props.disabled || this.props.readOnly,
            "number-input-invalid": this.props.required && !this.state.value
        });
        const paddingLength = (this.props.mobile ? 4 : 1.5) + 'em';
        const prefixSuffixLength = (this.props.prefix.length + this.props.suffix.length) + 'ch';
        const numberLength = (2 + Math.max(
            (this.props.min || 0).toFixed(this.props.decimals).length,
            (this.props.max || 0).toFixed(this.props.decimals).length
        )) + "ch";
        const style = {
            minWidth: `calc(${paddingLength} + ${prefixSuffixLength} + ${numberLength})`
        };
        const step = this.props.step ?? Math.pow(10, -this.props.decimals);
        const plusIcon = this.props.mobile ? "plus" : "chevron-up";
        const minusIcon = this.props.mobile ? "minus" : "chevron-down";
        return (
            <div className={className + " " + this.props.className}>
                <input disabled={this.props.disabled}
                    onBlur={this.commit} onChange={this.onChange}
                    onFocus={this.setupSelectionListener}
                    onKeyDown={this.onKeyDown} placeholder={this.props.placeholder}
                    readOnly={this.props.readOnly} required={this.props.required}
                    style={style} type="text" value={this.props.prefix + this.state.value + this.props.suffix} />
                <input name={this.props.name} required={this.props.required} type="hidden" value={this.state.value} />
                <Icon icon={plusIcon} onMouseDown={() => this.startStep(+step)} />
                <Icon icon={minusIcon} onMouseDown={() => this.startStep(-step)} />
            </div>
        );
    }
    onChange = (ev) => {
        const len = ev.target.value.length;
        const value = ev.target.value.substring(this.props.prefix.length, len - this.props.suffix.length);
        this.setState({value: value, changed: true});
    };
    currentFloatValue = () => {
        const floatValue = parseFloat(this.state.value);
        return isNaN(floatValue) ? null : floatValue;
    };
    startStep = (delta) => {
        if (this.props.disabled || this.props.readOnly) {
            return;
        }
        this.props.onChange(this.constrainValue(this.currentFloatValue() + delta));
        let stepInterval = null;
        const stepTimeout = setTimeout(() => {
            stepInterval = setInterval(() => {
                this.props.onChange(this.constrainValue(this.currentFloatValue() + delta));
            }, 50);
        }, 500);
        document.addEventListener('mouseup', () => {
            clearTimeout(stepTimeout);
            clearInterval(stepInterval);
        }, {once: true});
    };
    onKeyDown = (ev) => {
        if (ev.key === 'Enter') {
            this.commit();
        }
        // Ensure prefix/suffix isn't changed
        const selStart = ev.target.selectionStart;
        const selEnd = ev.target.selectionEnd;
        const len = ev.target.value.length;
        const startOffset = ev.key === 'Backspace' && selStart === selEnd ? 1 : 0;
        const endOffset = ev.key === 'Delete' && selStart === selEnd ? 1 : 0;
        if (
            (selStart < this.props.prefix.length + startOffset) ||
            (selEnd > len - this.props.suffix.length - endOffset)
        ) {
            ev.preventDefault();
        }
    };
    commit = () => {
        if (this.state.changed) {
            const value = this.constrainValue(this.currentFloatValue());
            this.setState({value: value === null ? "" : value.toFixed(this.props.decimals)});
            this.props.onChange(value);
        }
    };
    constrainValue = (value) => {
        if (value === null) {
            return null;
        }
        if (this.props.min !== undefined) {
            value = Math.max(this.props.min, value);
        }
        if (this.props.max !== undefined) {
            value = Math.min(this.props.max, value);
        }
        const k = Math.pow(10, this.props.decimals);
        return Math.round(value * k) / k;
    };
    setupSelectionListener = (event) => {
        const input = event.target;
        const selectionHandler = (ev) => {
            if (ev.target === input) {
                // Ensure prefix/suffix isn't selected
                const len = input.value.length;
                const prefixLen = this.props.prefix.length;
                const suffixLen = this.props.suffix.length;
                const selStart = Math.min(Math.max(input.selectionStart, prefixLen), len - suffixLen);
                const selEnd = Math.max(Math.min(input.selectionEnd, len - suffixLen), prefixLen);
                if (selStart !== input.selectionStart || selEnd !== input.selectionEnd) {
                    input.setSelectionRange(selStart, selEnd);
                }
            }
        };
        document.addEventListener("selectionchange", selectionHandler);
        input.addEventListener("blur", () => {
            document.removeEventListener("selectionchange", selectionHandler);
        }, {once: true});
    };
}
