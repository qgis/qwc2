/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {setEditContext, clearEditContext, getFeatureTemplate} from '../actions/editing';
import {LayerRole, addLayerFeatures, removeLayer, refreshLayer, changeLayerProperty} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import AttributeForm from '../components/AttributeForm';
import Icon from '../components/Icon';
import PickFeature from '../components/PickFeature';
import SideBar from '../components/SideBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ConfigUtils from '../utils/ConfigUtils';
import EditingInterface from '../utils/EditingInterface';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import './style/Editing.css';


/**
 * Allows editing geometries and attributes of datasets.
 *
 * The attribute form is generated from the QGIS attribute form configuration.
 *
 * This plugin queries the dataset via the editing service specified by
 * `editServiceUrl` in `config.json` (by default the `qwc-data-service`).
 */
class Editing extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        /** Whether to enable the "Clone existing geometry" functionality. */
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
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        /** Whether snapping is available when editing. */
        snapping: PropTypes.bool,
        /** Whether snapping is enabled by default when editing.
         *  Either `false`, `edge`, `vertex` or `true` (i.e. both vertex and edge). */
        snappingActive: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        taskData: PropTypes.object,
        theme: PropTypes.object,
        /** The default width of the editing sidebar, as a CSS width string. */
        width: PropTypes.string
    };
    static defaultProps = {
        width: "30em",
        side: 'right',
        snapping: true,
        snappingActive: true,
        allowCloneGeometry: true
    };
    state = {
        selectedLayer: null,
        selectedLayerVisibility: null,
        pickedFeatures: null,
        busy: false,
        minimized: false,
        drawPick: false
    };
    onShow = () => {
        if (this.props.taskData) {
            this.changeSelectedLayer(this.props.taskData.layer, "Pick", this.props.taskData.feature);
        } else {
            this.changeSelectedLayer(this.state.selectedLayer, "Pick");
        }
        this.props.setSnappingConfig(this.props.snapping, this.props.snappingActive);
    };
    onHide = () => {
        this.props.clearEditContext('Editing');
        this.setLayerVisibility(this.state.selectedLayer, this.state.selectedLayerVisibility);
        this.setState({minimized: false, drawPick: false});
    };
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
                const layer = this.props.layers.find(l => l.role === LayerRole.THEME);
                this.props.iface.getFeature(editDataset, newPoint.coordinate, this.props.map.projection, scale, 96, (featureCollection) => {
                    const features = featureCollection ? featureCollection.features : null;
                    this.setState({pickedFeatures: features});
                    const feature = features ? features[0] : null;
                    this.props.setEditContext('Editing', {feature: feature, changed: false, geomReadOnly: editPermissions.updatable === false});
                }, layer.filterParams?.[this.state.selectedLayer], layer.filterGeom);
            }
        }
        if (prevProps.editContext.changed !== this.props.editContext.changed) {
            this.props.setCurrentTaskBlocked(this.props.editContext.changed === true, LocaleUtils.tr("editing.unsavedchanged"));
        }
        if (!this.props.editContext.feature && prevState.pickedFeatures) {
            this.setState({pickedFeatures: null});
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
                {attributeForm}
            </div>

        );
    };
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("editing.maximize") : LocaleUtils.tr("editing.minimize");
        const extraTitlebarContent = (<Icon className="editing-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState((state) => ({minimized: !state.minimized}))} title={minMaxTooltip}/>);
        const attribFormVisible = !!(this.props.editContext.feature && (this.props.editContext.action === "Pick" || this.props.editContext.feature.geometry));
        return [(
            <SideBar extraTitlebarContent={extraTitlebarContent} heightResizeable={attribFormVisible}
                icon={"editing"} id="Editing" key="EditingSidebar" onHide={this.onHide} onShow={this.onShow}
                side={this.props.side} title="appmenu.items.Editing" width={this.props.width}
            >
                {() => ({
                    body: this.state.minimized ? null : this.renderBody()
                })}
            </SideBar>
        ), this.state.drawPick ? (
            <PickFeature featureFilter={this.pickFilter} featurePicked={this.geomPicked} key="FeaturePicker" />
        ) : null];
    }
    actionClicked = (action, data) => {
        this.setState({drawPick: false, pickedFeatures: null});
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
    };
    pickFilter = (feature) => {
        const geomType = this.props.theme.editConfig[this.state.selectedLayer]?.geomType;
        return feature.geometry && (
            feature.geometry.type === geomType ||
            "Multi" + feature.geometry.type === geomType ||
            (feature.geometry.type.replace(/^Multi/, "") === geomType && feature.geometry.coordinates.length === 1)
        );
    };
    geomPicked = (layer, feature) => {
        const geomType = this.props.theme.editConfig[this.state.selectedLayer]?.geomType;
        let geometry = feature.geometry;
        if (geometry.type !== geomType) {
            if (("Multi" + feature.geometry.type) === geomType) {
                // Convert picked geometry to multi-type
                geometry = {
                    type: "Multi" + geometry.type,
                    coordinates: [geometry.coordinates]
                };
            } else if (geometry.type.replace(/^Multi/, "") === geomType && geometry.coordinates.length === 1) {
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
            id: uuidv1()
        };
        this.props.setEditContext('Editing', {action: "Draw", feature: editFeature, changed: true});
        this.setState({drawPick: false});
    };
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
    };
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
            drawPick: false
        });
    };
    setEditFeature = (featureId) => {
        const feature = this.state.pickedFeatures.find(f => f.id.toString() === featureId);
        const editConfig = this.props.theme.editConfig[this.state.selectedLayer];
        const editPermissions = editConfig.permissions || {};
        this.props.setEditContext('Editing', {feature: feature, changed: false, geomReadOnly: editPermissions.updatable === false});
    };
    toggleDrawPick = () => {
        this.setState((state) => {
            const pickActive = !state.drawPick;
            this.props.setEditContext('Editing', {action: pickActive ? null : "Draw"});
            return {drawPick: pickActive};
        });
    };
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
