/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classnames from 'classnames';
import PropTypes from 'prop-types';

import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';
import PopupMenu from '../PopupMenu';

import './style/ComboBox.css';

export default class ComboBox extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.array]),
        className: PropTypes.string,
        menuClassName: PropTypes.string,
        onChange: PropTypes.func,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        value: PropTypes.string
    };
    state = {
        popup: false,
        expanded: []
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
                        {children.map((child, idx) => {
                            const classNames = classnames({
                                "combobox-menu-entry": true,
                                "combobox-menu-entry-active": child.props.value === this.props.value && !child.props.disabled,
                                "combobox-menu-entry-disabled": child.props.disabled,
                                "combobox-menu-entry-group-header": child.props["data-group-header"] !== undefined
                            });
                            if (child.props["data-group"] !== undefined && !this.state.expanded.includes(child.props["data-group"])) {
                                return null;
                            }
                            const expanderIcon = this.state.expanded.includes(child.props["data-group-header"]) ? "collapse" : "expand";
                            return (
                                <div className={classNames} key={"child:" + idx} onClickCapture={(ev) => this.onChildClicked(ev, child)}>
                                    {child.props["data-group-header"] !== undefined ? (
                                        <Icon icon={expanderIcon} />
                                    ) : null}
                                    {child}
                                </div>
                            );
                        })}
                    </PopupMenu>
                ) : null}
            </div>
        );
    }
    onChildClicked = (ev, child) => {
        if (child.props["data-group-header"] !== undefined) {
            MiscUtils.killEvent(ev);
            this.setState((state) => {
                const groupid = child.props["data-group-header"];
                if (state.expanded.includes(groupid)) {
                    return {expanded: state.expanded.filter(x => x !== groupid)};
                } else {
                    return {expanded: [...state.expanded, groupid]};
                }
            });
        } else if (!child.props.disabled) {
            this.props.onChange(child.props.value);
        }
    };
}
