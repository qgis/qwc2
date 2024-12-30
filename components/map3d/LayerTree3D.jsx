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
import SideBar from '../SideBar';

import './style/LayerTree3D.css';


export default class LayerTree3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    render() {
        return (
            <div>
                <SideBar
                    icon="layers"
                    id="LayerTree3D"
                    title={LocaleUtils.tr("appmenu.items.LayerTree3D")}
                    width="20em"
                >
                    {() => ({
                        body: this.renderDrapedLayerEntries()
                    })}
                </SideBar>
            </div>
        );
    }
    renderDrapedLayerEntries = () => {
        const sceneContext = this.props.sceneContext;
        return (
            <div className="layertree-item-container">
                <div className="layertree-section">{LocaleUtils.tr("layertree3d.objects")}</div>
                {Object.entries(sceneContext.sceneObjects).map(([objectId, entry]) => {
                    if (!entry.layertree) {
                        return null;
                    }
                    const classes = classNames({
                        "layertree-item": true,
                        "layertree-item-disabled": !entry.visible
                    });
                    return (
                        <div className={classes} key={objectId}>
                            <Icon className="layertree-item-checkbox"
                                icon={entry.visible ? "checked" : "unchecked"}
                                onClick={() => sceneContext.updateSceneObject(objectId, {visible: !entry.visible})}
                            />
                            <span className="layertree-item-title" title={objectId}>{objectId}</span>
                            <span className="layertree-item-transparency">
                                <input className="layertree-item-transparency-slider" max="100" min="0"
                                    onChange={(ev) => sceneContext.updateSceneObject(objectId, {opacity: parseInt(ev.target.value, 10) / 100})}
                                    step="1" type="range" value={entry.opacity * 100} />
                            </span>
                        </div>
                    );
                })}
                <div className="layertree-section">{LocaleUtils.tr("layertree3d.layers")}</div>
                {sceneContext.colorLayers.map(entry => {
                    const classes = classNames({
                        "layertree-item": true,
                        "layertree-item-disabled": !entry.visibility
                    });
                    return (
                        <div className={classes} key={entry.id}>
                            <Icon className="layertree-item-checkbox"
                                icon={entry.visibility ? "checked" : "unchecked"}
                                onClick={() => sceneContext.updateColorLayer(entry.id, {visibility: !entry.visibility})}
                            />
                            <span className="layertree-item-title" title={entry.title}>{entry.title}</span>
                            <span className="layertree-item-transparency">
                                <input className="layertree-item-transparency-slider" max="255" min="0"
                                    onChange={(ev) => sceneContext.updateColorLayer(entry.id, {opacity: parseInt(ev.target.value, 10)})}
                                    step="1" type="range" value={entry.opacity} />
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };
}
