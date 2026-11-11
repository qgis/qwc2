/**
 * Copyright Sourcepole AG
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
import withTooltip from '../../utils/Tooltip';
import Icon from '../Icon';
import MenuButton from './MenuButton';

import './style/ButtonBar.css';

const ButtonPropShape = PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    forceLabel: PropTypes.bool,
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
        onClick: PropTypes.func
    };
    static defaultProps = {
        className: ""
    };
    render() {
        const isMobile = ConfigUtils.isMobile();
        return (
            <div className={"ButtonBar controlgroup " + this.props.className + (this.props.disabled ? " buttonbar-disabled" : "")}>
                {this.props.buttons.map((entry, idx) => {
                    if (Array.isArray(entry) && entry.length > 1) {
                        const active = entry.find(e => e.key === this.props.active) !== undefined ? this.props.active : null;
                        return (
                            <MenuButton active={active} key={"combo" + idx} onActivate={(value) => this.props.onClick(value, entry.find(e => e.key === value).data)}>
                                {entry.map(comboentry => (
                                    <div
                                        className="buttonbar-combo-entry" key={comboentry.key}
                                        onClick={() => this.props.onClick(comboentry.key, comboentry.data)}
                                        value={comboentry.key} {...withTooltip(comboentry.tooltip)}
                                    >
                                        {comboentry.icon ? (<Icon icon={comboentry.icon} />) : null}
                                        {comboentry.label && (!isMobile || !comboentry.icon || this.props.forceLabel || comboentry.forceLabel) ? (
                                            <span className="buttonbar-combo-entry-label">{comboentry.label}</span>
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
                            <button className={classes}
                                disabled={entry.disabled || this.props.disabled} key={entry.key}
                                onClick={entry.type !== "submit" ? () => this.props.onClick(entry.key, entry.data) : null}
                                type={entry.type || "button"}
                                {...withTooltip(entry.tooltip)}
                            >
                                {entry.icon ? (<Icon icon={entry.icon} />) : null}
                                {entry.label && (!isMobile || !entry.icon || this.props.forceLabel || entry.forceLabel) ? (<span>{entry.label}</span>) : null}
                            </button>
                        );
                    } else {
                        return null;
                    }
                })}
            </div>
        );
    }
}
