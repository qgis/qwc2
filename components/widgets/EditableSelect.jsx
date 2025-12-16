/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classNames from 'classnames';
import isEmpty from 'lodash.isempty';
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
        manualInput: false,
        selectedOption: null,
        focused: false,
        popup: false
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
                manualInput: false,
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
    componentDidUpdate(prevProps, prevState) {
        if (this.state.value !== prevState.value && !this.state.manualInput && document.activeElement === this.el) {
            this.el.select();
        } else if (!this.state.value && this.state.manualInput) {
            this.setState({manualInput: false, popup: true});
        }
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
                        onFocus={this.onFocus}
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
                {this.el && this.state.popup && !this.props.readOnly ? this.renderOptions() : null}
            </div>
        );
    }
    renderOptions = () => {
        const lvalue = this.state.value.toLowerCase();
        const options = this.props.options.map((option, idx) => {
            const label = EditableSelect.optionLabel(option);
            if (this.state.manualInput && lvalue && !label.toLowerCase().includes(lvalue)) {
                return null;
            }
            return (
                <div key={"opt" + idx} onClick={() => this.optionSelected(option)} onMouseDown={MiscUtils.killEvent} title={label}>{label}</div>
            );
        }).filter(Boolean);
        return !isEmpty(options) ? (
            <PopupMenu anchor={this.el} className="editable-select-dropdown" onClose={() => this.setState({popup: false})} spaceKeyActivation={false}>
                {options}
            </PopupMenu>
        ) : null;
    };
    renderSelectedOption = () => {
        const label = EditableSelect.optionLabel(this.state.selectedOption);
        return (
            <div className="editable-select-selopt" onClick={() => this.setState({popup: true})} title={label}>
                {label}
            </div>
        );
    };
    valueChanged = (ev) => {
        this.setState({value: ev.target.value, selectedOption: null, manualInput: true});
    };
    optionSelected = (option) => {
        const value = EditableSelect.optionValue(option);
        this.props.onChange(value);
        this.setState({selectedOption: option, popup: false, value: value});
    };
    clear = () => {
        if (!this.props.readOnly) {
            this.props.onChange("");
        }
    };
    onClick = (ev) => {
        if (!this.state.manualInput) {
            ev.target.select();
            this.setState({popup: true});
        }
    };
    onFocus = (ev) => {
        ev.target.select();
        this.setState({focused: true, manualInput: false});
    };
    onBlur = () => {
        if (!this.props.readOnly) {
            this.props.onChange(this.state.value.trim());
            this.setState({focused: false});
        }
    };
    onKeyDown = (ev) => {
        if (!this.props.readOnly && ev.key === 'Enter') {
            this.props.onChange(this.state.value.trim());
            MiscUtils.killEvent(ev);
            if (this.props.onSubmit) {
                this.props.onSubmit(this.state.value.trim());
            }
        }
    };
}
