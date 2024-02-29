/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import NumericInput from 'react-numeric-input2';

import omit from 'lodash.omit';
import PropTypes from 'prop-types';

import EditComboField from './EditComboField';
import EditUploadField from './EditUploadField';
import ToggleSwitch from './widgets/ToggleSwitch';

import './style/AutoEditForm.css';

export default class AutoEditForm extends React.Component {
    static propTypes = {
        editLayerId: PropTypes.string,
        fields: PropTypes.array,
        iface: PropTypes.object,
        readOnly: PropTypes.bool,
        touchFriendly: PropTypes.bool,
        updateField: PropTypes.func,
        values: PropTypes.object
    };
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
        const multiline = (field.constraints || {}).multiline;
        const constraints = omit(field.constraints || {}, ["multiline"]);
        const readOnly = this.props.readOnly || constraints.readOnly;
        let value = (this.props.values || {})[field.id];
        if (value === undefined || value === null) {
            value = "";
        }
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
        } else if (constraints.values || constraints.keyvalrel) {
            input = (
                <span className="input-frame">
                    <EditComboField
                        editIface={this.props.iface} fieldId={field.id} keyvalrel={constraints.keyvalrel}
                        name={field.id} readOnly={readOnly} required={constraints.required}
                        updateField={this.props.updateField} value={value} values={constraints.values} />
                </span>
            );
        } else if (field.type === "number") {
            const precision = constraints.step > 0 ? Math.ceil(-Math.log10(constraints.step)) : 6;
            input = (
                <NumericInput format={nr => String(Number(nr))} max={constraints.max} min={constraints.min}
                    mobile={this.props.touchFriendly} name={field.id} onChange={nr => this.props.updateField(field.id, nr)}
                    precision={precision} readOnly={readOnly} required={constraints.required}
                    step={constraints.step || 1}
                    strict value={value} />
            );
        } else if (field.type === "date") {
            // Truncate time portion of ISO date string
            value = value.substr(0, 10);
            input = (
                <span className="input-frame">
                    <input name={field.id} type={field.type} {...constraints}
                        onChange={(ev) => this.props.updateField(field.id, ev.target.value)}
                        value={value} />
                </span>
            );
        } else if (field.type === "text") {
            if (multiline) {
                input = (
                    <textarea name={field.id} onChange={(ev) => this.props.updateField(field.id, ev.target.value)} readOnly={readOnly} required={constraints.required} value={value} />
                );
            } else {
                input = (
                    <span className="input-frame">
                        <input name={field.id}
                            onChange={(ev) => this.props.updateField(field.id, ev.target.value)}
                            readOnly={readOnly} required={constraints.required} type={field.type} value={value}/>
                    </span>
                );
            }
        } else if (field.type === "file") {
            input = (
                <EditUploadField constraints={constraints} dataset={this.props.editLayerId}
                    fieldId={field.id} name={field.id} updateField={this.props.updateField} value={value} />
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
    };
}
