/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const NumericInput = require('react-numeric-input2');
const Icon = require("./Icon");
const ToggleSwitch = require('./widgets/ToggleSwitch');
const ConfigUtils = require('../utils/ConfigUtils');
const LocaleUtils = require("../utils/LocaleUtils");
require('./style/AutoEditForm.css');

class AutoEditForm extends React.Component {
    static propTypes = {
        editLayerId: PropTypes.string,
        fields: PropTypes.array,
        touchFriendly: PropTypes.bool,
        updateField: PropTypes.func,
        values: PropTypes.object
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
        const constraints = field.constraints || {};
        let value = (this.props.values || {})[field.id] || "";
        let input = null;
        let title = field.name + ":";
        if (field.type === "boolean" || field.type === "bool") {
            if (this.props.touchFriendly) {
                const boolvalue = value === "1" || value === "on" || value === "true" || value === true;
                input = (
                    <ToggleSwitch name={field.id} {...constraints} active={boolvalue} onChange={active => this.props.updateField(field.id, active)} />
                );
            } else {
                title = (
                    <label>
                        <input name={field.id} {...constraints} checked={value} onChange={ev => this.props.updateField(field.id, ev.target.checked)} type="checkbox" />
                        {field.name}
                    </label>
                );
            }
        } else if (constraints.values) {
            input = (
                <span className="input-frame">
                    <select disabled={constraints.readOnly} name={field.id}
                        onChange={ev => this.props.updateField(field.id, ev.target.value)}
                        required={constraints.required} value={value}
                    >
                        <option disabled value="">
                            {LocaleUtils.getMessageById(this.context.messages, "editing.select")}
                        </option>
                        {constraints.values.map((item, index) => {
                            let optValue = "";
                            let label = "";
                            if (typeof(item) === 'string') {
                                optValue = label = item;
                            } else {
                                optValue = item.value;
                                label = item.label;
                            }
                            return (
                                <option key={field.id + index} value={optValue}>{label}</option>
                            );
                        })}
                    </select>
                </span>
            );
        } else if (field.type === "number") {
            const precision = constraints.step > 0 ? Math.ceil(-Math.log10(constraints.step)) : 6;
            input = (
                <NumericInput format={nr => String(Number(nr))} max={constraints.max} min={constraints.min}
                    mobile={this.props.touchFriendly} name={field.id} onChange={nr => this.props.updateField(field.id, nr)}
                    precision={precision} readOnly={constraints.readOnly} required={constraints.required}
                    step={constraints.step || 1}
                    strict value={value} />
            );
        } else if (field.type === "date") {
            // Truncate time portion of ISO date string
            value = value.substr(0, 10);
            input = (
                <span className="input-frame">
                    <input name={field.id} type={field.type} {...constraints}
                        onChange={(ev) => {
                            // set empty date field value to null instead of empty string
                            this.props.updateField(field.id, ev.target.value === '' ? null : ev.target.value);
                        }}
                        value={value} />
                </span>
            );
        } else if (field.type === "text") {
            input = (
                <textarea name={field.id} value={value} {...constraints} onChange={(ev) => this.props.updateField(field.id, ev.target.value)} />
            );
        } else if (field.type === "file") {
            const fileValue = value.replace(/attachment:\/\//, '');
            const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl");

            input = fileValue ? (
                <span className="upload-file-field">
                    <a href={editServiceUrl + "/" + this.props.editLayerId + "/attachment?file=" + encodeURIComponent(fileValue)}
                        rel="noreferrer" target="_blank"
                    >
                        {fileValue.replace(/.*\//, '')}
                    </a>
                    <Icon icon="clear" onClick={() => this.props.updateField(field.id, '')} />
                </span>
            ) : (
                <input name={field.id} type="file" {...constraints} onChange={() => this.props.updateField(field.id, '')} />
            );
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
                <td colSpan={input ? 1 : 2} title={field.name}>{title}</td>
                {input ? (<td>{input}</td>) : null}
            </tr>
        );
    }
}

module.exports = AutoEditForm;
