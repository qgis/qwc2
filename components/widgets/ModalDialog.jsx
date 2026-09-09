/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';

import Icon from '../Icon';
import {AppRootPortalContext} from '../PluginsContainer';

import './style/ModalDialog.css';


export default class ModalDialog extends React.Component {
    static contextType = AppRootPortalContext;
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        icon: PropTypes.string,
        onClose: PropTypes.func,
        title: PropTypes.string
    };
    render() {
        const contents = (
            <div className="modal-dialog-container">
                <div className="modal-dialog">
                    <div className="modal-dialog-title">
                        <Icon icon={this.props.icon} />
                        <span>{this.props.title}</span>
                        <Icon icon="remove" onClick={this.props.onClose} /></div>
                    <div className="modal-dialog-body">
                        {this.props.children}
                    </div>
                </div>
            </div>
        );
        return ReactDOM.createPortal(contents, this.context ?? document.body);
    }
}
