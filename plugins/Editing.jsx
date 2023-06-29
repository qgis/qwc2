/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import uuid from 'uuid';
import {setEditContext, clearEditContext, getFeatureTemplate} from '../actions/editing';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import {LayerRole, addLayerFeatures, removeLayer, refreshLayer, changeLayerProperty} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import AttributeForm from '../components/AttributeForm';
import Icon from '../components/Icon';
import SideBar from '../components/SideBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ConfigUtils from '../utils/ConfigUtils';
import EditingInterface from '../utils/EditingInterface';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import './style/Editing.css';


class Editing extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        allowCloneGeometry: PropTypes.bool,
        changeLayerProperty: PropTypes.func,
        clearEditContext: PropTypes.func,
        currentEditContext: PropTypes.string,
        editContext: PropTypes.object,
        enabled: PropTypes.bool,
        iface: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        refreshLayer: PropTypes.func,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        setEditContext: PropTypes.func,
        setSnappingConfig: PropTypes.func,
        side: PropTypes.string,
        snapping: PropTypes.bool,
        snappingActive: PropTypes.bool,
        taskData: PropTypes.object,
        theme: PropTypes.object,
        touchFriendly: PropTypes.bool,
        width: PropTypes.string
    }
    static defaultProps = {
        touchFriendly: true,
        width: "30em",
        side: 'right',
        snapping: true,
        snappingActive: true,
        allowCloneGeometry: true
    }
    state = {
        selectedLayer: null,
        selectedLayerVisibility: null,
        pickedFeatures: null,
        busy: false,
        minimized: false,
        drawPick: false,
        drawPickResults: null
    }
    onShow = () => {
        if (this.props.taskData) {
            this.changeSelectedLayer(this.props.taskData.layer, "Pick", this.props.taskData.feature);
        } else {
            this.changeSelectedLayer(this.state.selectedLayer, "Pick");
        }
        this.props.setSnappingConfig(this.props.snapping, this.props.snappingActive);
    }
    onHide = () => {
        this.props.clearEditContext('Editing');
        this.setLayerVisibility(this.state.selectedLayer, this.state.selectedLayerVisibility);
        this.setState({minimized: false, drawPick: false, drawPickResults: null});
    }
    componentDidUpdate(prevProps, prevState) {
        const themeSublayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(LayerUtils.getSublayerNames(layer)) : accum;
        }, []);
        // Update selected layer on layers change
        if (this.props.enabled && (this.props.layers !== prevProps.layers || !prevProps.enabled)) {
            const layerIds = Object.keys(this.props.theme && this.props.theme.editConfig || {}).filter(layerId => themeSublayers.includes(layerId));
            if (!isEmpty(layerIds)) {
                if (!layerIds.includes(this.state.selectedLayer)) {
                    this.changeSelectedLayer(layerIds[0], "Pick");
                }
            } else if (this.state.selectedLayer) {
                this.changeSelectedLayer(null);
            }
        }
        // If click point changed and in pick mode with a selected layer, trigger a pick
        const isCurrentContext = this.props.editContext.id === this.props.currentEditContext;
        if (this.props.enabled && isCurrentContext && this.props.editContext.action === 'Pick' && this.state.selectedLayer && !this.props.editContext.changed) {
            const newPoint = this.props.map.click || {};
            const oldPoint = prevProps.map.click || {};
            if (newPoint.coordinate && !isEqual(newPoint.coordinate, oldPoint.coordinate)) {
                const scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
                const editConfig = this.props.theme.editConfig[this.state.selectedLayer];
                const editPermissions = editConfig.permissions || {};
                const editDataset = editConfig.editDataset;
                this.props.iface.getFeature(editDataset, newPoint.coordinate, this.props.map.projection, scale, 96, (featureCollection) => {
                    const features = featureCollection ? featureCollection.features : null;
                    this.setState({pickedFeatures: features});
                    const feature = features ? features[0] : null;
                    this.props.setEditContext('Editing', {feature: feature, changed: false, geomReadOnly: editPermissions.updatable === false});
                });
            }
        }
        if (prevProps.editContext.changed !== this.props.editContext.changed) {
            this.props.setCurrentTaskBlocked(this.props.editContext.changed === true, LocaleUtils.tr("editing.unsavedchanged"));
        }
        if (!this.props.editContext.feature && prevState.pickedFeatures) {
            this.setState({pickedFeatures: null});
        }
        // Handle drawPick
        if (this.state.drawPick && this.props.map.click && this.props.map.click !== prevProps.map.click) {
            this.drawPickQuery(this.props.map.click.coordinate);
        }
    }
    renderBody = () => {
        if (!this.props.theme || isEmpty(this.props.theme.editConfig)) {
            return (
                <div role="body" style={{padding: "1em"}}>
                    {LocaleUtils.tr("editing.noeditablelayers")}
                </div>
            );
        }
        const editConfig = this.props.theme.editConfig;
        const curConfig = editConfig[this.state.selectedLayer];
        if (!curConfig) {
            return (
                <div role="body" style={{padding: "1em"}}>
                    {LocaleUtils.tr("editing.noeditablelayers")}
                </div>
            );
        }
        const editPermissions = curConfig.permissions || {};

        const actionButtons = [];
        actionButtons.push({key: 'Pick', icon: 'pick', label: LocaleUtils.trmsg("editing.pick"), data: {action: 'Pick', geomReadOnly: false, feature: null}});
        if ( editPermissions.creatable !== false) {
            // Draw button will appear by default if no permissions are defined in theme editConfig or when creatable permission is set
            actionButtons.push({key: 'Draw', icon: 'editdraw', label: LocaleUtils.trmsg("editing.draw"), data: {action: 'Draw', geomReadOnly: false}});
        }
        if (ConfigUtils.havePlugin("AttributeTable")) {
            actionButtons.push({key: 'AttribTable', icon: 'editing', label: LocaleUtils.trmsg("editing.attrtable"), data: {action: 'AttrTable'}});
        }

        let featureSelection = null;
        if (this.state.pickedFeatures) {
            const featureText = LocaleUtils.tr("editing.feature");
            featureSelection = (
                <div className="editing-feature-selection">
                    <select className="combo editing-feature-select" disabled={this.props.editContext.changed === true || this.props.editContext.id !== this.props.currentEditContext} onChange={(ev) => this.setEditFeature(ev.target.value)}  value={(this.props.editContext.feature || {}).id || ""}>
                        {this.state.pickedFeatures.map(feature => (
                            <option key={feature.id} value={feature.id}>{curConfig.displayField ? feature.properties[curConfig.displayField] : featureText + " " + feature.id}</option>
                        ))}
                    </select>
                </div>
            );
        }
        let pickBar = null;
        if (this.props.allowCloneGeometry && (this.props.editContext.action === "Draw" || this.state.drawPick) && !(this.props.editContext.feature || {}).geometry) {
            const pickButtons = [
                {key: 'DrawPick', icon: 'pick', label: LocaleUtils.trmsg("editing.pickdrawfeature")}
            ];
            pickBar = (<ButtonBar active={this.state.drawPick ? "DrawPick" : null} buttons={pickButtons} onClick={this.toggleDrawPick} />);
        }
        let drawPickResults = null;
        if (this.state.drawPickResults) {
            let count = 0;
            drawPickResults = (
                <div className="editing-drawpick-results">
                    {Object.entries(this.state.drawPickResults).map(([layername, features]) => {
                        return features.map(feature => {
                            if (!feature.geometry) {
                                return null;
                            }
                            // If geomtype mismatches and is not convertible (i.e. multipart geom with one part to single part), skip
                            const singlePartMultiGeom = feature.geometry.type.startsWith("Multi") && feature.geometry.coordinates.length === 1;
                            if (!(feature.geometry.type === curConfig.geomType || (feature.geometry.type === "Multi" + curConfig.geomType && singlePartMultiGeom))) {
                                return null;
                            }
                            count += 1;
                            return (
                                <div key={layername + "." + feature.id}
                                    onClick={() => this.drawPickFeature(feature)}
                                    onMouseEnter={() => this.drawPickSetHighlight(feature)} onMouseLeave={this.drawPickClearHighlight}
                                >{((LayerUtils.searchLayer(this.props.layers, 'name', layername) || {sublayer: {}}).sublayer.title || layername) + ": " + feature.id}</div>
                            );
                        });
                    })}
                </div>
            );
            if (count === 0) {
                drawPickResults = (
                    <div className="editing-drawpick-results"><i>{LocaleUtils.tr("editing.nocompatpick")}</i></div>
                );
            }
        }
        let attributeForm = null;
        if (this.props.editContext.feature && (this.props.editContext.action === "Pick" || this.props.editContext.feature.geometry)) {
            attributeForm = (
                <AttributeForm editConfig={curConfig} editContext={this.props.editContext} iface={this.props.iface} readOnly={editPermissions.updatable === false} />
            );
        }
        const themeSublayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(LayerUtils.getSublayerNames(layer)) : accum;
        }, []);
        return (
            <div className="editing-body">
                <div className="editing-layer-selection">
                    <select className="combo editing-layer-select" disabled={this.props.editContext.changed === true || this.props.editContext.id !== this.props.currentEditContext} onChange={ev => this.changeSelectedLayer(ev.target.value)} value={this.state.selectedLayer || ""}>
                        {Object.keys(editConfig).filter(layerId => themeSublayers.includes(layerId)).map(layerId => {
                            const layerName = editConfig[layerId].layerName;
                            const match = LayerUtils.searchLayer(this.props.layers, 'name', layerName, [LayerRole.THEME]);
                            return (
                                <option key={layerId} value={layerId}>{match ? match.sublayer.title : layerName}</option>
                            );
                        })}
                    </select>
                </div>
                <ButtonBar active={this.state.drawPick ? "Draw" : this.props.editContext.action} buttons={actionButtons} disabled={this.props.editContext.changed || this.props.editContext.id !== this.props.currentEditContext} onClick={this.actionClicked} />
                {featureSelection}
                {pickBar}
                {drawPickResults}
                {attributeForm}
            </div>

        );
    }
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("editing.maximize") : LocaleUtils.tr("editing.minimize");
        const extraTitlebarContent = (<Icon className="editing-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState({minimized: !this.state.minimized})} title={minMaxTooltip}/>);
        const attribFormVisible = !!(this.props.editContext.feature && (this.props.editContext.action === "Pick" || this.props.editContext.feature.geometry));
        return (
            <SideBar extraTitlebarContent={extraTitlebarContent} heightResizeable={attribFormVisible} icon={"editing"} id="Editing" onHide={this.onHide} onShow={this.onShow}
                side={this.props.side} title="appmenu.items.Editing" width={this.props.width}>
                {() => ({
                    body: this.state.minimized ? null : this.renderBody()
                })}
            </SideBar>
        );
    }
    actionClicked = (action, data) => {
        this.setState({drawPick: false, drawPickResults: null});
        if (action === "AttribTable") {
            this.props.setCurrentTask("AttributeTable", null, null, {layer: this.state.selectedLayer});
        } else if (action === "Draw") {
            const editConfig = this.props.theme.editConfig;
            const curConfig = editConfig[this.state.selectedLayer];
            const feature = getFeatureTemplate(curConfig, {
                type: "Feature",
                properties: {}
            });
            this.props.setEditContext('Editing', {...data, feature: feature});
        } else {
            this.props.setEditContext('Editing', {...data});
        }
    }
    setLayerVisibility = (selectedLayer, visibility) => {
        if (selectedLayer !== null) {
            const path = [];
            let sublayer = null;
            const layer = this.props.layers.find(l => (l.role === LayerRole.THEME && (sublayer = LayerUtils.searchSubLayer(l, 'name', selectedLayer, path))));
            if (layer && sublayer) {
                const oldvisibility = sublayer.visibility;
                if (oldvisibility !== visibility && visibility !== null) {
                    const recurseDirection = !oldvisibility ? "both" : "children";
                    this.props.changeLayerProperty(layer.uuid, "visibility", visibility, path, recurseDirection);
                }
                return oldvisibility;
            }
        }
        return null;
    }
    changeSelectedLayer = (selectedLayer, action = null, feature = null) => {
        const curConfig = this.props.theme && this.props.theme.editConfig && selectedLayer ? this.props.theme.editConfig[selectedLayer] : null;
        const editPermissions = curConfig ? (curConfig.permissions || {}) : {};
        this.props.setEditContext('Editing', {action: action || (this.state.drawPick ? "Draw" : this.props.editContext.action), feature: feature, geomType: curConfig ? curConfig.geomType : null, geomReadOnly: editPermissions.updatable === false});

        let prevLayerVisibility = null;
        if (this.state.selectedLayer !== null) {
            this.setLayerVisibility(this.state.selectedLayer, this.state.selectedLayerVisibility);
            prevLayerVisibility = this.setLayerVisibility(selectedLayer, true);
        }

        this.setState({
            selectedLayer: selectedLayer,
            selectedLayerVisibility: prevLayerVisibility,
            drawPick: false,
            drawPickResults: null
        });
    }
    setEditFeature = (featureId) => {
        const feature = this.state.pickedFeatures.find(f => f.id.toString() === featureId);
        const editConfig = this.props.theme.editConfig[this.state.selectedLayer];
        const editPermissions = editConfig.permissions || {};
        this.props.setEditContext('Editing', {feature: feature, changed: false, geomReadOnly: editPermissions.updatable === false});
    }
    toggleDrawPick = () => {
        const pickActive = !this.state.drawPick;
        this.setState({drawPick: pickActive, drawPickResults: null});
        this.props.setEditContext('Editing', {action: pickActive ? null : "Draw"});
    }
    drawPickQuery = (coordinates) => {
        const queryableLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
        if (!queryableLayers) {
            return;
        }
        this.setState({drawPickResults: {}});
        queryableLayers.forEach(layer => {
            const request = IdentifyUtils.buildRequest(layer, layer.queryLayers.join(","), coordinates, this.props.map);
            IdentifyUtils.sendRequest(request, (response) => {
                if (response) {
                    this.setState({drawPickResults: {...this.state.drawPickResults, ...IdentifyUtils.parseXmlResponse(response, this.props.map.projection)}});
                }
            });
        });
    }
    drawPickFeature = (feature) => {
        const curConfig = this.props.theme.editConfig[this.state.selectedLayer];
        let geometry = feature.geometry;
        if (geometry.type !== curConfig.geomType) {
            if (("Multi" + geometry.type) === curConfig.geomType) {
                // Convert picked geometry to multi-type
                geometry = {
                    type: "Multi" + geometry.type,
                    coordinates: [geometry.coordinates]
                };
            } else if (geometry.type.replace(/^Multi/, "") === curConfig.geomType && geometry.coordinates.length === 1) {
                // Convert picked geometry to single type
                geometry = {
                    type: geometry.type.replace(/^Multi/, ""),
                    coordinates: geometry.coordinates[0]
                };
            } else {
                // Should not happen, mismatching geometries should already have been filtered from the list of choices
                return;
            }
        }
        const editFeature = {
            type: "Feature",
            geometry: geometry,
            id: uuid.v1()
        };
        this.props.setEditContext('Editing', {action: "Draw", feature: editFeature, changed: true});
        this.setState({drawPick: false, drawPickResults: null});
        this.drawPickClearHighlight();
    }
    drawPickSetHighlight = (feature) => {
        const layer = {
            id: "pickhighlight",
            role: LayerRole.SELECTION
        };
        this.props.addLayerFeatures(layer, [feature], true);
    }
    drawPickClearHighlight = () => {
        this.props.removeLayer("pickhighlight");
    }
}

export default (iface = EditingInterface) => {
    return connect(state => ({
        enabled: state.task.id === 'Editing',
        theme: state.theme.current,
        layers: state.layers.flat,
        map: state.map,
        iface: iface,
        editContext: state.editing.contexts.Editing || {},
        currentEditContext: state.editing.currentContext,
        taskData: state.task.id === "Editing" ? state.task.data : null
    }), {
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
        clearEditContext: clearEditContext,
        setEditContext: setEditContext,
        setSnappingConfig: setSnappingConfig,
        setCurrentTask: setCurrentTask,
        setCurrentTaskBlocked: setCurrentTaskBlocked,
        refreshLayer: refreshLayer,
        changeLayerProperty: changeLayerProperty
    })(Editing);
};
