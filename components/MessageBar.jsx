/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';

import {MapContainerPortalContext} from '../components/PluginsContainer';
import Icon from './Icon';

import './style/MessageBar.css';


export default class MessageBar extends React.Component {
    static contextType = MapContainerPortalContext;
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        onClose: PropTypes.func
    };
    renderRole = (role) => {
        const children = typeof this.props.children === "function" ?
            this.props.children() :
            React.Children.toArray(this.props.children).reduce((res, child) => ({...res, [child.props.role]: child}), {});
        return children[role];
    };
    render() {
        return ReactDOM.createPortal((
            <div>
                <div className="messagebar-container">
                    <div className="messagebar">
                        <div className="body">
                            {this.renderRole("body")}
                        </div>
                        {this.props.onClose ? (
                            <span className="closewrapper">
                                <Icon className="close" icon="remove" onClick={this.props.onClose} size="large"/>
                            </span>
                        ) : null}
                    </div>
                </div>
                {this.renderRole("extra")}
            </div>
        ), this.context);
    }
}
