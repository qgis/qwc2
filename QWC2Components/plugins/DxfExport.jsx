/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const Message = require('../../MapStore2Components/components/I18N/Message');
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');
const ProxyUtils = require("../../MapStore2Components/utils/ProxyUtils");
const {setCurrentTask} = require('../actions/task');
const {TaskBar} = require('../components/TaskBar');
const PrintFrame = require('../components/PrintFrame');
require('./style/DxfExport.css');

class DxfExport extends React.Component {
    static propTypes = {
        theme: PropTypes.object,
        map: PropTypes.object,
        themeLayerId: PropTypes.string,
        layers: PropTypes.array,
        setCurrentTask: PropTypes.func
    }
    renderBody = () => {
        let themeLayer = this.props.layers.find(layer => layer.id === this.props.themeLayerId);
        if(!themeLayer) {
            return null;
        }
        let filename = this.props.theme.name + ".dxf";
        let action = ProxyUtils.addProxyIfNeeded(this.props.theme.url, "&filename=" + encodeURIComponent(this.props.theme.name + ".dxf"));
        return (
            <span role="body">
                <form ref={form => this.form = form} action={action} method="POST" target="_blank">
                <div className="help-text"><Message msgId="dxfexport.selectinfo" /></div>
                <div className="export-settings"><Message msgId="dxfexport.symbologyscale" /> <span className="input-frame"><span>1&nbsp;:&nbsp;</span><input type="number" name="SCALE" defaultValue="500" /></span></div>
                <input type="hidden" name="SERVICE" value="WMS" readOnly="true" />
                <input type="hidden" name="VERSION" value={themeLayer.version || "1.3.0"} readOnly="true" />
                <input type="hidden" name="REQUEST" value="GetMap" readOnly="true" />
                <input type="hidden" name="FORMAT" value="application/dxf" readOnly="true" />
                <input type="hidden" name="LAYERS" value={themeLayer.params.LAYERS} readOnly="true" />
                <input type="hidden" name="CRS" value={this.props.map.projection} readOnly="true" />
                <input type="hidden" name="FILENAME" value={this.props.theme.name + ".dxf"} readOnly="true" />
                <input ref={input => this.extentInput = input} type="hidden" name="BBOX" value="" readOnly="true" />
                </form>
            </span>
        );
    }
    render() {
        return (
            <TaskBar task="DxfExport">
                {this.renderBody()}
                <PrintFrame role="extra" map={this.props.map} bboxSelected={this.bboxSelected} />
            </TaskBar>
        );
    }
    bboxSelected = (bbox) => {
        bbox = CoordinatesUtils.reprojectBbox(bbox, bbox.crs, "EPSG:3857");
        let extent = bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3];
        this.extentInput.value = extent;
        this.form.submit();
        this.props.setCurrentTask(null);
    }
};

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    map: state.map ? state.map : null,
    themeLayerId: state.theme ? state.theme.currentlayer : null,
    layers: state.layers ? state.layers.flat : []
});

module.exports = {
    DxfExportPlugin: connect(selector, {
        setCurrentTask: setCurrentTask
    })(DxfExport),
    reducers: {
        task: require('../reducers/task')
    }
}
