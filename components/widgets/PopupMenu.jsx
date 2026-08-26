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
        align: PropTypes.string,
        anchor: PropTypes.object,
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        className: PropTypes.string,
        disabledItemClass: PropTypes.string,
        keepMenuOpen: PropTypes.bool,
        onClose: PropTypes.func,
        setMaxWidth: PropTypes.bool,
        spaceKeyActivation: PropTypes.bool,
        width: PropTypes.number,
        x: PropTypes.number,
        y: PropTypes.number
    };
    static defaultProps = {
        spaceKeyActivation: true
    };
    constructor(props) {
        super(props);
        const doc = (this.props.anchor?.ownerDocument ?? document);
        this.container = doc.createElement("div");
        this.container.id = 'popup-container';
        this.container.style.position = 'fixed';
        this.container.style.left = 0;
        this.container.style.right = 0;
        this.container.style.top = 0;
        this.container.style.bottom = 0;
        this.container.style.zIndex = 100000;
        this.container.style.pointerEvents = 'none';
        this.menuEl = null;
        doc.body.appendChild(this.container);
        // Delay one cycle
        setTimeout(() => doc.addEventListener('pointerdown', this.checkCloseMenu, {capture: true}), 0);
        doc.addEventListener('click', this.checkKillClick, {capture: true});
    }
    componentDidMount() {
        if (this.props.anchor?.nodeName === "INPUT") {
            this.props.anchor.addEventListener('keydown', this.keyNav);
        }
    }
    componentWillUnmount() {
        const doc = (this.props.anchor?.ownerDocument ?? document);
        doc.body.removeChild(this.container);
        if (this.props.anchor?.nodeName === "INPUT") {
            this.props.anchor.removeEventListener('keydown', this.keyNav);
        }
        this.props.anchor?.focus?.();
        doc.removeEventListener('pointerdown', this.checkCloseMenu, {capture: true});
        if (!this.killClick) {
            doc.removeEventListener('click', this.checkKillClick, {capture: true});
        }
    }
    checkCloseMenu = (ev) => {
        if (this.menuEl && !this.menuEl.contains(ev.target) && !this.props.anchor?.contains?.(ev.target)) {
            this.props.onClose();
            MiscUtils.killEvent(ev);
            this.killClick = true;
        }
    };
    checkKillClick = (ev) => {
        if (this.killClick) {
            MiscUtils.killEvent(ev);
            this.killClick = undefined;
            ev.currentTarget.removeEventListener('click', this.checkKillClick, {capture: true});
        }
    };
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
        }
        const doc = (this.props.anchor?.ownerDocument ?? document);
        const win = doc.defaultView;
        const x = ((this.props.align === 'right' ? rect?.right : rect?.left) ?? this.props.x) - 1;
        let y = (rect?.bottom ?? this.props.y) - 1;
        const minWidth = (rect?.width ?? this.props.width ?? 0);
        const style = {
            position: 'absolute',
            [this.props.align === "right" ? "right" : "left"]: (this.props.align === "right" ? win.innerWidth - x : x) + 'px',
            minWidth: minWidth + 'px',
            overflowY: 'auto',
            zIndex: 1,
            pointerEvents: 'initial'
        };
        if (win.innerHeight - y < 100) {
            y = rect?.top ?? this.props.y - 1;
            style.bottom = (win.innerHeight - y) + 'px';
            style.maxHeight = (y - 5) + 'px';
        } else {
            style.top = y + 'px';
            style.maxHeight = (win.innerHeight - y - 5) + 'px';
        }
        if (this.props.setMaxWidth) {
            style.maxWidth = minWidth + 'px';
        }
        const disabledItemClass = this.props.disabledItemClass ?? "popup-menu-item-disabled";
        const children = Array.isArray(this.props.children) ? this.props.children : [this.props.children];
        return ReactDOM.createPortal((
            <div className={"popup-menu " + this.props.className} onClick={this.handleMenuClick} onKeyDown={this.keyNav} onMouseLeave={this.clearFocus} ref={this.setFocus} style={style} tabIndex={0}>
                {children.flat(Infinity).filter(Boolean).map(child => {
                    const className = classnames({
                        [disabledItemClass]: child.props.disabled,
                        [child.props.className]: !!child.props.className
                    });
                    return React.cloneElement(child, {
                        className: className,
                        tabIndex: child.props.disabled ? undefined : 0,
                        onKeyDown: child.props.disabled ? undefined : ev => MiscUtils.checkKeyActivate(ev, null, this.props.spaceKeyActivation),
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
    handleMenuClick = (ev) => {
        let disabled = false;
        for (let el = ev.target; ev.currentTarget.contains(el); el = el.parentElement) {
            if (el.attributes.disabled !== undefined) {
                disabled = true;
            }
        }
        if (disabled || this.props.keepMenuOpen) {
            MiscUtils.killEvent(ev);
        } else {
            this.props.onClose?.();
        }
    };
    keyNav = (ev) => {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            const childCount = this.menuEl.children.length;
            const delta = ev.key === 'ArrowUp' ? -1 : 1;
            let currentIndex = Array.from(this.menuEl.children).findIndex(el => ev.view.document.activeElement === el || el.contains(ev.view.document.activeElement));
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
            MiscUtils.killEvent(ev);
        } else if (ev.key === 'Escape') {
            this.props.onClose?.();
            this.props.anchor?.focus?.();
            MiscUtils.killEvent(ev);
        } else if (ev.key === 'Enter' || (ev.key === ' ' && this.props.spaceKeyActivation)) {
            MiscUtils.killEvent(ev);
        } else if (ev.key !== 'Tab' && ev.key !== 'Shift') {
            this.props.anchor?.focus?.();
        }
    };
}
