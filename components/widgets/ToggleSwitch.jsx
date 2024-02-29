/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classnames from 'classnames';
import PropTypes from 'prop-types';

import Icon from '../Icon';

import './style/ToggleSwitch.css';

export default class ToggleSwitch extends React.Component {
    static propTypes = {
        active: PropTypes.bool.isRequired,
        name: PropTypes.string,
        onChange: PropTypes.func.isRequired,
        readOnly: PropTypes.bool,
        required: PropTypes.bool
    };
    render() {
        const classNames = classnames({
            "ToggleSwitch": true,
            "toggle-switch-active": this.props.active,
            "toggle-switch-inactive": !this.props.active,
            "toggle-switch-read-only": this.props.readOnly
        });
        return (
            <div className={classNames} onClick={this.onClick}>
                <span className="toggle-switch-yes"><Icon icon="ok" /></span>
                <span className="toggle-switch-slider"><Icon icon="menu-hamburger" /></span>
                <span className="toggle-switch-no"><Icon icon="remove" /></span>
                {/* Ensure toggle switch appears in form.elements */}
                <input checked={this.props.active} name={this.props.name}
                    onChange={()=>{}} readOnly={this.props.readOnly}
                    required={this.props.required} style={{visibility: 'none'}}
                    type="checkbox" value={this.props.active} />
            </div>
        );
    }
    onClick = () => {
        if (!this.props.readOnly) {
            this.props.onChange(!this.props.active);
        }
    };
}
