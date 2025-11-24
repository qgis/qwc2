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
        anchor: PropTypes.object,
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
        if (this.props.anchor) {
            this.shields = [];
            for (let i = 0; i < 4; ++i) {
                this.shields[i] = document.createElement("div");
                this.shields[i].style.position = 'absolute';
                this.shields[i].style.left = "0px";
                this.shields[i].style.right = "0px";
                this.shields[i].style.top = "0px";
                this.shields[i].style.bottom = "0px";
                this.shields[i].style.pointerEvents = 'initial';
                this.shields[i].style.zIndex = 0;
                setTimeout(() => this.shields[i].addEventListener('click', () => {
                    this.props.onClose?.();
                }), 0);
                this.container.appendChild(this.shields[i]);
            }
            this.container.style.pointerEvents = 'none';
        }
        this.menuEl = null;
        setTimeout(() => this.container.addEventListener('click', () => {
            this.props.onClose?.();
        }), 0);
        document.body.appendChild(this.container);
    }
    componentDidMount() {
        if (this.props.anchor?.nodeName === "INPUT") {
            this.props.anchor.addEventListener('keydown', this.keyNav);
        }
    }
    componentWillUnmount() {
        document.body.removeChild(this.container);
        if (this.props.anchor?.nodeName === "INPUT") {
            this.props.anchor.removeEventListener('keydown', this.keyNav);
        }
        this.props.anchor?.focus?.();
    }
    render() {
        if (isEmpty(this.props.children)) {
            return null;
        }
        let rect = null;
        if (this.props.anchor) {
            if ((this.props.anchor.parentElement.className || "").includes("input-container")) {
                rect = this.props.anchor.parentElement.getBoundingClientRect();
            } else {
                rect = this.props.anchor.getBoundingClientRect();
            }
            this.shields[0].style.height = rect.top + "px";
            this.shields[0].style.bottom = 0;

            this.shields[1].style.width = rect.left + "px";
            this.shields[1].style.right = 0;

            this.shields[2].style.left = rect.right + "px";
            this.shields[3].style.top = rect.bottom + "px";
        }
        const x = (rect?.left ?? this.props.x);
        const y = (rect?.bottom ?? this.props.y) - 1;
        const minWidth = (rect?.width ?? this.props.width ?? 0);
        const style = {
            position: 'absolute',
            left: x + 'px',
            top: y + 'px',
            minWidth: minWidth + 'px',
            maxHeight: (window.innerHeight - y - 5) + 'px',
            overflowY: 'auto',
            zIndex: 1,
            pointerEvents: 'initial'
        };
        const disabledItemClass = this.props.disabledItemClass ?? "popup-menu-item-disabled";
        const children = Array.isArray(this.props.children) ? this.props.children : [this.props.children];
        return ReactDOM.createPortal((
            <div className={"popup-menu " + this.props.className} onKeyDown={this.keyNav} onMouseLeave={this.clearFocus} ref={this.setFocus} style={style} tabIndex={0}>
                {children.flat(Infinity).filter(Boolean).map(child => {
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
        this.menuEl = el;
        if (el && this.props.anchor?.nodeName !== "INPUT") {
            this.menuEl.focus();
        }
    };
    clearFocus = () => {
        if (this.props.anchor?.nodeName === "INPUT") {
            this.props.anchor.focus();
        } else {
            this.menuEl.focus();
        }
    };
    keyNav = (ev) => {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            const childCount = this.menuEl.children.length;
            const delta = ev.key === 'ArrowUp' ? -1 : 1;
            let currentIndex = Array.from(this.menuEl.children).findIndex(el => document.activeElement === el || el.contains(document.activeElement));
            if (currentIndex === -1) {
                currentIndex = delta === 1 ? childCount - 1 : 0;
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
            this.props.anchor?.focus?.();
            ev.preventDefault();
            ev.stopPropagation();
        } else if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            ev.stopPropagation();
        } else if (ev.key !== 'Tab') {
            this.props.anchor?.focus?.();
        }
    };
}
