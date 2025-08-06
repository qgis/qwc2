/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import SideBar from '../SideBar';
import Input from '../widgets/Input';

import './style/Settings3D.css';


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
                            <td><Input
                                max={100} min={20} onChange={this.qualityChanged} step={20}
                                type="range" value={this.props.sceneContext.settings.sceneQuality} /></td>
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
}
