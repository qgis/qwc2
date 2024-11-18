/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import {AppMenu} from '../AppMenu';
import Icon from '../Icon';
import {TaskContext} from './Map3DContextTypes';

import './style/TopBar3D.css';

export default class TopBar3D extends React.Component {
    static propTypes = {
        currentTask: PropTypes.object,
        setCurrentTask: PropTypes.func
    };
    state = {
    };
    render() {
        const menuItems = [
            {key: "LayerTree3D", icon: "layers"}
        ];
        return (
            <TaskContext.Consumer>
                {taskContext => (
                    <div className="map3d-topbar">
                        <span className="map3d-topbar-spacer" />
                        <AppMenu appMenuClearsTask={false} buttonContents={this.menuButtonContents()}
                            currentTask={taskContext.currentTask} menuItems={menuItems}
                            setCurrentTask={taskContext.setCurrentTask} />
                    </div>
                )}
            </TaskContext.Consumer>
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
