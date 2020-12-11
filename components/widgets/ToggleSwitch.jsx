/**
* Copyright 2017, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const Icon = require('../Icon');
require('./style/ToggleSwitch.css');

class ToggleSwitch extends React.Component {
    static propTypes = {
        active: PropTypes.bool.isRequired,
        name: PropTypes.string,
        onChange: PropTypes.func.isRequired,
        readOnly: PropTypes.boolean,
        required: PropTypes.boolean
    }
    render() {
        const classNames = classnames({
            "ToggleSwitch": true,
            "toggle-switch-active": this.props.active,
            "toggle-switch-inactive": !this.props.active
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
    }
}

module.exports = ToggleSwitch;
