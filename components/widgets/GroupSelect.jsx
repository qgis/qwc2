/**
 * Copyright 2025 Stadtwerke München GmbH
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {Component} from 'react';

import PropTypes from 'prop-types';

/**
 * Dropdown for selecting options grouped under sections.
 */
export default class GroupSelect extends Component {
    static propTypes = {
        defaultOption: PropTypes.array,
        onChange: PropTypes.func,
        options: PropTypes.object,
        placeholder: PropTypes.string,
        value: PropTypes.string
    };
    static defaultProps = {
        defaultOption: null,
        placeholder: null
    };
    render() {
        return (
            <select onChange={this.onChange} role="input" value={this.props.value}>
                {this.props.placeholder !== null ? (
                    <option disabled hidden selected>
                        {this.props.placeholder}
                    </option>
                ) : null}
                {this.props.defaultOption !== null ? (
                    <option key={this.props.defaultOption[0]} value={this.props.defaultOption[0]}>
                        {this.props.defaultOption[1]}
                    </option>
                ) : null}
                {Object.entries(this.props.options || {}).map(([title, options], index) => (
                    options && options.length > 0 ? (
                        <optgroup key={"optgroup-" + index} label={title}>
                            {options.map(([value, description]) => (
                                <option key={value} value={value}>{description}</option>
                            ))}
                        </optgroup>
                    ) : null
                ))}
            </select>
        );
    }
    onChange = (e) => {
        this.props.onChange(e.target.value);
    };
}
