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
import FileSaver from 'file-saver';
import formDataEntries from 'formdata-json';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import InputContainer from '../components/InputContainer';
import PrintFrame from '../components/PrintFrame';
import TaskBar from '../components/TaskBar';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/DxfExport.css';


/**
 * Allows exporting a selected extent of the map as DXF.
 *
 * Uses the DXF format support of QGIS Server.
 *
 * Deprecated. Use the MapExport plugin instead.
 */
class DxfExport extends React.Component {
    static propTypes = {
        /** Optional format options to pass to QGIS Server via FORMAT_OPTIONS. */
        formatOptions: PropTypes.string,
        /** Optional choice of layer sets to pass to QGIS Server via LAYERS. */
        layerOptions: PropTypes.arrayOf(PropTypes.shape({
            label: PropTypes.string,
            layers: PropTypes.string
        })),
        layers: PropTypes.array,
        map: PropTypes.object,
        /** Optional URL invoked on export instead of the default QGIS Server URL. */
        serviceUrl: PropTypes.string,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
    };
    state = {
        selectedLayers: ""
    };
    constructor(props) {
        super(props);
        this.state.selectedLayers = !isEmpty(props.layerOptions) ? props.layerOptions[0].layers : "";

        /* eslint-disable-next-line */
        console.warn("The DxfExport plugin is deprecated. Use the MapExport plugin instead.");
    }
    renderBody = () => {
        const themeLayers = this.props.layers.filter(layer => layer.role === LayerRole.THEME);
        if (!this.props.theme || isEmpty(themeLayers)) {
            return null;
        }
        const themeSubLayers = themeLayers.map(layer => layer.params.LAYERS).reverse().join(",");
        const action = this.props.serviceUrl || this.props.theme.url;
        const formatOptions = this.props.formatOptions
            ? <input name="FORMAT_OPTIONS" readOnly type="hidden" value={this.props.formatOptions} />
            : null;
        const basename = this.props.serviceUrl ? this.props.serviceUrl.replace(/\/$/, '').replace(/^.*\//, '') : this.props.theme.name;

        const dimensionValues = this.props.layers.reduce((res, layer) => {
            if (layer.role === LayerRole.THEME) {
                Object.entries(layer.dimensionValues || {}).forEach(([key, value]) => {
                    if (value !== undefined) {
                        res[key] = value;
                    }
                });
            }
            return res;
        }, {});
        const extraOptions = Object.fromEntries((this.props.theme.extraDxfParameters || "").split("&").map(entry => entry.split("=")));
        const paramValue = (key, deflt) => {
            if (key in extraOptions) {
                const value = extraOptions[key];
                delete extraOptions[key];
                return value;
            }
            return deflt;
        };

        return (
            <span>
                <form action={action} method="POST" onSubmit={this.export} ref={form => { this.form = form; }}>
                    <div className="help-text">{LocaleUtils.tr("dxfexport.selectinfo")}</div>
                    <div className="export-settings">
                        <span>
                            {LocaleUtils.tr("dxfexport.symbologyscale")}:&nbsp;
                            <InputContainer>
                                <span role="prefix">&nbsp;1&nbsp;:&nbsp;</span>
                                <input defaultValue={paramValue("SCALE", 500)} name="SCALE" role="input" type="number" />
                            </InputContainer>
                        </span>
                        {!isEmpty(this.props.layerOptions) ? (
                            <span>
                                {LocaleUtils.tr("dxfexport.layers")}:&nbsp;
                                <select name="LAYERS" onChange={ev => this.setState({selectedLayers: ev.target.value})} value={this.state.selectedLayers}>
                                    {this.props.layerOptions.map(opt => (
                                        <option key={opt.layers} value={opt.layers}>{opt.label}</option>
                                    ))}
                                </select>
                            </span>
                        ) : (
                            <input name="LAYERS" readOnly type="hidden" value={paramValue("LAYERS", themeSubLayers)} />
                        )}
                    </div>
                    <input name="SERVICE" readOnly type="hidden" value="WMS" />
                    <input name="VERSION" readOnly type="hidden" value={themeLayers[0].version || "1.3.0"} />
                    <input name="REQUEST" readOnly type="hidden" value="GetMap" />
                    <input name="FORMAT" readOnly type="hidden" value="application/dxf" />
                    <input name="CRS" readOnly type="hidden" value={this.props.map.projection} />
                    <input name="filename" readOnly type="hidden" value={paramValue("filename", basename + ".dxf")} />
                    <input name="BBOX" readOnly ref={input => { this.extentInput = input; }} type="hidden" value="" />
                    {Object.entries(dimensionValues).map(([key, value]) => (
                        <input key={key} name={key} readOnly type="hidden" value={value} />
                    ))}
                    <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
                    {Object.entries(extraOptions).map(([key, value]) => (<input key={key} name={key} readOnly type="hidden" value={value} />))}
                    {formatOptions}
                </form>
            </span>
        );
    };
    render() {
        return (
            <TaskBar task="DxfExport">
                {() => ({
                    body: this.renderBody(),
                    extra: (<PrintFrame bboxSelected={this.bboxSelected} map={this.props.map} />)
                })}
            </TaskBar>
        );
    }
    export = (ev = null) => {
        if (ev) {
            ev.preventDefault();
        }
        const formData = formDataEntries(new FormData(this.form));
        const data = Object.entries(formData).map((pair) =>
            pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
        ).join("&");
        const config = {
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            responseType: "arraybuffer"
        };
        const action = this.props.serviceUrl || this.props.theme.url;
        axios.post(action, data, config).then(response => {
            const contentType = response.headers["content-type"];
            FileSaver.saveAs(new Blob([response.data], {type: contentType}), this.props.theme.name + '.dxf');
        }).catch(e => {
            if (e.response) {
                /* eslint-disable-next-line */
                console.log(new TextDecoder().decode(e.response.data));
            }
            /* eslint-disable-next-line */
            alert('Export failed');
        });
    };
    bboxSelected = (bbox, crs) => {
        if (!bbox) {
            return;
        }
        const version = this.props.theme.version;
        const extent = (CoordinatesUtils.getAxisOrder(crs).substr(0, 2) === 'ne' && version === '1.3.0') ?
            bbox[1] + "," + bbox[0] + "," + bbox[3] + "," + bbox[2] :
            bbox.join(',');
        this.extentInput.value = extent;
        this.export();
        this.props.setCurrentTask(null);
    };
}

const selector = (state) => ({
    theme: state.theme.current,
    map: state.map,
    layers: state.layers.flat
});

export default connect(selector, {
    setCurrentTask: setCurrentTask
})(DxfExport);
