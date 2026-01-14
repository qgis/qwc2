/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classNames from 'classnames';
import DOMPurify from 'dompurify';
import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';

import './style/TextInput.css';

export default class TextInput extends React.Component {
    static propTypes = {
        addLinkAnchors: PropTypes.bool,
        className: PropTypes.string,
        clearValue: PropTypes.string,
        disabled: PropTypes.bool,
        focusOnRef: PropTypes.bool,
        multiline: PropTypes.bool,
        name: PropTypes.string,
        onChange: PropTypes.func,
        onNoChange: PropTypes.func,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        required: PropTypes.bool,
        showClear: PropTypes.bool,
        style: PropTypes.object,
        value: PropTypes.string
    };
    static defaultProps = {
        clearValue: "",
        placeholder: "",
        showClear: true
    };
    state = {
        focus: false,
        value: "",
        valueRev: 0,
        curValue: "",
        changed: false,
        committing: false
    };
    constructor(props) {
        super(props);
        this.focusEnterClick = false;
        this.initialHeight = null;
        this.input = null;
        this.tooltipEl = null;
        this.tooltipTimeout = null;
    }
    static getDerivedStateFromProps(nextProps, state) {
        if (state.value !== nextProps.value && !state.committing) {
            return {
                value: nextProps.value,
                valueRev: state.valueRev + 1,
                curValue: DOMPurify.sanitize(nextProps.value || ""),
                changed: false
            };
        }
        return null;
    }
    componentDidUpdate(prevProps, prevState) {
        this.setDefaultValue(this.state.value, this.state.valueRev, prevState.valueRev);
    }
    setDefaultValue = (value, valueRev, prevValueRef) => {
        if (valueRev > prevValueRef) {
            this.input.innerHTML = DOMPurify.sanitize(value.replaceAll('\n', this.props.multiline ? '<br />' : ''));
        }
    };
    render() {
        const wrapperClassName = classNames({
            "TextInput": true,
            "text-input-wrapper": true,
            "text-input-wrapper-multiline": this.props.multiline,
            "text-input-wrapper-focused": this.state.focus
        });
        const preClassName = classNames({
            "text-input": true,
            "text-input-disabled": this.props.disabled,
            "text-input-readonly": this.props.readOnly || !this.state.curValue,
            "text-input-invalid": this.props.required && !this.state.curValue
        });
        const showClear = this.props.showClear && this.state.focus && !this.props.multiline && !this.props.disabled && !this.props.readOnly && this.state.curValue;
        const style = {
            ...this.props.style
        };
        if (showClear) {
            style.marginRight = '1.5em';
        }
        return (
            <div className={wrapperClassName + " " + (this.props.className || "")} onClick={MiscUtils.killEvent} ref={this.storeInitialHeight}>
                {this.props.name ? (
                    <textarea
                        className="text-input-form-el"
                        name={this.props.name}
                        onChange={() => {}}
                        required={this.props.required}
                        tabIndex="-1"
                        value={this.state.curValue} />
                ) : null}
                <pre
                    className={preClassName}
                    contentEditable={!this.props.disabled && !this.props.readOnly}
                    onBlur={this.onBlur}
                    onChange={this.onChange}
                    onCopy={(ev) => this.onCopy(ev, false)}
                    onCut={(ev) => this.onCopy(ev, true)}
                    onFocus={this.onFocus}
                    onInput={this.onChange}
                    onKeyDown={this.onKeyDown}
                    onMouseDown={this.onMouseDown}
                    onMouseLeave={this.onMouseLeave}
                    onMouseMove={this.onMouseMove}
                    ref={this.storeRef}
                    style={style}
                />
                {!this.state.curValue ? (
                    <div className="text-input-placeholder">{this.props.placeholder}</div>
                ) : null}
                {this.props.multiline ? (
                    <div
                        className="text-input-resize-handle"
                        onPointerDown={this.startResize} />
                ) : null}
                {showClear ? (
                    <div className="text-input-clear-icon">
                        <Icon icon="clear" onClick={this.clear} onMouseDown={MiscUtils.killEvent} />
                    </div>
                ) : null}
            </div>
        );
    }
    storeRef = (el) => {
        if (el) {
            this.input = el;
            this.setDefaultValue(this.state.value, this.state.valueRev, -1);
            if (this.props.focusOnRef) {
                el.focus();
            }
        }
    };
    setInputContents = () => {
        this.input.innerHTML = this.state.value.replaceAll('\n', this.props.multiline ? '<br />' : '');
    };
    onCopy = (ev, cut) => {
        ev.preventDefault();
        const selection = window.getSelection();
        const plainText = selection.toString();
        if (ev.clipboardData) {
            ev.clipboardData.setData('text/plain', plainText);
        }
        if (cut) {
            this.clear();
        }
    };
    clear = () => {
        const clearValue = this.props.clearValue;
        this.props.onChange(clearValue);
        this.setState(state => ({curValue: this.props.clearValue, changed: state.value !== clearValue}));
        this.input.innerHTML = clearValue;
    };
    onChange = (ev) => {
        let curValue = DOMPurify.sanitize(ev.target.innerText.replace(/<br\s*\/?>$/, '').replace(/\n$/, ''));
        if (!this.props.multiline) {
            curValue = curValue.replace('\n', '');
        }
        this.setState({curValue: curValue, changed: true});
    };
    onBlur = () => {
        this.setState({focus: false});
        this.commit();
    };
    onFocus = (ev) => {
        this.setState({focus: true});
        window.setTimeout(function() {
            if (window.getSelection && document.createRange) {
                const range = document.createRange();
                range.selectNodeContents(ev.target);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } else if (document.body.createTextRange) {
                const range = document.body.createTextRange();
                range.moveToElementText(ev.target);
                range.select();
            }
        }, 1);
    };
    onMouseDown = (ev) => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        if (el?.nodeName === 'A' && ev.ctrlKey) {
            window.open(el.href, el.target);
        }
    };
    onMouseMove = (ev) => {
        const isTouch = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
        clearTimeout(this.tooltipTimeout);
        const editable = !this.props.disabled && !this.props.readOnly;
        if (!isTouch && editable && ev.target.nodeName === 'A') {
            const rect = ev.target.getBoundingClientRect();
            const left = rect.left + window.scrollX;
            const bottom = rect.bottom + window.scrollY + 2;
            this.tooltipTimeout = setTimeout(() => {
                if (!this.tooltipEl) {
                    this.tooltipEl = document.createElement("span");
                    this.tooltipEl.className = "text-input-link-tooltip";
                    this.tooltipEl.innerHTML = LocaleUtils.tr("misc.ctrlclickhint");
                    this.tooltipEl.style.position = 'absolute';
                    this.tooltipEl.style.zIndex = 10000000000;
                    document.body.appendChild(this.tooltipEl);
                }
                this.tooltipEl.style.left = left + 'px';
                this.tooltipEl.style.top = bottom + 'px';
                this.tooltipTimeout = null;
            }, 250);
        } else if (this.tooltipEl) {
            document.body.removeChild(this.tooltipEl);
            this.tooltipEl = null;
        }
    };
    onMouseLeave = () => {
        clearTimeout(this.tooltipTimeout);
        if (this.tooltipEl) {
            document.body.removeChild(this.tooltipEl);
            this.tooltipEl = null;
        }
    };
    onKeyDown = (ev) => {
        if (ev.key === 'Enter' && !this.props.multiline) {
            ev.preventDefault();
            this.commit();
        } else if (ev.key === 'Escape') {
            this.setState((state) => ({
                value: this.props.value,
                valueRev: state.valueRev + 1,
                curValue: this.props.value || "",
                changed: false
            }), () => ev.target.blur());
            MiscUtils.killEvent(ev);
        }
    };
    commit = () => {
        if (this.state.changed) {
            this.setState(state => {
                const value = this.props.addLinkAnchors ? MiscUtils.addLinkAnchors(state.curValue) : state.curValue;
                return {value: value, changed: false, committing: true};
            }, () => {
                this.setState({committing: false});
                this.props.onChange(this.state.value);
            });
        } else {
            this.props.onNoChange?.();
        }
    };
    storeInitialHeight = (el) => {
        if (el) {
            this.initialHeight = el.offsetHeight;
        }
    };
    startResize = (ev) => {
        const container = ev.target.parentElement;
        if (!container) {
            return;
        }
        const startHeight = container.offsetHeight;
        const startMouseY = ev.clientY;
        const resizeInput = (event) => {
            container.style.height = Math.max(this.initialHeight, (startHeight + (event.clientY - startMouseY))) + 'px';
        };
        document.body.style.userSelect = 'none';
        ev.view.addEventListener("pointermove", resizeInput);
        ev.view.addEventListener("pointerup", () => {
            document.body.style.userSelect = '';
            ev.view.removeEventListener("pointermove", resizeInput);
        }, {once: true});
    };
}
