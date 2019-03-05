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
const isEmpty = require('lodash.isempty');
const Message = require('../components/I18N/Message');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const ProxyUtils = require("../utils/ProxyUtils");
const {LayerRole} = require('../actions/layers');
const {setCurrentTask} = require('../actions/task');
const {TaskBar} = require('../components/TaskBar');
const PrintFrame = require('../components/PrintFrame');
require('./style/DxfExport.css');

class DxfExport extends React.Component {
    static propTypes = {
        theme: PropTypes.object,
        map: PropTypes.object,
        layers: PropTypes.array,
        setCurrentTask: PropTypes.func
    }
    renderBody = () => {
        let themeLayers = this.props.layers.filter(layer => layer.role === LayerRole.THEME);
        if(!this.props.theme || isEmpty(themeLayers)) {
            return null;
        }
        let themeSubLayers = themeLayers.map(layer => layer.params.LAYERS).reverse().join(",");
        let filename = this.props.theme.name + ".dxf";
        let action = ProxyUtils.addProxyIfNeeded(this.props.theme.url, "&filename=" + encodeURIComponent(this.props.theme.name + ".dxf"));
        return (
            <span>
                <form ref={form => this.form = form} action={action} method="POST" target="_blank">
                <div className="help-text"><Message msgId="dxfexport.selectinfo" /></div>
                <div className="export-settings"><Message msgId="dxfexport.symbologyscale" /> <span className="input-frame"><span>1&nbsp;:&nbsp;</span><input type="number" name="SCALE" defaultValue="500" /></span></div>
                <input type="hidden" name="SERVICE" value="WMS" readOnly={true} />
                <input type="hidden" name="VERSION" value={themeLayers[0].version || "1.3.0"} readOnly={true} />
                <input type="hidden" name="REQUEST" value="GetMap" readOnly={true} />
                <input type="hidden" name="FORMAT" value="application/dxf" readOnly={true} />
                <input type="hidden" name="LAYERS" value={themeSubLayers} readOnly={true} />
                <input type="hidden" name="CRS" value={this.props.map.projection} readOnly={true} />
                <input type="hidden" name="FILE_NAME" value={this.props.theme.name + ".dxf"} readOnly={true} />
                <input ref={input => this.extentInput = input} type="hidden" name="BBOX" value="" readOnly={true} />
                </form>
            </span>
        );
    }
    render() {
        return (
            <TaskBar task="DxfExport">
                {() => ({
                    body: this.renderBody(),
                    extra: (<PrintFrame map={this.props.map} bboxSelected={this.bboxSelected} />)
                })}
            </TaskBar>
        );
    }
    bboxSelected = (bbox, crs) => {
        const version = this.props.theme.version || "1.3.0";
        let extent = (CoordinatesUtils.getAxisOrder(crs).substr(0, 2) == 'ne' && version == '1.3.0') ?
            bbox[1] + "," + bbox[0] + "," + bbox[3] + "," + bbox[2]:
            bbox.join(',');
        this.extentInput.value = extent;
        this.form.submit();
        this.props.setCurrentTask(null);
    }
};

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    map: state.map ? state.map : null,
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
