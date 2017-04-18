/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const {setCurrentTask} = require('../actions/task');
const MessageBar = require('../components/MessageBar');
const PrintFrame = require('../components/PrintFrame');
require('./style/RasterExport.css');

const RasterExport = React.createClass({
    propTypes: {
        visible: React.PropTypes.bool,
        theme: React.PropTypes.object,
        map: React.PropTypes.object,
        themeLayerId: React.PropTypes.string,
        layers: React.PropTypes.array,
        setCurrentTask: React.PropTypes.func
    },
    getDefaultProps() {
        return {
        }
    },
    getInitialState() {
        return {selectedFormat: null}
    },
    formatChanged(ev) {
        this.setState({selectedFormat: ev.target.value})
    },
    renderBody() {
        const formatMap = {
            "image/jpeg" : "JPEG",
            "image/png": "PNG 24bit",
            "image/png; mode=16bit": "PNG 16bit",
            "image/png; mode=8bit" : "PNG 8bit",
            "image/png; mode=1bit" : "PNG 1bit",
            "image/geotiff" : "GeoTIFF"
        };

        let themeLayer = this.props.layers.find(layer => layer.id === this.props.themeLayerId);
        let action = this.props.theme.url;
        let availableFormats = this.props.theme.availableFormats;
        let defaultFormat = availableFormats.includes('image/geotiff') ? 'image/geotiff' : availableFormats[0];
        let selectedFormat = this.state.selectedFormat || defaultFormat;
        let filename = this.props.theme.name + "." + selectedFormat.split(";")[0].split("/").pop();
        if (ConfigUtils.getConfigProp("proxyUrl")) {
            action = ConfigUtils.getConfigProp("proxyUrl") + encodeURIComponent(action) + "&filename=" + encodeURIComponent(filename);
        }
        let exportLayers = themeLayer ? themeLayer.params.LAYERS : "";
        let exportOpacities = themeLayer ? themeLayer.params.OPACITIES : "";
        let backgroundLayer = this.props.layers.find(layer => layer.group === 'background' && layer.visibility === true);
        let themeBackgroundLayer = backgroundLayer ? this.props.theme.backgroundLayers.find(entry => entry.name === backgroundLayer.name) : null;
        let exportBackgroundLayer = themeBackgroundLayer ? themeBackgroundLayer.printLayer : null;
        if(exportBackgroundLayer) {
            exportLayers = exportBackgroundLayer + "," + exportLayers;
            exportOpacities = "255," + exportOpacities;
        }

        return (
            <span role="body">
                <form ref={form => this.form = form} action={action} method="POST" target="_blank" >
                <div className="help-text"><Message msgId="rasterexport.selectinfo" /></div>
                <div className="export-settings">
                    <Message msgId="rasterexport.format" />&nbsp;
                    <select name="FORMAT" defaultValue={defaultFormat} onChange={this.formatChanged}>
                        {availableFormats.map(format => {
                            if(format.startsWith('image/')) {
                                return (<option key={format} value={format}>{formatMap[format] || format}</option>);
                            } else {
                                return null;
                            }
                        })}
                    </select>
                </div>
                <input type="hidden" name="SERVICE" value="WMS" readOnly="true" />
                <input type="hidden" name="VERSION" value="1.3.0" readOnly="true" />
                <input type="hidden" name="REQUEST" value="GetMap" readOnly="true" />
                <input type="hidden" name="FORMAT" value="image/png" readOnly="true" />
                <input type="hidden" name="LAYERS" value={exportLayers} readOnly="true" />
                <input type="hidden" name="OPACITIES" value={exportOpacities} readOnly="true" />
                <input type="hidden" name="TRANSPARENT" value="true" readOnly="true" />
                <input type="hidden" name="TILED" value="false" readOnly="true" />
                <input type="hidden" name="STYLES" value="" readOnly="true" />
                <input type="hidden" name="CRS" value={this.props.map.projection} readOnly="true" />
                <input type="hidden" name="FILENAME" value={filename} readOnly="true" />
                <input ref={input => this.extentInput = input} type="hidden" name="BBOX" value="" readOnly="true" />
                <input ref={input => this.widthInput = input} type="hidden" name="WIDTH" value="" readOnly="true" />
                <input ref={input => this.heightInput = input} type="hidden" name="HEIGHT" value="" readOnly="true" />
                {Object.keys(this.props.theme.watermark || {}).map(key => {
                    return (<input key={key} type="hidden" name={"WATERMARK_" + key.toUpperCase()} value={this.props.theme.watermark[key]} readOnly="true" />)
                })}
                </form>
            </span>
        );
    },
    render() {
        if(!this.props.visible) {
            return null;
        }
        return (
            <div id="RasterExport">
                <MessageBar name="RasterExport" onClose={this.close}>
                    {this.renderBody()}
                </MessageBar>
                <PrintFrame map={this.props.map} bboxSelected={this.bboxSelected} />
            </div>
        );
    },
    bboxSelected(bbox, pixelsize) {
        let extent = "";
        if(this.props.map.projection == "EPSG:4326") {
            extent = bbox.miny + "," + bbox.minx + "," + bbox.maxy + "," + bbox.maxx;
        } else {
            extent = bbox.minx + "," + bbox.miny + "," + bbox.maxx + "," + bbox.maxy;
        }
        this.extentInput.value = extent;
        this.widthInput.value = pixelsize[0];
        this.heightInput.value = pixelsize[1];
        this.form.submit();
        this.close();
    },
    close() {
        this.props.setCurrentTask(null);
    }
});

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    visible: state.task ? state.task.current === 'RasterExport' : false,
    map: state.map ? state.map.present : null,
    themeLayerId: state.theme ? state.theme.currentlayer : "",
    layers: state.layers ? state.layers.flat : []
});

module.exports = {
    RasterExportPlugin: connect(selector, {
        setCurrentTask: setCurrentTask
    })(RasterExport),
    reducers: {
        task: require('../reducers/task')
    }
}
