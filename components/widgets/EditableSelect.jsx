/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';
import InputContainer from './InputContainer';
import PopupMenu from './PopupMenu';

import './style/EditableSelect.css';

export default class EditableSelect extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        name: PropTypes.string,
        onChange: PropTypes.func,
        onSubmit: PropTypes.func,
        options: PropTypes.array,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };
    state = {
        propValue: "",
        value: "",
        changed: false,
        selectedOption: null,
        focused: false
    };
    constructor(props) {
        super(props);
        this.el = null;
    }
    static getDerivedStateFromProps(nextProps, state) {
        if (state.focused) {
            // No changes while focussed
            return null;
        }
        const value = String(nextProps.value ?? "");
        if (value !== state.propValue) {
            const selectedOption = nextProps.options.find(option => EditableSelect.optionValue(option) === value) ?? null;
            return {
                propValue: value,
                value: value,
                changed: false,
                selectedOption: selectedOption
            };
        }
        return null;
    }
    static optionLabel(option) {
        return typeof option === 'object' ? option.label : String(option);
    }
    static optionValue(option) {
        return typeof option === 'object' ? option.value : String(option);
    }
    render() {
        const classes = classNames({
            EditableSelect: true,
            [this.props.className]: true
        });
        return (
            <div className={classes}>
                <InputContainer className="editable-select-inputcontainer">
                    <input
                        autoComplete="off"
                        name={this.props.name}
                        onBlur={this.onBlur}
                        onChange={this.valueChanged}
                        onClick={this.onClick}
                        onKeyDown={this.onKeyDown}
                        placeholder={this.props.placeholder}
                        readOnly={this.props.readOnly}
                        ref={el => { this.el = el; }}
                        role="input"
                        type="text"
                        value={this.state.value} />
                    <Icon icon="clear" onClick={this.clear} role="suffix" />
                </InputContainer>
                {this.state.selectedOption ? this.renderSelectedOption() : null}
                {this.el && this.state.focused && !this.props.readOnly ? this.renderOptions() : null}
            </div>
        );
    }
    renderOptions = () => {
        const rect = this.el.getBoundingClientRect();
        const lvalue = this.state.value.toLowerCase();
        return (
            <PopupMenu className="editable-select-dropdown" onClose={() => this.setState({focused: false})} width={rect.width} x={rect.left} y={rect.bottom}>
                {this.props.options.map((option, idx) => {
                    const label = EditableSelect.optionLabel(option);
                    if (this.state.changed && lvalue && !label.toLowerCase().startsWith(lvalue)) {
                        return null;
                    }
                    return (
                        <div key={"opt" + idx} onClickCapture={() => this.optionSelected(option)} onMouseDown={MiscUtils.killEvent} title={label}>{label}</div>
                    );
                })}
            </PopupMenu>
        );
    };
    renderSelectedOption = () => {
        const label = EditableSelect.optionLabel(this.state.selectedOption);
        return (
            <div className="editable-select-selopt" title={label}>
                {label}
            </div>
        );
    };
    valueChanged = (ev) => {
        this.setState({value: ev.target.value, selectedOption: null, changed: true});
    };
    optionSelected = (option) => {
        const value = EditableSelect.optionValue(option);
        this.props.onChange(value);
        this.setState({selectedOption: option, focused: false, value: value});
    };
    clear = () => {
        if (!this.props.readOnly) {
            this.props.onChange("");
        }
    };
    onClick = (ev) => {
        ev.target.select();
        this.setState({focused: true});
    };
    onBlur = () => {
        if (!this.props.readOnly) {
            this.props.onChange(this.state.value.trim());
            this.setState({focused: false, changed: false});
        }
    };
    onKeyDown = (ev) => {
        if (!this.props.readOnly && ev.key === 'Enter') {
            this.props.onChange(this.state.value.trim());
            this.setState({changed: false});
            MiscUtils.killEvent(ev);
            if (this.props.onSubmit) {
                this.props.onSubmit(this.state.value.trim());
            }
        }
    };
}
