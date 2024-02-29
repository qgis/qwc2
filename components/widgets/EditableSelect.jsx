/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';
import InputContainer from '../InputContainer';

import './style/EditableSelect.css';

export default class EditableSelect extends React.Component {
    static propTypes = {
        onChange: PropTypes.func,
        onSubmit: PropTypes.func,
        options: PropTypes.array,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool
    };
    static defaultProps = {
        onSubmit: () => {}
    };
    state = {
        textValue: "",
        selectedOption: null,
        focused: false
    };
    render() {
        return (
            <div className="EditableSelect">
                <InputContainer className="editable-select-inputcontainer">
                    <input
                        onBlur={() => this.setState({focused: false})}
                        onChange={this.valueChanged}
                        onClick={() => this.setState({focused: true})}
                        onKeyPress={this.onKeyPress}
                        placeholder={this.state.selectedOption ? "" : this.props.placeholder}
                        readOnly={this.props.readOnly}
                        ref={el => { this.input = el; }}
                        role="input"
                        type="text"
                        value={this.state.textValue} />
                    <Icon icon="clear" onClick={this.clear} role="suffix" />
                </InputContainer>
                {this.state.selectedOption !== null ? this.renderSelectedOption() : null}
                {this.state.focused && !this.props.readOnly ? this.renderOptions() : null}
            </div>
        );
    }
    optionLabel = (option) => {
        return typeof option === 'string' ? option : option.label;
    };
    optionValue = (option) => {
        return typeof option === 'string' ? option : option.value;
    };
    renderOptions = () => {
        return (
            <div className="editable-select-dropdown">
                {this.props.options.map((option, idx) => {
                    const label = this.optionLabel(option);
                    if (this.state.textValue && !label.toLowerCase().startsWith(this.state.textValue.toLowerCase())) {
                        return null;
                    }
                    return (
                        <div key={"opt" + idx} onClick={() => this.optionSelected(option)} onMouseDown={MiscUtils.killEvent}>{this.optionLabel(option)}</div>
                    );
                })}
            </div>
        );
    };
    renderSelectedOption = () => {
        return (
            <div className="editable-select-selopt">
                <span>{this.optionLabel(this.state.selectedOption)}</span>
            </div>
        );
    };
    valueChanged = (ev) => {
        this.setState({textValue: ev.target.value, selectedOption: null});
        this.props.onChange(ev.target.value.trim());
    };
    optionSelected = (option) => {
        this.setState({textValue: "", selectedOption: option, focused: false});
        this.props.onChange(this.optionValue(option.value));
    };
    clear = () => {
        this.setState({textValue: "", selectedOption: null, focused: false});
        this.props.onChange("");
    };
    onKeyPress = (ev) => {
        if (!ev.target.readOnly && ev.key === 'Enter') {
            this.props.onSubmit();
        }
    };
}
