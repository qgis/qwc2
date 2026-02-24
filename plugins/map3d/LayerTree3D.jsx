/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classNames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {setCurrentTask} from '../../actions/task';
import Icon from '../../components/Icon';
import ImportObjects3D from '../../components/map3d/ImportObjects3D';
import SideBar from '../../components/SideBar';
import NumberInput from '../../components/widgets/NumberInput';
import LayerUtils from '../../utils/LayerUtils';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/LayerTree3D.css';


/**
 * Layer and object tree for the 3D map
 */
class LayerTree3D extends React.Component {
    static propTypes = {
        /** Whether toggling a group also toggles all sublayers. */
        groupTogglesSublayers: PropTypes.bool,
        /** Base URL of imported tile sets. */
        importedTilesBaseUrl: PropTypes.string,
        sceneContext: PropTypes.object,
        setCurrentTask: PropTypes.func
    };
    static defaultProps = {
        importedTilesBaseUrl: ':/'
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
                    {sceneContext.objectTree.null.children.map(objectId => {
                        return this.renderLayerEntry(objectId, sceneContext.objectTree[objectId], this.updateSceneObject, true);
                    })}
                    <div className="layertree3d-section">{LocaleUtils.tr("layertree3d.layers")}</div>
                    {Object.entries(sceneContext.colorLayers).map(([layerId, entry]) => {
                        return this.renderLayerEntry(layerId, entry, this.updateColorLayer, false);
                    })}
                    <div className="layertree3d-option" onClick={() => this.setState(state => ({importvisible: !state.importvisible}))}>
                        <Icon icon={this.state.importvisible ? 'collapse' : 'expand'} /> {LocaleUtils.tr("layertree3d.importobjects")}
                    </div>
                </div>
                {this.state.importvisible ? (
                    <ImportObjects3D importedTilesBaseUrl={this.props.importedTilesBaseUrl} sceneContext={this.props.sceneContext} />
                ) : null}
            </div>
        );
    };
    renderLayerEntry = (entryId, entry, updateCallback, isObject, parentVisible = true, path = []) => {
        if (entry.layertree === false) {
            return null;
        }
        const key = [entryId, ...path].join(":");
        const classes = classNames({
            "layertree3d-item": true,
            "layertree3d-item-disabled": !entry.visibility || !parentVisible
        });
        const styleMenuClasses = classNames({
            "layertree3d-item-menubutton": true,
            "layertree3d-item-menubutton-active": this.state.activestylemenu === key
        });
        const optMenuClasses = classNames({
            "layertree3d-item-menubutton": true,
            "layertree3d-item-menubutton-active": this.state.activemenu === key
        });
        return (
            <div className="layertree3d-item-container" key={key}>
                <div className={classes}>
                    <Icon className="layertree3d-item-checkbox"
                        icon={this.computeVisibilityIcon(isObject, entry)}
                        onClick={() => updateCallback(entryId, {visibility: !entry.visibility}, {path})}
                    />
                    <span className="layertree3d-item-title" onClick={() => updateCallback(entryId, {visibility: !entry.visibility}, {path})} title={entry.title ?? entryId}>{entry.title ?? entryId}</span>
                    {Object.keys(entry.styles || {}).length > 1 ? (
                        <Icon className={styleMenuClasses} icon="paint" onClick={() => this.layerStyleMenuToggled(key)}/>
                    ) : null}
                    {entry.drawGroup || entry.imported ? (<Icon className="layertree3d-item-remove" icon="trash" onClick={() => this.props.sceneContext.removeSceneObject(entryId)} />) : null}
                    <Icon className={optMenuClasses} icon="cog" onClick={() => this.layerMenuToggled(key)}/>
                </div>
                {this.state.activemenu === key ? (
                    <div className="layertree3d-item-optionsmenu">
                        <div className="layertree3d-item-optionsmenu-row">
                            {isObject ? (
                                <Icon icon="zoom" onClick={() => this.props.sceneContext.zoomToObject(entryId)} title={LocaleUtils.tr("layertree3d.zoomtoobject")} />
                            ) : null}
                            {entry.imported ? (<Icon icon="draw" onClick={() => this.editObject(entryId)} />) : null}
                            <Icon icon="transparency" />
                            <input className="layertree3d-item-transparency-slider" max="255" min="0"
                                onChange={(ev) => updateCallback(entryId, {opacity: parseInt(ev.target.value, 10)}, {path})}
                                step="1" type="range" value={entry.opacity} />
                            {(!isEmpty(entry.children) || !isEmpty(entry.sublayers)) && !this.props.groupTogglesSublayers ? (
                                <Icon icon="tree" onClick={() => updateCallback(entryId, {visibility: !entry.visibility}, {path, groupTogglesSublayers: true})} title={LocaleUtils.tr("layertree.togglegroup")} />
                            ) : null}
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
                {this.state.activestylemenu === key ? (
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
                        {entry.sublayers.map((sublayer, idx) =>
                            this.renderLayerEntry(entryId, sublayer, updateCallback, isObject, parentVisible && entry.visibility, [...path, idx]))}
                    </div>
                ) : null}
                {!isEmpty(entry.children) ? (
                    <div className="layertree3d-item-sublayers">
                        {entry.children.map((childId, idx) =>
                            this.renderLayerEntry(childId, this.props.sceneContext.objectTree[childId], updateCallback, isObject, parentVisible && entry.visibility, [...path, idx]))}
                    </div>
                ) : null}
            </div>
        );
    };
    computeVisibilityIcon = (isObject, entry) => {
        if (!entry.visibility) {
            return "unchecked";
        } else {
            if (this.props.groupTogglesSublayers) {
                const subtreevisibility = isObject ? this.computeObjectTreeVisibility(entry) : LayerUtils.computeLayerVisibility(entry);
                return subtreevisibility === 1 ? "checked" : "tristate";
            } else {
                return "checked";
            }
        }
    };
    computeObjectTreeVisibility = (entry) => {
        if (isEmpty(entry.children) || entry.visibility === false) {
            return entry.visibility ? 1 : 0;
        }
        let visible = 0;
        entry.children.map(childId => {
            const child = this.props.sceneContext.objectTree[childId];
            const sublayervisibility = child.visibility ?? true;
            if (child.children && sublayervisibility) {
                visible += this.computeObjectTreeVisibility(entry);
            } else {
                visible += sublayervisibility ? 1 : 0;
            }
        });
        return visible / entry.children.length;
    };
    layerStyleMenuToggled = (entryId) => {
        this.setState((state) => ({activestylemenu: state.activestylemenu === entryId ? null : entryId}));
    };
    layerMenuToggled = (entryId) => {
        this.setState((state) => ({activemenu: state.activemenu === entryId ? null : entryId}));
    };
    editObject = (objectId) => {
        this.props.setCurrentTask("EditDataset3D", null, null, {objectId});
    };
    updateSceneObject = (objectId, options, flags = {}) => {
        this.props.sceneContext.updateSceneObject(objectId, options, {groupTogglesSublayers: this.props.groupTogglesSublayers, ...flags});
    };
    updateColorLayer = (objectId, options, flags = {}) => {
        this.props.sceneContext.updateColorLayer(objectId, options, {groupTogglesSublayers: this.props.groupTogglesSublayers, ...flags});
    };
}

export default connect((state) => ({}), {
    setCurrentTask: setCurrentTask
})(LayerTree3D);
