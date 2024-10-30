/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classnames from 'classnames';
import PropTypes from 'prop-types';

import './style/InputContainer.css';

export default class InputContainer extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        className: PropTypes.string
    };
    state = {
        focused: false
    };
    render() {
        const containerClasses = classnames({
            "input-container": true,
            "input-container-focus": this.state.focused,
            [this.props.className]: !!this.props.className
        });
        const prefix = this.findChild("prefix").map(el => {
            return React.cloneElement(el, {className: "input-container-prefix " + (el.props.className || "")});
        });
        const input = this.findChild("input").map(el => {
            return React.cloneElement(el, {
                className: "input-container-input " + (el.props.className || ""),
                onBlur: (ev) => this.onInputBlur(ev, el.props.onBlur),
                onFocus: (ev) => this.onInputFocus(ev, el.props.onFocus)
            });
        });
        const suffix = this.findChild("suffix").map(el => {
            return React.cloneElement(el, {className: "input-container-suffix " + (el.props.className || "")});
        });
        return (
            <div className={containerClasses}>
                {prefix}
                {input}
                {suffix}
            </div>
        );
    }
    findChild = (role) => {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    };
    onInputBlur = (ev, origHandler) => {
        if (origHandler) {
            origHandler(ev);
        }
        this.setState({focused: false});
    };
    onInputFocus = (ev, origHandler) => {
        if (origHandler) {
            origHandler(ev);
        }
        this.setState({focused: true});
    };
}
