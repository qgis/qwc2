/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import NumberInput from './NumberInput';
import TextInput from './TextInput';

import './style/ListInput.css';

export default class ListInput extends React.Component {
    static propTypes = {
        disabled: PropTypes.bool,
        onChange: PropTypes.func,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        type: PropTypes.string,
        value: PropTypes.array
    };
    render() {
        let inputRenderer = null;
        if (this.props.type === 'number') {
            inputRenderer = (val, idx) => (
                <NumberInput onChange={newval => this.setVal(newval, idx)} readOnly={this.props.readOnly} value={val} />
            );
        } else if (this.props.type === 'text') {
            inputRenderer = (val, idx) => (
                <TextInput onChange={newval => this.setVal(newval, idx)} readOnly={this.props.readOnly} value={val} />
            );
        }
        return (
            <div className="ListInput">
                {(this.props.value || []).map((val, idx) => (
                    <div className="list-input-value" key={"v:" + idx}>
                        {inputRenderer(val, idx)}
                        <Icon icon="trash" onClick={() => this.delVal(idx)} />
                    </div>
                ))}
                {!this.props.readOnly ? (
                    <div className="list-input-add">
                        <button className="button" onClick={this.addVal} type="button">{LocaleUtils.tr("common.add")}</button>
                    </div>
                ) : null}
            </div>
        );
    }
    setVal = (newval, idx) => {
        const newValue = [...this.props.value];
        newValue.splice(idx, 1, newval);
        this.props.onChange(newValue);
    };
    delVal = (idx) => {
        const newValue = [...this.props.value];
        newValue.splice(idx, 1);
        this.props.onChange(newValue);
    };
    addVal = () => {
        this.props.onChange([...(this.props.value || []), null]);
    };
}
