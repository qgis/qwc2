/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classnames from 'classnames';
import {remove as removeDiacritics} from 'diacritics';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';
import PopupMenu from './PopupMenu';

import './style/ComboBox.css';

export default class ComboBox extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.array]),
        className: PropTypes.string,
        filterable: PropTypes.bool,
        menuClassName: PropTypes.string,
        onChange: PropTypes.func,
        placeholder: PropTypes.string,
        readOnly: PropTypes.bool,
        value: PropTypes.string
    };
    state = {
        popup: false,
        expanded: [],
        filter: ''
    };
    static defaultProps = {
        readOnly: false,
        placeholder: ''
    };
    constructor(props) {
        super(props);
        this.el = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevState.popup && !this.state.popup) {
            // Move focus back to combo button
            this.el.children[0].focus();
        }
    }
    render() {
        const children = React.Children.toArray(this.props.children);
        const rect = this.el ? this.el.getBoundingClientRect() : null;
        let activeOption = children.filter((child) => child.props.value === this.props.value);
        if (activeOption.length === 0) {
            if (!this.state.filter) {
                activeOption = (<span>{this.props.placeholder}</span>);
            } else {
                activeOption = (<span>&nbsp;</span>);
            }
        }
        const filter = this.state.filter ? new RegExp(removeDiacritics(this.state.filter).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i") : null;
        const onClick = this.props.readOnly || isEmpty(children) ? null : () => this.setState(state => ({popup: !state.popup}));
        return (
            <div className={"combobox " + (this.props.className || "")} ref={el => { this.el = el; }}>
                <div className="combobox-button" onClick={onClick} onKeyDown={MiscUtils.checkKeyActivate} tabIndex={0}>
                    <span className="combobox-button-content">
                        {activeOption}
                    </span>
                    {this.props.filterable && !this.props.readOnly ? (
                        <input className="combobox-button-filter" onChange={this.filterChanged} type="text" value={this.state.filter} />
                    ) : null}
                    {this.props.readOnly ? null : (<Icon icon="chevron-down" />)}
                </div>
                {this.el && this.state.popup ? (
                    <PopupMenu className={"combobox-menu" + (this.props.menuClassName ? " " + this.props.menuClassName : "")} onClose={() => this.setState({popup: false})} width={rect.width} x={rect.left} y={rect.bottom}>
                        {children.map((child, idx) => {
                            const classNames = classnames({
                                "combobox-menu-entry": true,
                                "combobox-menu-entry-active": child.props.value === this.props.value && !child.props.disabled,
                                "combobox-menu-entry-group-header": child.props["data-group-header"] !== undefined
                            });
                            if (child.props["data-group"] !== undefined && !this.state.expanded.includes(child.props["data-group"])) {
                                return null;
                            }
                            if (filter && !removeDiacritics(child.props.title).match(filter)) {
                                return null;
                            }
                            const expanderIcon = this.state.expanded.includes(child.props["data-group-header"]) ? "collapse" : "expand";
                            return (
                                <div className={classNames} disabled={child.props.disabled} key={"child:" + idx} onClickCapture={(ev) => this.onChildClicked(ev, child)}>
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
    filterChanged = (ev) => {
        this.setState({filter: ev.target.value});
        this.props.onChange('');
    };
    onChildClicked = (ev, child) => {
        this.setState({filter: ''});
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
