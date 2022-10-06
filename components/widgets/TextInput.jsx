/**
 * Copyright 2022 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';

class TextInput extends React.Component {
    static propTypes = {
        disabled: PropTypes.bool,
        immediateUpdate: PropTypes.bool,
        multiline: PropTypes.bool,
        name: PropTypes.string,
        onChange: PropTypes.func,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        style: PropTypes.object,
        value: PropTypes.string
    }
    state = {
        value: "",
        curValue: "",
        changed: false
    }
    constructor(props) {
        super(props);
        this.skipNextCommitOnBlur = false;
    }
    static getDerivedStateFromProps(nextProps, state) {
        if (state.value !== nextProps.value) {
            return {value: nextProps.value, curValue: nextProps.value || "", changed: false};
        }
        return null;
    }
    render() {
        if (this.props.multiline) {
            return (
                <textarea disabled={this.props.disabled} name={this.props.name}
                    onBlur={this.onBlur} onChange={this.onChange} onKeyDown={this.onKeyDown}
                    placeholder={this.props.placeholder}
                    readOnly={this.props.readOnly} style={this.props.style}
                    value={this.state.curValue} />
            );
        } else {
            return (
                <input disabled={this.props.disabled} name={this.props.name}
                    onBlur={this.onBlur} onChange={this.onChange} onKeyDown={this.onKeyDown}
                    placeholder={this.props.placeholder}
                    readOnly={this.props.readOnly} style={this.props.style}
                    type="text" value={this.state.curValue} />
            );
        }
    }
    onChange = (ev) => {
        this.setState({curValue: ev.target.value, changed: true});
        if (this.props.immediateUpdate) {
            this.props.onChange(ev.target.value);
        }
    }
    onBlur = () => {
        if (this.skipNextCommitOnBlur) {
            this.skipNextCommitOnBlur = false;
        } else {
            this.commit();
        }
    }
    onKeyDown = (ev) => {
        if (!this.props.multiline && ev.keyCode === 13) { // Enter
            this.commit();
        } else if (ev.keyCode === 27) { // Esc
            this.setState({value: this.props.value, curValue: this.props.value || "", changed: false});
            this.skipNextCommitOnBlur = true;
            ev.target.blur();
        }
    }
    commit = () => {
        if (this.state.changed) {
            this.props.onChange(this.state.curValue);
        }
    }
}

export default TextInput;
