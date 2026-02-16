/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import SideBar from '../../components/SideBar';
import Input from '../../components/widgets/Input';
import InputContainer from '../../components/widgets/InputContainer';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/Settings3D.css';


/**
 * Settings panel for the 3D map.
 */
export default class Settings3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    renderBody = () => {
        return (
            <div className="settings3d-body">
                <table>
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("settings3d.quality")}</td>
                            <td>
                                <InputContainer>
                                    <Input
                                        max={100} min={20} onChange={this.qualityChanged} role="input" step={20}
                                        type="range" value={this.props.sceneContext.settings.sceneQuality} />
                                    <span role="suffix">{this.props.sceneContext.settings.sceneQuality}&nbsp;%</span>
                                </InputContainer>
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("settings3d.fov")}</td>
                            <td>
                                <InputContainer>
                                    <Input
                                        max={100} min={25} onChange={this.fovChanged} role="input" step={5}
                                        type="range" value={this.props.sceneContext.settings.fov} />
                                    <span role="suffix">{this.props.sceneContext.settings.fov}&nbsp;°</span>
                                </InputContainer>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };
    render() {
        return (
            <SideBar icon="cog"
                id="Settings3D"
                title={LocaleUtils.tr("appmenu.items.Settings3D")} width="20em"
            >
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    qualityChanged = (value) => {
        this.props.sceneContext.setSetting("sceneQuality", parseInt(value, 10));
    };
    fovChanged = (value) => {
        this.props.sceneContext.setSetting("fov", parseInt(value, 10));
    };
}
