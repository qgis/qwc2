/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setView3dMode, View3DMode} from '../../actions/display';
import Icon from '../Icon';
import MapButton from '../MapButton';

import './style/View3DSwitcher.css';


class View3DSwitcher extends React.Component {
    static propTypes = {
        position: PropTypes.number,
        setView3dMode: PropTypes.func,
        switchTo: PropTypes.string,
        view3dMode: PropTypes.number
    };
    state = {
        expanded: false
    };
    render = () => {
        const buttons = [
            {mode: View3DMode.DISABLED, icon: "2d"},
            {mode: View3DMode.FULLSCREEN, icon: "3d"},
            {mode: View3DMode.SPLITSCREEN, icon: "3d2d"}
        ];
        return (
            <MapButton
                active={this.state.expanded}
                icon={"view"}
                iconSize="xlarge"
                onClick={() => this.setState(state => ({expanded: !state.expanded}))}
                position={this.props.position}
            >
                <div className={"view3d-switcher-buttons" + (this.state.expanded ? " view3d-switcher-buttons-expanded" : "")} inert={this.state.expanded ? undefined : "true"}>
                    {buttons.map(button => (
                        <button
                            className={"map-button" + (button.mode === this.props.view3dMode ? " map-button-active" : "")}
                            key={button.icon}
                            onClick={() => this.switchMode(button.mode)}
                        >
                            <Icon icon={button.icon} size="xlarge" />
                        </button>
                    ))}
                </div>
            </MapButton>
        );
    };
    switchMode = (mode) => {
        this.props.setView3dMode(mode);
        this.setState({expanded: false});
    };
}

export default connect(state => ({
    view3dMode: state.display.view3dMode
}), {
    setView3dMode: setView3dMode
})(View3DSwitcher);
