/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import {KeyValCache} from '../utils/EditingUtils';
import LocaleUtils from '../utils/LocaleUtils';

import './style/EditComboField.css';


export default class EditComboField extends React.Component {
    static propTypes = {
        editIface: PropTypes.object,
        fieldId: PropTypes.string,
        filterExpr: PropTypes.array,
        keyvalrel: PropTypes.string,
        multiSelect: PropTypes.bool,
        name: PropTypes.string,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        style: PropTypes.object,
        updateField: PropTypes.func,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        values: PropTypes.array
    };
    state = {
        showPlaceholder: true,
        values: []
    };
    componentDidMount() {
        if (this.props.values) {
            // eslint-disable-next-line
            this.setState({values: this.props.values, showPlaceholder: !this.hasEmptyValue(this.props.values)});
        } else if (this.props.keyvalrel) {
            KeyValCache.get(this.props.editIface, this.props.keyvalrel, this.props.filterExpr ?? null).then(values => {
                // eslint-disable-next-line
                this.setState({values, showPlaceholder: !this.hasEmptyValue(values)});
            });
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.keyvalrel && this.props.filterExpr !== prevProps.filterExpr) {
            KeyValCache.get(this.props.editIface, this.props.keyvalrel, this.props.filterExpr ?? null).then(values => {
                // eslint-disable-next-line
                this.setState({values, showPlaceholder: !this.hasEmptyValue(values)});
            });
        }
    }
    hasEmptyValue = (values) => {
        for (let i = 0; i < values.length; ++i) {
            if (typeof(values[i]) === 'string') {
                if (values[i] === '') {
                    return true;
                }
            } else if (values[i].value === '') {
                return true;
            }
        }
        return false;
    };
    render() {
        if (this.props.multiSelect) {
            return this.renderMultiSelect();
        } else {
            return this.renderComboSelect();
        }
    }
    renderMultiSelect = () => {
        let items = new Set();
        try {
            items = new Set(JSON.parse('[' + this.props.value.slice(1, -1) + ']'));
        } catch (e) {
            // pass
        }
        const serializeValue = (value, enabled) => {
            if (enabled) {
                return '{' + JSON.stringify([...items].concat([value])).slice(1, -1) + '}';
            } else {
                return '{' + JSON.stringify([...items].filter(x => x !== value)).slice(1, -1) + '}';
            }
        };
        return (
            <div className="edit-multi-select">
                {this.state.values.map((item, index) => {
                    const {value, label} = this.itemValueLabel(item);
                    return (
                        <div key={this.props.fieldId + index}>
                            <label>
                                <input
                                    checked={items.has(value)}
                                    onChange={(ev) => this.props.updateField(this.props.fieldId, serializeValue(value, ev.target.checked))}
                                    type="checkbox"
                                />{label}</label>
                        </div>
                    );
                })}
            </div>
        );
    };
    renderComboSelect = () => {
        return (
            <select disabled={this.props.readOnly} name={this.props.name}
                onChange={ev => this.props.updateField(this.props.fieldId, ev.target.selectedIndex === 0 && this.state.showPlaceholder ? null : ev.target.value)}
                required={this.props.required} style={this.props.style} value={String(this.props.value)}
            >
                {this.state.showPlaceholder ? (
                    <option disabled={this.props.required} value="">
                        {this.props.placeholder ?? LocaleUtils.tr("editing.select")}
                    </option>
                ) : null}
                {this.state.values.map((item, index) => {
                    const {value, label} = this.itemValueLabel(item);
                    return (
                        <option key={this.props.fieldId + index} value={String(value)}>{label}</option>
                    );
                })}
            </select>
        );
    };
    itemValueLabel = (item) => {
        let value = "";
        let label = "";
        if (typeof(item) === 'string') {
            value = label = item;
        } else {
            value = item.value;
            label = item.label;
        }
        return {value, label};
    };
}
