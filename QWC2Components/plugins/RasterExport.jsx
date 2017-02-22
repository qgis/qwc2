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
        return {extension: "png"}
    },
    formatChanged(ev) {
        this.setState({extension: ev.target.value.split("/").pop()})
    },
    renderBody() {
        let themeLayer = this.props.layers.find(layer => layer.id === this.props.themeLayerId);
        let filename = this.props.theme.name + "." + this.state.extension;
        let action = this.props.theme.url;
        if (ConfigUtils.getConfigProp("proxyUrl")) {
            action = ConfigUtils.getConfigProp("proxyUrl") + encodeURIComponent(action) + "&filename=" + encodeURIComponent(this.props.theme.name + "." + this.state.extension);
        }
        return (
            <span role="body">
                <form ref={form => this.form = form} action={action} method="POST" target="_blank">
                <div className="help-text"><Message msgId="rasterexport.selectinfo" /></div>
                <div className="export-settings">
                    <Message msgId="rasterexport.format" />&nbsp;
                    <select name="FORMAT" defaultValue="image/png" onChange={this.formatChanged}>
                        <option value="image/png">PNG</option>
                        <option value="image/jpeg">JPEG</option>
                    </select>
                </div>
                <input type="hidden" name="SERVICE" value="WMS" readOnly="true" />
                <input type="hidden" name="VERSION" value="1.3.0" readOnly="true" />
                <input type="hidden" name="REQUEST" value="GetMap" readOnly="true" />
                <input type="hidden" name="FORMAT" value="image/png" readOnly="true" />
                <input type="hidden" name="LAYERS" value={themeLayer.params.LAYERS} readOnly="true" />
                <input type="hidden" name="OPACITIES" value={themeLayer.params.OPACITIES} readOnly="true" />
                <input type="hidden" name="TRANSPARENT" value="true" readOnly="true" />
                <input type="hidden" name="TILED" value="false" readOnly="true" />
                <input type="hidden" name="STYLES" value="" readOnly="true" />
                <input type="hidden" name="CRS" value={this.props.map.projection} readOnly="true" />
                <input type="hidden" name="FILENAME" value={this.props.theme.name + "." + this.state.extension} readOnly="true" />
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
        bbox = CoordinatesUtils.reprojectBbox(bbox, bbox.crs, "EPSG:3857");
        let extent = bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3];
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
