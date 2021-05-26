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
const {LayerRole} = require('../actions/layers');
const {setCurrentTask} = require('../actions/task');
const {TaskBar} = require('../components/TaskBar');
const PrintFrame = require('../components/PrintFrame');
require('./style/DxfExport.css');

class DxfExport extends React.Component {
    static propTypes = {
        formatOptions: PropTypes.string,
        layerOptions: PropTypes.array,
        layers: PropTypes.array,
        map: PropTypes.object,
        serviceUrl: PropTypes.string,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
    }
    state = {
        selectedLayers: ""
    }
    constructor(props) {
        super(props);
        this.state.selectedLayers = !isEmpty(props.layerOptions) ? props.layerOptions[0].layers : "";
    }
    renderBody = () => {
        let themeLayers = this.props.layers.filter(layer => layer.role === LayerRole.THEME);
        if(!this.props.theme || isEmpty(themeLayers)) {
            return null;
        }
        const themeSubLayers = themeLayers.map(layer => layer.params.LAYERS).reverse().join(",");
        const action = this.props.serviceUrl || this.props.theme.url;
        const formatOptions = this.props.formatOptions
            ? <input name="FORMAT_OPTIONS" readOnly type="hidden" value={this.props.formatOptions} />
            : null;
        const basename = this.props.serviceUrl ? this.props.serviceUrl.replace(/\/$/, '').replace(/^.*\//, '') : this.props.theme.name;
        return (
            <span>
                <form action={action} method="POST" ref={form => { this.form = form; }} target="_blank">
                    <div className="help-text"><Message msgId="dxfexport.selectinfo" /></div>
                    <div className="export-settings">
                        <span>
                            <Message msgId="dxfexport.symbologyscale" />&nbsp;
                            <span className="input-frame"><span>&nbsp;1&nbsp;:&nbsp;</span><input defaultValue="500" name="SCALE" type="number" /></span>
                        </span>
                        {!isEmpty(this.props.layerOptions) ? (
                            <span>
                                <Message msgId="dxfexport.layers" />&nbsp;
                                <select name="LAYERS" onChange={ev => this.setState({selectedLayers: ev.target.value})} value={this.state.selectedLayers}>
                                    {this.props.layerOptions.map(opt => (
                                        <option key={opt.layers} value={opt.layers}>{opt.label}</option>
                                    ))}
                                </select>
                            </span>
                        ) : (
                            <input name="LAYERS" readOnly type="hidden" value={themeSubLayers} />
                        )}
                    </div>
                    <input name="SERVICE" readOnly type="hidden" value="WMS" />
                    <input name="VERSION" readOnly type="hidden" value={themeLayers[0].version || "1.3.0"} />
                    <input name="REQUEST" readOnly type="hidden" value="GetMap" />
                    <input name="FORMAT" readOnly type="hidden" value="application/dxf" />
                    <input name="CRS" readOnly type="hidden" value={this.props.map.projection} />
                    <input name="FILE_NAME" readOnly type="hidden" value={basename + ".dxf"} />
                    <input name="BBOX" readOnly ref={input => { this.extentInput = input; }} type="hidden" value="" />
                    {formatOptions}
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
