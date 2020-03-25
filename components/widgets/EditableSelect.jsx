/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const Icon = require('../Icon');

require('./style/EditableSelect.css');

class EditableSelect extends React.Component {
    static propTypes = {
        readOnly: PropTypes.bool,
        placeholder: PropTypes.string,
        options: PropTypes.array,
        onChange: PropTypes.func,
        onSubmit: PropTypes.func
    }
    static defaultProps = {
        onSubmit: () => {}
    }
    state = {
        textValue: "",
        selectedOption: null,
        focused: false
    }
    render() {
        return (
            <div className="EditableSelect">
                <div className="editable-select-inputcontainer">
                    <input type="text" value={this.state.textValue}
                        ref={el => this.input = el}
                        placeholder={this.state.selectedOption ? "" : this.props.placeholder}
                        readOnly={this.props.readOnly}
                        onChange={this.valueChanged}
                        onKeyPress={this.onKeyPress}
                        onClick={() => this.setState({focused: true})}
                        onBlur={() => this.setState({focused: false})} />
                    <Icon icon="clear" onClick={this.clear} />
                </div>
                {this.state.selectedOption !== null ? this.renderSelectedOption() : null}
                {this.state.focused && !this.props.readOnly ? this.renderOptions() : null}
            </div>
        );
    }
    optionLabel = (option) => {
        return typeof option === 'string' ? option : option.label;
    }
    optionValue = (option) => {
        return typeof option === 'string' ? option : option.value;
    }
    renderOptions = () => {
        return (
            <div className="editable-select-dropdown">
                {this.props.options.map((option ,idx) => {
                    let label = this.optionLabel(option);
                    if(this.state.textValue && !label.toLowerCase().startsWith(this.state.textValue.toLowerCase())) {
                        return null;
                    }
                    return (
                        <div key={"opt" + idx} onMouseDown={this.killEvent} onClick={() => this.optionSelected(option)}>{this.optionLabel(option)}</div>
                    );
                })}
            </div>
        );
    }
    renderSelectedOption = () => {
        return (
            <div className="editable-select-selopt">
                <span>{this.optionLabel(this.state.selectedOption)}</span>
            </div>
        );
    }
    valueChanged = (ev) => {
        this.setState({textValue: ev.target.value, selectedOption: null});
        this.props.onChange(ev.target.value.trim());
    }
    optionSelected = (option) => {
        this.setState({textValue: "", selectedOption: option, focused: false});
        this.props.onChange(this.optionValue(option.value));
    }
    clear = () => {
        this.setState({textValue: "", selectedOption: null, focused: false});
        this.props.onChange("");
    }
    onKeyPress = (ev) => {
        if(!ev.target.readOnly && ev.key === 'Enter') {
            this.props.onSubmit();
        }
    }
    killEvent = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
    }
}

module.exports = EditableSelect;
