/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import AppMenu from '../AppMenu';
import Icon from '../Icon';
import SearchField3D from './SearchField3D';

import './style/TopBar3D.css';

export default class TopBar3D extends React.Component {
    static propTypes = {
        options: PropTypes.object,
        sceneContext: PropTypes.object,
        searchProviders: PropTypes.object
    };
    state = {
    };
    render() {
        const menuItems = [
            {key: "LayerTree3D", icon: "layers"},
            {key: "DateTime3D", icon: "clock"}
        ];
        return (
            <div className="map3d-topbar">
                <SearchField3D options={this.props.options} sceneContext={this.props.sceneContext} searchProviders={this.props.searchProviders} />
                <span className="map3d-topbar-spacer" />
                <AppMenu appMenuClearsTask buttonContents={this.menuButtonContents()} menuItems={menuItems} />
            </div>
        );
    }
    menuButtonContents = () => {
        return (
            <span className="map3d-topbar-menu-button">
                <Icon icon="menu-hamburger"/>
            </span>
        );
    };
}
