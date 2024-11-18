/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import {SideBar} from '../SideBar';
import {LayersContext, TaskContext} from './Map3DContextTypes';

import './style/LayerTree3D.css';


export default class LayerTree extends React.Component {
    static propTypes = {
        currentTask: PropTypes.object,
        setCurrentTask: PropTypes.func
    };
    render() {
        return (
            <TaskContext.Consumer>
                {taskContext => (
                    <div>
                        <SideBar
                            currentTask={taskContext.currentTask}
                            icon="layers"
                            id="LayerTree3D"
                            setCurrentTask={taskContext.setCurrentTask}
                            title={LocaleUtils.tr("appmenu.items.LayerTree")}
                            width="20em"
                        >
                            {() => ({
                                body: this.renderBody()
                            })}
                        </SideBar>
                    </div>
                )}
            </TaskContext.Consumer>
        );
    }
    renderBody = () => {
        return (
            <LayersContext.Consumer>
                {layersContext => {
                    return [
                        this.renderDrapedLayerEntries(layersContext)
                    ];
                }}
            </LayersContext.Consumer>
        );
    };
    renderDrapedLayerEntries = (layersContext) => {
        return (
            <div className="layertree-item-container" key="draped-layers">
                {layersContext.drapedLayers.map(entry => {
                    const classes = classNames({
                        "layertree-item": true,
                        "layertree-item-disabled": !entry.visibility
                    })
                    return (
                        <div className={classes} key={entry.id}>
                            <Icon className="layertree-item-checkbox"
                                icon={entry.visibility ? "checked" : "unchecked"}
                                onClick={() => layersContext.updateDrapedLayer(entry.id, {visibility: !entry.visibility})}
                            />
                            <span className="layertree-item-title" title={entry.title}>{entry.title}</span>
                            <span className="layertree-item-transparency">
                                <input className="layertree-item-transparency-slider" max="255" min="0"
                                    onChange={(ev) => layersContext.updateDrapedLayer(entry.id, {opacity: parseInt(ev.target.value, 10)})}
                                    step="1" type="range" value={entry.opacity} />
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };
}
