/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setTopbarHeight} from '../../actions/map';
import AppMenu from '../AppMenu';
import Icon from '../Icon';
import SearchField3D from './SearchField3D';

import './style/TopBar3D.css';


class TopBar3D extends React.Component {
    static propTypes = {
        options: PropTypes.object,
        sceneContext: PropTypes.object,
        searchProviders: PropTypes.object,
        setTopbarHeight: PropTypes.func
    };
    state = {
    };
    render() {
        const menuItems = [
            {key: "LayerTree3D", icon: "layers"},
            {key: "Draw3D", icon: "draw"},
            {key: "Measure3D", icon: "measure"},
            {key: "Compare3D", icon: "compare"},
            {key: "DateTime3D", icon: "clock"},
            {key: "PrintScreen3D", icon: "rasterexport"}
        ];
        return (
            <div className="map3d-topbar" ref={this.storeHeight}>
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
    storeHeight = (el) => {
        if (el) {
            this.props.setTopbarHeight(el.clientHeight);
        }
    };
}

export default connect(() => ({}), {
    setTopbarHeight: setTopbarHeight
})(TopBar3D);
