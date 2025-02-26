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

import './style/View3DSwitcher.css';


class View3DSwitcher extends React.Component {
    static propTypes = {
        mapMargins: PropTypes.object,
        position: PropTypes.number,
        setView3dMode: PropTypes.func,
        switchTo: PropTypes.string,
        view3dMode: PropTypes.number
    };
    state = {
        expanded: false
    };
    render = () => {
        const right = this.props.mapMargins.right;
        const bottom = this.props.mapMargins.bottom;
        const style = {
            right: 'calc(1.5em + ' + right + 'px)',
            bottom: 'calc(var(--bottombar-height) + ' + bottom + 'px + ' + (3 + 4 * this.props.position) + 'em)'
        };
        const buttons = [
            {mode: View3DMode.DISABLED, icon: "2d"},
            {mode: View3DMode.FULLSCREEN, icon: "3d"},
            {mode: View3DMode.SPLITSCREEN, icon: "3d2d"}
        ];
        const activeButton = buttons.splice(this.props.view3dMode, 1)[0];
        return (
            <div className={"View3DSwitcher " + (this.state.expanded ? "view3d-switcher-expanded" : "")} style={style}>
                <button
                    className={"map-button " + (this.state.expanded ? "map-button-active" : "")}
                    onClick={() => this.setState(state => ({expanded: !state.expanded}))}
                >
                    <Icon icon={activeButton.icon} size="xlarge" />
                </button>
                {buttons.map(button => (
                    <button
                        className="map-button" key={button.icon}
                        onClick={() => this.switchMode(button.mode)}
                    >
                        <Icon icon={button.icon} size="xlarge" />
                    </button>
                ))}
            </div>
        );
    };
    switchMode = (mode) => {
        this.props.setView3dMode(mode);
        this.setState({expanded: false});
    };
}

export default connect(state => ({
    mapMargins: state.windows.mapMargins,
    view3dMode: state.display.view3dMode
}), {
    setView3dMode: setView3dMode
})(View3DSwitcher);
