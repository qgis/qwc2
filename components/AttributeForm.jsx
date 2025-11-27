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
import {v4 as uuidv4} from 'uuid';

import {setEditContext, clearEditContext} from '../actions/editing';
import {refreshLayer} from '../actions/layers';
import {setCurrentTaskBlocked} from '../actions/task';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import {getFeatureTemplate, parseExpressionsAsync} from '../utils/EditingUtils';
import LocaleUtils from '../utils/LocaleUtils';
import AutoEditForm from './AutoEditForm';
import LinkFeatureForm from './LinkFeatureForm';
import QtDesignerForm from './QtDesignerForm';
import ButtonBar from './widgets/ButtonBar';
import ReCaptchaWidget from './widgets/ReCaptchaWidget';

import './style/AttributeForm.css';

class AttributeForm extends React.Component {
    static propTypes = {
        childPickFilter: PropTypes.func,
        clearEditContext: PropTypes.func,
        deleteLabel: PropTypes.string,
        editConfigs: PropTypes.object,
        editContext: PropTypes.object,
        hideDelete: PropTypes.bool,
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
        touchFriendly: PropTypes.bool,
        translations: PropTypes.object
    };
    static defaultProps = {
        touchFriendly: true
    };
    state = {
        busy: false,
        deleteClicked: false,
        childEdit: null,
        relationTables: {},
        formValid: true,
        captchaResponse: null,
        dynamicHeight: false
    };
    constructor(props) {
        super(props);
        this.form = null;
        this.containerRef = React.createRef();
    }
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
            // Re-validate feature field constraints
            this.validateFieldConstraints(this.props.editContext.feature);
        }
    }
    render = () => {
        const captchaRequired = ConfigUtils.getConfigProp("editServiceCaptchaSiteKey") && !ConfigUtils.getConfigProp("username");
        const captchaPending = captchaRequired && !this.state.captchaResponse;

        let commitBar = null;
        if (this.props.editContext.changed) {
            const commitButtons = [
                {key: 'Commit', icon: this.state.formValid ? 'ok' : 'warning', label: this.state.formValid ? LocaleUtils.tr("editing.commit") : LocaleUtils.tr("editing.invalidform"), extraClasses: this.state.formValid ? "button-accept" : "button-warning", type: "submit", disabled: !this.state.formValid || captchaPending},
                {key: 'Discard', icon: 'remove', label: LocaleUtils.tr("editing.discard"), extraClasses: "button-reject"}
            ];
            commitBar = (<ButtonBar buttons={commitButtons} onClick={this.onDiscard}/>); /* submit is handled via onSubmit in the form */
        }

        const editConfig = this.props.editContext.editConfig;
        const editPermissions = editConfig.permissions || {};
        const readOnly = this.props.readOnly || (editPermissions.updatable === false && this.props.editContext.action === 'Pick');

        let deleteBar = null;
        if (!this.props.hideDelete && this.props.editContext.action === 'Pick' && this.props.editContext.feature && !this.props.editContext.changed && editPermissions.deletable !== false && !this.props.readOnly) {
            // Delete button bar will appear by default if no permissions are defined in editConfig or when deletable permission is set
            if (!this.state.deleteClicked) {
                const deleteButtons = [
                    {key: 'Delete', icon: 'trash', label: this.props.deleteLabel ?? LocaleUtils.tr("editing.delete")}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteClicked} />);
            } else {
                const deleteButtons = [
                    {key: 'Yes', icon: 'ok', label: LocaleUtils.tr("editing.reallydelete"), extraClasses: "button-accept", disabled: captchaPending},
                    {key: 'No', icon: 'remove', label: LocaleUtils.tr("editing.canceldelete"), extraClasses: "button-reject"}
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
                    <LinkFeatureForm
                        {...this.state.childEdit} finished={this.state.childEdit.finishCallback}
                        iface={this.props.iface} mapPrefix={this.props.editContext.mapPrefix}
                        pickFilter={this.props.childPickFilter} readOnly={this.props.readOnly}
                        translations={this.props.translations} />
                </div>
            );
        }
        let captchaButton = null;
        if (captchaRequired && (this.props.editContext.changed || this.state.deleteClicked)) {
            captchaButton = (<ReCaptchaWidget onChange={value => this.setState({captchaResponse: value})} sitekey={ConfigUtils.getConfigProp("editServiceCaptchaSiteKey")} />);
        }
        let readOnlyMsg = null;
        if (!readOnly && this.props.editContext.geomReadOnly) {
            readOnlyMsg = LocaleUtils.tr("editing.geomreadonly");
        } else if (!readOnly && this.props.editContext.geomNonZeroZ) {
            readOnlyMsg = LocaleUtils.tr("editing.geomnonzeroz");
        }
        return (
            <div className="AttributeForm" >
                {readOnlyMsg ? (
                    <div className="attrib-form-geom-readonly">{readOnlyMsg}</div>
                ) : null}
                {!this.state.childEdit && (
                    <form action="" onChange={ev => this.formChanged(ev)} onSubmit={this.onSubmit} ref={this.setupChangedObserver}>
                        {editConfig.form ? (
                            <QtDesignerForm addRelationRecord={this.addRelationRecord} editConfig={editConfig}
                                editRelationRecord={this.editRelationRecord}
                                feature={this.props.editContext.feature} iface={this.props.iface}
                                mapCrs={this.props.map.projection} mapPrefix={this.props.editContext.mapPrefix} readOnly={readOnly}
                                removeRelationRecord={this.removeRelationRecord} reorderRelationRecord={this.reorderRelationRecord}
                                report={this.props.report} setFormBusy={this.setFormBusy}
                                setRelationTables={this.setRelationTables} switchEditContext={this.startChildEdit}
                                translations={this.props.translations}
                                updateField={this.updateField} updateRelationField={this.updateRelationField} />
                        ) : (
                            <AutoEditForm editLayerId={editConfig.editDataset} fields={editConfig.fields}
                                iface={this.props.iface}
                                readOnly={readOnly} touchFriendly={this.props.touchFriendly} updateField={this.updateField}
                                values={this.props.editContext.feature.properties} />
                        )}
                        {captchaButton}
                        {commitBar}
                    </form>
                )}
                {childAttributeForm}
                {deleteBar}
                {busyDiv}
            </div>

        );
    };
    setFormBusy = (busy) => {
        this.setState({busy: busy});
    };
    updateField = (key, value) => {
        const newProperties = {...this.props.editContext.feature.properties, [key]: value};
        const newFeature = {...this.props.editContext.feature, properties: newProperties};
        this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: true});
        this.validateFieldConstraints(newFeature);
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
                const mapEditConfigs = this.props.editConfigs[this.props.editContext.mapPrefix];
                this.props.iface.getRelations(this.props.editContext.editConfig, feature.id, this.props.map.projection, relTables, mapEditConfigs, (relationValues => {
                    const newFeature = {...feature, relationValues: relationValues};
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
        const editConfig = this.props.editConfigs[this.props.editContext.mapPrefix][table.split('.').slice(-1)];
        getFeatureTemplate(editConfig, {
            type: "Feature",
            properties: {}
        }, this.props.iface, this.props.editContext.mapPrefix, this.props.map.projection, newRelFeature => {
            newRelFeature.__status__ = "empty";
            if (editConfig.geomType === null) {
                newRelFeature.geometry = null;
            }
            // If feature id is known, i.e. not when drawing new feature, set foreign key
            if (this.props.editContext.action !== "Draw") {
                newRelFeature.properties[this.state.relationTables[table].fk] = this.props.editContext.feature.id;
            }
            newRelationValues[table] = {...newRelationValues[table]};
            newRelationValues[table].features = newRelationValues[table].features.concat([newRelFeature]);
            const newFeature = {...this.props.editContext.feature, relationValues: newRelationValues};
            this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: true});
        });
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
    editRelationRecord = (action, layer, table, idx, displayField) => {
        const editConfig = this.props.editConfigs[this.props.editContext.mapPrefix][table.split('.').slice(-1)];
        const feature = this.props.editContext.feature.relationValues[table].features[idx];
        const childEdit = {
            action: action,
            editConfig: editConfig,
            editContextId: ':' + layer,
            dataset: table,
            idx: idx,
            feature: feature,
            finishCallback: this.finishEditRelationRecord,
            displayField: displayField,
            hideDelete: true
        };
        this.setState({childEdit: childEdit});
        // if (!this.state.busy) {
        //     const attributeFormContainer = this.containerRef.current;
        //     if (attributeFormContainer) {
        //         setTimeout(() => {
        //             const qtForm = attributeFormContainer.querySelector(".link-feature-form-container .qt-designer-layout-grid") || attributeFormContainer.querySelector(".qt-designer-layout-grid");
        //             this.setState({dynamicHeight: qtForm.scrollHeight + 100 || attributeFormContainer.scrollHeight + 100});
        //         }, 50);
        //     }
        // }
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

        // this.setState({childEdit: null, dynamicHeight: ""});
    };
    onDiscard = (action) => {
        if (action === "Discard") {
            this.props.setCurrentTaskBlocked(false);
            if (!this.props.onDiscard || !this.props.onDiscard()) {
                if (this.props.editContext.action === 'Pick') {
                    // Re-query the original feature
                    this.setState({busy: true});
                    this.props.iface.getFeatureById(this.props.editContext.editConfig, this.props.editContext.feature.id, this.props.map.projection, (feature) => {
                        this.setState({busy: false});
                        if (!isEmpty(this.state.relationTables)) {
                            // Re-load relation values
                            this.loadRelationValues(feature, (newFeature) => {
                                this.props.setEditContext(this.props.editContext.id, {feature: newFeature, changed: false});
                            });
                            // Re-validate feature field constraints
                            this.validateFieldConstraints(feature);
                        } else {
                            this.props.setEditContext(this.props.editContext.id, {feature: feature, changed: false});
                        }
                    });
                } else {
                    const featureSkel = {
                        type: "Feature",
                        properties: {}
                    };
                    getFeatureTemplate(this.props.editContext.editConfig, featureSkel, this.props.iface, this.props.editContext.mapPrefix, this.props.map.projection, feature => {
                        this.props.setEditContext(this.props.editContext.id, {feature: feature, changed: false});
                    });
                }
            }
        }
    };
    setupChangedObserver = (form) => {
        this.form = form;
        if (form) {
            form.observer = new MutationObserver(() => {
                this.setState({formValid: form.checkValidity()});
            });
            form.observer.observe(form, {subtree: true, childList: true, attributes: true});
        }
    };
    formChanged = (ev) => {
        const form = ev.currentTarget;
        if (ev.target?.setCustomValidity) {
            ev.target.setCustomValidity("");
        }
        if (form) {
            this.setState({formValid: form.checkValidity()});
            this.props.setEditContext(this.props.editContext.id, {changed: true});
        }
    };
    validateFieldConstraints = (feature, validCallback = null, invalidCallback = null) => {
        const constraintExpressions = this.props.editContext.editConfig.fields.reduce((res, cur) => {
            if (cur.constraints?.expression) {
                return [
                    ...res,
                    {field: cur.id, expression: cur.constraints.expression}
                ];
            }
            return res;
        }, []);
        parseExpressionsAsync(
            constraintExpressions, feature, this.props.editContext.editConfig, this.props.iface, this.props.editContext.mapPrefix, this.props.map.projection, false
        ).then(result => {
            let valid = true;
            const reasons = [];
            Object.entries(result).forEach(([key, value]) => {
                const element = this.form.elements.namedItem(key);
                if (element) {
                    if (value === false) {
                        valid = false;
                        const reason = this.props.editContext.editConfig.fields.find(field => field.id === key)?.constraints?.placeholder ?? LocaleUtils.tr("editing.contraintviolation");
                        reasons.push(reason);
                        element.setCustomValidity(reason);
                    } else {
                        element.setCustomValidity("");
                    }
                }
            });
            if (!valid) {
                this.setState({formValid: false});
                if (invalidCallback) {
                    invalidCallback(reasons);
                }
            } else {
                if (validCallback) {
                    validCallback();
                }
            }
        });
    };
    onSubmit = (ev) => {
        ev.preventDefault();
        this.validateFieldConstraints(this.props.editContext.feature, this.doSubmit, (reasons) => {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("editing.contraintviolation") + ":\n" + reasons.join("\n"));
        });
    };
    doSubmit = () => {

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
        // Omit geometry if it is read-only
        if (this.props.editContext.geomReadOnly) {
            delete feature.geometry;
        }

        const editConfig = this.props.editContext.editConfig;
        const textNullValue = ConfigUtils.getConfigProp("editTextNullValue");

        // Keep relation values separate
        const relationValues = clone(feature.relationValues || {});
        delete feature.relationValues;
        const relationUploads = {};
        const featureUploads = {};

        // Collect all values from form fields
        const fieldnames = Array.from(this.form.elements).map(element => element.name).filter(x => x && x !== "g-recaptcha-response");
        fieldnames.forEach(name => {
            const element = this.form.elements.namedItem(name);
            if (element) {
                const parts = name.split("__");
                let value = element.type === "radio" || element.type === "checkbox" ? element.checked : element.value;
                const nullElements = ["date", "number", "radio"];
                const nullFieldTypes = ["date", "number"];
                if (parts.length >= 3) {
                    // Relation value
                    // Usually <table>__<field>__<index>, but <field> might also contain __ (i.e. upload__user)
                    const tablename = parts[0];
                    const datasetname = this.props.editContext.mapPrefix + "." + tablename;
                    const field = parts.slice(1, parts.length - 1).join("__");
                    const index = parseInt(parts[parts.length - 1], 10);

                    const relEditConfig = this.props.editConfigs[this.props.editContext.mapPrefix][tablename];
                    const nrelFieldConfig = relEditConfig.fields?.find?.(f => f.id === field) ?? {};
                    const nrelFieldDataType = nrelFieldConfig.type;

                    if (nrelFieldConfig.expression) {
                        // Skip virtual fields
                        delete relationValues[datasetname].features[index][field];
                        return;
                    }

                    if ((element instanceof RadioNodeList || nullElements.includes(element.type) || nullFieldTypes.includes(nrelFieldDataType)) && element.value === "") {
                        // Set empty value to null instead of empty string
                        value = null;
                    }
                    if (nrelFieldDataType === "text" && textNullValue !== undefined && element.value === textNullValue) {
                        // Convert text NULL to null
                        value = null;
                    }

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
                        let filename = element.dataset.filename;
                        const type = element.value.match(/image\/\w+/)[0];
                        if (!filename) {
                            const ext = type.split("/")[1];
                            filename = uuidv4() + "." + ext;
                        }
                        relationUploads[name] = new File([this.dataUriToBlob(element.value)], filename, {type: type});
                        relationValues[datasetname].features[index].properties[field] = "";
                    }
                } else {
                    const fieldConfig = (editConfig.fields || []).find(field => field.id === name) || {};
                    if (fieldConfig.expression) {
                        // Skip virtual fields
                        delete feature.properties[name];
                        return;
                    }

                    const dataType = fieldConfig.type;
                    if ((element instanceof RadioNodeList || nullElements.includes(element.type) || nullFieldTypes.includes(dataType)) && element.value === "") {
                        // Set empty value to null instead of empty string
                        value = null;
                    }
                    if (dataType === "text" && textNullValue !== undefined && element.value === textNullValue) {
                        // Convert text NULL to null
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
                        let filename = element.dataset.filename;
                        const type = element.value.match(/image\/\w+/)[0];
                        if (!filename) {
                            const ext = type.split("/")[1];
                            filename = uuidv4() + "." + ext;
                        }
                        featureUploads[name] = new File([this.dataUriToBlob(element.value)], filename, {type: type});
                        feature.properties[name] = "";
                    }
                }
            }
        });
        // Remove expression fields
        Object.keys(feature.properties).forEach(key => {
            const fieldConfig = editConfig.fields.find(field => field.id === key) || {};
            if (fieldConfig?.expression) {
                delete feature.properties[key];
            }
        });
        Object.entries(relationValues).forEach(([dataset, entry]) => {
            const [mapName, layerName] = dataset.split(".", 2);
            const relEditConfig = this.props.editConfigs[mapName][layerName];
            entry.features.forEach(f => {
                Object.keys(f.properties).forEach(key => {
                    const fieldConfig = relEditConfig.fields.find(field => field.id === key) || {};
                    if (fieldConfig?.expression) {
                        delete f.properties[key];
                    }
                });
            });
        });

        // Set relation values CRS and sort index if necessary
        Object.keys(relationValues).forEach(relTable => {
            relationValues[relTable].features = relationValues[relTable].features.filter(relFeature => relFeature.__status__ !== "empty").map((relFeature, idx) => {
                const newRelFeature = {
                    ...relFeature,
                    crs: {
                        type: "name",
                        properties: {name: CoordinatesUtils.toOgcUrnCrs(this.props.map.projection)}
                    }
                };
                const sortcol = this.state.relationTables[relTable].sortcol;
                const noreorder = this.state.relationTables[relTable].noreorder;
                if (sortcol && !noreorder) {
                    newRelFeature.__status__ = feature.__status__ || (newRelFeature.properties[sortcol] !== idx ? "changed" : "");
                    newRelFeature.properties[sortcol] = idx;
                }
                return newRelFeature;
            });
        });

        feature.relationValues = relationValues;

        const featureData = new FormData();
        featureData.set('feature', JSON.stringify(feature));
        Object.entries(featureUploads).forEach(([key, value]) => featureData.set('file:' + key, value));
        Object.entries(relationUploads).forEach(([key, value]) => featureData.set('relfile:' + this.props.editContext.mapPrefix + "." + key, value));

        if (this.state.captchaResponse) {
            featureData.set('g-recaptcha-response', this.state.captchaResponse);
        }

        if (this.props.editContext.action === "Draw") {
            if (this.props.iface.addFeatureMultipart) {
                this.props.iface.addFeatureMultipart(editConfig, this.props.map.projection, featureData, (success, result) => this.featureCommited(success, result));
            } else {
                this.props.iface.addFeature(editConfig.editDataset, feature, this.props.map.projection, (success, result) => this.featureCommited(success, result));
            }
        } else if (this.props.editContext.action === "Pick") {
            if (this.props.iface.editFeatureMultipart) {
                this.props.iface.editFeatureMultipart(editConfig, this.props.map.projection, feature.id, featureData, (success, result) => this.featureCommited(success, result));
            } else {
                this.props.iface.editFeature(editConfig.editDataset, feature, this.props.map.projection, (success, result) => this.featureCommited(success, result));
            }
        }
    };
    featureCommited = (success, result) => {
        if (!success) {
            this.commitFinished(false, result);
            return;
        }
        // Check for relation records which failed to commit
        const relationValueErrors = Object.values(result.relationValues || []).find(entry => (entry.features || []).find(f => f.error)) !== undefined;
        if (relationValueErrors) {
            // Relation values commit failed, switch to pick to avoid adding feature again on next attempt
            this.commitFinished(false, LocaleUtils.tr("editing.relationcommitfailed"));
            this.props.setEditContext(this.props.editContext.id, {action: "Pick", feature: result, changed: true});
        } else {
            this.commitFinished(true, result);
        }
    };
    deleteClicked = () => {
        this.setState({deleteClicked: true});
        this.props.setCurrentTaskBlocked(true, LocaleUtils.tr("editing.unsavedchanged"));
    };
    deleteFeature = (action) => {
        if (action === 'Yes') {
            this.setState({busy: true});

            let recaptchaResponse = null;
            if (this.state.captchaResponse) {
                recaptchaResponse = this.state.captchaResponse;
            }

            this.props.iface.deleteFeature(this.props.editContext.editConfig, this.props.editContext.feature.id, this.deleteFinished, recaptchaResponse);
        } else {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
        }
    };
    commitFinished = (success, result) => {
        this.setState({busy: false});
        if (success) {
            this.props.refreshLayer(layer => layer.wms_name === this.props.editContext.mapPrefix);
            this.props.setCurrentTaskBlocked(false);
            if (!this.props.onCommit || !this.props.onCommit(result)) {
                if (!isEmpty(this.state.relationTables)) {
                    // Re-load relation values
                    this.loadRelationValues(result, (newFeature) => {
                        this.props.setEditContext(this.props.editContext.id, {action: 'Pick', feature: newFeature, changed: false});
                    });
                    // Re-validate feature field constraints
                    this.validateFieldConstraints(result);
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
            this.props.refreshLayer(layer => layer.wms_name === this.props.editContext.mapPrefix);
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
        const editConfig = this.props.editConfigs[this.props.editContext.mapPrefix][layer];
        if (!editConfig) {
            // eslint-disable-next-line
            console.warn("No edit config found for linked edit layer " + layer);
        } else {
            const childEdit = {
                action: action,
                editConfig: editConfig,
                editContextId: ':' + layer,
                displayField: displayField,
                featureId: featureId,
                updateField: updateField,
                finishCallback: this.finishChildEdit
            };
            this.setState({childEdit: childEdit});
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
    editConfigs: state.layers.editConfigs,
    theme: state.theme.current
}), {
    clearEditContext: clearEditContext,
    setEditContext: setEditContext,
    setCurrentTaskBlocked: setCurrentTaskBlocked,
    refreshLayer: refreshLayer
})(AttributeForm);
