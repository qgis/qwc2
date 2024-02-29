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

import Icon from './Icon';

import './style/ModalDialog.css';


export default class ModalDialog extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        icon: PropTypes.string,
        onClose: PropTypes.func,
        title: PropTypes.string
    };
    constructor(props) {
        super(props);
        this.el = document.createElement("div");
        this.el.className = "modal-dialog-container";
    }
    componentDidMount = () => {
        document.body.appendChild(this.el);
    };
    componentWillUnmount = () => {
        document.body.removeChild(this.el);
    };
    render() {
        const contents = (
            <div className="modal-dialog">
                <div className="modal-dialog-title">
                    <Icon icon={this.props.icon} />
                    <span>{this.props.title}</span>
                    <Icon icon="remove" onClick={this.props.onClose} /></div>
                <div className="modal-dialog-body">
                    {this.props.children}
                </div>
            </div>
        );
        return ReactDOM.createPortal(contents, this.el);
    }
}
