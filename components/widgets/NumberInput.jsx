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
        style: PropTypes.object,
        suffix: PropTypes.string,
        value: PropTypes.number
    };
    static defaultProps = {
        decimals: 0,
        mobile: false
    };
    state = {
        propValue: "",
        value: "",
        changed: false
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
            "number-input-normal": !this.props.mobile
        });
        const padding = this.props.mobile ? 4 : 1.5;
        const style = {
            minWidth: 2 + padding + Math.max(
                (this.props.min || 0).toFixed(this.props.decimals).length,
                (this.props.max || 0).toFixed(this.props.decimals).length
            ) + "em",
            ...this.props.style
        };
        const step = Math.pow(10, -this.props.decimals);
        const plusIcon = this.props.mobile ? "plus" : "chevron-up";
        const minusIcon = this.props.mobile ? "minus" : "chevron-down";
        return (
            <div className={className + " " + this.props.className}>
                <input disabled={this.props.disabled}
                    max={this.props.max} min={this.props.min} name={this.props.name}
                    onBlur={this.commit} onChange={this.onChange}
                    onKeyDown={this.onKeyDown} placeholder={this.props.placeholder}
                    readOnly={this.props.readOnly} required={this.props.required} step={step}
                    style={style} type="number" value={this.state.value} />
                <Icon icon={plusIcon} onMouseDown={() => this.startStep(+step)} />
                <Icon icon={minusIcon} onMouseDown={() => this.startStep(-step)} />
            </div>
        );
    }
    onChange = (ev) => {
        const value = parseFloat(ev.target.value);
        if (!Number.isNaN(value)) {
            this.setState({value: value.toFixed(this.props.decimals), changed: true});
        } else {
            this.setState({value: "", changed: true});
        }
    };
    startStep = (delta) => {
        this.props.onChange(this.constrainValue((parseFloat(this.state.value) || 0) + delta));
        let stepInterval = null;
        const stepTimeout = setTimeout(() => {
            stepInterval = setInterval(() => {
                this.props.onChange(this.constrainValue((parseFloat(this.state.value) || 0) + delta));
            }, 100);
        }, 500);
        document.addEventListener('mouseup', () => {
            clearTimeout(stepTimeout);
            clearInterval(stepInterval);
        }, {once: true});
    };
    onKeyDown = (ev) => {
        if (ev.keyCode === 13) {
            this.commit();
        }
    };
    commit = () => {
        if (this.state.changed) {
            const value = parseFloat(this.state.value);
            this.props.onChange(this.constrainValue(isNaN(value) ? null : value));
        }
    };
    constrainValue = (value) => {
        if (value === null) {
            return null;
        }
        if (this.props.min) {
            value = Math.max(this.props.min, value);
        }
        if (this.props.max) {
            value = Math.min(this.props.max, value);
        }
        return value;
    };
}
