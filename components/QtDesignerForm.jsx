/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';
import xml2js from 'xml2js';

import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import EditComboField, {KeyValCache} from './EditComboField';
import EditUploadField from './EditUploadField';
import Icon from './Icon';
import Spinner from './Spinner';
import ButtonBar from './widgets/ButtonBar';
import DateTimeInput from './widgets/DateTimeInput';
import TextInput from './widgets/TextInput';

import './style/QtDesignerForm.css';

const FormPreprocessors = {};

/* editLayerId: <mapname>.<datasetname>
preprocessor: function(formData, feature, callback)
    formData: {
        fields: { dict of fields },
        buttons: { dict of buttons },
        externalFields: { dict of external fields}
    }
    feature: The feature for which the form is being displayed
    callback: function(formData), return the updated formData
*/
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
        setFormBusy: PropTypes.func,
        setRelationTables: PropTypes.func,
        switchEditContext: PropTypes.func,
        updateField: PropTypes.func,
        updateRelationField: PropTypes.func
    };
    static defaultState = {
        activetabs: {},
        formdata: null,
        loading: false,
        loadingReqId: null,
        relationAddPressed: null
    };
    constructor(props) {
        super(props);
        this.state = QtDesignerForm.defaultState;
    }
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        // Query form
        if (this.props.form !== prevProps.form || this.props.feature.__version__ !== prevProps.feature.__version__) {
            this.setState((state) => ({
                ...QtDesignerForm.defaultState,
                activetabs: this.props.form === prevProps.form ? state.activetabs : {}
            }));
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
        // As soon as relation value is added, scroll to bottom of list
        if (this.state.relationAddPressed && this.props.feature.relationValues !== prevProps.feature.relationValues) {
            const relationWidget = this.state.relationAddPressed.parentNode.previousSibling;
            relationWidget.scrollTo(0, relationWidget.scrollHeight);
            this.setState({relationAddPressed: null});
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
        let sortKey = (item, idx) => idx;
        let containerStyle = {};
        if (!layout) {
            return null;
        } else if (layout.class === "QGridLayout" || layout.class === "QFormLayout") {
            containerClass = "qt-designer-layout-grid";
            containerStyle = {
                gridTemplateColumns: this.computeLayoutColumns(layout.item).join(" "),
                gridTemplateRows: this.computeLayoutRows(layout.item).join(" ")
            };
            itemStyle = item => ({
                gridArea: (1 + parseInt(item.row, 10)) + "/" + (1 + parseInt(item.column, 10)) + "/ span " + parseInt(item.rowspan || 1, 10) + "/ span " + parseInt(item.colspan || 1, 10)
            });
            sortKey = (item) => item.row;
        } else if (layout.class === "QVBoxLayout") {
            containerClass = "qt-designer-layout-grid";
            itemStyle = (item, idx) => ({
                gridArea: (1 + idx) + "/1/ span 1/ span 1"
            });
            sortKey = (item, idx) => idx;
        } else if (layout.class === "QHBoxLayout") {
            containerClass = "qt-designer-layout-grid";
            containerStyle = {
                gridTemplateColumns: this.computeLayoutColumns(layout.item, true).join(" ")
            };
            itemStyle = (item, idx) => ({
                gridArea: "1/" + (1 + idx) + "/ span 1/ span 1"
            });
            sortKey = (item, idx) => idx;
        } else {
            return null;
        }
        if (!visible) {
            containerStyle.display = 'none';
        }
        if (layout.item.find(item => item.spacer && (item.spacer.property || {}).orientation === "Qt::Vertical")) {
            containerStyle.height = '100%';
        }
        return (
            <div className={containerClass} key={layout.name} style={containerStyle}>
                {layout.item.sort((a, b) => (sortKey(a) - sortKey(b))).map((item, idx) => {
                    let child = null;
                    if (item.widget) {
                        child = this.renderWidget(item.widget, feature, dataset, updateField, nametransform);
                    } else if (item.layout) {
                        child = this.renderLayout(item.layout, feature, dataset, updateField, nametransform);
                    } else if (item.spacer) {
                        child = (<div />);
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
    };
    computeLayoutColumns = (items, useIndex = false) => {
        const columns = [];
        const fitWidgets = ["QLabel", "QCheckBox", "QRadioButton", "Line", "QDateTimeEdit", "QDateEdit", "QTimeEdit"];
        let index = 0;
        let hasAuto = false;
        const hasSpacer = items.find(item => (item.spacer && (item.spacer.property || {}).orientation === "Qt::Horizontal"));
        for (const item of items) {
            const col = useIndex ? index : (parseInt(item.column, 10) || 0);
            const colSpan = useIndex ? 1 : (parseInt(item.colspan, 10) || 1);
            if (!hasSpacer && item.widget && !fitWidgets.includes(item.widget.class) && colSpan === 1) {
                columns[col] = 'auto';
                hasAuto = true;
            } else if (item.spacer && (item.spacer.property || {}).orientation === "Qt::Horizontal") {
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
    };
    computeLayoutRows = (items, useIndex = false) => {
        const rows = [];
        const fitWidgets = ["QLabel", "QCheckBox", "QRadioButton", "Line", "QDateTimeEdit", "QDateEdit", "QTimeEdit", "QPushButton", "QComboBox", "QLineEdit", "QSpinBox", "QDoubleSpinBox", "QSlider"];
        let index = 0;
        let hasAuto = false;
        const hasSpacer = items.find(item => (item.spacer && (item.spacer.property || {}).orientation === "Qt::Vertical"));
        for (const item of items) {
            const row = useIndex ? index : (parseInt(item.row, 10) || 0);
            const rowSpan = useIndex ? 1 : (parseInt(item.rowspan, 10) || 1);
            if (!hasSpacer && item.widget && !fitWidgets.includes(item.widget.class) && rowSpan === 1) {
                rows[row] = 'auto';
                hasAuto = true;
            } else if (item.spacer && (item.spacer.property || {}).orientation === "Qt::Vertical") {
                rows[row] = 'auto';
                hasAuto = true;
            } else {
                rows[row] = rows[row] || null; // Placeholder replaced by fit-content below
            }
            ++index;
        }
        const fit = 'fit-content(' + Math.round(1 / rows.length * 100) + '%)';
        for (let row = 0; row < rows.length; ++row) {
            rows[row] = hasAuto ? (rows[row] || fit) : 'auto';
        }
        return rows;
    };
    renderWidget = (widget, feature, dataset, updateField, nametransform = (name) => name, disabled = false) => {
        let value = (feature.properties || {})[widget.name] ?? "";
        const prop = widget.property || {};
        if (prop.visible === "false") {
            return null;
        }
        const attr = widget.attribute || {};
        const fieldConstraints = (this.props.fields[widget.name] || {}).constraints || {};
        const inputConstraints = {};
        inputConstraints.readOnly = this.props.readOnly || prop.readOnly === "true" || prop.enabled === "false" || fieldConstraints.readOnly === true || disabled;
        inputConstraints.required = !inputConstraints.readOnly && (prop.required === "true" || fieldConstraints.required === true);
        inputConstraints.placeholder = prop.placeholderText || fieldConstraints.placeholder || "";

        const fontProps = prop.font || {};
        const fontStyle = {
            fontWeight: fontProps.bold === "true" ? "bold" : "normal",
            fontStyle: fontProps.italic === "true" ? "italic" : "normal",
            textDecoration: [fontProps.underline === "true" ? "underline" : "", fontProps.strikeout === "true" ? "line-through" : ""].join(" "),
            fontSize: Math.round((fontProps.pointsize || 9) / 9 * 100) + "%",
            textAlign: 'left'
        };
        if (prop.alignment) {
            if (prop.alignment.includes("Qt::AlignRight")) {
                fontStyle.textAlign = 'right';
            } else if (prop.alignment.includes("Qt::AlignCenter")) {
                fontStyle.textAlign = 'center';
            }
        }

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
                return (<div style={fontStyle}>{text}</div>);
            }
        } else if (widget.class === "Line") {
            const linetype = (widget.property || {}).orientation === "Qt::Vertical" ? "vline" : "hline";
            return (<div className={"qt-designer-form-" + linetype} />);
        } else if (widget.class === "QFrame") {
            return (
                <div className="qt-designer-form-container">
                    <div className="qt-designer-form-frame">
                        {widget.name.startsWith("nrel__") ? this.renderNRelation(widget) : this.renderLayout(widget.layout, feature, dataset, updateField, nametransform)}
                    </div>
                </div>
            );
        } else if (widget.class === "QGroupBox") {
            return (
                <div className="qt-designer-form-container">
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
                <div className="qt-designer-form-container">
                    <div className="qt-designer-form-tabbar">
                        {widget.widget.map(tab => (
                            <span
                                className={tab.name === activetab ? "qt-designer-form-tab-active" : ""}
                                key={tab.name}
                                onClick={() => this.setState((state) => ({activetabs: {...state.activetabs, [widget.name]: tab.name}}))}
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
                return (<TextInput multiline name={elname} onChange={(val) => updateField(widget.name, val)} {...inputConstraints} style={fontStyle} value={value} />);
            }
        } else if (widget.class === "QLineEdit") {
            if (widget.name.endsWith("__upload")) {
                const fieldId = widget.name.replace(/__upload/, '');
                const uploadValue = ((feature.properties || {})[fieldId] || "");
                const uploadElName = elname.replace(/__upload/, '');
                const constraints = {
                    accept: prop.text || "",
                    required: inputConstraints.required
                };
                return (<EditUploadField constraints={constraints} dataset={dataset} disabled={inputConstraints.readOnly} fieldId={fieldId} name={uploadElName} report={this.props.report} updateField={updateField} value={uploadValue} />);
            } else {
                if (fieldConstraints.prec !== undefined && typeof value === 'number') {
                    value = value.toFixed(fieldConstraints.prec);
                }
                if (this.props.report) {
                    return (<div style={fontStyle}>{value || inputConstraints.placeholder}</div>);
                } else {
                    return (<TextInput name={elname} onChange={(val) => updateField(widget.name, val)} {...inputConstraints} style={fontStyle} value={value} />);
                }
            }
        } else if (widget.class === "QCheckBox" || widget.class === "QRadioButton") {
            const type = widget.class === "QCheckBox" ? "checkbox" : "radio";
            const inGroup = attr.buttonGroup;
            const checked = inGroup ? (this.props.feature.properties || {})[this.groupOrName(widget)] === widget.name : value;
            return (
                <label style={fontStyle}>
                    <input checked={checked} disabled={inputConstraints.readOnly} name={nametransform(this.groupOrName(widget))} onChange={ev => updateField(this.groupOrName(widget), inGroup ? widget.name : ev.target.checked)} {...inputConstraints} type={type} value={widget.name} />
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
                const values = MiscUtils.ensureArray(widget.item || []).map((item) => ({
                    label: item.property.text,
                    value: item.property.value || item.property.text
                }));
                return (
                    <EditComboField
                        editIface={this.props.iface} fieldId={widget.name} key={widget.name}
                        name={elname} placeholder={inputConstraints.placeholder}
                        readOnly={inputConstraints.readOnly || inputConstraints.readOnly}
                        required={inputConstraints.required || inputConstraints.required}
                        style={fontStyle} updateField={updateField} value={value} values={values} />
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
            const min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1600-01-01";
            const max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            return (
                <input max={max} min={min} name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} style={fontStyle} type="date" value={value} />
            );
        } else if (widget.class === "QTimeEdit") {
            return (
                <input name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} style={fontStyle} type="time" value={value} />
            );
        } else if (widget.class === "QDateTimeEdit") {
            const min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1600-01-01";
            const max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            return (
                <DateTimeInput maxDate={max} minDate={min} name={elname} onChange={val => updateField(widget.name, val)}
                    readOnly={inputConstraints.readOnly} required={inputConstraints.required}
                    style={fontStyle} value={value} />
            );
        } else if (widget.class === "QWidget") {
            if (widget.name.startsWith("nrel__")) {
                return this.renderNRelation(widget);
            } else if (widget.name.startsWith("ext__")) {
                return value;
            } else {
                return this.renderLayout(widget.layout, feature, dataset, updateField, nametransform);
            }
        } else if (widget.class === "QPushButton") {
            if (widget.name.startsWith("btn__") && widget.onClick) {
                return (<button className="button" disabled={inputConstraints.readOnly} onClick={() => widget.onClick(this.props.setFormBusy)} type="button">{widget.property.text}</button>);
            } else if (widget.name.startsWith("featurelink__")) {
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
                        const displayField = attrname.split("__")[1];
                        if (feature.__status__ !== "empty") {
                            const featurebuttons = [
                                {key: 'Edit', icon: 'editing', label: String(value ?? "")}
                            ];
                            return (
                                <div className="qt-designer-form-featurelink-buttons">
                                    <ButtonBar buttons={featurebuttons} onClick={() => this.props.editRelationRecord('Edit', reltable, reldataset, index, displayField)} />
                                </div>
                            );
                        } else {
                            const featurebuttons = [
                                {key: 'Pick', icon: 'pick', label: LocaleUtils.trmsg("editing.pick")},
                                {key: 'Create', icon: 'editdraw', label: LocaleUtils.trmsg("editing.create")}
                            ];
                            return (<ButtonBar buttons={featurebuttons} onClick={(action) => this.props.editRelationRecord(action, reltable, reldataset, index, displayField)} />);
                        }
                    } else {
                        if (value !== null) {
                            const featurebuttons = [
                                {key: 'Edit', icon: 'editing', label: String(value ?? "")}
                            ];
                            return (
                                <div className="qt-designer-form-featurelink-buttons">
                                    <ButtonBar buttons={featurebuttons} onClick={() => this.props.switchEditContext('Edit', layer, value, (v) => updateField(attrname, v), attrname)} />
                                    <button className="button" onClick={() => updateField(attrname, null)} type="button"><Icon icon="clear" /></button>
                                </div>
                            );
                        } else {
                            const featurebuttons = [
                                {key: 'Pick', icon: 'pick', label: LocaleUtils.trmsg("editing.pick")},
                                {key: 'Create', icon: 'editdraw', label: LocaleUtils.trmsg("editing.create")}
                            ];
                            return (<ButtonBar buttons={featurebuttons} onClick={(action) => this.props.switchEditContext(action, layer, null, (v) => updateField(attrname, v), attrname)} />);
                        }
                    }
                }
            }
        } else if (widget.class === "QStackedWidget") {
            return this.renderLayout(widget.widget[parseInt(widget.property.currentIndex, 10)].layout, feature, dataset, updateField, nametransform);
        }
        return null;
    };
    renderNRelation = (widget) => {
        const parts = widget.name.split("__");
        if (parts.length < 3) {
            return null;
        }
        const disabled = (widget.property || {}).enabled === "false";
        const tablename = parts[1];
        const sortcol = parts[3] || null;
        const noreorder = parts[4] || false;
        const datasetname = this.props.mapPrefix + tablename;
        const headerItems = widget.layout.item.filter(item => item.widget && item.widget.name.startsWith("header__")).sort((a, b) => a.column - b.column);
        const widgetItems = widget.layout.item.filter(item => !item.widget || !item.widget.name.startsWith("header__")).sort((a, b) => a.column - b.column);
        const tableFitWidgets = ["QLabel", "QCheckBox", "QRadioButton", "QDateTimeEdit", "QDateEdit", "QTimeEdit"];
        const columnStyles = widgetItems.map(item => { return item.widget && tableFitWidgets.includes(item.widget.class) ? {width: '1px'} : {}; });
        return (
            <div className="qt-designer-widget-relation">
                <div className="qt-designer-widget-relation-table-container">
                    {!this.props.feature.relationValues ? (
                        <div className="qt-designer-widget-relation-table-loading">
                            <Spinner />
                        </div>
                    ) : null}
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
                                return (
                                    <tr className={"qt-designer-widget-relation-record " + extraClass} key={datasetname + idx}>
                                        <td className="qt-designer-widget-relation-record-icon">
                                            {statusIcon ? (<Icon icon={statusIcon} title={statusText} />) : null}
                                        </td>
                                        {widgetItems.map((item, widx) => {
                                            if (item.widget) {
                                                return (<td className="qt-designer-widget-relation-row-widget" key={item.widget.name} style={columnStyles[widx]}>{this.renderWidget(item.widget, relFeature, datasetname, updateField, nametransform, disabled)}</td>);
                                            } else if (item.spacer) {
                                                return (<td key={"spacer_" + widx} />);
                                            } else {
                                                return null;
                                            }
                                        })}
                                        {!this.props.readOnly && !disabled && sortcol && !noreorder ? (
                                            <td>
                                                <Icon icon="chevron-up" onClick={() => this.props.reorderRelationRecord(datasetname, idx, -1)} />
                                                <br />
                                                <Icon icon="chevron-down" onClick={() => this.props.reorderRelationRecord(datasetname, idx, 1)} />
                                            </td>
                                        ) : null}
                                        {!this.props.readOnly && !disabled ? (
                                            <td className="qt-designer-widget-relation-record-icon">
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
                    <div className="qt-designer-widget-relation-buttons">
                        <button className="button qt-designer-widget-relation-add" disabled={!this.props.feature.relationValues} onClick={(ev) => this.addRelationRecord(ev, datasetname)} type="button">{LocaleUtils.tr("editing.add")}</button>
                    </div>
                ) : null}
            </div>
        );
    };
    addRelationRecord = (ev, datasetname) => {
        this.setState({relationAddPressed: ev.target});
        this.props.addRelationRecord(datasetname);
    };
    groupOrName = (widget) => {
        return widget.attribute && widget.attribute.buttonGroup ? widget.attribute.buttonGroup._ : widget.name;
    };
    dateConstraint = (constr) => {
        return (constr.year + "-" + ("0" + constr.month).slice(-2) + "-" + ("0" + constr.day).slice(-2));
    };
    parseForm = (data) => {
        const options = {
            explicitArray: false,
            mergeAttrs: true
        };
        const loadingReqId = uuidv1();
        this.setState({loading: true, loadingReqId: loadingReqId});
        xml2js.parseString(data, options, (err, json) => {
            const relationTables = {};
            const externalFields = {};
            const widgets = {};
            const fields = {};
            const buttons = {};
            const nrels = {};
            const counters = {
                widget: 0,
                layout: 0
            };
            this.reformatWidget(json.ui.widget, relationTables, fields, buttons, nrels, externalFields, widgets, counters);
            // console.log(root);
            json.externalFields = externalFields;
            json.widgets = widgets;
            json.fields = fields;
            json.buttons = buttons;
            json.nrels = nrels;
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
    };
    reformatWidget = (widget, relationTables, fields, buttons, nrels, externalFields, widgets, counters) => {
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
            MiscUtils.ensureArray(widget.item).map(item => this.reformatWidget(item, relationTables, fields, buttons, nrels, externalFields, widgets, counters));
        }

        widget.name = widget.name || (":widget_" + counters.widget++);

        if (widget.name in this.props.fields) {
            fields[widget.name] = widget;
        } else if (widget.name.startsWith("kvrel__") || widget.name.startsWith("img__")) {
            const parts = widget.name.split("__");
            if (parts[1] in this.props.fields) {
                fields[parts[1]] = widget;
            }
        } else if (widget.name.startsWith("btn__")) {
            buttons[widget.name.split("__")[1]] = widget;
        } else if (widget.name.startsWith("nrel__")) {
            nrels[widget.name.split("__")[1]] = widget;
        }

        if (widget.name.startsWith("ext__")) {
            externalFields[widget.name.slice(5)] = "";
        }

        widgets[widget.name] = widget;

        if (widget.layout) {
            this.reformatLayout(widget.layout, relationTables, fields, buttons, nrels, externalFields, widgets, counters);
        }
        if (widget.widget) {
            widget.widget = Array.isArray(widget.widget) ? widget.widget : [widget.widget];
            widget.widget.forEach(child => {
                child.name = (":widget_" + counters.widget++);
                this.reformatWidget(child, relationTables, fields, buttons, nrels, externalFields, widgets, counters);
            });
        }

        const parts = widget.name.split("__");
        if (parts.length >= 3 && parts[0] === "nrel") {
            relationTables[this.props.mapPrefix + parts[1]] = {fk: parts[2], sortcol: parts[3] || null, noreorder: parts[4] || false};
        }
    };
    reformatLayout = (layout, relationTables, fields, buttons, nrels, externalFields, widgets, counters) => {
        layout.item = MiscUtils.ensureArray(layout.item);
        layout.name = layout.name || (":layout_" + counters.layout++);
        layout.item.forEach(item => {
            if (!item) {
                return;
            } else if (item.widget) {
                this.reformatWidget(item.widget, relationTables, fields, buttons, nrels, externalFields, widgets, counters);
            } else if (item.spacer) {
                item.spacer.property = MiscUtils.ensureArray(item.spacer.property).reduce((res, prop) => {
                    return ({...res, [prop.name]: prop[Object.keys(prop).find(key => key !== "name")]});
                }, {});
            } else if (item.layout) {
                this.reformatLayout(item.layout, relationTables, fields, buttons, nrels, externalFields, widgets, counters);
            }
        });
    };
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
    };
}

export default connect((state) => ({
    locale: state.locale.current
}), {
})(QtDesignerForm);
