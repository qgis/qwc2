/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import MiscUtils from '../../utils/MiscUtils';

import './style/PopupMenu.css';

export default class PopupMenu extends React.PureComponent {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        className: PropTypes.string,
        disabledItemClass: PropTypes.string,
        onClose: PropTypes.func,
        width: PropTypes.number,
        x: PropTypes.number,
        y: PropTypes.number
    };
    constructor(props) {
        super(props);
        this.container = document.createElement("div");
        this.container.id = 'popup-container';
        this.container.style.position = 'fixed';
        this.container.style.left = 0;
        this.container.style.right = 0;
        this.container.style.top = 0;
        this.container.style.bottom = 0;
        this.container.style.zIndex = 100000;
        this.menuEl = null;
        setTimeout(() => this.container.addEventListener('click', () => {
            this.props.onClose?.();
        }), 0);
        document.body.appendChild(this.container);
    }
    componentWillUnmount() {
        document.body.removeChild(this.container);
    }
    render() {
        if (isEmpty(this.props.children)) {
            return null;
        }
        const style = {
            position: 'absolute',
            left: this.props.x + 'px',
            top: this.props.y + 'px',
            minWidth: this.props.width + 'px',
            maxHeight: (window.innerHeight - this.props.y) + 'px',
            overflowY: 'auto'
        };
        const disabledItemClass = this.props.disabledItemClass ?? "popup-menu-item-disabled";
        return ReactDOM.createPortal((
            <div className={"popup-menu " + this.props.className} onKeyDown={this.keyNav} onMouseLeave={this.clearFocus} ref={this.setFocus} style={style} tabIndex={0}>
                {this.props.children.filter(Boolean).map((child, idx) => {
                    const className = classnames({
                        [disabledItemClass]: child.props.disabled,
                        [child.props.className]: !!child.props.className
                    });
                    return React.cloneElement(child, {
                        className: className,
                        tabIndex: child.props.disabled ? undefined : 0,
                        onKeyDown: child.props.disabled ? undefined : MiscUtils.checkKeyActivate,
                        onMouseOver: child.props.disabled ? undefined : ev => ev.target.focus()
                    });
                })}
            </div>
        ), this.container);
    }
    setFocus = (el) => {
        if (el) {
            this.menuEl = el;
            this.menuEl.focus();
        }
    };
    clearFocus = () => {
        this.menuEl.focus();
    };
    keyNav = (ev) => {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Tab') {
            const childCount = this.menuEl.children.length;
            const delta = ev.key === 'ArrowUp' || (ev.key === 'Tab' && ev.shiftKey) ? -1 : 1;
            let currentIndex = Array.from(this.menuEl.children).findIndex(el => document.activeElement === el);
            if (currentIndex === -1) {
                currentIndex = -delta;
            }
            let next = (currentIndex + childCount + delta) % childCount;
            while (this.menuEl.children[next].tabIndex !== 0 && next !== currentIndex) {
                next = (next + childCount + delta) % childCount;
            }
            if (next !== currentIndex) {
                this.menuEl.children[next].focus();
            }
            ev.preventDefault();
            ev.stopPropagation();
        } else if (ev.key === 'Escape') {
            this.props.onClose?.();
            ev.preventDefault();
            ev.stopPropagation();
        }
    };
}
