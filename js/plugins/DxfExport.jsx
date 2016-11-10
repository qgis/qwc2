/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {setCurrentTask} = require('../actions/task');
const MessageBar = require('../components/MessageBar');
const PrintFrame = require('../components/PrintFrame');
require('./style/DxfExport.css');

const DxfExport = React.createClass({
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
    renderBody() {
        let themeLayer = this.props.layers.find(layer => layer.id === this.props.themeLayerId);
        let filename = this.props.theme.name + ".dxf";
        return (
            <span role="body">
                <form ref={form => this.form = form} action={this.props.theme.url + "#" + filename} method="POST" target="_blank">
                <div className="help-text"><Message msgId="dxfexport.selectinfo" /></div>
                <div className="export-settings"><Message msgId="dxfexport.symbologyscale" /> <span className="input-frame"><span>1&nbsp;:&nbsp;</span><input type="number" name="SCALE" defaultValue="500" /></span></div>
                <input type="hidden" name="SERVICE" value="WMS" readOnly="true" />
                <input type="hidden" name="VERSION" value="1.3" readOnly="true" />
                <input type="hidden" name="REQUEST" value="GetMap" readOnly="true" />
                <input type="hidden" name="FORMAT" value="application/dxf" readOnly="true" />
                <input type="hidden" name="LAYERS" value={themeLayer.params.LAYERS} readOnly="true" />
                <input type="hidden" name="CRS" value="EPSG:3857" readOnly="true" />
                <input type="hidden" name="FILENAME" value={this.props.theme.name + ".dxf"} readOnly="true" />
                <input ref={input => this.extentInput = input} type="hidden" name="BBOX" value="" readOnly="true" />
                </form>
            </span>
        );
    },
    render() {
        if(!this.props.visible) {
            return null;
        }
        return (
            <div id="DxfExport">
                <MessageBar name="dxfexport" onClose={this.close}>
                    {this.renderBody()}
                </MessageBar>
                <PrintFrame map={this.props.map} bboxSelected={this.bboxSelected} />
            </div>
        );
    },
    bboxSelected(bbox) {
        bbox = CoordinatesUtils.reprojectBbox(bbox, bbox.crs, "EPSG:3857");
        let extent = bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3];
        this.extentInput.value = extent;
        this.form.submit();
        this.close();
    },
    close() {
        this.props.setCurrentTask(null);
    }
});

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    visible: state.task ? state.task.current === 'dxfexport' : false,
    map: state.map ? state.map.present : null,
    themeLayerId: state.theme ? state.theme.currentlayer : "",
    layers: state.layers ? state.layers.flat : []
});

module.exports = {
    DxfExportPlugin: connect(selector, {
        setCurrentTask: setCurrentTask
    })(DxfExport),
    reducers: {
        controls: require('../../MapStore2/web/client/reducers/controls')
    }
}
