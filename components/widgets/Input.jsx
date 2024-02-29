/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

class Input extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        disabled: PropTypes.bool,
        onChange: PropTypes.func,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        type: PropTypes.string,
        value: PropTypes.string
    };
    state = {
        value: "",
        curValue: "",
        changed: false
    };
    static getDerivedStateFromProps(nextProps, state) {
        if (state.value !== nextProps.value) {
            return {value: nextProps.value, curValue: nextProps.value || "", changed: false};
        }
        return null;
    }
    render() {
        return (
            <input className={this.props.className} disabled={this.props.disabled}
                onBlur={this.onBlur} onChange={this.onChange} onKeyDown={this.onKeyDown}
                readOnly={this.props.readOnly} required={this.props.required}
                type={this.props.type} value={this.state.curValue} />
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
        if (ev.keyCode === 13) {
            this.commit();
        }
    };
    commit = () => {
        if (this.state.changed) {
            this.setState((state) => ({value: state.curValue}));
            this.props.onChange(this.state.curValue);
        }
    };
}

export default Input;
