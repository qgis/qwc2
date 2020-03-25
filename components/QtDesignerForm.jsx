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
const ResizeableWindow = require("./ResizeableWindow");
const axios = require('axios');
const xml2js = require('xml2js');

require('./style/QtDesignerForm.css');

class QtDesignerForm extends React.Component {
    static propTypes = {
        form: PropTypes.string,
        values: PropTypes.object,
        updateField: PropTypes.func
    }
    state = {
        formdata: null
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
                {this.renderLayout(root.layout)}
            </div>
        );
    }
    renderLayout = (layout) => {
        let containerClass = "";
        let itemStyle = item => ({});
        if(layout.class === "QGridLayout") {
            containerClass = "qt-designer-layout-grid";
            itemStyle = (item => ({
                gridArea: (1 + parseInt(item.row)) + "/" + (1 + parseInt(item.column)) + "/ span " + parseInt(item.rowspan || 1) + "/ span " + parseInt(item.colspan || 1)
            }));
        } else if(layout.class === "QVBoxLayout") {
            containerClass = "qt-designer-layout-vbox";
            itemStyle = item => ({});
        } else if(layout.class === "QHBoxLayout") {
            containerClass = "qt-designer-layout-hbox";
            itemStyle = item => ({});
        } else {
            return null;
        }
        return (
            <div className={containerClass}>
                {layout.item.map((item,idx) => {
                    return (
                        <div key={"i" + idx} style={itemStyle(item)}>
                            {item.widget ? this.renderWidget(item.widget) : item.layout ? this.renderLayout(item.layout) : null}
                        </div>
                    );
                })}
            </div>
        );
    }
    renderWidget = (widget) => {
        let value = (this.props.values || {})[widget.name] || "";
        let prop = widget.property || {};
        let attr = widget.attribute || {};
        if(widget.class === "QLabel") {
            return (<span>{widget.property.text}</span>);
        } else if(widget.class === "Line") {
            return (<div className="qt-designer-form-line"></div>);
        } else if(widget.class === "QTextEdit") {
            return (<textarea name={widget.name} value={value} onChange={(ev) => this.props.updateField(widget.name, ev.target.value)}></textarea>);
        } else if(widget.class === "QLineEdit") {
            let placeholder = prop.placeholderText || "";
            return (<input name={widget.name} placeholder={placeholder} type="text" value={value} onChange={(ev) => this.props.updateField(widget.name, ev.target.value)} />);
        } else if(widget.class === "QCheckBox" || widget.class === "QRadioButton") {
            let type = widget.class === "QCheckBox" ? "checkbox" : "radio";
            let inGroup = attr.buttonGroup;
            let checked = inGroup ? (this.props.values || {})[this.groupOrName(widget)] == widget.name : value;
            return (<label>
                <input name={this.groupOrName(widget)} type={type} checked={checked} onChange={ev => this.props.updateField(this.groupOrName(widget), inGroup ? widget.name : ev.target.checked)} />
                {widget.property.text}
            </label>);
        } else if(widget.class === "QComboBox") {
            return (
                <select name={widget.name} value={value} onChange={ev => this.props.updateField(widget.name, ev.target.value)}>
                    {widget.item.map((item, idx) => (
                        <option key={item.property.string} value={item.property.string}>{item.property.string}</option>
                    ))}
                </select>
            );
        } else if(widget.class === "QSpinBox" || widget.class === "QDoubleSpinBox" || widget.class === "QSlider") {
            let min = prop.minimum || 0;
            let max = prop.maximum || 100;
            let step = prop.singleStep || 1;
            let type = (widget.class === "QSlider" ? "range" : "number");
            return (
                <input name={widget.name} type={type} min={min} max={max} step={step} value={value} onChange={(ev) => this.props.updateField(widget.name, ev.target.value)} />
            );
        } else if(widget.class === "QDateEdit") {
            let min = prop.minimumDate ? this.dateConstraint(prop.minimumDate) : "1900-01-01";
            let max = prop.maximumDate ? this.dateConstraint(prop.maximumDate) : "9999-12-31";
            return (
                <input name={widget.name} type="date" min={min} max={max} value={value} onChange={(ev) => this.props.updateField(widget.name, ev.target.value)} />
            );
        }
        return null;
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
        this.reformatWidget(root);
        // console.log(root);
        this.setState({formdata: root});
    }
    reformatWidget = (widget) => {
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
        if(widget.layout) {
            this.reformatLayout(widget.layout);
        }
    }
    reformatLayout = (layout) => {
        layout.item = Array.isArray(layout.item) ? layout.item : [layout.item];
        layout.item.forEach(item => {
            if(item.widget) {
                this.reformatWidget(item.widget);
            } else if(item.layout) {
                this.reformatLayout(item.layout);
            }
        });
    }
}

module.exports = QtDesignerForm;
