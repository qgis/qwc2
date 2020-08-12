/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const NumericInput = require('react-numeric-input');
const Icon = require("./Icon");
const ToggleSwitch = require('./widgets/ToggleSwitch');
const ConfigUtils = require('../utils/ConfigUtils');
const LocaleUtils = require("../utils/LocaleUtils");
require('./style/AutoEditForm.css');

class AutoEditForm extends(React.Component) {
    static propTypes = {
        fields: PropTypes.array,
        values: PropTypes.object,
        touchFriendly: PropTypes.bool,
        updateField: PropTypes.func,
        editLayerId: PropTypes.string
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        return (
            <table className="AutoEditForm">
                <tbody>
                    {(this.props.fields || []).map(field => this.renderField(field))}
                </tbody>
            </table>
        );
    }
    renderField = (field) => {
        let constraints = field.constraints || {};
        let value = (this.props.values || {})[field.id] || "";
        let input = null;
        let title = field.name + ":";
        if(field.type == "boolean" || field.type == "bool") {
            if(this.props.touchFriendly) {
                let boolvalue = value == "1" || value == "on" || value == "true" || value === true;
                input = (
                    <ToggleSwitch name={field.id} {...constraints} active={boolvalue} onChange={active => this.props.updateField(field.id, active)} />
                );
            } else {
                title = (
                    <label>
                        <input name={field.id} {...constraints} type="checkbox" checked={value} onChange={ev => this.props.updateField(field.id, ev.target.checked)} />
                        {field.name}
                    </label>
                );
            }
        }
        else if(constraints.values) {
            input = (
                <span className="input-frame">
                    <select name={field.id} value={value} onChange={ev => this.props.updateField(field.id, ev.target.value)} required={constraints.required} disabled={constraints.readOnly}>
                        <option value="" disabled>{LocaleUtils.getMessageById(this.context.messages, "editing.select")}</option>
                        {constraints.values.map((item,index) => {
                            let value = "", label = "";
                            if(typeof(item) === 'string') {
                                value = label = item;
                            } else {
                                value = item.value;
                                label = item.label;
                            }
                            return (
                                <option key={field.id + index} value={value}>{label}</option>
                            );
                        })}
                    </select>
                </span>
            );
        } else if(field.type == "number") {
            let precision = constraints.step > 0 ? Math.ceil(-Math.log10(constraints.step)) : 6;
            input = (
                <NumericInput name={field.id} mobile={this.props.touchFriendly} strict
                    min={constraints.min} max={constraints.max} readOnly={constraints.readOnly}
                    step={constraints.step || 1} precision={precision} required={constraints.required}
                    format={nr => String(Number(nr))}
                    value={value} onChange={nr => this.props.updateField(field.id, nr)} />
            );
        } else if(field.type == "date") {
            // Truncate time portion of ISO date string
            value = value.substr(0, 10);
            input = (
                <span className="input-frame">
                    <input name={field.id} type={field.type} {...constraints}
                        onChange={(ev) => {
                            // set empty date field value to null instead of empty string
                            this.props.updateField(field.id, ev.target.value == '' ? null : ev.target.value);
                        }}
                        value={value}/>
                </span>
            );
        } else if(field.type == "text") {
            input = (
                <textarea name={field.id} value={value} {...constraints} onChange={(ev) => this.props.updateField(field.id, ev.target.value)}></textarea>
            );
        } else if(field.type == "file") {
            let fileValue = value.replace(/attachment:\/\//, '');
            let editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl");

            input = fileValue ? (
                <span className="upload-file-field">
                    <a target="_blank" href={editServiceUrl + "/" + this.props.editLayerId + "/attachment?file=" + encodeURIComponent(fileValue)}>{fileValue.replace(/.*\//, '')}</a>
                    <Icon icon="clear" onClick={ev => this.props.updateField(field.id, '')} />
                </span>
            ) : (<input name={field.id} type="file" onChange={ev => this.props.updateField(field.id, '')} />);
        } else {
            input = (
                <span className="input-frame">
                    <input name={field.id} type={field.type} {...constraints}
                        onChange={(ev) => this.props.updateField(field.id, ev.target.value)}
                        value={value}/>
                </span>
            );
        }
        return (
            <tr key={field.id}>
                <td title={field.name} colSpan={input ? 1 : 2}>{title}</td>
                {input ? (<td>{input}</td>) : null}
            </tr>
        );
    }
}

module.exports = AutoEditForm;
