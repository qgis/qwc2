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
import {Box3, Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader';
import {v4 as uuidv4} from 'uuid';

import ConfigUtils from '../../utils/ConfigUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import SideBar from '../SideBar';
import FileSelector from '../widgets/FileSelector';
import NumberInput from '../widgets/NumberInput';
import Spinner from '../widgets/Spinner';

import './style/LayerTree3D.css';


export default class LayerTree3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        activemenu: null,
        importvisible: false,
        selectedfile: null,
        importing: false
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
                    return this.renderLayerEntry(objectId, entry, sceneContext.updateSceneObject, true);
                })}
                <div className="layertree3d-section">{LocaleUtils.tr("layertree3d.layers")}</div>
                {Object.entries(sceneContext.colorLayers).map(([layerId, entry]) => {
                    return this.renderLayerEntry(layerId, entry, sceneContext.updateColorLayer, false);
                })}
                <div className="layertree3d-option" onClick={() => this.setState(state => ({importvisible: !state.importvisible}))}>
                    <Icon icon={this.state.importvisible ? 'collapse' : 'expand'} /> {LocaleUtils.tr("layertree3d.importobjects")}
                </div>
                {this.state.importvisible ? this.renderImportForm() : null}
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
                    {entry.drawGroup ? (<Icon className="layertree3d-item-remove" icon="trash" onClick={() => this.props.sceneContext.removeSceneObject(entryId)} />) : null}
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
                                <span>Extrude: </span>
                                <NumberInput max={500} min={0} onChange={h => updateCallback(entryId, {extrusionHeight: h})} value={entry.extrusionHeight}/>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    };
    renderImportForm = () => {
        return (
            <div className="layertree3d-import-widget">
                <div>
                    <FileSelector
                        accept=".gltf" file={this.state.selectedfile}
                        onFileSelected={file => this.setState({selectedfile: file})}
                        title={LocaleUtils.tr("layertree3d.supportedformats")} />
                </div>
                <div>
                    <button className="button importlayer-addbutton" disabled={this.state.selectedfile === null || this.state.importing} onClick={this.importFile} type="button">
                        {this.state.importing ? (<Spinner />) : null}
                        {LocaleUtils.tr("layertree3d.import")}
                    </button>
                </div>
            </div>
        );
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
    importFile = () => {
        if (!this.state.selectedfile) {
            return;
        }
        this.setState({importing: true});
        const file = this.state.selectedfile;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const loader = new GLTFLoader();
            loader.parse(ev.target.result, ConfigUtils.getAssetsPath(), (gltf) => {
                // GLTF is Y-UP, we need Z-UP
                gltf.scene.rotation.x = Math.PI / 2;
                gltf.scene.updateMatrixWorld();

                const objectId = uuidv4();
                const options = {
                    drawGroup: true,
                    layertree: true,
                    title: file.name
                };
                const group = new Group();
                group.add(gltf.scene);
                gltf.scene.traverse(c => {
                    if (c.geometry) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });
                this.props.sceneContext.addSceneObject(objectId, group, options);
            }, (err) => {
                /* eslint-disable-next-line */
                console.warn(err);
            });
            this.setState({selectedfile: null, importing: false});
        };
        reader.readAsArrayBuffer(this.state.selectedfile);
    };
}
