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
import clone from 'clone';
import uuid from 'uuid';
import {changeEditingState} from '../actions/editing';
import {setCurrentTaskBlocked} from '../actions/task';
import {LayerRole, refreshLayer} from '../actions/layers';
import AutoEditForm from '../components/AutoEditForm';
import QtDesignerForm from '../components/QtDesignerForm';
import ButtonBar from '../components/widgets/ButtonBar';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/AttributeForm.css';

class AttributeForm extends React.Component {
    static propTypes = {
        changeEditingState: PropTypes.func,
        editConfig: PropTypes.object,
        editDataset: PropTypes.string,
        editMapPrefix: PropTypes.string,
        editing: PropTypes.object,
        iface: PropTypes.object,
        map: PropTypes.object,
        newfeature: PropTypes.bool,
        refreshLayer: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        touchFriendly: PropTypes.bool
    }
    static defaultProps = {
        touchFriendly: true
    }
    state = {
        busy: false,
        deleteClicked: false
    }
    componentDidMount() {
        const prevState = {
            editing: {
                feature: null,
                changed: false
            }
        };
        this.componentDidUpdate(prevState, {});
    }
    componentDidUpdate(prevProps) {
        if (prevProps.editing.changed !== this.props.editing.changed) {
            this.props.setCurrentTaskBlocked(this.props.editing.changed === true);
        }
        if ((!this.props.editing.feature || this.props.editing.changed) && this.state.deleteClicked) {
            this.setState({deleteClicked: false});
        }
    }
    editLayerId = (layerId) => {
        return this.props.editConfig || layerId;
    }
    render = () => {
        let commitBar = null;
        if (this.props.editing.changed) {
            const commitButtons = [
                {key: 'Commit', icon: 'ok', label: LocaleUtils.trmsg("editing.commit"), extraClasses: "attrib-form-commit", type: "submit"},
                {key: 'Discard', icon: 'remove', label: LocaleUtils.trmsg("editing.discard"), extraClasses: "attrib-form-discard"}
            ];
            commitBar = (<ButtonBar buttons={commitButtons} onClick={this.onDiscard}/>); /* submit is handled via onSubmit in the form */
        }

        let deleteBar = null;
        if (!this.props.newfeature && this.props.editing.feature && !this.props.editing.changed) {
            if (!this.state.deleteClicked) {
                const deleteButtons = [
                    {key: 'Delete', icon: 'trash', label: LocaleUtils.trmsg("editing.delete")}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteClicked} />);
            } else {
                const deleteButtons = [
                    {key: 'Yes', icon: 'ok', label: LocaleUtils.trmsg("editing.reallydelete"), extraClasses: "attrib-form-commit"},
                    {key: 'No', icon: 'remove', label: LocaleUtils.trmsg("editing.canceldelete"), extraClasses: "attrib-form-discard"}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteFeature} />);
            }
        }
        let busyDiv = null;
        if (this.state.busy) {
            busyDiv = (<div className="attrib-form-busy" />);
        }
        return (
            <div className="AttributeForm">
                {this.props.editing.geomReadOnly ? (
                    <div className="attrib-form-geom-readonly">{LocaleUtils.tr("editing.geomreadonly")}</div>
                ) : null}
                <form action="" onSubmit={this.onSubmit}>
                    {this.props.editConfig.form ? (
                        <QtDesignerForm addRelationRecord={this.addRelationRecord} editLayerId={this.props.editDataset} feature={this.props.editing.feature}
                            featureChanged={this.props.editing.changed}
                            form={this.props.editConfig.form} iface={this.props.iface} loadRelationValues={this.loadRelationValues}
                            mapPrefix={this.props.editMapPrefix} relationValues={this.props.editing.feature.relationValues}
                            removeRelationRecord={this.removeRelationRecord} updateField={this.updateField} updateRelationField={this.updateRelationField} />
                    ) : (
                        <AutoEditForm editLayerId={this.props.editDataset} fields={this.props.editConfig.fields}
                            iface={this.props.iface} mapPrefix={this.props.editMapPrefix}
                            touchFriendly={this.props.touchFriendly} updateField={this.updateField}
                            values={this.props.editing.feature.properties} />
                    )}
                    {commitBar}
                </form>
                {deleteBar}
                {busyDiv}
            </div>

        );
    }
    updateField = (key, value) => {
        const newProperties = {...this.props.editing.feature.properties, [key]: value};
        const newFeature = {...this.props.editing.feature, properties: newProperties};
        this.props.changeEditingState({...this.props.editing, feature: newFeature, changed: true});
    }
    loadRelationValues = (relationTables) => {
        const relTables = Object.entries(relationTables).map(([name, fk]) => this.props.editMapPrefix + name + ":" + fk).join(",");
        const feature = this.props.editing.feature;
        this.props.iface.getRelations(this.props.editDataset, feature.id, relTables, (response => {
            const relationValues = this.unprefixRelationValues(response.relationvalues, this.props.editMapPrefix);
            const newFeature = {...feature, relationValues: relationValues};
            this.props.changeEditingState({...this.props.editing, feature: newFeature});
        }));
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
            // Re-query the original feature
            this.props.iface.getFeatureById(this.props.editDataset, this.props.editing.feature.id, this.props.map.projection, (feature) => {
                this.props.changeEditingState({...this.props.editing, action: 'Pick', feature: feature, changed: false});
            });
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
                properties: {name: CoordinatesUtils.toOgcUrnCrs(this.props.map.projection)}
            }
        };

        const curConfig = this.props.editConfig;

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
                const nullElements = ["date", "number", "radio"];
                const nullFieldTypes = ["date", "number", "list"];
                if ((element instanceof RadioNodeList || nullElements.includes(element.type) || nullFieldTypes.includes(fieldConfig.type)) && element.value === "") {
                    // Set empty value to null instead of empty string
                    value = null;
                }
                const parts = name.split("__");
                if (parts.length >= 3) {
                    // Usually <table>__<field>__<index>, but <field> might also contain __ (i.e. upload__user)
                    const table = parts[0];
                    const field = parts.slice(1, parts.length - 1).join("__");
                    const index = parseInt(parts[parts.length - 1], 10);
                    // relationValues for table must exist as rows are either pre-existing or were added
                    relationValues[table].records[index][table + "__" + field] = value;
                    if (element.type === "file" && element.files.length > 0) {
                        relationUploads[name] = element.files[0];
                    } else if (element.type === "hidden" && element.value.startsWith("data:")) {
                        relationUploads[name] = new File([this.dataUriToBlob(element.value)], uuid.v1() + ".jpg", {type: "image/jpeg"});
                    }
                } else {
                    feature.properties[name] = value;
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
                this.props.iface.addFeatureMultipart(this.props.editDataset, featureData, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            } else {
                this.props.iface.addFeature(this.props.editDataset, feature, this.props.map.projection, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            }
        } else if (this.props.editing.action === "Pick") {
            if (this.props.iface.editFeatureMultipart) {
                this.props.iface.editFeatureMultipart(this.props.editDataset, feature.id, featureData, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
            } else {
                this.props.iface.editFeature(this.props.editDataset, feature, this.props.map.projection, (success, result) => this.featureCommited(success, result, relationValues, relationUploads));
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
            const mapPrefix = this.props.editMapPrefix;
            relationValues = this.prefixRelationValues(relationValues, mapPrefix);
            const relationData = new FormData();
            relationData.set('values', JSON.stringify(relationValues));
            Object.entries(relationUploads).forEach(([key, value]) => relationData.set(mapPrefix + key, value));

            this.props.iface.writeRelations(this.props.editDataset, newFeature.id, relationData, (relResult, errorMsg) => {
                if (relResult === false) {
                    this.commitFinished(false, errorMsg);
                } else if (relResult.success !== true) {
                    // Relation values commit failed, switch to pick update relation values with response and switch to pick to
                    // to avoid adding feature again on next attempt
                    this.commitFinished(false, LocaleUtils.tr("editing.relationcommitfailed"));
                    newFeature = {...newFeature, relationValues: this.unprefixRelationValues(relResult.relationvalues, mapPrefix)};
                    this.props.changeEditingState({...this.props.editing, action: "Pick", feature: newFeature, changed: true});
                } else {
                    this.commitFinished(true, result);
                }
            });
        } else {
            this.commitFinished(success, result);
        }
    }
    deleteClicked = () => {
        this.setState({deleteClicked: true});
        this.props.setCurrentTaskBlocked(true);
    }
    deleteFeature = (action) => {
        if (action === 'Yes') {
            this.setState({busy: true});
            this.props.iface.deleteFeature(this.props.editDataset, this.props.editing.feature.id, this.deleteFinished);
        } else {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
        }
    }
    commitFinished = (success, result) => {
        this.setState({busy: false});
        if (success) {
            this.props.changeEditingState({...this.props.editing, action: 'Pick', feature: result, changed: false});
            this.props.refreshLayer(layer => layer.role === LayerRole.THEME);
        } else {
            // eslint-disable-next-line
            alert(result);
        }
    }
    deleteFinished = (success, errorMsg) => {
        this.setState({busy: false});
        if (success) {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
            this.props.changeEditingState({...this.props.editing, feature: null, changed: false});
            this.props.refreshLayer(layer => layer.role === LayerRole.THEME);
        } else {
            // eslint-disable-next-line
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

export default connect(state => ({
    map: state.map,
    editing: state.editing
}), {
    changeEditingState: changeEditingState,
    setCurrentTaskBlocked: setCurrentTaskBlocked,
    refreshLayer: refreshLayer
})(AttributeForm);
