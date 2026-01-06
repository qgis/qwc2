/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import {parseNumber} from '@norbulcz/num-parse';
import dateParser from 'any-date-parser';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {setEditContext, clearEditContext} from '../actions/editing';
import {addLayerFeatures, removeLayer, changeLayerProperty} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import AttributeForm from '../components/AttributeForm';
import Icon from '../components/Icon';
import MeasureSwitcher from '../components/MeasureSwitcher';
import PickFeature from '../components/PickFeature';
import {BottomToolPortalContext} from '../components/PluginsContainer';
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
    static contextType = BottomToolPortalContext;
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        /** Whether to enable the "Clone existing geometry" functionality. */
        allowCloneGeometry: PropTypes.bool,
        changeLayerProperty: PropTypes.func,
        clearEditContext: PropTypes.func,
        currentEditContext: PropTypes.string,
        editConfigs: PropTypes.object,
        editContext: PropTypes.object,
        enabled: PropTypes.bool,
        filter: PropTypes.object,
        iface: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
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
        // Clear selected layer on layers change
        if (this.props.layers !== prevProps.layers && this.state.selectedLayer) {
            const [wmsName, layerName] = this.state.selectedLayer.split("#");
            if (!LayerUtils.searchLayer(this.props.layers, 'wms_name', wmsName, 'name', layerName)) {
                this.setState({selectedLayer: null});
            }
        }
        // If click point changed and in pick mode with a selected layer, trigger a pick
        const isCurrentContext = this.props.editContext.id === this.props.currentEditContext;
        if (this.props.enabled && isCurrentContext && this.props.editContext.action === 'Pick' && this.state.selectedLayer && !this.props.editContext.changed) {
            const newPoint = this.props.map.click || {};
            const oldPoint = prevProps.map.click || {};
            if (newPoint.coordinate && !isEqual(newPoint.coordinate, oldPoint.coordinate)) {
                const scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
                const [wmsName, layerName] = this.state.selectedLayer.split("#");
                const editConfig = this.props.editConfigs[wmsName][layerName];
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
    renderCloneAttributeDialog = () => {
        const quickButtons = [
            {key: 'All', label: LocaleUtils.tr("editing.clone_all")},
            {key: 'None', label: LocaleUtils.tr("editing.clone_none")},
            {key: 'Visible', label: LocaleUtils.tr("editing.clone_visible")}
        ];
        const actionButtons = [
            {key: 'Copy', label: LocaleUtils.tr("editing.clone_copy"), icon: "ok", extraClasses: "button-accept"},
            {key: 'DontCopy', label: LocaleUtils.tr("editing.clone_dontcopy"), icon: "remove", extraClasses: "button-reject"}
        ];
        return (
            <div className="editing-body">
                <div className="editing-clone-dialog">
                    <div className="editing-clone-header">
                        {LocaleUtils.tr("editing.clone_select_attrs")}
                    </div>
                    <ButtonBar buttons={quickButtons} onClick={this.onCloneAttrQuickSelect} />
                    <table className="editing-clone-table">
                        <tbody>
                            {this.state.pendingClone.matchingAttributes.map(attr => (
                                <tr key={attr.fieldId}>
                                    <td>
                                        <label className="editing-clone-attribute" key={attr.fieldId}>
                                            <input
                                                checked={this.state.pendingClone.selectedAttributes.includes(attr.fieldId)}
                                                onChange={() => this.toggleAttribute(attr.fieldId)}
                                                type="checkbox"
                                            />
                                            <span className="editing-clone-attribute-name">
                                                {attr.fieldName}
                                                {!attr.visible ? (<i>{" " + LocaleUtils.tr("editing.clone_hidden")}</i>) : ""}
                                                {attr.autoCalculated ? (<i>{" " + LocaleUtils.tr("editing.clone_defaulted")}</i>) : ""}
                                            </span>
                                        </label>
                                    </td>
                                    <td title={attr.value}>{attr.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <ButtonBar buttons={actionButtons} onClick={this.onCloneAction} />
                </div>
            </div>
        );
    };
    renderBody = () => {
        // Show clone attribute selection dialog if pending
        if (this.state.pendingClone) {
            return this.renderCloneAttributeDialog();
        }

        if (!this.props.theme || isEmpty(this.props.editConfigs)) {
            return (
                <div role="body" style={{padding: "1em"}}>
                    {LocaleUtils.tr("editing.noeditablelayers")}
                </div>
            );
        }
        const editConfig = this.props.editContext?.editConfig;
        const editPermissions = editConfig?.permissions ?? {};

        const actionButtons = [];
        actionButtons.push({key: 'Pick', icon: 'pick', label: LocaleUtils.tr("common.pick"), data: {action: 'Pick', feature: null}});
        if ( editPermissions.creatable !== false && !this.props.editContext.geomReadOnly) {
            actionButtons.push({key: 'Draw', icon: 'editdraw', label: LocaleUtils.tr("editing.draw"), data: {action: 'Draw'}});
        }
        if (ConfigUtils.havePlugin("AttributeTable") && this.props.showAttributeTableButton) {
            actionButtons.push({key: 'AttribTable', icon: 'editing', label: LocaleUtils.tr("editing.attrtable"), data: {action: 'AttrTable'}});
        }

        let featureSelection = null;
        if (editConfig && this.state.pickedFeatures && this.state.pickedFeatures.length > 1) {
            const featureText = LocaleUtils.tr("editing.feature");
            featureSelection = (
                <div className="editing-feature-selection">
                    <select className="combo editing-feature-select" disabled={this.props.editContext.changed === true || this.props.editContext.id !== this.props.currentEditContext} onChange={(ev) => this.setEditFeature(ev.target.value)}  value={(this.props.editContext.feature || {}).id || ""}>
                        {this.state.pickedFeatures.map(feature => (
                            <option key={feature.id} value={feature.id}>{editConfig.displayField ? feature.properties[editConfig.displayField] : featureText + " " + feature.id}</option>
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
        if (editConfig && this.props.editContext.feature && (this.props.editContext.action === "Pick" || this.props.editContext.feature.geometry)) {
            const translations = this.props.layers.find(layer => layer.wms_name === this.props.editContext.mapPrefix)?.translations;
            attributeForm = (
                <AttributeForm
                    editContext={this.props.editContext} iface={this.props.iface}
                    onCommit={this.updatePickedFeatures} translations={translations} />
            );
        }
        return (
            <div className="editing-body">
                <div className="editing-layer-selection">
                    <select className="combo editing-layer-select" disabled={this.props.editContext.changed === true || this.props.editContext.id !== this.props.currentEditContext} onChange={ev => this.changeSelectedLayer(ev.target.value)} value={this.state.selectedLayer || ""}>
                        <option disabled value="">{LocaleUtils.tr("common.selectlayer")}</option>
                        {Object.entries(this.props.editConfigs).map(([mapName, serviceConfigs]) => (
                            Object.entries(serviceConfigs).map(([layerName, edConfig]) => {
                                const match = LayerUtils.searchLayer(this.props.layers, 'wms_name', mapName, 'name', layerName);
                                if (!match) {
                                    return null;
                                }
                                const layerTitle = match.layer.translations?.layertree?.[layerName] ?? edConfig.layerTitle ?? match?.sublayer?.title ?? layerName;
                                const value = mapName + "#" + layerName;
                                return (
                                    <option key={value} value={value}>{layerTitle}</option>
                                );
                            })
                        ))}
                    </select>
                </div>
                <ButtonBar active={this.state.drawPick ? "Draw" : this.props.editContext.action} buttons={actionButtons} disabled={!editConfig || this.props.editContext.changed || this.props.editContext.id !== this.props.currentEditContext} onClick={this.actionClicked} />
                {featureSelection}
                {pickBar}
                {attributeForm}
            </div>

        );
    };
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("window.maximize") : LocaleUtils.tr("window.minimize");
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
        ) : null];
    }
    changeMeasurementState = (diff) => {
        this.props.setEditContext('Editing', {measurements: {...this.props.editContext.measurements, ...diff}});
    };
    actionClicked = (action, data) => {
        this.setState({drawPick: false, pickedFeatures: null});
        if (action === "AttribTable") {
            this.props.setCurrentTask("AttributeTable", null, null, {layer: this.state.selectedLayer});
        } else if (action === "Draw") {
            const featureSkel = {
                type: "Feature",
                properties: {}
            };
            getFeatureTemplate(this.props.editContext.editConfig, featureSkel, this.props.iface, this.props.editContext.mapPrefix, this.props.map.projection, feature => {
                this.props.setEditContext('Editing', {...data, feature: feature});
            });
        } else {
            this.props.setEditContext('Editing', {...data});
        }
    };
    pickFilter = (feature) => {
        const geomType = this.props.editContext.geomType;
        return feature.geometry && (
            feature.geometry.type === geomType ||
            "Multi" + feature.geometry.type === geomType ||
            (feature.geometry.type.replace(/^Multi/, "") === geomType && feature.geometry.coordinates.length === 1)
        );
    };
    geomPicked = (layer, feature, mapName) => {
        const geomType = this.props.editContext.geomType;
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

        const targetFields = this.props.editContext.editConfig?.fields;
        const matchingAttributes = [];
        if (!isEmpty(targetFields)) {
            const sourceProperties = feature.properties || {};

            // Get source layer's field configuration and build name-to-id mapping
            const sourceFields = this.props.editConfigs[mapName]?.[layer]?.fields;
            const sourceNameToIdMap = (sourceFields || []).reduce((res, field) => ({
                ...res,
                [field.name]: field.id,
                [field.id]: field.id
            }), {});

            const sourcePropertiesById = Object.entries(sourceProperties).reduce((res, [key, value]) => ({
                ...res,
                [sourceNameToIdMap[key] || key]: value
            }), {});

            // Build list of matching attributes with metadata
            targetFields.forEach(field => {
                if (!field.expression) {
                    let value = sourcePropertiesById[field.id];

                    if (value !== null && value !== undefined && value !== '') {
                        // Parse number values
                        if (field.type === 'number') {
                            if (typeof value === 'string') {
                                const numValue = parseNumber(value.replace(',', '.'));
                                if (!isNaN(numValue)) {
                                    value = numValue;
                                }
                            }
                        } else if (field.type === 'boolean') {
                            value = !['0', 'false'].includes(String(value).toLowerCase());
                        } else if (field.type === 'date') {
                            if (typeof value === 'string') {
                                value = dateParser.fromString(value).toISOString();
                            }
                        } else if (field.type === 'list') {
                            // Not supported
                            return;
                        }

                        matchingAttributes.push({
                            fieldId: field.id,
                            fieldName: field.name,
                            value: value,
                            visible: field.constraints?.hidden !== true,
                            autoCalculated: !!field.defaultValue
                        });
                    }
                }
            });
        }

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
        } else {
            this.props.setEditContext('Editing', {action: "Draw", feature: editFeature, changed: true});
            this.setState({drawPick: false});
        }
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
    onCloneAttrQuickSelect = (action) => {
        if (action === 'All') {
            const allFieldIds = this.state.pendingClone.matchingAttributes.map(attr => attr.fieldId);
            this.setState(state => ({
                pendingClone: {...state.pendingClone, selectedAttributes: allFieldIds}
            }));
        } else if (action === 'None') {
            this.setState(state => ({
                pendingClone: {...state.pendingClone, selectedAttributes: []}
            }));
        } else if (action === 'Visible') {
            const visibleFieldIds = this.state.pendingClone.matchingAttributes
                .filter(attr => attr.visible && !attr.autoCalculated)
                .map(attr => attr.fieldId);
            this.setState(state => ({
                pendingClone: {...state.pendingClone, selectedAttributes: visibleFieldIds}
            }));
        }
    };
    onCloneAction = (action) => {
        if (action === 'Copy') {
            this.confirmCopyAttributes();
        } else if (action === 'DontCopy') {
            this.cancelCopyAttributes();
        }
    };
    setLayerVisibility = (selectedLayer, visibility) => {
        if (selectedLayer !== null) {
            const [wmsName, layerName] = selectedLayer.split("#");
            const match = LayerUtils.searchLayer(this.props.layers, 'wms_name', wmsName, 'name', layerName);
            if (match) {
                const oldvisibility = match.sublayer.visibility;
                if (oldvisibility !== visibility && visibility !== null) {
                    const recurseDirection = !oldvisibility ? "both" : "children";
                    this.props.changeLayerProperty(match.layer.id, "visibility", visibility, match.path, recurseDirection);
                }
                return oldvisibility;
            }
        }
        return null;
    };
    changeSelectedLayer = (selectedLayer, feature = null) => {
        const [mapName, layerName] = (selectedLayer ?? '#').split("#");
        const editConfig = selectedLayer ? this.props.editConfigs[mapName][layerName] : null;
        this.props.setEditContext('Editing', {
            action: "Pick",
            feature: feature,
            changed: false,
            mapPrefix: mapName,
            editConfig: editConfig
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
        editConfigs: state.layers.editConfigs,
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
        changeLayerProperty: changeLayerProperty
    })(Editing);
};
