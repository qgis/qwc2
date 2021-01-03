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
import Message from '../components/I18N/Message';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import {LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import TaskBar from '../components/TaskBar';
import PrintFrame from '../components/PrintFrame';
import MapUtils from '../utils/MapUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import './style/RasterExport.css';

class RasterExport extends React.Component {
    static propTypes = {
        dpis: PropTypes.array,
        layers: PropTypes.array,
        map: PropTypes.object,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
    }
    state = {
        selectedFormat: null,
        dpi: 96
    }
    formatChanged = (ev) => {
        this.setState({selectedFormat: ev.target.value});
    }
    dpiChanged = (ev) => {
        this.setState({dpi: parseInt(ev.target.value, 10)});
    }
    renderBody = () => {
        const themeLayers = this.props.layers.filter(layer => layer.role === LayerRole.THEME);
        if (!this.props.theme || !themeLayers) {
            return null;
        }
        const formatMap = {
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/png; mode=16bit": "PNG 16bit",
            "image/png; mode=8bit": "PNG 8bit",
            "image/png; mode=1bit": "PNG 1bit",
            "image/geotiff": "GeoTIFF"
        };

        const availableFormats = this.props.theme.availableFormats;
        const defaultFormat = availableFormats.includes('image/geotiff') ? 'image/geotiff' : availableFormats[0];
        const selectedFormat = this.state.selectedFormat || defaultFormat;
        const filename = this.props.theme.name + "." + selectedFormat.split(";")[0].split("/").pop();
        const action = this.props.theme.url;
        let exportLayers = themeLayers.map(layer => layer.params.LAYERS).reverse().join(",");
        let exportOpacities = themeLayers.map(layer => layer.params.OPACITIES).reverse().join(",");
        const backgroundLayer = this.props.layers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility === true);
        const themeBackgroundLayer = backgroundLayer ? this.props.theme.backgroundLayers.find(entry => entry.name === backgroundLayer.name) : null;
        const exportBackgroundLayer = themeBackgroundLayer ? themeBackgroundLayer.printLayer : null;
        if (exportBackgroundLayer) {
            let printBgLayerName = exportBackgroundLayer;
            if (Array.isArray(exportBackgroundLayer)) {
                const scale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
                printBgLayerName = null;
                for (let i = 0; i < exportBackgroundLayer.length; ++i) {
                    printBgLayerName = exportBackgroundLayer[i].name;
                    if (scale <= exportBackgroundLayer[i].maxScale) {
                        break;
                    }
                }
            }
            if (printBgLayerName) {
                exportLayers = printBgLayerName + "," + exportLayers;
                exportOpacities = "255," + exportOpacities;
            }
        }
        let dpiSelector = null;
        if (this.props.dpis) {
            dpiSelector = (
                <span>
                    <Message msgId="rasterexport.resolution" />&nbsp;
                    <select defaultValue={this.props.dpis[0]} name="DPI" onChange={this.dpiChanged}>
                        {this.props.dpis.map(dpi => {
                            return (<option key={dpi + "dpi"} value={dpi}>{dpi + " dpi"}</option>);
                        })}
                    </select>
                </span>
            );
        }

        // Local vector layer features
        const mapCrs = this.props.map.projection;
        const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, mapCrs, this.state.dpi);

        return (
            <span>
                <form action={action} method="POST" ref={form => { this.form = form; }} target="_blank" >
                    <div className="help-text"><Message msgId="rasterexport.selectinfo" /></div>
                    <div className="raster-export-settings">
                        <span>
                            <Message msgId="rasterexport.format" />&nbsp;
                            <select name="FORMAT" onChange={this.formatChanged} value={selectedFormat}>
                                {availableFormats.map(format => {
                                    if (format.startsWith('image/')) {
                                        return (<option key={format} value={format}>{formatMap[format] || format}</option>);
                                    } else {
                                        return null;
                                    }
                                })}
                            </select>
                        </span>
                        {dpiSelector}
                    </div>
                    <input name="SERVICE" readOnly type="hidden" value="WMS" />
                    <input name="VERSION" readOnly type="hidden" value={themeLayers[0].version || "1.3.0"} />
                    <input name="REQUEST" readOnly type="hidden" value="GetMap" />
                    <input name="LAYERS" readOnly type="hidden" value={exportLayers} />
                    <input name="OPACITIES" readOnly type="hidden" value={exportOpacities} />
                    <input name="TRANSPARENT" readOnly type="hidden" value="true" />
                    <input name="TILED" readOnly type="hidden" value="false" />
                    <input name="STYLES" readOnly type="hidden" value="" />
                    <input name="CRS" readOnly type="hidden" value={this.props.map.projection} />
                    <input name="FILENAME" readOnly type="hidden" value={filename} />
                    <input name="BBOX" readOnly ref={input => { this.extentInput = input; }} type="hidden" value="" />
                    <input name="WIDTH" readOnly ref={input => { this.widthInput = input; }} type="hidden" value="" />
                    <input name="HEIGHT" readOnly ref={input => { this.heightInput = input; }} type="hidden" value="" />
                    {Object.keys(this.props.theme.watermark || {}).map(key => {
                        return (<input key={key} name={"WATERMARK_" + key.toUpperCase()} readOnly type="hidden" value={this.props.theme.watermark[key]} />);
                    })}
                    <input name={"HIGHLIGHT_GEOM"} readOnly type="hidden" value={highlightParams.geoms.join(";")} />
                    <input name={"HIGHLIGHT_SYMBOL"} readOnly type="hidden" value={highlightParams.styles.join(";")} />
                    <input name={"HIGHLIGHT_LABELSTRING"} readOnly type="hidden" value={highlightParams.labels.join(";")} />
                    <input name={"HIGHLIGHT_LABELCOLOR"} readOnly type="hidden" value={highlightParams.labelFillColors.join(";")} />
                    <input name={"HIGHLIGHT_LABELBUFFERCOLOR"} readOnly type="hidden" value={highlightParams.labelOultineColors.join(";")} />
                    <input name={"HIGHLIGHT_LABELBUFFERSIZE"} readOnly type="hidden" value={highlightParams.labelOutlineSizes.join(";")} />
                    <input name={"HIGHLIGHT_LABELSIZE"} readOnly type="hidden" value={highlightParams.labelSizes.join(";")} />
                </form>
            </span>
        );
    }
    render() {
        return (
            <TaskBar task="RasterExport">
                {() => ({
                    body: this.renderBody(),
                    extra: (<PrintFrame bboxSelected={this.bboxSelected} map={this.props.map} />)
                })}
            </TaskBar>
        );
    }
    bboxSelected = (bbox, crs, pixelsize) => {
        const version = this.props.theme.version || "1.3.0";
        const extent = (CoordinatesUtils.getAxisOrder(crs).substr(0, 2) === 'ne' && version === '1.3.0') ?
            bbox[1] + "," + bbox[0] + "," + bbox[3] + "," + bbox[2] :
            bbox.join(',');
        this.extentInput.value = extent;
        this.widthInput.value = Math.round(pixelsize[0] * parseInt(this.state.dpi || 96, 10) / 96);
        this.heightInput.value = Math.round(pixelsize[1] * parseInt(this.state.dpi || 96, 10) / 96);
        this.form.submit();
        this.props.setCurrentTask(null);
    }
}

const selector = (state) => ({
    theme: state.theme.current,
    map: state.map,
    layers: state.layers.flat
});

export default connect(selector, {
    setCurrentTask: setCurrentTask
})(RasterExport);
