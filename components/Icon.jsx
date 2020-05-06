/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const ConfigUtils = require('../utils/ConfigUtils');
const LocaleUtils = require('../utils/LocaleUtils');
require('./style/Icon.css');

class Icon extends React.Component {
    static propTypes = {
        icon: PropTypes.string,
        className: PropTypes.string,
        title: PropTypes.string,
        titlemsgid: PropTypes.string,
        onClick: PropTypes.func,
        size: PropTypes.string
    }
    static defaultProps = {
        className: "",
        title: ""
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        let classes = classnames({
            "icon": true,
            ["icon-" + this.props.icon]: true,
            ["icon_" + this.props.size]: !!this.props.size,
            [this.props.className]: !!this.props.className,
            "icon_clickable": !!this.props.onClick
        });
        let title = this.props.title;
        if(this.props.titlemsgid) {
            title = LocaleUtils.getMessageById(this.context.messages, this.props.titlemsgid);
        }
        if(this.props.icon.startsWith(":/")) {
            let assetsPath = ConfigUtils.getConfigProp("assetsPath");
            let src = assetsPath + this.props.icon.substr(1);
            return (
                <img src={src} alt={title} title={title}
                    className={classes} onClick={this.props.onClick}
                />
            );
        } else {
            return (
                <span title={title}
                    className={classes} onClick={this.props.onClick}
                ></span>
            );
        }
    }
};

module.exports = Icon;
