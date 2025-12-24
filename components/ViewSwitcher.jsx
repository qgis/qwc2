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

import {setViewMode, ViewMode} from '../actions/display';
import ConfigUtils from '../utils/ConfigUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import Icon from './Icon';
import MapButton from './MapButton';

import './style/ViewSwitcher.css';


class ViewSwitcher extends React.Component {
    static propTypes = {
        position: PropTypes.number,
        setViewMode: PropTypes.func,
        switchTo: PropTypes.string,
        theme: PropTypes.object,
        viewMode: PropTypes.number
    };
    static defaultProps = {
        position: 1
    };
    state = {
        expanded: false
    };
    componentDidUpdate(prevProps) {
        // Handle view mode change
        if (this.props.viewMode !== prevProps.viewMode) {
            if (this.props.viewMode === ViewMode._3DFullscreen) {
                UrlParams.updateParams({v: "3d"});
            } else if (this.props.viewMode === ViewMode._3DSplitscreen) {
                UrlParams.updateParams({v: "3d2d"});
            } else if (this.props.viewMode === ViewMode._Oblique) {
                UrlParams.updateParams({v: "oblique"});
            } else {
                UrlParams.updateParams({v: "2d"});
            }
        }
    }
    render = () => {
        const buttons = [
            {mode: ViewMode._2D, icon: "2d"}
        ];
        if (this.props.theme?.map3d && ConfigUtils.havePlugin("View3D")) {
            buttons.push({mode: ViewMode._3DFullscreen, icon: "3d"});
            buttons.push({mode: ViewMode._3DSplitscreen, icon: "3d2d"});
        }
        if (this.props.theme?.obliqueDatasets && ConfigUtils.havePlugin("ObliqueView")) {
            buttons.push({mode: ViewMode._Oblique, icon: "oblique"});
        }
        if (buttons.length <= 1) {
            return null;
        }
        return (
            <MapButton
                active={this.state.expanded}
                className="view-switcher-button"
                icon={"view"}
                iconSize="xlarge"
                onClick={() => this.setState(state => ({expanded: !state.expanded}))}
                position={this.props.position}
            >
                <div className={"view-switcher-buttons" + (this.state.expanded ? " view-switcher-buttons-expanded" : "")} inert={this.state.expanded ? undefined : "true"}>
                    {buttons.map(button => (
                        <button
                            className={"map-button" + (button.mode === this.props.viewMode ? " map-button-active" : "")}
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
        this.props.setViewMode(mode);
        this.setState({expanded: false});
    };
}

export default connect(state => ({
    viewMode: state.display.viewMode,
    theme: state.theme.current
}), {
    setViewMode: setViewMode
})(ViewSwitcher);
