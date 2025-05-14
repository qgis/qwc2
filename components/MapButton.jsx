/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import Icon from './Icon';
import {MapButtonPortalContext} from './PluginsContainer';
import Spinner from './widgets/Spinner';

import './style/MapButton.css';


export default class MapButton extends React.Component {
    static contextType = MapButtonPortalContext;

    static propTypes = {
        active: PropTypes.bool,
        busy: PropTypes.bool,
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        className: PropTypes.string,
        disabled: PropTypes.bool,
        engaged: PropTypes.bool,
        icon: PropTypes.string,
        iconSize: PropTypes.string,
        onClick: PropTypes.func,
        position: PropTypes.number,
        tooltip: PropTypes.string
    };
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        if (this.context && this.props.position !== prevProps.position) {
            this.context.recomputeSpacers();
        }
    }
    render() {
        if (!this.context) {
            return null;
        }
        const className = classNames({
            "map-button": true,
            "map-button-active": this.props.active,
            "map-button-disabled": this.props.disabled,
            "map-button-engaged": this.props.engaged
        });
        const position = this.props.position || 0;
        return ReactDOM.createPortal((
            <div className="map-button-container" data-slot={position} style={{order: position}}>
                <button
                    className={`${className} ${this.props.className || ""}`}
                    onClick={this.props.onClick}
                    title={this.props.tooltip}
                >
                    {this.props.busy ? (
                        <Spinner />
                    ) : (
                        <Icon icon={this.props.icon} size={this.props.iconSize} />
                    )}
                </button>
                {this.props.children}
            </div>
        ), this.context);
    }
}
