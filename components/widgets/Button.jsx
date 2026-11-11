/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from "react";

import classNames from "classnames";
import PropTypes from "prop-types";

import withTooltip from "../../utils/Tooltip";

import './style/Button.css';


export default class Button extends React.PureComponent {
    static propTypes = {
        children: PropTypes.element,
        className: PropTypes.string,
        pressed: PropTypes.bool,
        selected: PropTypes.bool,
        title: PropTypes.string,
        type: PropTypes.string
    };
    render() {
        const {children, className, pressed, selected, title, type, ...props} = this.props;
        const classes = classNames({
            button: true,
            pressed: pressed,
            selected: selected,
            [className]: true
        });
        return (
            <button className={classes} type={type ?? "button"} {...withTooltip(title, props)}>
                {children}
            </button>
        );
    }
}
