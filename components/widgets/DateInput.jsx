/**
 * Copyright 2022 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';

class DateInput extends React.Component {
    static propTypes = {
        disabled: PropTypes.bool,
        onChange: PropTypes.func,
        readOnly: PropTypes.bool,
        value: PropTypes.string
    }
    state = {
        value: "",
        curValue: "",
        changed: false
    }
    static getDerivedStateFromProps(nextProps, state) {
        if (state.value !== nextProps.value) {
            return {value: nextProps.value, curValue: nextProps.value || "", changed: false};
        }
        return null;
    }
    render() {
        return (
            <input disabled={this.props.disabled} onBlur={this.onBlur}
                onChange={this.onChange} onKeyDown={this.onKeyDown}
                readOnly={this.props.readOnly} type="date"
                value={this.state.curValue} />
        );
    }
    onChange = (ev) => {
        this.setState({curValue: ev.target.value, changed: true});
    }
    onBlur = () => {
        this.commit();
    }
    onKeyDown = (ev) => {
        if (ev.keyCode === 13) {
            this.commit();
        }
    }
    commit = () => {
        if (this.state.changed) {
            this.props.onChange(this.state.curValue);
        }
    }
}

export default DateInput;
