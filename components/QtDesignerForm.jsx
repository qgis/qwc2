/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import axios from 'axios';
import xml2js from 'xml2js';
import uuid from 'uuid';
import isEmpty from 'lodash.isempty';
import ButtonBar from './widgets/ButtonBar';
import EditComboField, {KeyValCache} from './EditComboField';
import EditUploadField from './EditUploadField';
import Spinner from './Spinner';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import Icon from './Icon';

import './style/QtDesignerForm.css';

const FormPreprocessors = {};

export function registerFormPreprocessor(editLayerId, preprocessor) {
    FormPreprocessors[editLayerId] = preprocessor;
}

export function removeFormPreprocessor(editLayerId) {
    delete FormPreprocessors[editLayerId];
}


class QtDesignerForm extends React.Component {
    static propTypes = {
        addRelationRecord: PropTypes.func,
        editLayerId: PropTypes.string,
        editRelationRecord: PropTypes.func,
        feature: PropTypes.object,
        fields: PropTypes.object,
        form: PropTypes.string,
        iface: PropTypes.object,
        locale: PropTypes.string,
        mapPrefix: PropTypes.string,
        readOnly: PropTypes.bool,
        removeRelationRecord: PropTypes.func,
        reorderRelationRecord: PropTypes.func,
        report: PropTypes.bool,
        setRelationTables: PropTypes.func,
        switchEditContext: PropTypes.func,
        updateField: PropTypes.func,
        updateRelationField: PropTypes.func
    }
    static defaultState = {
        activetabs: {},
        formdata: null,
        loading: false,
        loadingReqId: null
    }
    constructor(props) {
        super(props);
        this.state = QtDesignerForm.defaultState;
    }
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps, prevState) {
        // Query form
        if (this.props.form !== prevProps.form || this.props.feature.__version__ !== prevProps.feature.__version__) {
            this.setState(QtDesignerForm.defaultState);
            let url = this.props.form;
            if (url && url.startsWith(":/")) {
                const assetsPath = ConfigUtils.getAssetsPath();
                url = assetsPath + this.props.form.substr(1);
            }
            url += (url.includes('?') ? '&' : '?') + "lang=" + this.props.locale;

            axios.get(url).then(response => {
                this.parseForm(response.data);
            }).catch(e => {
                // eslint-disable-next-line
                console.log(e);
            });
        }
    }
    componentWillUnmount() {
        KeyValCache.clear();
    }
    render() {
        if (this.state.loading) {
            return (
                <div className="qt-designer-form-loading">
                    <Spinner /><span>{LocaleUtils.tr("qtdesignerform.loading")}</span>
                </div>
            );
        } else if (this.state.formData) {
            const root = this.state.formData.ui.widget;
            return (
                <div className={this.props.report ? "qt-designer-report" : "qt-designer-form"}>
                    {this.renderLayout(root.layout, this.props.feature, this.props.editLayerId, this.props.updateField)}
                </div>
            );
        } else {
            return null;
        }
    }
    renderLayout = (layout, feature, dataset, updateField, nametransform = (name) => name, visible = true) => {
        let containerClass = "";
        let itemStyle = () => ({});
        let containerStyle = {};
        if (!layout) {
            return null;
        } else if (layout.class === "QGridLayout" || layout.class === "QFormLayout") {
            containerClass = "qt-designer-layout-grid";
            containerStyle = {
                gridTemplateColumns: this.computeLayoutColumns(layout.item).join(" ")
            };
            itemStyle = item => ({
                gridArea: (1 + parseInt(item.row, 10)) + "/" + (1 + parseInt(item.column, 10)) + "/ span " + parseInt(item.rowspan || 1, 10) + "/ span " + parseInt(item.colspan || 1, 10)
            });
        } else if (layout.class === "QVBoxLayout") {
            containerClass = "qt-designer-layout-grid";
            itemStyle = (item, idx) => ({
                gridArea: (1 + idx) + "/1/ span 1/ span 1"
            });
        } else if (layout.class === "QHBoxLayout") {
            containerClass = "qt-designer-layout-grid";
            containerStyle = {
                gridTemplateColumns: this.computeLayoutColumns(layout.item, true).join(" ")
            };
            itemStyle = (item, idx) => ({
                gridArea: "1/" + (1 + idx) + "/ span 1/ span 1"
            });
        } else {
            return null;
        }
        if (!visible) {
            containerStyle.display = 'none';
        }
        return (
            <div className={containerClass} key={layout.name} style={containerStyle}>
                {layout.item.map((item, idx) => {
                    let child = null;
                    if (item.widget) {
                        child = this.renderWidget(item.widget, feature, dataset, updateField, nametransform);
                    } else if (item.layout) {
                        child = this.renderLayout(item.layout, feature, dataset, updateField, nametransform);
                    } else {
                        return null;
                    }
                    return (
                        <div key={"i" + idx} style={itemStyle(item, idx)}>
                            {child}
                        </div>
                    );
                })}
            </div>
        );
    }
    computeLayoutColumns = (items, useIndex = false) => {
        const columns = [];
        const fitWidgets = ["QLabel", "QCheckBox", "QRadioButton", "Line"];
        let index = 0;
        let hasAuto = false;
        for (const item of items) {
            const col = useIndex ? index : (parseInt(item.column, 10) || 0);
            const colSpan = useIndex ? 1 : (parseInt(item.colspan, 10) || 1);
            if (item.widget && !fitWidgets.includes(item.widget.class) && colSpan === 1) {
                columns[col] = 'auto';
                hasAuto = true;
            } else {
                columns[col] = columns[col] || null; // Placeholder replaced by fit-content below
            }
            ++index;
        }
        const fit = 'fit-content(' + Math.round(1 / columns.length * 100) + '%)';
        for (let col = 0; col < columns.length; ++col) {
            columns[col] = hasAuto ? (columns[col] || fit) : 'auto';
        }
        return columns;
    }
    renderWidget = (widget, feature, dataset, updateField, nametransform = (name) => name) => {
        let value = (feature.properties || {})[widget.name] ?? "";
        const prop = widget.property || {};
        const attr = widget.attribute || {};
        const fieldConstraints = (this.props.fields[widget.name] || {}).constraints || {};
        const inputConstraints = {};
        inputConstraints.readOnly = this.props.readOnly || prop.readOnly === "true" || prop.enabled === "false" || fieldConstraints.readOnly === true;
        inputConstraints.required = !inputConstraints.readOnly && (prop.required === "true" || fieldConstraints.required === true);
        inputConstraints.placeholder = prop.placeholderText || fieldConstraints.placeholder || "";

        const fontProps = widget.property.font || {};
        const fontStyle = {
            fontWeight: fontProps.bold === "true" ? "bold" : "normal",
            fontStyle: fontProps.italic === "true" ? "italic" : "normal",
            textDecoration: [fontProps.underline === "true" ? "underline" : "", fontProps.strikeout === "true" ? "line-through" : ""].join(" "),
            fontSize: Math.round((fontProps.pointsize || 9) / 9 * 100) + "%"
        };

        let elname = undefined;
        if (widget.name.startsWith("ext__")) {
            updateField = null;
            value = this.state.formData.externalFields[widget.name.slice(5)];
            inputConstraints.readOnly = true;
        } else {
            elname = nametransform(widget.name);
        }

        if (widget.class === "QLabel") {
            if (widget.name.startsWith("img__")) {
                value = (feature.properties || [])[widget.name.split("__")[1]] ?? widget.property.text;
                return (<div className="qt-designer-form-image"><a href={value} rel="noreferrer" target="_blank"><img src={value} /></a></div>);
            } else {
                const text = widget.name.startsWith("ext__") ? value : widget.property.text;
                return (<span style={fontStyle}>{text}</span>);
            }
        } else if (widget.class === "Line") {
            const linetype = (widget.property || {}).orientation === "Qt::Vertical" ? "vline" : "hline";
            return (<div className={"qt-designer-form-" + linetype} />);
        } else if (widget.class === "QFrame") {
            return (
                <div className="qt-designer-form-frame">
                    {widget.name.startsWith("nrel__") ? this.renderNRelation(widget) : this.renderLayout(widget.layout, feature, dataset, updateField, nametransform)}
                </div>
            );
        } else if (widget.class === "QGroupBox") {
            return (
                <div>
                    <div className="qt-designer-form-frame-title" style={fontStyle}>{prop.title}</div>
                    <div className="qt-designer-form-frame">
                        {widget.name.startsWith("nrel__") ? this.renderNRelation(widget) : this.renderLayout(widget.layout, feature, dataset, updateField, nametransform)}
                    </div>
                </div>
            );
        } else if (widget.class === "QTabWidget") {
            if (isEmpty(widget.widget)) {
                return null;
            }
            const activetab = this.state.activetabs[widget.name] || widget.widget[0].name;
            return (
                <div>
                    <div className="qt-designer-form-tabbar">
                        {widget.widget.map(tab => (
                            <span
                                className={tab.name === activetab ? "qt-designer-form-tab-active" : ""}
                                key={tab.name}
                                onClick={() => this.setState({activetabs: {...this.state.activetabs, [widget.name]: tab.name}})}
                            >
                                {tab.attribute.title}
                            </span>
                        ))}
                    </div>
                    <div className="qt-designer-form-frame">
                        {widget.widget.filter(child => child.layout).map(child => (
                            this.renderLayout(child.layout, feature, dataset, updateField, nametransform, child.name === activetab)
                        ))}
                    </div>
                </div>
            );
        } else if (widget.class === "QTextEdit" || widget.class === "QTextBrowser" || widget.class === "QPlainTextEdit") {
            if (this.props.report) {
                return (<div className="qt-designer-form-textarea">{value}</div>);
            } else {
                return (<textarea name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} style={fontStyle} value={value} />);
            }
        } else if (widget.class === "QLineEdit") {
            if (widget.name.endsWith("__upload")) {
                const fieldId = widget.name.replace(/__upload/, '');
                const uploadValue = ((feature.properties || {})[fieldId] || "");
                const uploadElName = elname.replace(/__upload/, '');
                const constraints = {accept: prop.text || ""};
                return (<EditUploadField constraints={constraints} dataset={dataset} disabled={inputConstraints.readOnly} fieldId={fieldId} name={uploadElName} report={this.props.report} updateField={updateField} value={uploadValue} />);
            } else {
                if (this.props.report) {
                    return (<span>{value}</span>);
                } else {
                    return (<input name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} size={5} style={fontStyle} type="text" value={value} />);
                }
            }
        } else if (widget.class === "QCheckBox" || widget.class === "QRadioButton") {
            const type = widget.class === "QCheckBox" ? "checkbox" : "radio";
            const inGroup = attr.buttonGroup;
            const checked = inGroup ? (this.props.feature.properties || {})[this.groupOrName(widget)] === widget.name : value;
            return (
                <label style={fontStyle}>
                    <input checked={checked} name={nametransform(this.groupOrName(widget))} onChange={ev => updateField(this.groupOrName(widget), inGroup ? widget.name : ev.target.checked)} {...inputConstraints} type={type} value={widget.name} />
                    {widget.property.text}
                </label>
            );
        } else if (widget.class === "QComboBox") {
            const parts = widget.name.split("__");
            if ((parts.length === 5 || parts.length === 6) && parts[0] === "kvrel") {
                // kvrel__attrname__datatable__keyfield__valuefield
                // kvrel__reltablename__attrname__datatable__keyfield__valuefield
                const count = parts.length;
                const attrname = parts.slice(1, count - 3).join("__");
                const comboFieldConstraints = (this.props.fields[attrname] || {}).constraints || {};
                value = (feature.properties || [])[attrname] ?? "";
                const fieldId = parts.slice(1, count - 3).join("__");
                const keyvalrel = this.props.mapPrefix + parts[count - 3] + ":" + parts[count - 2] + ":" + parts[count - 1];
                return (
                    <EditComboField
                        editIface={this.props.iface} fieldId={fieldId} key={fieldId} keyvalrel={keyvalrel}
                        name={nametransform(attrname)} placeholder={inputConstraints.placeholder}
                        readOnly={inputConstraints.readOnly || comboFieldConstraints.readOnly}
                        required={inputConstraints.required || comboFieldConstraints.required}
                        style={fontStyle} updateField={updateField} value={value} />
                );
            } else {
                const haveEmpty = (widget.item || []).map((item) => (item.property.value || item.property.text) === "");
                return (
                    <select name={elname} onChange={ev => updateField(widget.name, ev.target.value)} {...inputConstraints} style={fontStyle} value={value}>
                        {!haveEmpty ? (
                            <option disabled value="">
                                {inputConstraints.placeholder || LocaleUtils.tr("editing.select")}
                            </option>
                        ) : null}
                        {(widget.item || []).map((item) => {
                            const optval = item.property.value || item.property.text;
                            return (
                                <option key={optval} value={optval}>{item.property.text}</option>
                            );
                        })}
                    </select>
                );
            }
        } else if (widget.class === "QSpinBox" || widget.class === "QDoubleSpinBox" || widget.class === "QSlider") {
            const min = prop.minimum ?? fieldConstraints.min ?? undefined;
            const max = prop.maximum ?? fieldConstraints.max ?? undefined;
            const step = prop.singleStep ?? fieldConstraints.step ?? 1;
            const type = (widget.class === "QSlider" ? "range" : "number");
            return (
                <input max={max} min={min} name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} size={5} step={step} style={fontStyle} type={type} value={value} />
            );
        } else if (widget.class === "QDateEdit") {
            const min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1900-01-01";
            const max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            return (
                <input max={max} min={min} name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} style={fontStyle} type="date" value={value} />
            );
        } else if (widget.class === "QTimeEdit") {
            return (
                <input name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} style={fontStyle} type="time" value={value} />
            );
        } else if (widget.class === "QDateTimeEdit") {
            const min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1900-01-01";
            const max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            const parts = (value || "T").split("T");
            parts[1] = (parts[1] || "").replace(/\.\d+$/, ''); // Strip milliseconds
            return (
                <span className="qt-designer-form-datetime">
                    <input max={max[0]} min={min[0]} onChange={(ev) => updateField(widget.name, ev.target.value ? ev.target.value + "T" + parts[1] : "")} readOnly={inputConstraints.readOnly} required={inputConstraints.required} style={fontStyle} type="date" value={parts[0]} />
                    <input disabled={!parts[0]} onChange={(ev) => updateField(widget.name, parts[0] + "T" + ev.target.value)} {...inputConstraints} style={fontStyle} type="time" value={parts[1]} />
                    <input name={elname} type="hidden" value={value} />
                </span>
            );
        } else if (widget.class === "QWidget") {
            if (widget.name.startsWith("nrel__")) {
                return this.renderNRelation(widget);
            } else if (widget.name.startsWith("ext__")) {
                return value;
            } else {
                return this.renderLayout(widget.layout, feature, dataset, updateField, nametransform);
            }
        } else if (widget.class === "QPushButton" && widget.name.startsWith("featurelink__")) {
            const parts = widget.name.split("__");
            // featurelink__layer__attrname
            // featurelink__layer__reltable__attrname
            if (parts.length === 3 || parts.length === 4 ) {
                const layer = parts[1];
                const reltable = parts.length === 4 ? parts[2] : "";
                const attrname = parts.slice(2).join("__");
                value = (feature.properties || {})[attrname];
                if (layer === reltable) {
                    const index = parseInt(nametransform("").split("__")[1], 10); // Ugh..
                    const reldataset = this.props.mapPrefix + reltable;
                    if (feature.__status__ !== "empty") {
                        const featurebuttons = [
                            {key: 'Edit', icon: 'editing', label: String(value ?? "")}
                        ];
                        return (
                            <div className="qt-designer-form-featurelink-buttons">
                                <ButtonBar buttons={featurebuttons} onClick={() => this.props.editRelationRecord('Edit', reltable, reldataset, index)} />
                            </div>
                        );
                    } else {
                        const featurebuttons = [
                            {key: 'Pick', icon: 'pick', label: LocaleUtils.trmsg("editing.pick")},
                            {key: 'Create', icon: 'editdraw', label: LocaleUtils.trmsg("editing.create")}
                        ];
                        return (<ButtonBar buttons={featurebuttons} onClick={(action) => this.props.editRelationRecord(action, reltable, reldataset, index)} />);
                    }
                } else {
                    if (value !== null) {
                        const featurebuttons = [
                            {key: 'Edit', icon: 'editing', label: String(value ?? "")}
                        ];
                        return (
                            <div className="qt-designer-form-featurelink-buttons">
                                <ButtonBar buttons={featurebuttons} onClick={() => this.props.switchEditContext('Edit', layer, value, (v) => updateField(attrname, v))} />
                                <button className="button" onClick={() => updateField(attrname, null)} type="button"><Icon icon="clear" /></button>
                            </div>
                        );
                    } else {
                        const featurebuttons = [
                            {key: 'Pick', icon: 'pick', label: LocaleUtils.trmsg("editing.pick")},
                            {key: 'Create', icon: 'editdraw', label: LocaleUtils.trmsg("editing.create")}
                        ];
                        return (<ButtonBar buttons={featurebuttons} onClick={(action) => this.props.switchEditContext(action, layer, null, (v) => updateField(attrname, v))} />);
                    }
                }
            }
        }
        return null;
    }
    renderNRelation = (widget) => {
        const parts = widget.name.split("__");
        if (parts.length < 3) {
            return null;
        }
        const tablename = parts[1];
        const sortcol = parts[3] || null;
        const datasetname = this.props.mapPrefix + tablename;
        const headerItems = widget.layout.item.filter(item => item.widget.name.startsWith("header__"));
        return (
            <div className="qt-designer-widget-relation">
                <div className="qt-designer-widget-relation-table-container">
                    <table>
                        <tbody>
                            {!isEmpty(headerItems) ? (
                                <tr>
                                    <th />
                                    {headerItems.map(item => (<th key={item.widget.name}>{item.widget.property.text}</th>))}
                                    <th />
                                </tr>
                            ) : null}
                            {(((this.props.feature.relationValues || {})[datasetname] || {}).features || []).map((feature, idx) => {
                                const updateField = (name, value) => {
                                    const fieldname = name.slice(tablename.length + 2); // Strip <tablename>__ prefix
                                    this.props.updateRelationField(datasetname, idx, fieldname, value);
                                };
                                const nametransform = (name) => (name + "__" + idx);
                                const status = feature.__status__ || "";
                                const relFeature = {
                                    ...feature,
                                    properties: Object.entries(feature.properties).reduce((res, [key, value]) => ( {...res, [tablename + "__" + key]: value}), {})
                                };
                                let statusIcon = null;
                                if (status === "empty") {
                                    // Pass
                                } else if (status === "new") {
                                    statusIcon = "new";
                                } else if (status) {
                                    statusIcon = "edited";
                                }
                                let statusText = "";
                                if (feature.error) {
                                    statusIcon = "warning";
                                    statusText = this.buildErrMsg(feature);
                                }
                                const extraClass = status.startsWith("deleted") ? "qt-designer-widget-relation-record-deleted" : "";
                                const widgetItems = widget.layout.item.filter(item => !item.widget.name.startsWith("header__"));
                                return (
                                    <tr className={"qt-designer-widget-relation-record " + extraClass} key={datasetname + idx}>
                                        <td>{statusIcon ? (<Icon icon={statusIcon} title={statusText} />) : null}</td>
                                        {widgetItems.map(item => (
                                            <td className="qt-designer-widget-relation-row-widget" key={item.widget.name}>{this.renderWidget(item.widget, relFeature, datasetname, updateField, nametransform)}</td>
                                        ))}
                                        {!this.props.readOnly && sortcol ? (
                                            <td>
                                                <Icon icon="chevron-up" onClick={() => this.props.reorderRelationRecord(datasetname, idx, -1)} />
                                                <br />
                                                <Icon icon="chevron-down" onClick={() => this.props.reorderRelationRecord(datasetname, idx, 1)} />
                                            </td>
                                        ) : null}
                                        {!this.props.readOnly ? (
                                            <td>
                                                <Icon icon="trash" onClick={() => this.props.removeRelationRecord(datasetname, idx)} />
                                            </td>
                                        ) : null}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {!this.props.readOnly ? (
                    <div><button className="qt-designer-widget-relation-add" onClick={() => this.props.addRelationRecord(datasetname)} type="button">{LocaleUtils.tr("editing.add")}</button></div>
                ) : null}
            </div>
        );
    }
    groupOrName = (widget) => {
        return widget.attribute && widget.attribute.buttonGroup ? widget.attribute.buttonGroup._ : widget.name;
    }
    dateConstraint = (constr) => {
        return (constr.year + "-" + ("0" + constr.month).slice(-2) + "-" + ("0" + constr.day).slice(-2));
    }
    parseForm = (data) => {
        const options = {
            explicitArray: false,
            mergeAttrs: true
        };
        const loadingReqId = uuid.v1();
        this.setState({loading: true, loadingReqId: loadingReqId});
        xml2js.parseString(data, options, (err, json) => {
            const relationTables = {};
            const externalFields = {};
            const fields = {};
            this.reformatWidget(json.ui.widget, relationTables, fields, externalFields);
            // console.log(root);
            json.externalFields = externalFields;
            json.fields = fields;
            if (FormPreprocessors[this.props.editLayerId]) {
                FormPreprocessors[this.props.editLayerId](json, this.props.feature, (formData) => {
                    if (this.state.loadingReqId === loadingReqId) {
                        this.setState({formData: formData, loading: false, loadingReqId: null});
                    }
                });
            } else {
                this.setState({formData: json, loading: false, loadingReqId: null});
            }
            this.props.setRelationTables(relationTables);
        });
    }
    reformatWidget = (widget, relationTables, fields, externalFields) => {
        if (widget.property) {
            widget.property = MiscUtils.ensureArray(widget.property).reduce((res, prop) => {
                return ({...res, [prop.name]: prop[Object.keys(prop).find(key => key !== "name")]});
            }, {});
        } else {
            widget.property = {};
        }
        if (widget.attribute) {
            widget.attribute = MiscUtils.ensureArray(widget.attribute).reduce((res, prop) => {
                return ({...res, [prop.name]: prop[Object.keys(prop).find(key => key !== "name")]});
            }, {});
        } else {
            widget.attribute = {};
        }
        if (widget.item) {
            MiscUtils.ensureArray(widget.item).map(item => this.reformatWidget(item, relationTables, fields, externalFields));
        }

        widget.name = widget.name || uuid.v1();

        if (widget.name in this.props.fields) {
            fields[widget.name] = widget;
        } else if (widget.name.startsWith("kvrel__") || widget.name.startsWith("img__")) {
            const parts = widget.name.split("__");
            if (parts[1] in this.props.fields) {
                fields[parts[1]] = widget;
            }
        }

        if (widget.name.startsWith("ext__")) {
            externalFields[widget.name.slice(5)] = "";
        }

        if (widget.layout) {
            this.reformatLayout(widget.layout, relationTables, fields, externalFields);
        }
        if (widget.widget) {
            widget.widget = Array.isArray(widget.widget) ? widget.widget : [widget.widget];
            widget.widget.forEach(child => {
                child.name = uuid.v1();
                this.reformatWidget(child, relationTables, fields, externalFields);
            });
        }

        const parts = widget.name.split("__");
        if (parts.length >= 3 && parts[0] === "nrel") {
            relationTables[this.props.mapPrefix + parts[1]] = {fk: parts[2], sortcol: parts[3] || null};
        }
    }
    reformatLayout = (layout, relationTables, fields, externalFields) => {
        layout.item = MiscUtils.ensureArray(layout.item);
        layout.name = layout.name || uuid.v1();
        layout.item.forEach(item => {
            if (!item) {
                return;
            } else if (item.widget) {
                this.reformatWidget(item.widget, relationTables, fields, externalFields);
            } else if (item.layout) {
                this.reformatLayout(item.layout, relationTables, fields, externalFields);
            }
        });
    }
    buildErrMsg = (record) => {
        let message = record.error;
        const errorDetails = record.error_details || {};
        if (!isEmpty(errorDetails.geometry_errors)) {
            message += ":\n";
            message += errorDetails.geometry_errors.map(entry => " - " + entry.reason + " at " + entry.location);
        }
        if (!isEmpty(errorDetails.data_errors)) {
            message += ":\n - " + errorDetails.data_errors.join("\n - ");
        }
        if (!isEmpty(errorDetails.validation_errors)) {
            message += ":\n - " + errorDetails.validation_errors.join("\n - ");
        }
        return message;
    }
}

export default connect((state) => ({
    locale: state.locale.current
}), {
})(QtDesignerForm);
