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
import Icon from './Icon';
import ComboBox from './widgets/ComboBox';

import './style/EditComboField.css';


export default class EditComboField extends React.Component {
    static propTypes = {
        editIface: PropTypes.object,
        fieldId: PropTypes.string,
        filterExpr: PropTypes.array,
        keyvalrel: PropTypes.string,
        mapPrefix: PropTypes.string,
        multiSelect: PropTypes.bool,
        name: PropTypes.string,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        showAdd: PropTypes.bool,
        showEdit: PropTypes.bool,
        style: PropTypes.object,
        switchEditContext: PropTypes.func,
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
            this.setState({values: this.props.values, showPlaceholder: !this.hasEmptyValue(this.props.values)});
        } else if (this.props.keyvalrel) {
            KeyValCache.get(this.props.editIface, this.props.mapPrefix + "." + this.props.keyvalrel, this.props.filterExpr ?? null).then(values => {
                this.setState({values, showPlaceholder: !this.hasEmptyValue(values)});
            });
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.values && this.props.values !== prevProps.values) {
            // This does not handle the case a selected value has disappeared from values, caller should handle that
            this.setState({values: this.props.values, showPlaceholder: !this.hasEmptyValue(this.props.values)});
        } else if (this.props.keyvalrel && this.props.filterExpr !== prevProps.filterExpr) {
            KeyValCache.get(this.props.editIface, this.props.mapPrefix + "." + this.props.keyvalrel, this.props.filterExpr ?? null).then(values => {
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
        } catch {
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
                                    disabled={this.props.readOnly}
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
            <div className="edit-single-select controlgroup">
                <ComboBox className="controlgroup-expanditem" name={this.props.name}
                    onChange={value => this.props.updateField(this.props.fieldId, value)}
                    placeholder={this.state.showPlaceholder ? (this.props.placeholder ?? LocaleUtils.tr("common.select")) : undefined}
                    required={this.props.required} style={this.props.style} value={String(this.props.value)}
                >
                    {this.state.values.map((item, index) => {
                        const {value, label} = this.itemValueLabel(item);
                        return (
                            <div key={this.props.fieldId + index} value={String(value)}>{label}</div>
                        );
                    })}
                </ComboBox>
                {this.props.showEdit ? (
                    <button className="button" onClick={this.onEdit} type="button"><Icon icon="draw" /></button>
                ) : null}
                {this.props.showAdd ? (
                    <button className="button" onClick={this.onAdd} type="button"><Icon icon="plus" /></button>
                ) : null}
            </div>
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
    onAdd = () => {
        const parts = this.props.keyvalrel.split(":");
        this.props.switchEditContext("Create", parts[0], null, this.childContextDone, parts[2]);
    };
    onEdit = () => {
        const parts = this.props.keyvalrel.split(":");
        this.props.switchEditContext("Edit", parts[0], this.props.value, this.childContextDone, parts[2]);
    };
    childContextDone = (feature) => {
        const parts = this.props.keyvalrel.split(":");
        KeyValCache.get(this.props.editIface, this.props.mapPrefix + "." + this.props.keyvalrel, this.props.filterExpr ?? null, true).then(values => {
            this.setState({values, showPlaceholder: !this.hasEmptyValue(values)});
            this.props.updateField(this.props.fieldId, feature.properties[parts[1]]);
        });
    };
}
