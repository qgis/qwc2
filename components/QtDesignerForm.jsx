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
import EditComboField, {KeyValCache} from './EditComboField';
import EditUploadField from './EditUploadField';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import Icon from './Icon';

import './style/QtDesignerForm.css';


class QtDesignerForm extends React.Component {
    static propTypes = {
        addRelationRecord: PropTypes.func,
        editLayerId: PropTypes.string,
        feature: PropTypes.object,
        featureChanged: PropTypes.bool,
        fields: PropTypes.object,
        form: PropTypes.string,
        iface: PropTypes.object,
        loadRelationValues: PropTypes.func,
        locale: PropTypes.string,
        mapPrefix: PropTypes.string,
        readOnly: PropTypes.bool,
        relationValues: PropTypes.object,
        removeRelationRecord: PropTypes.func,
        updateField: PropTypes.func,
        updateRelationField: PropTypes.func
    }
    static defaultProps = {
        relationValues: {}
    }
    static defaultState = {
        activetabs: {},
        formdata: null,
        relationTables: null
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
        if (this.props.form !== prevProps.form) {
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
        // Reload relation values if necessary
        const feature = this.props.feature;
        const prevFeature = prevProps.feature;
        if (this.state.relationTables && feature && (
            feature.id !== (prevFeature || {}).id ||
            (this.state.relationTables && !prevState.relationTables) ||
            (!this.props.featureChanged && prevProps.featureChanged)
        )) {
            this.props.loadRelationValues(this.state.relationTables);
        }
    }
    componentWillUnmount() {
        KeyValCache.clear();
    }
    render() {
        if (!this.state.formData) {
            return null;
        }
        const root = this.state.formData;
        return (
            <div className="qt-designer-form">
                {this.renderLayout(root.layout, this.props.feature.properties, this.props.editLayerId, this.props.updateField)}
            </div>
        );
    }
    renderLayout = (layout, values, dataset, updateField, nametransform = (name) => name) => {
        let containerClass = "";
        let itemStyle = () => ({});
        let containerStyle = {};
        if (layout.class === "QGridLayout") {
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
        return (
            <div className={containerClass} style={containerStyle}>
                {layout.item.map((item, idx) => {
                    let child = null;
                    if (item.widget) {
                        child = this.renderWidget(item.widget, values, dataset, updateField, nametransform);
                    } else if (item.layout) {
                        child = this.renderLayout(item.layout, values, dataset, updateField, nametransform);
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
        const fitWidgets = ["QLabel", "QCheckBox", "QRadioButton"];
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
    renderWidget = (widget, values, dataset, updateField, nametransform = (name) => name) => {
        let value = (values || {})[widget.name] ?? "";
        const prop = widget.property || {};
        const attr = widget.attribute || {};
        const fieldConstraints = (this.props.fields[widget.name] || {}).constraints || {};
        const inputConstraints = {};
        inputConstraints.readOnly = this.props.readOnly || prop.readOnly === "true" || fieldConstraints.readOnly === true;
        inputConstraints.required = !inputConstraints.readOnly && (prop.required === "true" || fieldConstraints.required === true);
        inputConstraints.placeholder = prop.placeholderText || fieldConstraints.placeholder || "";

        const elname = nametransform(widget.name);
        if (widget.class === "QLabel") {
            const fontProps = widget.property.font || {};
            const style = {
                fontWeight: fontProps.bold === "true" ? "bold" : "normal",
                fontStyle: fontProps.italic === "true" ? "italic" : "normal",
                textDecoration: [fontProps.underline === "true" ? "underline" : "", fontProps.strikeout === "true" ? "line-through" : ""].join(" "),
                fontSize: Math.round((fontProps.pointsize || 9) / 9 * 100) + "%"
            };
            return (<span style={style}>{widget.property.text}</span>);
        } else if (widget.class === "Line") {
            return (<div className="qt-designer-form-line" />);
        } else if (widget.class === "QFrame") {
            return (
                <div className="qt-designer-form-frame">
                    {widget.name.startsWith("nrel__") ? this.renderNRelation(widget) : this.renderLayout(widget.layout, values, dataset, updateField, nametransform)}
                </div>
            );
        } else if (widget.class === "QGroupBox") {
            return (
                <div>
                    <div className="qt-designer-form-frame-title">{prop.title}</div>
                    <div className="qt-designer-form-frame">
                        {widget.name.startsWith("nrel__") ? this.renderNRelation(widget) : this.renderLayout(widget.layout, values, dataset, updateField, nametransform)}
                    </div>
                </div>
            );
        } else if (widget.class === "QTabWidget") {
            if (isEmpty(widget.widget)) {
                return null;
            }
            const activetab = this.state.activetabs[widget.name] || widget.widget[0].name;
            const activewidget = widget.widget.find(child => child.name === activetab);
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
                        {this.renderLayout(activewidget.layout, values, dataset, updateField, nametransform)}
                    </div>
                </div>
            );
        } else if (widget.class === "QTextEdit" || widget.class === "QTextBrowser" || widget.class === "QPlainTextEdit") {
            return (<textarea name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} value={value} />);
        } else if (widget.class === "QLineEdit") {
            if (widget.name.endsWith("__upload")) {
                const fieldId = widget.name.replace(/__upload/, '');
                const uploadValue = ((values || {})[fieldId] || "");
                const uploadElName = elname.replace(/__upload/, '');
                const constraints = {accept: prop.text || ""};
                return (<EditUploadField constraints={constraints} dataset={dataset} disabled={inputConstraints.readOnly} fieldId={fieldId} name={uploadElName} updateField={updateField} value={uploadValue} />);
            } else {
                return (<input name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} size={5} type="text" value={value} />);
            }
        } else if (widget.class === "QCheckBox" || widget.class === "QRadioButton") {
            const type = widget.class === "QCheckBox" ? "checkbox" : "radio";
            const inGroup = attr.buttonGroup;
            const checked = inGroup ? (this.props.feature.properties || {})[this.groupOrName(widget)] === widget.name : value;
            return (
                <label>
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
                value = (values || [])[attrname] ?? "";
                const fieldId = parts.slice(1, count - 3).join("__");
                const keyvalrel = this.props.mapPrefix + parts[count - 3] + ":" + parts[count - 2] + ":" + parts[count - 1];
                return (
                    <EditComboField
                        editIface={this.props.iface} fieldId={fieldId} key={fieldId} keyvalrel={keyvalrel}
                        name={nametransform(attrname)} readOnly={inputConstraints.readOnly || comboFieldConstraints.readOnly} required={inputConstraints.required || comboFieldConstraints.required}
                        updateField={updateField} value={value} />
                );
            } else {
                return (
                    <select name={elname} onChange={ev => updateField(widget.name, ev.target.value)} {...inputConstraints} value={value}>
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
            const min = prop.minimum ?? fieldConstraints.min ?? 0;
            const max = prop.maximum ?? fieldConstraints.max ?? 100;
            const step = prop.singleStep ?? fieldConstraints.step ?? 1;
            const type = (widget.class === "QSlider" ? "range" : "number");
            return (
                <input max={max} min={min} name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} size={5} step={step} type={type} value={value} />
            );
        } else if (widget.class === "QDateEdit") {
            const min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1900-01-01";
            const max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            return (
                <input max={max} min={min} name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} type="date" value={value} />
            );
        } else if (widget.class === "QTimeEdit") {
            return (
                <input name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} {...inputConstraints} type="time" value={value} />
            );
        } else if (widget.class === "QDateTimeEdit") {
            const min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1900-01-01";
            const max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            const parts = (value || "T").split("T");
            parts[1] = (parts[1] || "").replace(/\.\d+$/, ''); // Strip milliseconds
            return (
                <span className="qt-designer-form-datetime">
                    <input max={max[0]} min={min[0]} onChange={(ev) => updateField(widget.name, ev.target.value ? ev.target.value + "T" + parts[1] : "")} readOnly={inputConstraints.readOnly} required={inputConstraints.required} type="date" value={parts[0]} />
                    <input disabled={!parts[0]} onChange={(ev) => updateField(widget.name, parts[0] + "T" + ev.target.value)} {...inputConstraints} type="time" value={parts[1]} />
                    <input name={elname} type="hidden" value={value} />
                </span>
            );
        } else if (widget.class === "QWidget") {
            if (widget.name.startsWith("nrel__")) {
                return this.renderNRelation(widget);
            } else {
                return this.renderLayout(widget.layout, values, dataset, updateField, nametransform);
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
        const headerItems = widget.layout.item.filter(item => item.widget.name.startsWith("header__"));
        return (
            <div className="qt-designer-widget-relation">
                <table>
                    <tbody>
                        {!isEmpty(headerItems) ? (
                            <tr>
                                <th />
                                {headerItems.map(item => (<th key={item.widget.name}>{item.widget.property.text}</th>))}
                                <th />
                            </tr>
                        ) : null}
                        {((this.props.relationValues[tablename] || []).records || []).map((record, idx) => {
                            const updateField = (name, value) => this.props.updateRelationField(tablename, idx, name, value);
                            const nametransform = (name) => (name + "__" + idx);
                            const status = record.__status__ || "";
                            let statusIcon = null;
                            if (status === "new") {
                                statusIcon = "new";
                            } else if (status) {
                                statusIcon = "edited";
                            }
                            let statusText = "";
                            if (record.error) {
                                statusIcon = "warning";
                                statusText = this.buildErrMsg(record);
                            }
                            const extraClass = status.startsWith("deleted") ? "qt-designer-widget-relation-record-deleted" : "";
                            const widgetItems = widget.layout.item.filter(item => !item.widget.name.startsWith("header__"));
                            return (
                                <tr className={"qt-designer-widget-relation-record " + extraClass} key={tablename + idx}>
                                    <td>{statusIcon ? (<Icon icon={statusIcon} title={statusText} />) : null}</td>
                                    {widgetItems.map(item => (
                                        <td className="qt-designer-widget-relation-row-widget" key={item.widget.name}>{this.renderWidget(item.widget, record, this.props.mapPrefix + tablename, updateField, nametransform)}</td>
                                    ))}
                                    {!this.props.readOnly ? (
                                        <td>
                                            <Icon icon="trash" onClick={() => this.props.removeRelationRecord(tablename, idx)} />
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {!this.props.readOnly ? (
                    <div><button className="qt-designer-widget-relation-add" onClick={() => this.props.addRelationRecord(tablename)} type="button">{LocaleUtils.tr("editing.add")}</button></div>
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
        xml2js.parseString(data, options, (err, json) => {
            const relationTables = {};
            this.reformatWidget(json.ui.widget, relationTables);
            // console.log(root);
            this.setState({formData: json.ui.widget, relationTables: relationTables});
        });
    }
    reformatWidget = (widget, relationTables) => {
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
            MiscUtils.ensureArray(widget.item).map(item => this.reformatWidget(item, relationTables));
        }

        widget.name = widget.name || uuid.v1();
        if (widget.layout) {
            this.reformatLayout(widget.layout, relationTables);
        }
        if (widget.widget) {
            widget.widget = Array.isArray(widget.widget) ? widget.widget : [widget.widget];
            widget.widget.forEach(child => {
                child.name = uuid.v1();
                this.reformatWidget(child, relationTables);
            });
        }

        const parts = widget.name.split("__");
        if (parts.length === 3 && parts[0] === "nrel") {
            relationTables[parts[1]] = parts[2];
        }
    }
    reformatLayout = (layout, relationTables) => {
        layout.item = Array.isArray(layout.item) ? layout.item : [layout.item];
        layout.item.forEach(item => {
            if (item.widget) {
                this.reformatWidget(item.widget, relationTables);
            } else if (item.layout) {
                this.reformatLayout(item.layout, relationTables);
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
