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
import NumberInput from '../widgets/NumberInput';

import './style/LayerTree3D.css';


export default class LayerTree3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        activemenu: null
    };
    render() {
        return (
            <div>
                <SideBar icon="layers" id="LayerTree3D"
                    title={LocaleUtils.tr("appmenu.items.LayerTree3D")}
                    width="20em"
                >
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
            </div>
        );
    }
    renderBody = () => {
        const sceneContext = this.props.sceneContext;
        return (
            <div>
                <div className="layertree3d-section">{LocaleUtils.tr("layertree3d.objects")}</div>
                {Object.entries(sceneContext.sceneObjects).map(([objectId, entry]) => {
                    return this.renderLayerEntry(objectId, entry, sceneContext.updateSceneObject);
                })}
                <div className="layertree3d-section">{LocaleUtils.tr("layertree3d.layers")}</div>
                {sceneContext.colorLayers.map(entry => {
                    return this.renderLayerEntry(entry.id, entry, sceneContext.updateColorLayer);
                })}
            </div>
        );
    };
    renderLayerEntry = (entryId, entry, updateCallback) => {
        if (entry.layertree === false) {
            return null;
        }
        const classes = classNames({
            "layertree3d-item": true,
            "layertree3d-item-disabled": !entry.visibility
        });
        const optMenuClasses = classNames({
            "layertree3d-item-menubutton": true,
            "layertree3d-item-menubutton-active": this.state.activemenu === entryId
        });
        return (
            <div className="layertree3d-item-container" key={entryId}>
                <div className={classes}>
                    <Icon className="layertree3d-item-checkbox"
                        icon={entry.visibility ? "checked" : "unchecked"}
                        onClick={() => updateCallback(entryId, {visibility: !entry.visibility})}
                    />
                    <span className="layertree3d-item-title" title={entry.title ?? entryId}>{entry.title ?? entryId}</span>
                    <Icon className={optMenuClasses} icon="cog" onClick={() => this.layerMenuToggled(entryId)}/>
                </div>
                {this.state.activemenu === entryId ? (
                    <div className="layertree3d-item-optionsmenu">
                        <div className="layertree3d-item-optionsmenu-row">
                            <Icon icon="transparency" />
                            <input className="layertree3d-item-transparency-slider" max="255" min="0"
                                onChange={(ev) => updateCallback(entryId, {opacity: parseInt(ev.target.value, 10)})}
                                step="1" type="range" value={entry.opacity} />
                        </div>
                        {entry.extrusionHeight !== undefined ? (
                            <div className="layertree3d-item-optionsmenu-row">
                                <span>Extrude: </span>
                                <NumberInput max={500} min={0} onChange={h => updateCallback(entryId, {extrusionHeight: h})} value={entry.extrusionHeight}/>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    };
    layerMenuToggled = (entryId) => {
        this.setState((state) => ({activemenu: state.activemenu === entryId ? null : entryId}));
    };
}
