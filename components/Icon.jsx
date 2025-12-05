/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classnames from 'classnames';
import PropTypes from 'prop-types';

import ConfigUtils from '../utils/ConfigUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/Icon.css';

export default class Icon extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        disabled: PropTypes.bool,
        icon: PropTypes.string,
        onClick: PropTypes.func,
        onMouseDown: PropTypes.func,
        onMouseUp: PropTypes.func,
        onPointerDown: PropTypes.func,
        size: PropTypes.string,
        title: PropTypes.string
    };
    static defaultProps = {
        className: "",
        title: ""
    };
    render() {
        const classes = classnames({
            icon: true,
            icon_disabled: this.props.disabled,
            icon_clickable: !!this.props.onClick || !!this.props.onMouseDown || !!this.props.onPointerDown,
            ["icon-" + this.props.icon]: true,
            ["icon_" + this.props.size]: !!this.props.size,
            [this.props.className]: !!this.props.className
        });
        let tabIndex = undefined;
        let onKeyDown = null;
        if (this.props.onClick) {
            tabIndex = 0;
            onKeyDown = MiscUtils.checkKeyActivate;
        } else if (this.props.onPointerDown) {
            tabIndex = 0;
            onKeyDown = MiscUtils.checkKeyActivatePointerDown;
        }
        if (this.props.icon.startsWith(":/")) {
            const assetsPath = ConfigUtils.getAssetsPath();
            const src = assetsPath + this.props.icon.substr(1);
            return (
                <img alt={this.props.title} className={classes} onClick={this.props.disabled ? null : this.props.onClick}
                    onContextMenu={MiscUtils.killEvent} onKeyDown={onKeyDown}
                    onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp}
                    onPointerDown={this.props.onPointerDown}
                    src={src} tabIndex={tabIndex} title={this.props.title || undefined}
                />
            );
        } else {
            return (
                <span className={classes} onClick={this.props.disabled ? null : this.props.onClick}
                    onContextMenu={MiscUtils.killEvent} onKeyDown={onKeyDown}
                    onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp}
                    onPointerDown={this.props.onPointerDown}
                    tabIndex={tabIndex} title={this.props.title || undefined}
                />
            );
        }
    }
}
