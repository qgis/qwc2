/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const MapUtils = require('../../MapStore2/web/client/utils/MapUtils');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {changeRotation} = require('../../MapStore2/web/client/actions/map');
const {SideBar} = require('../components/SideBar');
const PrintFrame = require('../components/PrintFrame');
require('./style/Print.css');

const Print = React.createClass({
    propTypes: {
        visible: React.PropTypes.bool,
        theme: React.PropTypes.object,
        map: React.PropTypes.object,
        themeLayerId: React.PropTypes.string,
        layers: React.PropTypes.array,
        changeRotation: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            visible: false
        }
    },
    getInitialState() {
        return {layout: null, scale: null, dpi: 300, initialRotation: 0};
    },
    componentWillReceiveProps(newProps) {
        let newState = assign({}, this.state);
        if(newProps.theme !== this.props.theme || !this.state.layout) {
            let layout = null;
            if(newProps.theme && newProps.theme.print && newProps.theme.print.length > 0) {
                layout = newProps.theme.print[0];
            }
            newState["layout"] = layout;
        }
        if(newProps.visible && !this.state.scale && newProps.map) {
            newState["scale"] = Math.round(MapUtils.getScales(newProps.map.projection)[newProps.map.zoom] / 2);
            newState["initialRotation"] = newProps.map.bbox.rotation;
        } else if(!newProps.visible && this.state.scale) {
            newState["scale"] = null;
        }
        this.setState(newState);
    },
    onHide() {
        this.props.changeRotation(this.state.initialRotation);
    },
    renderBody() {
        if(!this.props.theme) {
            return (<div role="body"><Message msgId="print.notheme" /></div>);
        } else if(!this.props.theme.print || this.props.theme.print.length === 0) {
            return (<div role="body"><Message msgId="print.nolayouts" /></div>);
        }
        let currentLayoutname = this.state.layout ? this.state.layout.name : "";
        let mapName = this.state.layout ? this.state.layout.map.name : "";

        let themeLayer = this.props.layers.find(layer => layer.id === this.props.themeLayerId);
        let printLayers = themeLayer ? themeLayer.params.LAYERS : "";
        let printOpacities = themeLayer ? themeLayer.params.OPACITIES : "";

        let backgroundLayer = this.props.layers.find(layer => layer.group === 'background' && layer.visibility === true);
        let themeBackgroundLayer = backgroundLayer ? this.props.theme.backgroundLayers.find(entry => entry.name === backgroundLayer.name) : null;
        let printBackgroundLayer = themeBackgroundLayer ? themeBackgroundLayer.printLayer : null;
        if(printBackgroundLayer) {
            printLayers = printBackgroundLayer + "," + printLayers;
            printOpacities = "255," + printOpacities;
        }

        let extent = this.computeCurrentExtent();
        let formvisibility = 'hidden';
        return (
            <div role="body" className="scrollable">
                <form action={this.props.theme.url} method="POST" target="_blank">
                    <table className="options-table"><tbody>
                        <tr>
                            <td><Message msgId="print.layout" /></td>
                            <td>
                                <select name="TEMPLATE" onChange={this.changeLayout} value={currentLayoutname}>
                                    {this.props.theme.print.map(item => {
                                        return (
                                            <option key={item.name} value={item.name}>{item.name}</option>
                                        )
                                    })}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td><Message msgId="print.scale" /></td>
                            <td>
                                <span className="input-frame">
                                    <span>1&nbsp;:&nbsp;</span>
                                    <input name={mapName + ":scale"} type="number" value={this.state.scale} onChange={this.changeScale} min="1"/>
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td><Message msgId="print.resolution" /></td>
                            <td>
                                <span className="input-frame">
                                    <input name="DPI" type="number" value={this.state.dpi} onChange={this.changeResolution} min="50" max="1200"/>
                                    <span> dpi</span>
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td><Message msgId="print.rotation" /></td>
                            <td>
                                <span className="input-frame">
                                    <input name={mapName + ":rotation"} type="number" value={Math.round(this.props.map.bbox.rotation / Math.PI * 180.)} onChange={this.changeRotation}/>
                                </span>
                            </td>
                        </tr>
                    </tbody></table>
                    <div>
                        <input readOnly="true" name={mapName + ":extent"} type={formvisibility} value={extent} />
                        <input readOnly="true" name="SERVICE" type={formvisibility} value="WMS" />
                        <input readOnly="true" name="VERSION" type={formvisibility} value="1.3" />
                        <input readOnly="true" name="REQUEST" type={formvisibility} value="GetPrint" />
                        <input readOnly="true" name="FORMAT" type={formvisibility} value="pdf" />
                        <input readOnly="true" name="TRANSPARENT" type={formvisibility} value="true" />
                        <input readOnly="true" name="SRS" type={formvisibility} value="EPSG:3857" />
                        <input readOnly="true" name="LAYERS" type={formvisibility} value={printLayers} />
                        <input readOnly="true" name="OPACITIES" type={formvisibility} value={printOpacities} />
                    </div>
                    <div className="button-bar">
                        <button type="submit"><Message msgId="print.submit" /></button>
                    </div>
                </form>
            </div>
        );
    },
    render() {
        let printFrame = null;
        if(this.props.visible && this.state.layout) {
            let frame = {
                width: this.state.scale * this.state.layout.map.width / 1000.,
                height: this.state.scale * this.state.layout.map.height / 1000.,
            };
            printFrame = (<PrintFrame map={this.props.map} fixedFrame={frame} />);
        }
        return (
            <div>
                <SideBar id="Print" onHide={this.onHide} width="16em" title="print.paneltitle">
                    {this.renderBody()}
                </SideBar>
                {printFrame}
            </div>
        );
    },
    changeLayout(ev) {
        let layout = this.props.theme.print.find(item => item.name == ev.target.value);
        this.setState({layout: layout});
    },
    changeScale(ev) {
        this.setState({scale: ev.target.value});
    },
    changeResolution(ev) {
        this.setState({dpi: ev.target.value});
    },
    changeRotation(ev) {
        let angle = parseFloat(ev.target.value);
        while(angle < 0) {
            angle += 360;
        }
        while(angle >= 360) {
            angle -= 360;
        }
        this.props.changeRotation(angle / 180. * Math.PI);
    },
    computeCurrentExtent() {
        if(!this.props.map || !this.state.layout || !this.state.scale) {
            return "";
        }
        let center = CoordinatesUtils.reproject(this.props.map.center, this.props.map.center.crs, "EPSG:3857");
        let width = this.state.scale * this.state.layout.map.width / 1000.;
        let height = this.state.scale * this.state.layout.map.height / 1000.;
        let x1 = Math.round(center.x - 0.5 * width);
        let x2 = Math.round(center.x + 0.5 * width);
        let y1 = Math.round(center.y - 0.5 * height);
        let y2 = Math.round(center.y + 0.5 * height);
        return x1 + "," + y1 + "," + x2 + "," + y2;
    }
});

const selector = (state) => ({
    visible: state.task ? state.task.current === 'Print': false,
    theme: state.theme ? state.theme.current : null,
    map: state.map ? state.map.present : null,
    themeLayerId: state.theme ? state.theme.currentlayer : "",
    layers: state.layers ? state.layers.flat : []
});

module.exports = {
    PrintPlugin: connect(selector, {
        changeRotation: changeRotation
    })(Print),
    reducers: {
        task: require('../reducers/task')
    }
}
