/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import clone from 'clone';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {setEditContext, clearEditContext, getFeatureTemplate} from '../actions/editing';
import {LayerRole, refreshLayer} from '../actions/layers';
import {setCurrentTaskBlocked} from '../actions/task';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import AutoEditForm from './AutoEditForm';
import LinkFeatureForm from './LinkFeatureForm';
import QtDesignerForm from './QtDesignerForm';
import ButtonBar from './widgets/ButtonBar';

import './style/AttributeForm.css';

class AttributeForm extends React.Component {
    static propTypes = {
        childPickFilter: PropTypes.func,
        clearEditContext: PropTypes.func,
        deleteMsgId: PropTypes.string,
        editConfig: PropTypes.object,
        editContext: PropTypes.object,
        iface: PropTypes.object,
        map: PropTypes.object,
        onCommit: PropTypes.func,
        onDelete: PropTypes.func,
        onDiscard: PropTypes.func,
        readOnly: PropTypes.bool,
        refreshLayer: PropTypes.func,
        report: PropTypes.bool,
        setCurrentTaskBlocked: PropTypes.func,
        setEditContext: PropTypes.func,
        theme: PropTypes.object,
        touchFriendly: PropTypes.bool
    };
    static defaultProps = {
        deleteMsgId: LocaleUtils.trmsg("editing.delete"),
        touchFriendly: true
    };
    state = {
        busy: false,
        deleteClicked: false,
        childEdit: null,
        relationTables: {},
        formValid: true
    };
    componentDidUpdate(prevProps, prevState) {
        if (prevProps.editContext.changed !== this.props.editContext.changed) {
            this.props.setCurrentTaskBlocked(this.props.editContext.changed === true, LocaleUtils.tr("editing.unsavedchanged"));
        }
        if ((!this.props.editContext.feature || this.props.editContext.changed) && this.state.deleteClicked) {
            this.setState({deleteClicked: false});
        }
        // Reload relation values if necessary
        const feature = this.props.editContext.feature;
        const prevFeature = prevProps.editContext.feature;
        if (
            (!this.props.editContext.changed || !feature.relationValues) &&
            (this.state.relationTables !== prevState.relationTables || feature.id !== (prevFeature || {}).id)
        ) {
            this.loadRelationValues(this.props.editContext.feature, (newFeature) => {
                this.props.setEditContext(this.props.editContext.id, {feature: newFeature});
            });
        }
    }
    editLayerId = (layerId) => {
        return this.props.editConfig || layerId;
    };
    render = () => {
        let commitBar = null;
        if (this.props.editContext.changed) {
            const commitButtons = [
                {key: 'Commit', icon: this.state.formValid ? 'ok' : 'warning', label: this.state.formValid ? LocaleUtils.trmsg("editing.commit") : LocaleUtils.trmsg("editing.invalidform"), extraClasses: this.state.formValid ? "button-accept" : "button-warning", type: "submit", disabled: !this.state.formValid},
                {key: 'Discard', icon: 'remove', label: LocaleUtils.trmsg("editing.discard"), extraClasses: "button-reject"}
            ];
            commitBar = (<ButtonBar buttons={commitButtons} onClick={this.onDiscard}/>); /* submit is handled via onSubmit in the form */
        }

        const curConfig = this.props.editConfig;
        const editPermissions = curConfig.permissions || {};
        const readOnly = this.props.readOnly || editPermissions.updatable === false;

        let deleteBar = null;
        if (this.props.editContext.action === 'Pick' && this.props.editContext.feature && !this.props.editContext.changed && editPermissions.deletable !== false && !this.props.readOnly) {
            // Delete button bar will appear by default if no permissions are defined in editConfig or when deletable permission is set
            if (!this.state.deleteClicked) {
                const deleteButtons = [
                    {key: 'Delete', icon: 'trash', label: this.props.deleteMsgId}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteClicked} />);
            } else {
                const deleteButtons = [
                    {key: 'Yes', icon: 'ok', label: LocaleUtils.trmsg("editing.reallydelete"), extraClasses: "button-accept"},
                    {key: 'No', icon: 'remove', label: LocaleUtils.trmsg("editing.canceldelete"), extraClasses: "button-reject"}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteFeature} />);
            }
        }
        let busyDiv = null;
        if (this.state.busy) {
            busyDiv = (<div className="attrib-form-busy" />);
        }
        let childAttributeForm = null;
        if (this.state.childEdit) {
            childAttributeForm = (
                <div className="link-feature-form-container">
                    <LinkFeatureForm {...this.state.childEdit} finished={this.state.childEdit.finishCallback} iface={this.props.iface} pickFilter={this.props.childPickFilter} readOnly={this.props.readOnly} />
                </div>
            );
        }
        return (
            <div className="AttributeForm">
                {this.props.editContext.geomReadOnly && !this.props.readOnly ? (
                    <div className="attrib-form-geom-readonly">{LocaleUtils.tr("editing.geomreadonly")}</div>
                ) : null}
                <form action="" onChange={ev => this.checkValidity(ev.currentTarget, true)} onSubmit={this.onSubmit} ref={this.checkValidity}>
                    {this.props.editConfig.form ? (
                        <QtDesignerForm addRelationRecord={this.addRelationRecord} editLayerId={this.props.editConfig.editDataset}
                            editRelationRecord={this.editRelationRecord} feature={this.props.editContext.feature}
                            fields={this.fieldsMap(this.props.editConfig.fields)} form={this.props.editConfig.form} iface={this.props.iface}
                            mapPrefix={this.editMapPrefix()} readOnly={readOnly} removeRelationRecord={this.removeRelationRecord}
                            reorderRelationRecord={this.reorderRelationRecord} report={this.props.report}
                            setFormBusy={this.setFormBusy} setRelationTables={this.setRelationTables} switchEditContext={this.startChildEdit}
                            updateField={this.updateField} updateRelationField={this.updateRelationField} />
                    ) : (
                        <AutoEditForm editLayerId={this.props.editConfig.editDataset} fields={this.props.editConfig.fields}
                            iface={this.props.iface}
                            readOnly={readOnly} touchFriendly={this.props.touchFriendly} updateField={this.updateField}
                            values={this.props.editContext.feature.properties} />
                    )}
                    {commitBar}
                </form>
                {deleteBar}
                {busyDiv}
                {childAttributeForm}
            </div>

        );
    };
    setFormBusy = (busy) => {
        this.setState({busy: busy});
    };
    fieldsMap = (fields) => {
        return fields.reduce((res, field) => ({...res, [field.id]: field}), {});
    };
    updateField = (key, value) => {
        const newProperties = {...this.props.editContext.feature.properties, [key]: value};
        const newFeature = {...this.props.editContext.feature, properties: newProperties};
        this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: true});
    };
    editMapPrefix = () => {
        return (this.props.editConfig.editDataset.match(/^[^.]+\./) || [""])[0];
    };
    setRelationTables = (relationTables) => {
        this.setState({relationTables: relationTables});
    };
    loadRelationValues = (feature, callback) => {
        if (!isEmpty(this.state.relationTables)) {
            if (feature.id) {
                const relTables = Object.entries(this.state.relationTables).map(([name, entry]) => {
                    if (entry.sortcol) {
                        return name + ":" + entry.fk + ":" + entry.sortcol;
                    } else {
                        return name + ":" + entry.fk;
                    }
                }).join(",");
                this.props.iface.getRelations(this.props.editConfig.editDataset, feature.id, relTables, this.props.map.projection, (response => {
                    const newFeature = {...feature, relationValues: response.relationvalues};
                    callback(newFeature);
                }));
            } else {
                const relationValues = {
                    ...Object.entries(this.state.relationTables).reduce((res, [name, entry]) => ({...res, [name]: {
                        fk: entry.fk,
                        features: []
                    }}), {}),
                    ...feature.relationValues
                };
                const newFeature = {...feature, relationValues: relationValues};
                callback(newFeature);
            }
        }
    };
    addRelationRecord = (table) => {
        const newRelationValues = {...this.props.editContext.feature.relationValues};
        const editConfig = this.props.theme.editConfig[table.split('.').slice(-1)];
        const newRelFeature = getFeatureTemplate(editConfig, {
            type: "Feature",
            properties: {}
        });
        newRelFeature.__status__ = "empty";
        // If feature id is known, i.e. not when drawing new feature, set foreign key
        if (this.props.editContext.action !== "Draw") {
            newRelFeature.properties[this.state.relationTables[table].fk] = this.props.editContext.feature.id;
        }
        newRelationValues[table] = {...newRelationValues[table]};
        newRelationValues[table].features = newRelationValues[table].features.concat([newRelFeature]);
        const newFeature = {...this.props.editContext.feature, relationValues: newRelationValues};
        this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: true});
    };
    reorderRelationRecord = (table, idx, dir) => {
        const nFeatures = this.props.editContext.feature.relationValues[table].features.length;
        if ((dir < 0 && idx === 0) || (dir > 0 && idx >= nFeatures - 1)) {
            return;
        }
        const newRelationValues = {...this.props.editContext.feature.relationValues};
        newRelationValues[table] = {...newRelationValues[table]};
        const newFeatures = newRelationValues[table].features.slice(0);

        const offset = dir < 0 ? 0 : 1;
        newFeatures.splice(idx - 1 + offset, 2, newFeatures[idx + offset], newFeatures[idx - 1 + offset]);
        newFeatures[idx - 1 + offset].properties = {
            ...newFeatures[idx - 1 + offset].properties
        };
        newFeatures[idx + offset].properties = {
            ...newFeatures[idx + offset].properties
        };
        newFeatures[idx - 1 + offset].__status__ = ["new", "empty"].includes(newFeatures[idx - 1 + offset].__status__) ? "new" : "changed";
        newFeatures[idx + offset].__status__ = ["new", "empty"].includes(newFeatures[idx + offset].__status__) ? "new" : "changed";
        newRelationValues[table].features = newFeatures;
        const newFeature = {...this.props.editContext.feature, relationValues: newRelationValues};
        this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: true});
    };
    removeRelationRecord = (table, idx) => {
        const newRelationValues = {...this.props.editContext.feature.relationValues};
        newRelationValues[table] = {...newRelationValues[table]};
        newRelationValues[table].features = newRelationValues[table].features.slice(0);
        const fieldStatus = newRelationValues[table].features[idx].__status__ || "";
        // If field was new, delete it directly, else mark it as deleted
        if (["new", "empty"].includes(fieldStatus)) {
            newRelationValues[table].features.splice(idx, 1);
        } else {
            newRelationValues[table].features[idx] = {
                ...newRelationValues[table].features[idx],
                __status__: fieldStatus.startsWith("deleted") ? fieldStatus.substr(8) : "deleted:" + fieldStatus
            };
        }
        const newFeature = {...this.props.editContext.feature, relationValues: newRelationValues};
        this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: true});
    };
    updateRelationField = (table, idx, key, value) => {
        const newRelationValues = {...this.props.editContext.feature.relationValues};
        newRelationValues[table] = {...newRelationValues[table]};
        newRelationValues[table].features = newRelationValues[table].features.slice(0);
        newRelationValues[table].features[idx] = {
            ...newRelationValues[table].features[idx],
            properties: {
                ...newRelationValues[table].features[idx].properties,
                [key]: value
            },
            __status__: ["new", "empty"].includes(newRelationValues[table].features[idx].__status__) ? "new" : "changed"
        };
        const newFeature = {...this.props.editContext.feature, relationValues: newRelationValues};
        this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: true});
    };
    editRelationRecord = (action, layer, dataset, idx, displayField) => {
        const editConfig = (this.props.theme.editConfig || {})[layer];
        const feature = this.props.editContext.feature.relationValues[dataset].features[idx];
        this.setState({childEdit: {action, editConfig, editContextId: ':' + layer, dataset, idx, feature, finishCallback: this.finishEditRelationRecord, displayField: displayField}});
    };
    finishEditRelationRecord = (feature) => {
        this.props.clearEditContext(this.state.childEdit.editContextId, this.props.editContext.id);
        if (feature) {
            const table = this.state.childEdit.dataset;
            const idx = this.state.childEdit.idx;
            const newRelationValues = {...this.props.editContext.feature.relationValues};
            newRelationValues[table] = {...newRelationValues[table]};
            newRelationValues[table].features = newRelationValues[table].features.slice(0);
            newRelationValues[table].features[idx] = {
                ...feature,
                properties: {...feature.properties}
            };
            // If feature id is known, i.e. not when drawing new feature, set foreign key
            let changed = this.props.editContext.changed;
            const fk = this.state.relationTables[table].fk;
            if (this.props.editContext.action !== "Draw" && feature.properties[fk] !== this.props.editContext.feature.id) {
                newRelationValues[table].features[idx].properties[fk] = this.props.editContext.feature.id;
                newRelationValues[table].features[idx].__status__ = "changed";
                changed = true;
            }
            const newFeature = {...this.props.editContext.feature, relationValues: newRelationValues};
            this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: changed});
        }
        this.setState({childEdit: null});
    };
    onDiscard = (action) => {
        if (action === "Discard") {
            this.props.setCurrentTaskBlocked(false);
            if (!this.props.onDiscard || !this.props.onDiscard()) {
                if (this.props.editContext.action === 'Pick') {
                    // Re-query the original feature
                    this.setState({busy: true});
                    this.props.iface.getFeatureById(this.props.editConfig.editDataset, this.props.editContext.feature.id, this.props.map.projection, (feature) => {
                        this.setState({busy: false});
                        if (!isEmpty(this.state.relationTables)) {
                            // Re-load relation values
                            this.loadRelationValues(feature, (newFeature) => {
                                this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: false});
                            });
                        } else {
                            this.props.setEditContext(this.props.editContext.id, {feature: feature, changed: false});
                        }
                    });
                } else {
                    const feature = getFeatureTemplate(this.props.editConfig, {
                        type: "Feature",
                        properties: {}
                    });
                    this.props.setEditContext(this.props.editContext.id, {feature: feature, changed: false});
                }
            }
        }
    };
    checkValidity = (form, changed = false) => {
        if (form) {
            this.setState({formValid: form.checkValidity()});
            if (changed) {
                this.props.setEditContext(this.props.editContext.id, {changed: true});
            }
        }
    };
    onSubmit = (ev) => {
        ev.preventDefault();
        this.setState({busy: true});

        let feature = this.props.editContext.feature;
        // Ensure properties is not null
        feature = {
            ...feature,
            type: "Feature",
            properties: {...(feature.properties || {})},
            crs: {
                type: "name",
                properties: {name: CoordinatesUtils.toOgcUrnCrs(this.props.map.projection)}
            }
        };

        const curConfig = this.props.editConfig;
        const mapPrefix = this.editMapPrefix();

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
                const parts = name.split("__");
                let value = element.type === "radio" || element.type === "checkbox" ? element.checked : element.value;
                const nullElements = ["date", "number", "radio"];
                const nullFieldTypes = ["date", "number"];
                if (parts.length >= 3) {
                    // Relation value
                    // Usually <table>__<field>__<index>, but <field> might also contain __ (i.e. upload__user)
                    const tablename = parts[0];
                    const datasetname = mapPrefix + tablename;
                    const field = parts.slice(1, parts.length - 1).join("__");

                    const nrelFieldConfig = (this.props.theme.editConfig[tablename].fields || []).find(f => f.id === field) || {};
                    if ((element instanceof RadioNodeList || nullElements.includes(element.type) || nullFieldTypes.includes(nrelFieldConfig.type)) && element.value === "") {
                        // Set empty value to null instead of empty string
                        value = null;
                    }

                    const index = parseInt(parts[parts.length - 1], 10);
                    // relationValues for table must exist as rows are either pre-existing or were added
                    if (!(field in relationValues[datasetname].features[index].properties)) {
                        relationValues[datasetname].features[index].defaultedProperties = [
                            ...(relationValues[datasetname].features[index].defaultedProperties || []),
                            field
                        ];
                    }
                    relationValues[datasetname].features[index].properties[field] = value;
                    if (relationValues[datasetname].features[index].__status__ === "empty") {
                        relationValues[datasetname].features[index].__status__ = "new";
                    }
                    if (element.type === "file" && element.files.length > 0) {
                        relationUploads[name] = element.files[0];
                        relationValues[datasetname].features[index].properties[field] = "";
                    } else if (element.type === "hidden" && element.value.startsWith("data:")) {
                        const type = element.value.match(/image\/\w+/);
                        relationUploads[name] = new File([this.dataUriToBlob(element.value)], uuidv1() + ".jpg", {type: type});
                        relationValues[datasetname].features[index].properties[field] = "";
                    }
                } else {
                    const dataType = fieldConfig.data_type ?? fieldConfig.type;
                    if ((element instanceof RadioNodeList || nullElements.includes(element.type) || nullFieldTypes.includes(dataType)) && element.value === "") {
                        // Set empty value to null instead of empty string
                        value = null;
                    }
                    if (!(name in feature.properties)) {
                        feature.defaultedProperties = [
                            ...(feature.defaultedProperties || []),
                            name
                        ];
                    }
                    feature.properties[name] = value;
                    if (element.type === "file" && element.files.length > 0) {
                        featureUploads[name] = element.files[0];
                        feature.properties[name] = "";
                    } else if (element.type === "hidden" && element.value.startsWith("data:")) {
                        const type = element.value.match(/image\/\w+/);
                        featureUploads[name] = new File([this.dataUriToBlob(element.value)], uuidv1() + ".jpg", {type: type});
                        feature.properties[name] = "";
                    }
                }
            }
        });
        const featureData = new FormData();
        featureData.set('feature', JSON.stringify(feature));
        Object.entries(featureUploads).forEach(([key, value]) => featureData.set('file:' + key, value));

        if (this.props.editContext.action === "Draw") {
            if (this.props.iface.addFeatureMultipart) {
                this.props.iface.addFeatureMultipart(this.props.editConfig.editDataset, featureData, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            } else {
                this.props.iface.addFeature(this.props.editConfig.editDataset, feature, this.props.map.projection, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            }
        } else if (this.props.editContext.action === "Pick") {
            if (this.props.iface.editFeatureMultipart) {
                this.props.iface.editFeatureMultipart(this.props.editConfig.editDataset, feature.id, featureData, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            } else {
                this.props.iface.editFeature(this.props.editConfig.editDataset, feature, this.props.map.projection, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            }
        }
    };
    featureCommited = (success, result, relationValues, relationUploads) => {
        if (!success) {
            this.commitFinished(false, result);
            return;
        }
        let newFeature = result;
        // Commit relations
        if (!isEmpty(relationValues)) {

            // Set CRS and foreign key, set sort index if necessary
            Object.keys(relationValues).forEach(relTable => {
                relationValues[relTable].features = relationValues[relTable].features.filter(relFeature => relFeature.__status__ !== "empty").map((relFeature, idx) => {
                    const fk = this.state.relationTables[relTable].fk;
                    const feature = {
                        ...relFeature,
                        type: "Feature",
                        properties: {
                            ...relFeature.properties,
                            [fk]: newFeature.id
                        },
                        __status__: relFeature.__status__ || (relFeature.properties[fk] !== newFeature.id ? "changed" : ""),
                        crs: {
                            type: "name",
                            properties: {name: CoordinatesUtils.toOgcUrnCrs(this.props.map.projection)}
                        }
                    };
                    const sortcol = this.state.relationTables[relTable].sortcol;
                    const noreorder = this.state.relationTables[relTable].noreorder;
                    if (sortcol && !noreorder) {
                        feature.__status__ = feature.__status__ || (feature.properties[sortcol] !== idx ? "changed" : "");
                        feature.properties[sortcol] = idx;
                    }
                    return feature;
                });
            });

            const mapPrefix = this.editMapPrefix();
            const relationData = new FormData();
            relationData.set('values', JSON.stringify(relationValues));
            Object.entries(relationUploads).forEach(([key, value]) => relationData.set(mapPrefix + key, value));

            this.props.iface.writeRelations(this.props.editConfig.editDataset, newFeature.id, relationData, this.props.map.projection, (relResult, errorMsg) => {
                if (relResult === false) {
                    this.commitFinished(false, errorMsg);
                } else if (relResult.success !== true) {
                    // Relation values commit failed, switch to pick to avoid adding feature again on next attempt
                    this.commitFinished(false, LocaleUtils.tr("editing.relationcommitfailed"));
                    newFeature = {...newFeature, relationValues: relResult.relationvalues};
                    this.props.setEditContext(this.props.editContext.id, {action: "Pick", feature: newFeature, changed: true});
                } else {
                    this.commitFinished(true, newFeature);
                }
            });
        } else {
            this.commitFinished(true, newFeature);
        }
    };
    deleteClicked = () => {
        this.setState({deleteClicked: true});
        this.props.setCurrentTaskBlocked(true, LocaleUtils.tr("editing.unsavedchanged"));
    };
    deleteFeature = (action) => {
        if (action === 'Yes') {
            this.setState({busy: true});
            this.props.iface.deleteFeature(this.props.editConfig.editDataset, this.props.editContext.feature.id, this.deleteFinished);
        } else {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
        }
    };
    commitFinished = (success, result) => {
        this.setState({busy: false});
        if (success) {
            this.props.refreshLayer(layer => layer.role === LayerRole.THEME);
            this.props.setCurrentTaskBlocked(false);
            if (!this.props.onCommit || !this.props.onCommit(result)) {
                if (!isEmpty(this.state.relationTables)) {
                    // Re-load relation values
                    this.loadRelationValues(result, (newFeature) => {
                        this.props.setEditContext(this.props.editContext.id, {action: 'Pick', feature: newFeature, changed: false});
                    });
                } else {
                    this.props.setEditContext(this.props.editContext.id, {action: 'Pick', feature: result, changed: false});
                }
            }
        } else {
            // eslint-disable-next-line
            alert(result);
        }
    };
    deleteFinished = (success, result) => {
        this.setState({busy: false});
        if (success) {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
            this.props.refreshLayer(layer => layer.role === LayerRole.THEME);
            if (!this.props.onDelete || !this.props.onDelete(result)) {
                this.props.setEditContext(this.props.editContext.id, {feature: null, changed: false});
            }
        } else {
            // eslint-disable-next-line
            alert(result);
        }
    };
    dataUriToBlob = (dataUri) => {
        const parts = dataUri.split(',');
        const byteString = parts[0].indexOf('base64') >= 0 ? atob(parts[1]) : decodeURI(parts[1]);
        const mimeString = parts[0].split(':')[1].split(';')[0];

        const ia = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], {type: mimeString});
    };
    startChildEdit = (action, layer, featureId, updateField, displayField) => {
        const editConfig = (this.props.theme.editConfig || {})[layer];
        if (!editConfig) {
            // eslint-disable-next-line
            console.warn("No edit config found for linked edit layer " + layer);
        } else {
            this.setState({childEdit: {action, editConfig, editContextId: ':' + layer, displayField, featureId, updateField, finishCallback: this.finishChildEdit}});
        }
    };
    finishChildEdit = (feature) => {
        this.props.clearEditContext(this.state.childEdit.editContextId, this.props.editContext.id);
        if (feature && feature.id !== this.state.childEdit.featureId) {
            this.state.childEdit.updateField(feature.id);
        }
        this.setState({childEdit: null});
    };
}

export default connect(state => ({
    map: state.map,
    theme: state.theme.current
}), {
    clearEditContext: clearEditContext,
    setEditContext: setEditContext,
    setCurrentTaskBlocked: setCurrentTaskBlocked,
    refreshLayer: refreshLayer
})(AttributeForm);
