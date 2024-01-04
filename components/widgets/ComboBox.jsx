/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Icon from '../Icon';
import PopupMenu from '../PopupMenu';
import './style/ComboBox.css';

export default class ComboBox extends React.Component {
    static propTypes = {
        children: PropTypes.array,
        className: PropTypes.string,
        menuClassName: PropTypes.string,
        onChange: PropTypes.func,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        value: PropTypes.string
    };
    state = {
        popup: false
    };
    static defaultProps = {
        readOnly: false,
        placeholder: ''
    };
    constructor(props) {
        super(props);
        this.el = null;
    }
    render() {
        const children = React.Children.toArray(this.props.children);
        const rect = this.el ? this.el.getBoundingClientRect() : null;
        let activeOption = children.filter((child) => child.props.value === this.props.value);
        if (activeOption.length === 0) {
            activeOption = (<span>{this.props.placeholder}</span>);
        }
        return (
            <div className={"combobox " + (this.props.className || "")} ref={el => { this.el = el; }}>
                <div className="combobox-button" onClick={this.props.readOnly ? null : () => this.setState({popup: true})}>
                    <span className="combobox-button-content">
                        {activeOption}
                    </span>
                    {this.props.readOnly ? null : (<Icon icon="chevron-down" />)}
                </div>
                {this.el && this.state.popup ? (
                    <PopupMenu className={"combobox-menu" + (this.props.menuClassName ? " " + this.props.menuClassName : "")} onClose={() => this.setState({popup: false})} width={rect.width} x={rect.left} y={rect.bottom}>
                        {children.map(child => {
                            const classNames = classnames({
                                "combobox-menu-entry": true,
                                "combobox-menu-entry-active": child.props.value === this.props.value && !child.props.disabled,
                                "combobox-menu-entry-disabled": child.props.disabled
                            });
                            return (
                                <div className={classNames} key={child.props.value} onClickCapture={() => this.onChildClicked(child)}>
                                    {child}
                                </div>
                            );
                        })}
                    </PopupMenu>
                ) : null}
            </div>
        );
    }
    onChildClicked = (child) => {
        if (!child.props.disabled) {
            this.props.onChange(child.props.value);
        }
    };
}
