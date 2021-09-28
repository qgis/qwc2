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
import axios from 'axios';
import clone from 'clone';
import uuid from 'uuid';
import {changeEditingState} from '../actions/editing';
import {setCurrentTaskBlocked} from '../actions/task';
import {LayerRole, refreshLayer, changeLayerProperty} from '../actions/layers';
import {clickOnMap} from '../actions/map';
import AutoEditForm from '../components/AutoEditForm';
import QtDesignerForm from '../components/QtDesignerForm';
import Icon from '../components/Icon';
import SideBar from '../components/SideBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ConfigUtils from '../utils/ConfigUtils';
import EditingInterface from '../utils/EditingInterface';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import './style/Editing.css';

class Editing extends React.Component {
    static propTypes = {
        changeEditingState: PropTypes.func,
        changeLayerProperty: PropTypes.func,
        clickOnMap: PropTypes.func,
        editing: PropTypes.object,
        enabled: PropTypes.bool,
        iface: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        refreshLayer: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        theme: PropTypes.object,
        touchFriendly: PropTypes.bool,
        width: PropTypes.string,
        side: PropTypes.string
    }
    static defaultProps = {
        touchFriendly: true,
        width: "30em",
        side: 'right'
    }
    state = {
        selectedLayer: null,
        selectedLayerVisibility: null,
        relationTables: {},
        pickedFeatures: null,
        busy: false,
        deleteClicked: false,
        minimized: false
    }
    onShow = () => {
        this.changeSelectedLayer(this.state.selectedLayer, "Pick");
    }
    onHide = () => {
        this.props.changeEditingState({action: null, geomType: null, feature: null});
        this.setLayerVisibility(this.state.selectedLayer, this.state.selectedLayerVisibility);
        this.setState({minimized: false});
    }
    componentDidUpdate(prevProps, prevState) {
        const themeSublayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(LayerUtils.getSublayerNames(layer)) : accum;
        }, []);
        // Update selected layer on layers change
        if (this.props.layers !== prevProps.layers) {
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
        if (this.props.enabled && prevProps.enabled && this.props.editing.action === 'Pick' && this.state.selectedLayer && !this.props.editing.changed) {
            const newPoint = this.props.map.click || {};
            const oldPoint = prevProps.map.click || {};
            if (newPoint.coordinate && !isEqual(newPoint.coordinate, oldPoint.coordinate)) {
                const scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
                this.props.iface.getFeature(this.editLayerId(this.state.selectedLayer), newPoint.coordinate, this.props.map.projection, scale, 96, (featureCollection) => {
                    const features = featureCollection ? featureCollection.features : null;
                    this.setState({pickedFeatures: features});
                    const feature = features ? features[0] : null;
                    this.props.changeEditingState({...this.props.editing, feature: feature, changed: false});

                    // Query relation values for picked feature
                    const editDataset = this.editLayerId(this.state.selectedLayer);
                    const mapPrefix = editDataset.replace(new RegExp("." + this.state.selectedLayer + "$"), ".");
                    if (feature) {
                        const relTables = Object.entries(this.state.relationTables).map(([name, fk]) => mapPrefix + name + ":" + fk).join(",");
                        this.props.iface.getRelations(editDataset, feature.id, relTables, (response => {
                            const relationValues = this.unprefixRelationValues(response.relationvalues, mapPrefix);
                            const newFeature = {...this.props.editing.feature, relationValues: relationValues};
                            this.props.changeEditingState({...this.props.editing, feature: newFeature});
                        }));
                    }
                });
            }
        }
        if (prevProps.editing.changed !== this.props.editing.changed) {
            this.props.setCurrentTaskBlocked(this.props.editing.changed === true);
        }
        if ((!this.props.editing.feature || this.props.editing.changed) && this.state.deleteClicked) {
            this.setState({deleteClicked: false});
        }
        if (!this.props.editing.feature && prevState.pickedFeatures) {
            this.setState({pickedFeatures: null});
        }
        // Always clear clicked pos if enabled
        if (this.props.map.click && this.props.enabled) {
            this.props.clickOnMap(null);
        }
    }
    editLayerId = (layerId) => {
        if (this.props.theme && this.props.theme.editConfig && this.props.theme.editConfig[layerId]) {
            return this.props.theme.editConfig[layerId].editDataset || layerId;
        }
        return layerId;
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

        const actionButtons = [
            {key: 'Pick', icon: 'pick', label: LocaleUtils.trmsg("editing.pick"), data: {action: 'Pick'}},
            {key: 'Draw', icon: 'editdraw', label: LocaleUtils.trmsg("editing.draw"), data: {action: 'Draw', feature: null}}
        ];

        let commitBar = null;
        if (this.props.editing.changed) {
            const commitButtons = [
                {key: 'Commit', icon: 'ok', label: LocaleUtils.trmsg("editing.commit"), extraClasses: "edit-commit", type: "submit"},
                {key: 'Discard', icon: 'remove', label: LocaleUtils.trmsg("editing.discard"), extraClasses: "edit-discard"}
            ];
            commitBar = (<ButtonBar buttons={commitButtons} onClick={this.onDiscard}/>); /* submit is handled via onSubmit in the form */
        }
        let featureSelection = null;
        if (this.state.pickedFeatures) {
            const featureText = LocaleUtils.tr("editing.feature");
            featureSelection = (
                <div className="editing-feature-selection">
                    <select className="editing-feature-select" disabled={this.props.editing.changed === true} onChange={(ev) => this.setEditFeature(ev.target.value)}  value={(this.props.editing.feature || {}).id || ""}>
                        {this.state.pickedFeatures.map(feature => (
                            <option key={feature.id} value={feature.id}>{editConfig.displayField ? feature.properties[editConfig.displayField] : featureText + " " + feature.id}</option>
                        ))}
                    </select>
                </div>
            );
        }
        let fieldsTable = null;
        if (this.props.editing.feature) {
            const editDataset = this.editLayerId(this.state.selectedLayer);
            const mapPrefix = editDataset.replace(new RegExp("." + this.state.selectedLayer + "$"), ".");
            fieldsTable = (
                <div className="editing-edit-frame">
                    <form action="" onSubmit={this.onSubmit}>
                        {curConfig.form ? (
                            <QtDesignerForm addRelationRecord={this.addRelationRecord} editLayerId={editDataset} form={curConfig.form}
                                iface={this.props.iface} mapPrefix={mapPrefix}
                                relationValues={this.props.editing.feature.relationValues} removeRelationRecord={this.removeRelationRecord}
                                updateField={this.updateField} updateRelationField={this.updateRelationField} values={this.props.editing.feature.properties} />
                        ) : (
                            <AutoEditForm editLayerId={editDataset} fields={curConfig.fields}
                                touchFriendly={this.props.touchFriendly} updateField={this.updateField}
                                values={this.props.editing.feature.properties} />
                        )}
                        {commitBar}
                    </form>
                </div>
            );
        }
        let deleteBar = null;
        if (this.props.editing.action === 'Pick' && this.props.editing.feature && !this.props.editing.changed) {
            if (!this.state.deleteClicked) {
                const deleteButtons = [
                    {key: 'Delete', icon: 'trash', label: LocaleUtils.trmsg("editing.delete")}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteClicked} />);
            } else {
                const deleteButtons = [
                    {key: 'Yes', icon: 'ok', label: LocaleUtils.trmsg("editing.reallydelete"), extraClasses: "edit-commit"},
                    {key: 'No', icon: 'remove', label: LocaleUtils.trmsg("editing.canceldelete"), extraClasses: "edit-discard"}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteFeature} />);
            }
        }
        let busyDiv = null;
        if (this.state.busy) {
            busyDiv = (<div className="editing-busy" />);
        }
        const themeSublayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(LayerUtils.getSublayerNames(layer)) : accum;
        }, []);
        return (
            <div className="editing-body">
                <div className="editing-layer-selection">
                    <select className="editing-layer-select" disabled={this.props.editing.changed === true} onChange={ev => this.changeSelectedLayer(ev.target.value)} value={this.state.selectedLayer || ""}>
                        {Object.keys(editConfig).filter(layerId => themeSublayers.includes(layerId)).map(layerId => {
                            const layerName = editConfig[layerId].layerName;
                            const match = LayerUtils.searchLayer(this.props.layers, 'name', layerName, [LayerRole.THEME]);
                            return (
                                <option key={layerId} value={layerId}>{match ? match.sublayer.title : layerName}</option>
                            );
                        })}
                    </select>
                </div>
                <ButtonBar active={this.props.editing.action} buttons={actionButtons} disabled={this.props.editing.changed} onClick={(action, data) => this.props.changeEditingState({...data})} />
                {featureSelection}
                {fieldsTable}
                {deleteBar}
                {busyDiv}
            </div>

        );
    }
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("editing.maximize") : LocaleUtils.tr("editing.minimize");
        const extraTitlebarContent = (<Icon className="editing-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={ev => this.setState({minimized: !this.state.minimized})} title={minMaxTooltip}/>)
        return (
            <SideBar side={this.props.side} extraTitlebarContent={extraTitlebarContent} icon={"editing"} id="Editing" onHide={this.onHide}
                onShow={this.onShow} title="appmenu.items.Editing" width={this.props.width}>
                {() => ({
                    body: this.state.minimized ? null : this.renderBody()
                })}
            </SideBar>
        );
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

    changeSelectedLayer = (selectedLayer, action = null) => {
        const curConfig = this.props.theme && this.props.theme.editConfig && selectedLayer ? this.props.theme.editConfig[selectedLayer] : null;
        this.props.changeEditingState({...this.props.editing, action: action || this.props.editing.action, feature: null, geomType: curConfig ? curConfig.geomType : null});

        let prevLayerVisibility = null;
        if (this.state.selectedLayer !== null) {
            this.setLayerVisibility(this.state.selectedLayer, this.state.selectedLayerVisibility);
            prevLayerVisibility = this.setLayerVisibility(selectedLayer, true);
        }

        // Gather relation tables for selected layer if config is a designer form
        this.setState({selectedLayer: selectedLayer, selectedLayerVisibility: prevLayerVisibility, relationTables: {}});
        if (curConfig && curConfig.form) {
            let url = curConfig.form;
            if (url && url.startsWith(":/")) {
                const assetsPath = ConfigUtils.getAssetsPath();
                url = assetsPath + curConfig.form.substr(1);
            }
            axios.get(url).then(response => {
                const relationTables = {};
                const domParser = new DOMParser();
                const doc = domParser.parseFromString(response.data, 'text/xml');
                for (const widget of doc.getElementsByTagName("widget")) {
                    const name = widget.attributes.name;
                    if (name) {
                        const parts = widget.attributes.name.value.split("__");
                        if (parts.length === 3 && parts[0] === "nrel") {
                            relationTables[parts[1]] = parts[2];
                        }
                    }
                }
                this.setState({relationTables: relationTables});
            }).catch(e => {
                console.log(e);
            });
        }
    }
    updateField = (key, value) => {
        const newProperties = {...this.props.editing.feature.properties, [key]: value};
        const newFeature = {...this.props.editing.feature, properties: newProperties};
        this.props.changeEditingState({...this.props.editing, feature: newFeature, changed: true});
    }
    addRelationRecord = (table) => {
        const newRelationValues = {...this.props.editing.feature.relationValues};
        if (!newRelationValues[table]) {
            newRelationValues[table] = {
                fk: this.state.relationTables[table],
                records: []
            };
        }
        newRelationValues[table].records = newRelationValues[table].records.concat([{
            __status__: "new"
        }]);
        const newFeature = {...this.props.editing.feature, relationValues: newRelationValues};
        this.props.changeEditingState({...this.props.editing, feature: newFeature, changed: true});
    }
    removeRelationRecord = (table, idx) => {
        const newRelationValues = {...this.props.editing.feature.relationValues};
        newRelationValues[table] = {...newRelationValues[table]};
        newRelationValues[table].records = newRelationValues[table].records.slice(0);
        const fieldStatus = newRelationValues[table].records[idx].__status__ || "";
        // If field was new, delete it directly, else mark it as deleted
        if (fieldStatus === "new") {
            newRelationValues[table].records.splice(idx, 1);
        } else {
            newRelationValues[table].records[idx] = {
                ...newRelationValues[table].records[idx],
                __status__: fieldStatus.startsWith("deleted") ? fieldStatus.substr(8) : "deleted:" + fieldStatus
            };
        }
        const newFeature = {...this.props.editing.feature, relationValues: newRelationValues};
        this.props.changeEditingState({...this.props.editing, feature: newFeature, changed: true});
    }
    updateRelationField = (table, idx, key, value) => {
        const newRelationValues = {...this.props.editing.feature.relationValues};
        newRelationValues[table] = {...newRelationValues[table]};
        newRelationValues[table].records = newRelationValues[table].records.slice(0);
        newRelationValues[table].records[idx] = {
            ...newRelationValues[table].records[idx],
            [key]: value,
            __status__: newRelationValues[table].records[idx].__status__ === "new" ? "new" : "changed"
        };
        const newFeature = {...this.props.editing.feature, relationValues: newRelationValues};
        this.props.changeEditingState({...this.props.editing, feature: newFeature, changed: true});
    }
    unprefixRelationValues = (relationValues, mapPrefix) => {
        if (!mapPrefix) {
            return relationValues;
        }
        const mapPrefixRe = new RegExp("^" + mapPrefix);
        return Object.entries(relationValues || {}).reduce((res, [table, value]) => {
            const tblname = table.replace(mapPrefixRe, "");
            value.records = (value.records || []).map(record => Object.entries(record).reduce((result, [key, val]) => {
                result[key.replace(table, tblname)] = val;
                return result;
            }, {}));
            res[tblname] = value;
            return res;
        }, {});
    }
    prefixRelationValues = (relationValues, mapPrefix) => {
        if (!mapPrefix) {
            return relationValues;
        }
        return Object.entries(relationValues).reduce((res, [table, value]) => {
            value.records = (value.records || []).map(record => Object.entries(record).reduce((result, [key, val]) => {
                result[key.startsWith("__") || key === "id" ? key : mapPrefix + key] = val;
                return result;
            }, {}));
            res[mapPrefix + table] = value;
            return res;
        }, {});
    }
    onDiscard = (action) => {
        if (action === "Discard") {
            this.props.changeEditingState({...this.props.editing, feature: null});
        }
    }
    onSubmit = (ev) => {
        ev.preventDefault();
        this.setState({busy: true});

        let feature = this.props.editing.feature;
        // Ensure properties is not null
        feature = {
            ...feature,
            properties: feature.properties || {},
            crs: {
                type: "name",
                properties: {name: "urn:ogc:def:crs:EPSG::" + this.props.map.projection.split(":")[1]}
            }
        };

        const editConfig = this.props.theme.editConfig;
        const curConfig = editConfig[this.state.selectedLayer];

        // Keep relation values separate
        const relationValues = clone(feature.relationValues || {});
        delete feature.relationValues;
        const relationUploads = {};
        const featureUploads = {};

        // Collect all values from form fields
        const fieldnames = Array.from(ev.target.elements).map(element => element.name).filter(x => x);
        fieldnames.forEach(name => {
            const fieldConfig = (curConfig.fields || []).find(field => field.id === name) || {};
            const element = ev.target.elements.namedItem(name);
            if (element) {
                let value = element.type === "radio" || element.type === "checkbox" ? element.checked : element.value;
                if ((element.type === "date" || element.type === "number" || fieldConfig.type === "date" || fieldConfig.type === "number") && element.value === "") {
                    // Set empty date/number value to null instead of empty string
                    value = null;
                }
                const parts = name.split("__");
                if (parts.length === 3) {
                    const table = parts[0];
                    const field = parts[1];
                    const index = parseInt(parts[2], 10);
                    // relationValues for table must exist as rows are either pre-existing or were added
                    if (relationValues[table].records[index][table + "__" + field] === undefined) {
                        relationValues[table].records[index][table + "__" + field] = value;
                    }
                    if (element.type === "file" && element.files.length > 0) {
                        relationUploads[name] = element.files[0];
                    } else if (element.type === "hidden" && element.value.startsWith("data:")) {
                        relationUploads[name] = new File([this.dataUriToBlob(element.value)], uuid.v1() + ".jpg", {type: "image/jpeg"});
                    }
                } else {
                    if (feature.properties[name] === undefined) {
                        feature.properties[name] = value;
                    }
                    if (element.type === "file" && element.files.length > 0) {
                        featureUploads[name] = element.files[0];
                    } else if (element.type === "hidden" && element.value.startsWith("data:")) {
                        featureUploads[name] = new File([this.dataUriToBlob(element.value)], uuid.v1() + ".jpg", {type: "image/jpeg"});
                    }
                }
            }
        });
        const featureData = new FormData();
        featureData.set('feature', JSON.stringify(feature));
        Object.entries(featureUploads).forEach(([key, value]) => featureData.set('file:' + key, value));

        if (this.props.editing.action === "Draw") {
            if (this.props.iface.addFeatureMultipart) {
                this.props.iface.addFeatureMultipart(this.editLayerId(this.state.selectedLayer), featureData, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            } else {
                this.props.iface.addFeature(this.editLayerId(this.state.selectedLayer), feature, this.props.map.projection, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            }
        } else if (this.props.editing.action === "Pick") {
            if (this.props.iface.editFeatureMultipart) {
                this.props.iface.editFeatureMultipart(this.editLayerId(this.state.selectedLayer), feature.id, featureData, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            } else {
                this.props.iface.editFeature(this.editLayerId(this.state.selectedLayer), feature, this.props.map.projection, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            }
        }
    }
    featureCommited = (success, result, relationValues, relationUploads) => {
        if (!success) {
            this.commitFinished(success, result);
            return;
        }
        let newFeature = result;
        // Commit relations
        if (!isEmpty(relationValues)) {
            // Prefix relation tables and fields
            const editDataset = this.editLayerId(this.state.selectedLayer);
            const mapPrefix = editDataset.replace(new RegExp("." + this.state.selectedLayer + "$"), ".");
            relationValues = this.prefixRelationValues(relationValues, mapPrefix);
            const relationData = new FormData();
            relationData.set('values', JSON.stringify(relationValues));
            Object.entries(relationUploads).forEach(([key, value]) => relationData.set(mapPrefix + key, value));

            this.props.iface.writeRelations(this.editLayerId(this.state.selectedLayer), newFeature.id, relationData, (relResult, errorMsg) => {
                if (relResult === false) {
                    this.commitFinished(false, errorMsg);
                } else if (relResult.success !== true) {
                    // Relation values commit failed, switch to pick update relation values with response and switch to pick to
                    // to avoid adding feature again on next attempt
                    this.commitFinished(false, LocaleUtils.tr("editing.relationcommitfailed"));
                    newFeature = {...newFeature, relationValues: this.unprefixRelationValues(relResult.relationvalues, mapPrefix)};
                    this.props.changeEditingState({...this.props.editing, action: "Pick", feature: newFeature, changed: true});
                } else {
                    this.commitFinished(true);
                }
            });
        } else {
            this.commitFinished(success, result);
        }
    }
    setEditFeature = (featureId) => {
        const feature = this.state.pickedFeatures.find(f => f.id.toString() === featureId);
        this.props.changeEditingState({...this.props.editing, feature: feature, changed: false});
    }
    deleteClicked = () => {
        this.setState({deleteClicked: true});
        this.props.setCurrentTaskBlocked(true);
    }
    deleteFeature = (action) => {
        if (action === 'Yes') {
            this.setState({busy: true});
            this.props.iface.deleteFeature(this.editLayerId(this.state.selectedLayer), this.props.editing.feature.id, this.deleteFinished);
        } else {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
        }
    }
    commitFinished = (success, errorMsg) => {
        this.setState({busy: false});
        if (success) {
            this.props.changeEditingState({...this.props.editing, feature: null});
            this.props.refreshLayer(layer => layer.role === LayerRole.THEME);
        } else {
            alert(errorMsg);
        }
    }
    deleteFinished = (success, errorMsg) => {
        this.setState({busy: false});
        if (success) {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
            this.props.changeEditingState({...this.props.editing, feature: null});
            this.props.refreshLayer(layer => layer.role === LayerRole.THEME);
        } else {
            alert(errorMsg);
        }
    }
    dataUriToBlob = (dataUri) => {
        const parts = dataUri.split(',');
        const byteString = parts[0].indexOf('base64') >= 0 ? atob(parts[1]) : decodeURI(parts[1]);
        const mimeString = parts[0].split(':')[1].split(';')[0];

        const ia = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], {type: mimeString});
    }
}

export default (iface = EditingInterface) => {
    return connect(state => ({
        enabled: state.task.id === 'Editing',
        theme: state.theme.current,
        layers: state.layers.flat,
        map: state.map,
        iface: iface,
        editing: state.editing
    }), {
        clickOnMap: clickOnMap,
        changeEditingState: changeEditingState,
        setCurrentTaskBlocked: setCurrentTaskBlocked,
        refreshLayer: refreshLayer,
        changeLayerProperty: changeLayerProperty
    })(Editing);
};
