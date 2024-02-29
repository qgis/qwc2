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
import LocaleUtils from '../utils/LocaleUtils';

import './style/Icon.css';

export default class Icon extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        icon: PropTypes.string,
        onClick: PropTypes.func,
        size: PropTypes.string,
        title: PropTypes.string,
        titlemsgid: PropTypes.string
    };
    static defaultProps = {
        className: "",
        title: ""
    };
    render() {
        const classes = classnames({
            icon: true,
            ["icon-" + this.props.icon]: true,
            ["icon_" + this.props.size]: !!this.props.size,
            [this.props.className]: !!this.props.className,
            icon_clickable: !!this.props.onClick
        });
        let title = this.props.title;
        if (this.props.titlemsgid) {
            title = LocaleUtils.tr(this.props.titlemsgid);
        }
        if (this.props.icon.startsWith(":/")) {
            const assetsPath = ConfigUtils.getAssetsPath();
            const src = assetsPath + this.props.icon.substr(1);
            return (
                <img alt={title} className={classes} onClick={this.props.onClick} src={src} title={title || undefined} />
            );
        } else {
            return (
                <span className={classes} onClick={this.props.onClick} title={title || undefined} />
            );
        }
    }
}
