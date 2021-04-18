/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import xml2js from 'xml2js';
import ConfigUtils from '../utils/ConfigUtils';
import Icon from './Icon';

import './style/QtDesignerForm.css';


export default class QtDesignerForm extends React.Component {
    static propTypes = {
        addRelationRecord: PropTypes.func,
        editLayerId: PropTypes.string,
        form: PropTypes.string,
        iface: PropTypes.object,
        mapPrefix: PropTypes.string,
        relationValues: PropTypes.object,
        removeRelationRecord: PropTypes.func,
        updateField: PropTypes.func,
        updateRelationField: PropTypes.func,
        values: PropTypes.object
    }
    static defaultProps = {
        relationValues: {}
    }
    state = {
        formdata: null,
        keyvalues: {},
        attributerelations: {}
    }
    componentDidMount() {
        let url = this.props.form;
        if (url && url.startsWith(":/")) {
            const assetsPath = ConfigUtils.getAssetsPath();
            url = assetsPath + this.props.form.substr(1);
        }

        axios.get(url).then(response => {
            this.parseForm(response.data);
        }).catch(e => {
            console.log(e);
        });
    }
    render() {
        if (!this.state.formdata) {
            return null;
        }
        const root = this.state.formdata;
        return (
            <div className="qt-designer-form">
                {this.renderLayout(root.layout, this.props.values, this.props.updateField)}
            </div>
        );
    }
    renderLayout = (layout, values, updateField, nametransform = (name) => name) => {
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
                        child = this.renderWidget(item.widget, values, updateField, nametransform);
                    } else if (item.layout) {
                        child = this.renderLayout(item.layout, values, updateField, nametransform);
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
    renderWidget = (widget, values, updateField, nametransform = (name) => name) => {
        const value = (values || {})[widget.name] || "";
        const prop = widget.property || {};
        const attr = widget.attribute || {};
        const elname = nametransform(widget.name);
        if (widget.class === "QLabel") {
            return (<span>{widget.property.text}</span>);
        } else if (widget.class === "Line") {
            return (<div className="qt-designer-form-line" />);
        } else if (widget.class === "QFrame") {
            return (
                <div className="qt-designer-form-frame">
                    {this.renderLayout(widget.layout, values, updateField, nametransform)}
                </div>
            );
        } else if (widget.class === "QGroupBox") {
            return (
                <div>
                    <div>{prop.title}</div>
                    <div className="qt-designer-form-frame">
                        {this.renderLayout(widget.layout, values, updateField, nametransform)}
                    </div>
                </div>
            );
        } else if (widget.class === "QTextEdit" || widget.class === "QTextBrowser") {
            return (<textarea name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} value={value} />);
        } else if (widget.class === "QLineEdit") {
            if (widget.name.endsWith("__upload")) {
                const fileValue = ((values || {})[widget.name.replace(/__upload/, '')] || "").replace(/attachment:\/\//, '');
                const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl");

                return fileValue ? (
                    <span className="qt-designer-uploaded-file">
                        <a href={editServiceUrl + "/" + this.props.editLayerId + "/attachment?file=" + encodeURIComponent(fileValue)} rel="noreferrer" target="_blank" >
                            {fileValue.replace(/.*\//, '')}
                        </a>
                        <Icon icon="clear" onClick={() => updateField(widget.name.replace(/__upload/, ''), '')} />
                    </span>
                ) : (<input accept={prop.text || ""} name={elname.replace(/__upload/, '')} onChange={() => updateField(widget.name.replace(/__upload/, ''), '')} type="file" />);
            } else {
                const placeholder = prop.placeholderText || "";
                return (<input name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} placeholder={placeholder} type="text" value={value} />);
            }
        } else if (widget.class === "QCheckBox" || widget.class === "QRadioButton") {
            const type = widget.class === "QCheckBox" ? "checkbox" : "radio";
            const inGroup = attr.buttonGroup;
            const checked = inGroup ? (this.props.values || {})[this.groupOrName(widget)] === widget.name : value;
            return (
                <label>
                    <input checked={checked} name={nametransform(this.groupOrName(widget))} onChange={ev => updateField(this.groupOrName(widget), inGroup ? widget.name : ev.target.checked)} type={type} />
                    {widget.property.text}
                </label>
            );
        } else if (widget.class === "QComboBox") {
            if (this.state.keyvalues[widget.name]) {
                return (
                    <select name={elname} onChange={ev => updateField(widget.name, ev.target.value)} value={value}>
                        {this.state.keyvalues[widget.name].map((item) => (
                            <option key={item.key} value={item.key}>{item.value}</option>
                        ))}
                    </select>
                );
            } else {
                return (
                    <select name={elname} onChange={ev => updateField(widget.name, ev.target.value)} value={value}>
                        {this.ensureArray(widget.item).map((item) => (
                            <option key={item.property.string} value={item.property.string}>{item.property.string}</option>
                        ))}
                    </select>
                );
            }
        } else if (widget.class === "QSpinBox" || widget.class === "QDoubleSpinBox" || widget.class === "QSlider") {
            const min = prop.minimum || 0;
            const max = prop.maximum || 100;
            const step = prop.singleStep || 1;
            const type = (widget.class === "QSlider" ? "range" : "number");
            return (
                <input max={max} min={min} name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} step={step} type={type} value={value} />
            );
        } else if (widget.class === "QDateEdit") {
            const min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1900-01-01";
            const max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            return (
                <input max={max} min={min} name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} type="date" value={value} />
            );
        } else if (widget.class === "QDateTimeEdit") {
            const min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1900-01-01T00:00";
            const max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31T00:00";
            return (
                <input max={max} min={min} name={elname} onChange={(ev) => updateField(widget.name, ev.target.value)} type="datetime-local" value={value} />
            );
        } else if (widget.class === "QWidget") {
            if (widget.name.startsWith("nrel__")) {
                return this.renderNRelation(widget);
            } else {
                return this.renderLayout(widget.layout, values, updateField, nametransform);
            }
        }
        return null;
    }
    ensureArray = (el) => {
        if (el === undefined) {
            return [];
        } else if (Array.isArray) {
            return el;
        }
        return [el];
    }
    renderNRelation = (widget) => {
        const parts = widget.name.split("__");
        if (parts.length < 3) {
            return null;
        }
        const tablename = parts[1];
        return (
            <div className="qt-designer-widget-relation">
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
                        statusText = record.error;
                    }
                    const extraClass = status.startsWith("deleted") ? "qt-designer-widget-relation-record-deleted" : "";
                    return (
                        <div className={"qt-designer-widget-relation-record " + extraClass} key={tablename + idx}>
                            {statusIcon ? (<Icon icon={statusIcon} title={statusText} />) : (<span />)}
                            {this.renderLayout(widget.layout, record, updateField, nametransform)}
                            <Icon icon="trash" onClick={() => this.props.removeRelationRecord(tablename, idx)} />
                        </div>
                    );
                })}
                <div><button className="qt-designer-widget-relation-add" onClick={() => this.props.addRelationRecord(tablename)} type="button">Add</button></div>
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
        let json;
        const options = {
            explicitArray: false,
            mergeAttrs: true
        };
        xml2js.parseString(data, options, (err, result) => {
            json = result;
        });
        const root = json.ui.widget;
        const keyvals = {};
        this.reformatWidget(root, keyvals);
        this.props.iface.getKeyValues(Object.values(keyvals).map(entry => this.props.mapPrefix + entry.table + ":" + entry.key + ":" + entry.value).join(","), (result) => {
            const keyvalues = Object.entries(keyvals).reduce((res, [key, val]) => ({...res, [key]: result.keyvalues[this.props.mapPrefix + val.table]}), {});
            this.setState({keyvalues});
        });
        // console.log(root);
        this.setState({formdata: root});
    }
    reformatWidget = (widget, keyvals) => {
        if (widget.property) {
            widget.property = Array.isArray(widget.property) ? widget.property : [widget.property];
            widget.property = widget.property.reduce((res, prop) => {
                return ({...res, [prop.name]: prop[Object.keys(prop).find(key => key !== "name")]});
            }, {});
        }
        if (widget.attribute) {
            widget.attribute = Array.isArray(widget.attribute) ? widget.attribute : [widget.attribute];
            widget.attribute = widget.attribute.reduce((res, prop) => {
                return ({...res, [prop.name]: prop[Object.keys(prop).find(key => key !== "name")]});
            }, {});
        }

        const parts = widget.name.split("__");
        if ((parts.length === 5 || parts.length === 6) && parts[0] === "kvrel") {
            const count = parts.length;
            // kvrel__attrname__datatable__keyfield__valuefield
            // kvrel__reltablename__attrname__datatable__keyfield__valuefield
            keyvals[parts.slice(1, count - 3).join("__")] = {table: parts[count - 3], key: parts[count - 2], value: parts[count - 1]};
            widget.name = parts.slice(1, count - 3).join("__");
        }
        if (widget.layout) {
            this.reformatLayout(widget.layout, keyvals);
        }
    }
    reformatLayout = (layout, keyvals) => {
        layout.item = Array.isArray(layout.item) ? layout.item : [layout.item];
        layout.item.forEach(item => {
            if (item.widget) {
                this.reformatWidget(item.widget, keyvals);
            } else if (item.layout) {
                this.reformatLayout(item.layout, keyvals);
            }
        });
    }
}
