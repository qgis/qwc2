/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
require('./style/Icon.css');
require('../../../icons/build/qwc2-icons.css')

class Icon extends React.Component {
    static propTypes = {
        icon: PropTypes.string,
        className: PropTypes.string,
        title: PropTypes.string,
        onClick: PropTypes.func,
        size: PropTypes.string
    }
    static defaultProps = {
        className: "",
        title: "",
        onClick: (ev) => {},
    }
    render() {
        return (
            <span
                title={this.props.title}
                className={"icon " + (this.props.size ? "icon" + this.props.size : "") + " icon-" + this.props.icon + " " + this.props.className}
                onClick={this.props.onClick}
            ></span>
        );
    }
};

module.exports = Icon;
