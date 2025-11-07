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
import {v4 as uuidv4} from 'uuid';

import {setEditContext, clearEditContext} from '../actions/editing';
import {LayerRole, addLayerFeatures, removeLayer, refreshLayer, changeLayerProperty} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import AttributeForm from '../components/AttributeForm';
import Icon from '../components/Icon';
import MessageBar from '../components/MessageBar';
import PickFeature from '../components/PickFeature';
import SideBar from '../components/SideBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ConfigUtils from '../utils/ConfigUtils';
import EditingInterface from '../utils/EditingInterface';
import {getFeatureTemplate} from '../utils/EditingUtils';
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
        filter: PropTypes.object,
        iface: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        refreshLayer: PropTypes.func,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        setEditContext: PropTypes.func,
        setSnappingConfig: PropTypes.func,
        /** Whether to show a button to open the AttributeTable (if the plugin is available). */
        showAttributeTableButton: PropTypes.bool,
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
        allowCloneGeometry: true,
        showAttributeTableButton: true
    };
    state = {
        selectedLayer: null,
        selectedLayerVisibility: null,
        pickedFeatures: null,
        busy: false,
        minimized: false,
        drawPick: false,
        pendingClone: null
    };
    onShow = () => {
        if (this.props.taskData) {
            this.changeSelectedLayer(this.props.taskData.layer, this.props.taskData.feature);
        } else {
            this.changeSelectedLayer(this.state.selectedLayer);
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
                    this.changeSelectedLayer(layerIds[0]);
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
                this.props.iface.getFeature(editConfig, newPoint.coordinate, this.props.map.projection, scale, 96, (featureCollection) => {
                    const features = featureCollection ? featureCollection.features : null;
                    this.setState({pickedFeatures: features});
                    const feature = features ? features[0] : null;
                    this.props.setEditContext('Editing', {feature: feature, changed: false});
                }, this.props.filter.filterParams?.[this.state.selectedLayer], this.props.filter.filterGeom);
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
        actionButtons.push({key: 'Pick', icon: 'pick', label: LocaleUtils.tr("editing.pick"), data: {action: 'Pick', feature: null}});
        if ( editPermissions.creatable !== false && !this.props.editContext.geomReadOnly) {
            actionButtons.push({key: 'Draw', icon: 'editdraw', label: LocaleUtils.tr("editing.draw"), data: {action: 'Draw'}});
        }
        if (ConfigUtils.havePlugin("AttributeTable") && this.props.showAttributeTableButton) {
            actionButtons.push({key: 'AttribTable', icon: 'editing', label: LocaleUtils.tr("editing.attrtable"), data: {action: 'AttrTable'}});
        }

        let featureSelection = null;
        if (this.state.pickedFeatures && this.state.pickedFeatures.length > 1) {
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
                {key: 'DrawPick', icon: 'pick', label: LocaleUtils.tr("editing.pickdrawfeature")}
            ];
            pickBar = (<ButtonBar active={this.state.drawPick ? "DrawPick" : null} buttons={pickButtons} onClick={this.toggleDrawPick} />);
        }
        let attributeForm = null;
        if (this.props.editContext.feature && (this.props.editContext.action === "Pick" || this.props.editContext.feature.geometry)) {
            attributeForm = (
                <AttributeForm editConfig={curConfig} editContext={this.props.editContext} iface={this.props.iface} onCommit={this.updatePickedFeatures} />
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
                            const layerTitle = editConfig[layerId].layerTitle ? (
                                this.props.theme.translations?.layertree?.[layerName] ?? editConfig[layerId].layerTitle
                            ) : (
                                LayerUtils.searchLayer(this.props.layers, this.props.theme.url, layerName)?.sublayer?.title ?? layerName
                            );
                            return (
                                <option key={layerId} value={layerId}>{layerTitle}</option>
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
            <SideBar extraTitlebarContent={extraTitlebarContent} heightResizeable={!this.state.minimized && attribFormVisible}
                icon={"editing"} id="Editing" key="EditingSidebar" onHide={this.onHide} onShow={this.onShow}
                side={this.props.side} title={LocaleUtils.tr("appmenu.items.Editing")} width={this.props.width}
            >
                {() => ({
                    body: this.state.minimized ? null : this.renderBody()
                })}
            </SideBar>
        ), this.state.drawPick ? (
            <PickFeature featureFilter={this.pickFilter} featurePicked={this.geomPicked} key="FeaturePicker" />
        ) : null,
        this.state.pendingClone ? (
            <MessageBar key="CloneConfirmation" onClose={this.cancelCopyAttributes}>
                <div role="body">
                    <div className="editing-clone-dialog">
                        <div className="editing-clone-header">
                            {LocaleUtils.tr("editing.clone_select_attrs")}
                        </div>
                        <div className="editing-clone-quick-actions">
                            <button className="button" onClick={this.selectAllAttributes}>
                                {LocaleUtils.tr("editing.clone_all")}
                            </button>
                            <button className="button" onClick={this.selectNoneAttributes}>
                                {LocaleUtils.tr("editing.clone_none")}
                            </button>
                            <button className="button" onClick={this.selectVisibleAttributes}>
                                {LocaleUtils.tr("editing.clone_visible")}
                            </button>
                        </div>
                        <div className="editing-clone-attributes">
                            {this.state.pendingClone.matchingAttributes.map(attr => (
                                <label className="editing-clone-attribute" key={attr.fieldId}>
                                    <input
                                        checked={this.state.pendingClone.selectedAttributes.includes(attr.fieldId)}
                                        onChange={() => this.toggleAttribute(attr.fieldId)}
                                        type="checkbox"
                                    />
                                    <span className="editing-clone-attribute-name">
                                        {attr.fieldName}
                                        {!attr.visible ? " " + LocaleUtils.tr("editing.clone_hidden") : ""}
                                        {attr.autoCalculated ? " " + LocaleUtils.tr("editing.clone_calculated") : ""}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="editing-clone-actions">
                            <button className="button" onClick={this.confirmCopyAttributes}>
                                {LocaleUtils.tr("editing.clone_ok")}
                            </button>
                            <button className="button" onClick={this.cancelCopyAttributes}>
                                {LocaleUtils.tr("editing.clone_cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            </MessageBar>
        ) : null];
    }
    actionClicked = (action, data) => {
        this.setState({drawPick: false, pickedFeatures: null});
        if (action === "AttribTable") {
            this.props.setCurrentTask("AttributeTable", null, null, {layer: this.state.selectedLayer});
        } else if (action === "Draw") {
            const editConfig = this.props.theme.editConfig;
            const curConfig = editConfig[this.state.selectedLayer];
            const featureSkel = {
                type: "Feature",
                properties: {}
            };
            const mapPrefix = (curConfig.editDataset.match(/^[^.]+\./) || [""])[0];
            getFeatureTemplate(curConfig, featureSkel, this.props.iface, mapPrefix, this.props.map.projection, feature => {
                this.props.setEditContext('Editing', {...data, feature: feature, geomReadOnly: false});
            });
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
            id: uuidv4()
        };

        const editConfig = this.props.theme.editConfig;
        const curConfig = editConfig[this.state.selectedLayer];
        const sourceProperties = feature.properties || {};
        const targetFields = curConfig.fields || [];

        // Get source layer's field configuration and build name-to-id mapping
        const sourceConfig = editConfig[layer];
        const sourceNameToIdMap = {};
        if (sourceConfig && sourceConfig.fields) {
            sourceConfig.fields.forEach(sourceField => {
                sourceNameToIdMap[sourceField.name] = sourceField.id;
                sourceNameToIdMap[sourceField.id] = sourceField.id;
            });
        }

        const sourcePropertiesById = {};
        Object.entries(sourceProperties).forEach(([key, value]) => {
            const fieldId = sourceNameToIdMap[key] || key;
            sourcePropertiesById[fieldId] = value;
        });

        if (targetFields.length > 0) {
            // Build list of matching attributes with metadata
            const matchingAttributes = [];
            targetFields.forEach(field => {
                let value = sourcePropertiesById[field.id];

                if (value !== null && value !== undefined && value !== '') {
                    // Parse number values
                    if (field.type === 'number' && typeof value === 'string') {
                        const numValue = parseFloat(value.replace(',', '.'));
                        if (!isNaN(numValue)) {
                            value = numValue;
                        }
                    }

                    matchingAttributes.push({
                        fieldId: field.id,
                        fieldName: field.name,
                        value: value,
                        visible: field.constraints?.hidden !== true,
                        autoCalculated: !!(field.defaultValue || field.expression)
                    });
                }
            });

            if (matchingAttributes.length > 0) {
                // Default selection: only visible, non-auto-calculated fields
                const defaultSelection = matchingAttributes
                    .filter(attr => attr.visible && !attr.autoCalculated)
                    .map(attr => attr.fieldId);

                this.setState({
                    drawPick: false,
                    pendingClone: {
                        editFeature: editFeature,
                        matchingAttributes: matchingAttributes,
                        selectedAttributes: defaultSelection
                    }
                });
                return;
            }
        }

        this.props.setEditContext('Editing', {action: "Draw", feature: editFeature, changed: true});
        this.setState({drawPick: false});
    };
    confirmCopyAttributes = () => {
        const {editFeature, matchingAttributes, selectedAttributes} = this.state.pendingClone;
        const copiedProperties = {};
        matchingAttributes.forEach(attr => {
            if (selectedAttributes.includes(attr.fieldId)) {
                copiedProperties[attr.fieldId] = attr.value;
            }
        });
        editFeature.properties = copiedProperties;
        this.props.setEditContext('Editing', {action: "Draw", feature: editFeature, changed: true});
        this.setState({pendingClone: null});
    };
    cancelCopyAttributes = () => {
        const {editFeature} = this.state.pendingClone;
        this.props.setEditContext('Editing', {action: "Draw", feature: editFeature, changed: true});
        this.setState({pendingClone: null});
    };
    toggleAttribute = (fieldId) => {
        this.setState(state => {
            const selectedAttributes = state.pendingClone.selectedAttributes.includes(fieldId)
                ? state.pendingClone.selectedAttributes.filter(id => id !== fieldId)
                : [...state.pendingClone.selectedAttributes, fieldId];
            return {
                pendingClone: {...state.pendingClone, selectedAttributes}
            };
        });
    };
    selectAllAttributes = () => {
        const allFieldIds = this.state.pendingClone.matchingAttributes.map(attr => attr.fieldId);
        this.setState(state => ({
            pendingClone: {...state.pendingClone, selectedAttributes: allFieldIds}
        }));
    };
    selectNoneAttributes = () => {
        this.setState(state => ({
            pendingClone: {...state.pendingClone, selectedAttributes: []}
        }));
    };
    selectVisibleAttributes = () => {
        const visibleFieldIds = this.state.pendingClone.matchingAttributes
            .filter(attr => attr.visible && !attr.autoCalculated)
            .map(attr => attr.fieldId);
        this.setState(state => ({
            pendingClone: {...state.pendingClone, selectedAttributes: visibleFieldIds}
        }));
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
                    this.props.changeLayerProperty(layer.id, "visibility", visibility, path, recurseDirection);
                }
                return oldvisibility;
            }
        }
        return null;
    };
    changeSelectedLayer = (selectedLayer, feature = null) => {
        const curConfig = this.props.theme && this.props.theme.editConfig && selectedLayer ? this.props.theme.editConfig[selectedLayer] : null;
        this.props.setEditContext('Editing', {
            action: "Pick",
            feature: feature,
            geomType: curConfig?.geomType || null,
            permissions: curConfig?.permissions || {}
        });

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
        this.props.setEditContext('Editing', {feature: feature, changed: false});
    };
    toggleDrawPick = () => {
        this.setState((state) => {
            const pickActive = !state.drawPick;
            this.props.setEditContext('Editing', {action: pickActive ? null : "Draw"});
            return {drawPick: pickActive};
        });
    };
    updatePickedFeatures = (newfeature) => {
        if (this.state.pickedFeatures) {
            this.setState(state => ({
                pickedFeatures: state.pickedFeatures.map(feature => {
                    return feature.id === newfeature.id ? newfeature : feature;
                })
            }));
        }
    };
}

export default (iface = EditingInterface) => {
    return connect(state => ({
        enabled: state.task.id === 'Editing',
        theme: state.theme.current,
        layers: state.layers.flat,
        filter: state.layers.filter,
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
