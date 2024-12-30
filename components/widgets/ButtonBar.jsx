/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import ConfigUtils from '../../utils/ConfigUtils';
import Icon from '../Icon';
import MenuButton from './MenuButton';

import './style/ButtonBar.css';

const ButtonPropShape = PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    tooltip: PropTypes.string,
    icon: PropTypes.string,
    data: PropTypes.object,
    extraClasses: PropTypes.string,
    type: PropTypes.string,
    disabled: PropTypes.bool
});

export default class ButtonBar extends React.Component {
    static propTypes = {
        active: PropTypes.string,
        buttons: PropTypes.arrayOf(PropTypes.oneOfType([ButtonPropShape, PropTypes.arrayOf(ButtonPropShape)])),
        className: PropTypes.string,
        disabled: PropTypes.bool,
        forceLabel: PropTypes.bool,
        onClick: PropTypes.func,
        tooltipPos: PropTypes.string
    };
    static defaultProps = {
        className: "",
        tooltipPos: 'bottom'
    };
    render() {
        const isMobile = ConfigUtils.isMobile();
        return (
            <div className={"ButtonBar controlgroup " + this.props.className + (this.props.disabled ? " buttonbar-disabled" : "")}>
                {this.props.buttons.map((entry, idx) => {
                    if (Array.isArray(entry) && entry.length > 1) {
                        const active = entry.find(e => e.key === this.props.active) !== undefined ? this.props.active : null;
                        return (
                            <MenuButton active={active} className="buttonbar-combo" key={"combo" + idx} onActivate={(value) => this.props.onClick(value, entry.find(e => e.key === value).data)}>
                                {entry.map(comboentry => (
                                    <div className="buttonbar-combo-entry" key={comboentry.key} onClick={() => this.props.onClick(comboentry.key, comboentry.data)} value={comboentry.key}>
                                        {comboentry.icon ? (<Icon icon={comboentry.icon} />) : null}
                                        {comboentry.label && (!isMobile || !comboentry.icon || this.props.forceLabel) ? (
                                            <span className="buttonbar-combo-entry-label">{comboentry.label}</span>
                                        ) : null}
                                        {comboentry.tooltip ? (
                                            <span className={"buttonbar-button-tooltip " + ("buttonbar-button-tooltip-" + this.props.tooltipPos)}>
                                                {comboentry.tooltip}
                                            </span>
                                        ) : null}
                                    </div>
                                ))}
                            </MenuButton>
                        );
                    } else if (!isEmpty(entry)) {
                        if (Array.isArray(entry)) {
                            entry = entry[0];
                        }
                        let classes = classnames({
                            button: true,
                            pressed: this.props.active === entry.key || entry.pressed
                        });
                        classes += entry.extraClasses ? ' ' + entry.extraClasses : '';
                        return (
                            <div className="buttonbar-button-container" key={entry.key}>
                                <button
                                    className={classes} disabled={entry.disabled || this.props.disabled}
                                    onClick={entry.type !== "submit" ? () => this.props.onClick(entry.key, entry.data) : null}
                                    type={entry.type || "button"}
                                >
                                    {entry.icon ? (<Icon icon={entry.icon} />) : null}
                                    {entry.label && (!isMobile || !entry.icon || this.props.forceLabel) ? (<span>{entry.label}</span>) : null}
                                </button>
                                {entry.tooltip ? (
                                    <span className={"buttonbar-button-tooltip " + ("buttonbar-button-tooltip-" + this.props.tooltipPos)}>
                                        {entry.tooltip}
                                    </span>
                                ) : null}
                            </div>
                        );
                    } else {
                        return null;
                    }
                })}
            </div>
        );
    }
}
