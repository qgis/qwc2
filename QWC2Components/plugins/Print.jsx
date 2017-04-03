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
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const {changeRotation} = require('../../MapStore2/web/client/actions/map');
const {SideBar} = require('../components/SideBar');
const PrintFrame = require('../components/PrintFrame');
const IdentifyUtils = require('../utils/IdentifyUtils');
require('./style/Print.css');

const Print = React.createClass({
    propTypes: {
        visible: React.PropTypes.bool,
        theme: React.PropTypes.object,
        map: React.PropTypes.object,
        themeLayerId: React.PropTypes.string,
        layers: React.PropTypes.array,
        changeRotation: React.PropTypes.func,
        search: React.PropTypes.object
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
            let scale = Math.round(MapUtils.getScales(newProps.map.projection)[newProps.map.zoom] / 2);
            if(newProps.theme.printScales && newProps.theme.printScales.length > 0) {
                let closestVal = Math.abs(scale - newProps.theme.printScales[0]);
                let closestIdx = 0;
                for(let i = 1; i < newProps.theme.printScales.length; ++i) {
                    let currVal = Math.abs(scale - newProps.theme.printScales[i]);
                    if(currVal < closestVal) {
                        closestVal = currVal;
                        closestIdx = i;
                    }
                }
                scale = newProps.theme.printScales[closestIdx];
            }
            newState["scale"] = scale;
            newState["initialRotation"] = newProps.map.bbox.rotation;
        } else if(!newProps.visible && this.state.scale) {
            newState["scale"] = null;
        }
        this.setState(newState);
    },
    shouldComponentUpdate(newProps, nextState) {
        return newProps.visible || this.props.visible;
    },
    onHide() {
        this.props.changeRotation(this.state.initialRotation);
    },
    renderBody() {
        if(!this.props.theme) {
            return (<div role="body" className="print-body"><Message msgId="print.notheme" /></div>);
        } else if(!this.props.theme.print || this.props.theme.print.length === 0) {
            return (<div role="body" className="print-body"><Message msgId="print.nolayouts" /></div>);
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
        let action = this.props.theme.url;
        if (ConfigUtils.getConfigProp("proxyUrl")) {
            action = ConfigUtils.getConfigProp("proxyUrl") + encodeURIComponent(action) + "&filename=" + encodeURIComponent(this.props.theme.name + ".pdf");
        }
        let rotation = this.props.map.bbox ? this.props.map.bbox.rotation : 0;
        let scaleChooser = (<input name={mapName + ":scale"} type="number" value={this.state.scale || ""} onChange={this.changeScale} min="1"/>);

        if(this.props.theme.printScales && this.props.theme.printScales.length > 0) {
            scaleChooser = (
                <select name={mapName + ":scale"} value={this.state.scale || ""} onChange={this.changeScale}>
                    {this.props.theme.printScales.map(scale => (<option key={scale} value={scale}>{scale}</option>))}
                </select>);
        }
        let resolutionChooser = (<input name="DPI" type="number" value={this.state.dpi || ""} onChange={this.changeResolution} min="50" max="1200"/>);
        if(this.props.theme.printResolutions && this.props.theme.printResolutions.length > 0) {
            resolutionChooser = (
                <select name={"DPI"} value={this.state.dpi || ""} onChange={this.changeResolution}>
                    {this.props.theme.printResolutions.map(res => (<option key={res} value={res}>{res}</option>))}
                </select>);
        }

        let gridIntervalX = null;
        let gridIntervalY = null;
        let printGrid = this.props.theme.printGrid;
        if(printGrid && printGrid.length > 0 && this.state.scale) {
            let cur = 0;
            for(; cur < printGrid.length && this.state.scale < printGrid[cur].s; ++cur);
            gridIntervalX = (<input readOnly="true" name={mapName + ":GRID_INTERVAL_X"} type={formvisibility} value={printGrid[cur].x} />);
            gridIntervalY = (<input readOnly="true" name={mapName + ":GRID_INTERVAL_Y"} type={formvisibility} value={printGrid[cur].y} />);
        }

        let labels = this.state.layout && this.state.layout.labels ? this.state.layout.labels : [];

        let highlightGeom = null;
        let highlightStyle = null;
        let highlightLabel = null;
        if(this.props.search && this.props.search.markerLabel) {
            let feature = this.props.search.highlightedFeature;
            if(!feature) {
                let mapPos = CoordinatesUtils.reproject({x: this.props.search.markerPosition.lng, y: this.props.search.markerPosition.lat}, "EPSG:4326", this.props.map.projection);
                feature = {'geometry': {'type': 'Point', 'coordinates': [mapPos.x, mapPos.y]}};
            }
            highlightGeom = IdentifyUtils.geoJSONToWkt(feature);
            highlightStyle = IdentifyUtils.createGeometrySld(feature.geometry.type, '#FFFF00');
            if(!this.props.theme.printLabelForSearchResult) {
                highlightLabel = this.props.search.markerLabel;
            }
        }
        return (
            <div role="body" className="print-body">
                <form action={action} method="POST" target="_blank">
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
                                    {scaleChooser}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td><Message msgId="print.resolution" /></td>
                            <td>
                                <span className="input-frame">
                                    {resolutionChooser}
                                    <span>&nbsp;dpi</span>
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td><Message msgId="print.rotation" /></td>
                            <td>
                                <span className="input-frame">
                                    <input name={mapName + ":rotation"} type="number" value={Math.round(rotation / Math.PI * 180.)} onChange={this.changeRotation}/>
                                </span>
                            </td>
                        </tr>
                        {(labels || []).map(label => {
                            let opts = assign({rows: 1, name: label.toUpperCase()}, this.props.theme.printLabelConfig ? this.props.theme.printLabelConfig[label] : {});
                            return (<tr key={"label." + label}>
                                <td>{label}:</td>
                                <td>
                                    {
                                        this.props.theme.printLabelForSearchResult === label && this.props.search ?
                                            (<textarea {...opts} defaultValue={this.props.search.markerLabel}/>)
                                        :
                                            (<textarea {...opts}/>)
                                    }
                                </td>
                            </tr>)
                        })}
                    </tbody></table>
                    <div>
                        <input readOnly="true" name={mapName + ":extent"} type={formvisibility} value={extent || ""} />
                        <input readOnly="true" name="SERVICE" type={formvisibility} value="WMS" />
                        <input readOnly="true" name="VERSION" type={formvisibility} value="1.3" />
                        <input readOnly="true" name="REQUEST" type={formvisibility} value="GetPrint" />
                        <input readOnly="true" name="FORMAT" type={formvisibility} value="pdf" />
                        <input readOnly="true" name="TRANSPARENT" type={formvisibility} value="true" />
                        <input readOnly="true" name="SRS" type={formvisibility} value={this.props.map.projection} />
                        <input readOnly="true" name="LAYERS" type={formvisibility} value={printLayers || ""} />
                        <input readOnly="true" name="OPACITIES" type={formvisibility} value={printOpacities || ""} />
                        <input readOnly="true" name={mapName + ":HIGHLIGHT_GEOM"} type={formvisibility} value={highlightGeom || ""} />
                        <input readOnly="true" name={mapName + ":HIGHLIGHT_SYMBOL"} type={formvisibility} value={highlightStyle || ""} />
                        <input readOnly="true" name={mapName + ":HIGHLIGHT_LABELSTRING"} type={formvisibility} value={highlightLabel || ""} />
                        <input readOnly="true" name={mapName + ":HIGHLIGHT_LABELCOLOR"} type={formvisibility} value="black" />
                        <input readOnly="true" name={mapName + ":HIGHLIGHT_LABELBUFFERCOLOR"} type={formvisibility} value="white" />
                        <input readOnly="true" name={mapName + ":HIGHLIGHT_LABELBUFFERSIZE"} type={formvisibility} value="1" />
                        {gridIntervalX}
                        {gridIntervalY}
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
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        return (
            <div>
                <SideBar id="Print" onHide={this.onHide} width="20em"
                    title="appmenu.items.Print"
                    icon={assetsPath + "/img/print_white.svg"}>
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
        let center = CoordinatesUtils.reproject(this.props.map.center, this.props.map.center.crs, this.props.map.projection);
        let widthm = this.state.scale * this.state.layout.map.width / 1000.;
        let heightm = this.state.scale * this.state.layout.map.height / 1000.;
        let {width, height} = MapUtils.transformExtent(this.props.map.projection, center, widthm, heightm);
        let x1 = center.x - 0.5 * width;
        let x2 = center.x + 0.5 * width;
        let y1 = center.y - 0.5 * height;
        let y2 = center.y + 0.5 * height;
        return x1 + "," + y1 + "," + x2 + "," + y2;
    }
});

const selector = (state) => ({
    visible: state.task ? state.task.current === 'Print': false,
    theme: state.theme ? state.theme.current : null,
    map: state.map ? state.map.present : null,
    themeLayerId: state.theme ? state.theme.currentlayer : "",
    layers: state.layers ? state.layers.flat : [],
    search: state.search
});

module.exports = {
    PrintPlugin: connect(selector, {
        changeRotation: changeRotation
    })(Print),
    reducers: {
        task: require('../reducers/task')
    }
}
