/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classNames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {Box3} from 'three';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import SideBar from '../SideBar';
import NumberInput from '../widgets/NumberInput';
import ImportObjects3D from './ImportObjects3D';

import './style/LayerTree3D.css';


export default class LayerTree3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        activestylemenu: null,
        activemenu: null,
        importvisible: false
    };
    render() {
        return (
            <SideBar icon="layers" id="LayerTree3D"
                title={LocaleUtils.tr("appmenu.items.LayerTree3D")}
                width="20em"
            >
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
        const sceneContext = this.props.sceneContext;
        return (
            <div>
                <div className="layertree3d-layers">
                    <div className="layertree3d-section">{LocaleUtils.tr("layertree3d.objects")}</div>
                    {Object.entries(sceneContext.sceneObjects).map(([objectId, entry]) => {
                        return this.renderLayerEntry(objectId, entry, sceneContext.updateSceneObject, true);
                    })}
                    <div className="layertree3d-section">{LocaleUtils.tr("layertree3d.layers")}</div>
                    {Object.entries(sceneContext.colorLayers).map(([layerId, entry]) => {
                        return this.renderLayerEntry(layerId, entry, sceneContext.updateColorLayer, false);
                    })}
                    <div className="layertree3d-option" onClick={() => this.setState(state => ({importvisible: !state.importvisible}))}>
                        <Icon icon={this.state.importvisible ? 'collapse' : 'expand'} /> {LocaleUtils.tr("layertree3d.importobjects")}
                    </div>
                </div>
                {this.state.importvisible ? (<ImportObjects3D sceneContext={this.props.sceneContext} />) : null}
            </div>
        );
    };
    renderLayerEntry = (entryId, entry, updateCallback, isObject) => {
        if (entry.layertree === false) {
            return null;
        }
        const classes = classNames({
            "layertree3d-item": true,
            "layertree3d-item-disabled": !entry.visibility
        });
        const styleMenuClasses = classNames({
            "layertree3d-item-menubutton": true,
            "layertree3d-item-menubutton-active": this.state.activestylemenu === entryId
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
                    {!Object.keys(entry.styles || {}).length > 1 ? (
                        <Icon className={styleMenuClasses} icon="paint" onClick={() => this.layerStyleMenuToggled(entryId)}/>
                    ) : null}
                    {entry.drawGroup || entry.imported ? (<Icon className="layertree3d-item-remove" icon="trash" onClick={() => this.props.sceneContext.removeSceneObject(entryId)} />) : null}
                    <Icon className={optMenuClasses} icon="cog" onClick={() => this.layerMenuToggled(entryId)}/>
                </div>
                {this.state.activemenu === entryId ? (
                    <div className="layertree3d-item-optionsmenu">
                        <div className="layertree3d-item-optionsmenu-row">
                            {isObject ? (
                                <Icon icon="zoom" onClick={() => this.zoomToObject(entryId)} title={LocaleUtils.tr("layertree3d.zoomtoobject")} />
                            ) : null}
                            <Icon icon="transparency" />
                            <input className="layertree3d-item-transparency-slider" max="255" min="0"
                                onChange={(ev) => updateCallback(entryId, {opacity: parseInt(ev.target.value, 10)})}
                                step="1" type="range" value={entry.opacity} />
                        </div>
                        {entry.extrusionHeight !== undefined ? (
                            <div className="layertree3d-item-optionsmenu-row">
                                <span>Extrude:</span>
                                <>&nbsp;</>
                                <select
                                    onChange={ev => updateCallback(entryId, {extrusionHeight: ev.target.value === "__value" ? 0 : ev.target.value})}
                                    value={typeof entry.extrusionHeight === "string" ? entry.extrusionHeight : "__value"}
                                >
                                    <option value="__value">{LocaleUtils.tr("layertree3d.customheight")}</option>
                                    {(entry.fields || []).map(field => (
                                        <option key={field} value={field}>{field}</option>
                                    ))}
                                </select>
                                {typeof entry.extrusionHeight !== "string" ? (
                                    <NumberInput max={500} min={0} onChange={h => updateCallback(entryId, {extrusionHeight: h})} value={entry.extrusionHeight}/>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {this.state.activestylemenu === entryId ? (
                    <div className="layertree3d-item-stylemenu">
                        {Object.keys(entry.styles).map(name => (
                            <div key={name} onClick={() => updateCallback(entryId, {style: name})}>
                                <Icon icon={entry.style === name ? "radio_checked" : "radio_unchecked"} />
                                <div>{name}</div>
                            </div>
                        ))}
                    </div>
                ) : null}
                {!isEmpty(entry.sublayers) ? (
                    <div className="layertree3d-item-sublayers">
                        {entry.sublayers.map((sublayer, idx) => this.renderSublayer(sublayer, entryId, updateCallback, [idx], entry.visibility))}
                    </div>
                ) : null}
            </div>
        );
    };
    renderSublayer = (sublayer, entryId, updateCallback, path, parentVisible) => {
        const key = entryId + ":" + path.join(":");
        const classes = classNames({
            "layertree3d-item": true,
            "layertree3d-item-disabled": !parentVisible || !sublayer.visibility
        });
        const optMenuClasses = classNames({
            "layertree3d-item-menubutton": true,
            "layertree3d-item-menubutton-active": this.state.activemenu === key
        });
        return (
            <div className="layertree3d-item-container" key={key}>
                <div className={classes}>
                    <Icon className="layertree3d-item-checkbox"
                        icon={sublayer.visibility ? "checked" : "unchecked"}
                        onClick={() => updateCallback(entryId, {visibility: !sublayer.visibility}, path)}
                        sublayer="layertree3d-item-checkbox"
                    />
                    <span className="layertree3d-item-title" title={sublayer.title}>{sublayer.title}</span>
                    <Icon className={optMenuClasses} icon="cog" onClick={() => this.layerMenuToggled(key)}/>
                </div>
                {this.state.activemenu === key ? (
                    <div className="layertree3d-item-optionsmenu">
                        <div className="layertree3d-item-optionsmenu-row">
                            <Icon icon="transparency" />
                            <input className="layertree3d-item-transparency-slider" max="255" min="0"
                                onChange={(ev) => updateCallback(entryId, {opacity: parseInt(ev.target.value, 10)}, path)}
                                step="1" type="range" value={sublayer.opacity} />
                        </div>
                    </div>
                ) : null}
                {!isEmpty(sublayer.sublayers) ? (
                    <div className="layertree3d-item-sublayers">
                        {sublayer.sublayers.map((child, idx) => this.renderSublayer(child, entryId, updateCallback, [...path, idx], parentVisible && sublayer.visibility))}
                    </div>
                ) : null}
            </div>
        );
    };
    layerStyleMenuToggled = (entryId) => {
        this.setState((state) => ({activestylemenu: state.activestylemenu === entryId ? null : entryId}));
    };
    layerMenuToggled = (entryId) => {
        this.setState((state) => ({activemenu: state.activemenu === entryId ? null : entryId}));
    };
    zoomToObject = (objectId) => {
        const obj = this.props.sceneContext.getSceneObject(objectId);
        const bbox = new Box3();
        if (obj?.tiles?.root) {
            obj.tiles.root.cached.boundingVolume.getAABB(bbox);
        } else {
            bbox.setFromObject(obj);
        }
        if (!bbox.isEmpty()) {
            const bounds = [bbox.min.x, bbox.min.y, bbox.max.x, bbox.max.y];
            this.props.sceneContext.setViewToExtent(bounds, 0);
        }
    };
}
