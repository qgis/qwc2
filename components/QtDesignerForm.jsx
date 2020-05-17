/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const assign = require('object-assign');
const ConfigUtils = require('../utils/ConfigUtils');
const Icon = require("./Icon");
const ResizeableWindow = require("./ResizeableWindow");
const axios = require('axios');
const xml2js = require('xml2js');

require('./style/QtDesignerForm.css');

class QtDesignerForm extends React.Component {
    static propTypes = {
        form: PropTypes.string,
        values: PropTypes.object,
        relationValues: PropTypes.object,
        updateField: PropTypes.func,
        addRelationRecord: PropTypes.func,
        removeRelationRecord: PropTypes.func,
        updateRelationField: PropTypes.func,
        iface: PropTypes.object
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
        if(url && url.startsWith(":/")) {
            let assetsPath = ConfigUtils.getConfigProp("assetsPath");
            url = assetsPath + this.props.form.substr(1);
        }

        axios.get(url).then(response => {
            this.parseForm(response.data);
        }).catch(e => {
            console.log(e);
        });
    }
    render() {
        if(!this.state.formdata) {
            return null;
        }
        let root = this.state.formdata;
        return (
            <div className="qt-designer-form">
                {this.renderLayout(root.layout, this.props.values, this.props.updateField)}
            </div>
        );
    }
    renderLayout = (layout, values, updateField, nametransform = (name) => name) => {
        let containerClass = "";
        let itemStyle = item => ({});
        let containerStyle = {};
        if(layout.class === "QGridLayout") {
            containerClass = "qt-designer-layout-grid";
            containerStyle = {
                gridTemplateColumns: this.computeLayoutColumns(layout.item).join(" ")
            };
            itemStyle = item => ({
                gridArea: (1 + parseInt(item.row)) + "/" + (1 + parseInt(item.column)) + "/ span " + parseInt(item.rowspan || 1) + "/ span " + parseInt(item.colspan || 1)
            });
        } else if(layout.class === "QVBoxLayout") {
            containerClass = "qt-designer-layout-grid";
            itemStyle = (item, idx) => ({
                gridArea: (1 + idx) + "/1/ span 1/ span 1"
            });
        } else if(layout.class === "QHBoxLayout") {
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
                {layout.item.map((item,idx) => {
                    return (
                        <div key={"i" + idx} style={itemStyle(item, idx)}>
                            {item.widget ? this.renderWidget(item.widget, values, updateField, nametransform) : item.layout ? this.renderLayout(item.layout, values, updateField, nametransform) : null}
                        </div>
                    );
                })}
            </div>
        );
    }
    computeLayoutColumns = (items, useIndex=false) => {
        let columns = [];
        let fitWidgets = ["QLabel", "QCheckBox", "QRadioButton"];
        let index = 0;
        let hasAuto = false;
        for(let item of items) {
            let col = useIndex ? index : (parseInt(item.column) || 0);
            let colSpan = useIndex ? 1 : (parseInt(item.colspan) || 1);
            if(item.widget && !fitWidgets.includes(item.widget.class) && colSpan === 1) {
                columns[col] = 'auto';
                hasAuto = true;
            } else {
                columns[col] = columns[col] || null; // Placeholder replaced by fit-content below
            }
            ++index;
        }
        let fit = 'fit-content(' + Math.round(1. / columns.length * 100) + '%)';
        for(let col = 0; col < columns.length; ++col) {
            columns[col] = hasAuto ? (columns[col] || fit) : 'auto';
        }
        return columns;
    }
    renderWidget = (widget, values, updateField, nametransform = (name) => name) => {
        let value = (values || {})[widget.name] || "";
        let prop = widget.property || {};
        let attr = widget.attribute || {};
        let elname = nametransform(widget.name);
        if(widget.class === "QLabel") {
            return (<span>{widget.property.text}</span>);
        } else if(widget.class === "Line") {
            return (<div className="qt-designer-form-line"></div>);
        } else if(widget.class === "QTextEdit") {
            return (<textarea name={elname} value={value} onChange={(ev) => updateField(widget.name, ev.target.value)}></textarea>);
        } else if(widget.class === "QLineEdit") {
            let placeholder = prop.placeholderText || "";
            return (<input name={elname} placeholder={placeholder} type="text" value={value} onChange={(ev) => updateField(widget.name, ev.target.value)} />);
        } else if(widget.class === "QCheckBox" || widget.class === "QRadioButton") {
            let type = widget.class === "QCheckBox" ? "checkbox" : "radio";
            let inGroup = attr.buttonGroup;
            let checked = inGroup ? (this.props.values || {})[this.groupOrName(widget)] == widget.name : value;
            return (<label>
                <input name={nametransform(this.groupOrName(widget))} type={type} checked={checked} onChange={ev => updateField(this.groupOrName(widget), inGroup ? widget.name : ev.target.checked)} />
                {widget.property.text}
            </label>);
        } else if(widget.class === "QComboBox") {
            if(this.state.keyvalues[elname]) {
                return (
                    <select name={elname} value={value} onChange={ev => updateField(widget.name, ev.target.value)}>
                        {this.state.keyvalues[elname].map((item, idx) => (
                            <option key={item.key} value={item.key}>{item.value}</option>
                        ))}
                    </select>
                );
            } else {
                return (
                    <select name={elname} value={value} onChange={ev => updateField(widget.name, ev.target.value)}>
                        {this.ensureArray(widget.item).map((item, idx) => (
                            <option key={item.property.string} value={item.property.string}>{item.property.string}</option>
                        ))}
                    </select>
                );
            }
        } else if(widget.class === "QSpinBox" || widget.class === "QDoubleSpinBox" || widget.class === "QSlider") {
            let min = prop.minimum || 0;
            let max = prop.maximum || 100;
            let step = prop.singleStep || 1;
            let type = (widget.class === "QSlider" ? "range" : "number");
            return (
                <input name={elname} type={type} min={min} max={max} step={step} value={value} onChange={(ev) => updateField(widget.name, ev.target.value)} />
            );
        } else if(widget.class === "QDateEdit") {
            let min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1900-01-01";
            let max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            return (
                <input name={elname} type="date" min={min} max={max} value={value} onChange={(ev) => updateField(widget.name, ev.target.value)} />
            );
        } else if(widget.class === "QWidget") {
            if(widget.name.startsWith("nrel__")) {
                return this.renderNRelation(widget);
            } else {
                return this.renderLayout(widget.layout, values, updateField, nametransform);
            }
        }
        return null;
    }
    ensureArray = (el) => {
        return el === undefined ? [] : Array.isArray(el) ? el : [el];
    }
    renderNRelation = (widget) => {
        let parts = widget.name.split("__");
        if(parts.length < 3) {
            return null;
        }
        let tablename = parts[1];
        return (
            <div className="qt-designer-widget-relation">
                {((this.props.relationValues[tablename] || []).records || []).map((record, idx) => {
                    let updateField = (name, value) => this.props.updateRelationField(tablename, idx, name, value);
                    let nametransform = (name) => (name + "__" + idx);
                    let status = record["__status__"] || "";
                    let statusIcon = !status ? null : status === "new" ? "new" : "edited";
                    let statusText = "";
                    if(record["error"]) {
                        statusIcon = "warning";
                        statusText = record["error"];
                    }
                    let extraClass = status.startsWith("deleted") ? "qt-designer-widget-relation-record-deleted" : "";
                    return (<div key={tablename + idx} className={"qt-designer-widget-relation-record " + extraClass}>
                        {statusIcon ? (<Icon title={statusText} icon={statusIcon} />) : (<span></span>)}
                        {this.renderLayout(widget.layout, record, updateField, nametransform)}
                        <Icon icon="trash" onClick={() => this.props.removeRelationRecord(tablename, idx)} />
                    </div>);
                })}
                <div><button className="qt-designer-widget-relation-add" type="button" onClick={() => this.props.addRelationRecord(tablename)}>Add</button></div>
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
        let options = {
            explicitArray: false,
            mergeAttrs: true
        };
        xml2js.parseString(data, options, (err, result) => {
            json = result;
        });
        let root = json.ui.widget;
        let keyvals = {};
        this.reformatWidget(root, keyvals);
        this.props.iface.getKeyValues(Object.values(keyvals).map(entry => entry.table + ":" + entry.key + ":" + entry.value).join(","), (result) => {
            let keyvalues = Object.entries(keyvals).reduce((res, [key, val]) => assign(res, {[key]: result.keyvalues[val.table]}), {});
            this.setState({keyvalues});
        });
        // console.log(root);
        this.setState({formdata: root});
    }
    reformatWidget = (widget, keyvals) => {
        if(widget.property) {
            widget.property = Array.isArray(widget.property) ? widget.property : [widget.property];
            widget.property = widget.property.reduce((res, prop) => {
                return assign(res, {[prop.name]: prop[Object.keys(prop).find(key => key !== "name")]});
            }, {});
        }
        if(widget.attribute) {
            widget.attribute = Array.isArray(widget.attribute) ? widget.attribute : [widget.attribute];
            widget.attribute = widget.attribute.reduce((res, prop) => {
                return assign(res, {[prop.name]: prop[Object.keys(prop).find(key => key !== "name")]});
            }, {});
        }

        let parts = widget.name.split("__");
        if((parts.length === 5 || parts.length === 6) && parts[0] === "kvrel") {
            let count = parts.length;
            // kvrel__attrname__datatable__keyfield__valuefield
            // kvrel__reltablename__attrname__datatable__keyfield__valuefield
            keyvals[parts.slice(1, count - 3).join("__")] = {table: parts[count - 3], key: parts[count - 2], value: parts[count - 1]};
            widget.name = parts.slice(1, count - 3).join("__");
        }
        if(widget.layout) {
            this.reformatLayout(widget.layout, keyvals);
        }
    }
    reformatLayout = (layout, keyvals) => {
        layout.item = Array.isArray(layout.item) ? layout.item : [layout.item];
        layout.item.forEach(item => {
            if(item.widget) {
                this.reformatWidget(item.widget, keyvals);
            } else if(item.layout) {
                this.reformatLayout(item.layout, keyvals);
            }
        });
    }
}

module.exports = QtDesignerForm;
