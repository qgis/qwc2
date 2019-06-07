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
const axios = require('axios');
const assign = require('object-assign');
const isEmpty = require('lodash.isempty');
const FileSaver = require('file-saver');
const formDataEntries = require('form-data-entries').default;
const Message = require('../components/I18N/Message');
const MapUtils = require('../utils/MapUtils');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const ConfigUtils = require("../utils/ConfigUtils");
const LocaleUtils = require("../utils/LocaleUtils");
const Spinner = require("../components/Spinner");
const {LayerRole} = require('../actions/layers');
const {changeRotation} = require('../actions/map');
const ToggleSwitch = require('../components/widgets/ToggleSwitch');
const Icon = require('../components/Icon');
const ResizeableWindow = require("../components/ResizeableWindow");
const {SideBar} = require('../components/SideBar');
const PrintFrame = require('../components/PrintFrame');
const VectorLayerUtils = require('../utils/VectorLayerUtils');
require('./style/Print.css');

class Print extends React.Component {
    static propTypes = {
        theme: PropTypes.object,
        map: PropTypes.object,
        layers: PropTypes.array,
        printExternalLayers: PropTypes.bool, // Caution: requires explicit server-side support!
        changeRotation: PropTypes.func,
        inlinePrintOutput: PropTypes.bool,
        scaleFactor: PropTypes.number
    }
    static defaultProps = {
        printExternalLayers: false,
        inlinePrintOutput: false,
        scaleFactor: 1.9 // Experimentally determined...
    }
    state = {
        layout: null,
        scale: null,
        dpi: 300,
        initialRotation: 0,
        grid: false,
        rotationNull: false,
        minimized: false,
        printOutputVisible: false,
        outputLoaded: false,
        printing: false
    }
    constructor(props) {
        super(props);
        this.printForm = null;
    }
    componentWillReceiveProps(newProps) {
        if(newProps.theme !== this.props.theme || !this.state.layout) {
            let layout = null;
            if(newProps.theme && newProps.theme.print && newProps.theme.print.length > 0) {
                layout = newProps.theme.print.find(layout => layout.default) || newProps.theme.print[0];
            }
            this.setState({layout: layout});
        }
    }
    onShow = () => {
        let scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom) / 2);
        if(this.props.theme.printScales && this.props.theme.printScales.length > 0) {
            let closestVal = Math.abs(scale - this.props.theme.printScales[0]);
            let closestIdx = 0;
            for(let i = 1; i < this.props.theme.printScales.length; ++i) {
                let currVal = Math.abs(scale - this.props.theme.printScales[i]);
                if(currVal < closestVal) {
                    closestVal = currVal;
                    closestIdx = i;
                }
            }
            scale = this.props.theme.printScales[closestIdx];
        }
        this.setState({scale: scale, initialRotation: this.props.map.bbox.rotation});
    }
    onHide = () => {
        this.props.changeRotation(this.state.initialRotation);
        this.setState({minimized: false, scale: null});
    }
    renderBody = () => {
        if(!this.state.layout) {
            return (<div role="body" className="print-body"><Message msgId="print.nolayouts" /></div>);
        }
        let themeLayers = this.props.layers.filter(layer => layer.role === LayerRole.THEME);
        if(!this.props.theme || (!this.props.printExternalLayers && !themeLayers)) {
            return (<div role="body" className="print-body"><Message msgId="print.notheme" /></div>);
        }
        let printLayers = [];
        let printOpacities = [];
        let printColors = [];
        for(let layer of this.props.layers) {
            if(layer.role === LayerRole.THEME && layer.params.LAYERS) {
                printLayers.push(layer.params.LAYERS);
                printOpacities.push(layer.params.OPACITIES);
                printColors.push(layer.params.LAYERS.split(",").map(entry => "").join(","));
            } else if(this.props.printExternalLayers && layer.role === LayerRole.USERLAYER && layer.visibility && (layer.type === "wms" || layer.type === "wfs")) {
                printLayers.push(layer.type + ':' + layer.url + "#" + layer.name);
                printOpacities.push(layer.opacity);
                printColors.push(layer.color ? layer.color : "");
            }
        }

        let currentLayoutname = this.state.layout ? this.state.layout.name : "";
        let mapName = this.state.layout ? this.state.layout.map.name : "";

        let backgroundLayer = this.props.layers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility === true);
        let backgroundLayerName = backgroundLayer ? backgroundLayer.name : null;
        let themeBackgroundLayer = this.props.theme.backgroundLayers.find(entry => entry.name === backgroundLayerName);
        let printBackgroundLayer = themeBackgroundLayer ? themeBackgroundLayer.printLayer : null;
        if(printBackgroundLayer) {
            let printBgLayerName = printBackgroundLayer;
            if(Array.isArray(printBackgroundLayer)) {
                printBgLayerName = null;
                for(let i = 0; i < printBackgroundLayer.length; ++i) {
                    printBgLayerName = printBackgroundLayer[i].name;
                    if(this.state.scale <= printBackgroundLayer[i].maxScale) {
                        break;
                    }
                }
            }
            if(printBgLayerName) {
                printLayers.push(printBgLayerName);
                printOpacities.push("255");
                printColors.push("");
            }
        }
        printLayers = printLayers.reverse().join(",");
        printOpacities = printOpacities.reverse().join(",");
        printColors = printColors.reverse().join(",");

        let formvisibility = 'hidden';
        let printDpi = parseInt(this.state.dpi);
        let mapCrs = this.props.map.projection;
        let version = this.props.theme.version || "1.3.0";
        let extent = this.computeCurrentExtent();
        extent = (CoordinatesUtils.getAxisOrder(mapCrs).substr(0, 2) == 'ne' && version == '1.3.0') ?
            extent[1] + "," + extent[0] + "," + extent[3] + "," + extent[2]:
            extent.join(',');
        let rotation = this.state.rotationNull ? "" : this.props.map.bbox ? Math.round(this.props.map.bbox.rotation / Math.PI * 180.) : 0;
        let scaleChooser = (<input name={mapName + ":scale"} type="number" value={this.state.scale || ""} onChange={this.changeScale} min="1"/>);

        if(this.props.theme.printScales && this.props.theme.printScales.length > 0) {
            scaleChooser = (
                <select name={mapName + ":scale"} value={this.state.scale || ""} onChange={this.changeScale}>
                    {this.props.theme.printScales.map(scale => (<option key={scale} value={scale}>{scale}</option>))}
                </select>);
        }
        let resolutionChooser = null;
        let resolutionInput = null;
        if(!isEmpty(this.props.theme.printResolutions)) {
            if(this.props.theme.printResolutions.length > 1) {
                resolutionChooser = (
                    <select name={"DPI"} value={this.state.dpi || ""} onChange={this.changeResolution}>
                        {this.props.theme.printResolutions.map(res => (<option key={res} value={res}>{res}</option>))}
                    </select>);
            } else {
                resolutionInput = (<input name="DPI" readOnly={true} type={formvisibility} value={this.props.theme.printResolutions[0]}/>);
            }
        } else {
            resolutionChooser = (<input name="DPI" type="number" value={this.state.dpi || ""} onChange={this.changeResolution} min="50" max="1200"/>)
        }

        let gridIntervalX = null;
        let gridIntervalY = null;
        let printGrid = this.props.theme.printGrid;
        if(printGrid && printGrid.length > 0 && this.state.scale && this.state.grid) {
            let cur = 0;
            for(; cur < printGrid.length-1 && this.state.scale < printGrid[cur].s; ++cur);
            gridIntervalX = (<input readOnly={true} name={mapName + ":GRID_INTERVAL_X"} type={formvisibility} value={printGrid[cur].x} />);
            gridIntervalY = (<input readOnly={true} name={mapName + ":GRID_INTERVAL_Y"} type={formvisibility} value={printGrid[cur].y} />);
        }

        let labels = this.state.layout && this.state.layout.labels ? this.state.layout.labels : [];

        let highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, mapCrs, printDpi, this.props.scaleFactor);

        return (
            <div className="print-body">
                <form action={this.props.theme.printUrl} method="POST"
                    target="print-output-window" ref={el => this.printForm = el}
                     onSubmit={this.print}>
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
                        {resolutionChooser ? (
                            <tr>
                                <td><Message msgId="print.resolution" /></td>
                                <td>
                                    <span className="input-frame">
                                        {resolutionChooser}
                                        <span>&nbsp;dpi</span>
                                    </span>
                                </td>
                            </tr>
                        ) : null}
                        <tr>
                            <td><Message msgId="print.rotation" /></td>
                            <td>
                                <span className="input-frame">
                                    <input name={mapName + ":rotation"} type="number" value={rotation} onChange={this.changeRotation}/>
                                </span>
                            </td>
                        </tr>
                        {printGrid ? (
                            <tr>
                                <td><Message msgId="print.grid" /></td>
                                <td>
                                    <ToggleSwitch onChange={(newstate) => this.setState({grid: newstate})} active={this.state.grid} />
                                </td>
                            </tr>
                        ) : null}
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
                        <input readOnly={true} name={mapName + ":extent"} type={formvisibility} value={extent || ""} />
                        <input readOnly={true} name="SERVICE" type={formvisibility} value="WMS" />
                        <input readOnly={true} name="VERSION" type={formvisibility} value={version || "1.3.0"} />
                        <input readOnly={true} name="REQUEST" type={formvisibility} value="GetPrint" />
                        <input readOnly={true} name="FORMAT" type={formvisibility} value="pdf" />
                        <input readOnly={true} name="TRANSPARENT" type={formvisibility} value="true" />
                        <input readOnly={true} name="SRS" type={formvisibility} value={mapCrs} />
                        {themeLayers[0].params.MAP ? (<input readOnly={true} name="MAP" type={formvisibility} value={themeLayers[0].params.MAP} />) : null}
                        <input readOnly={true} name="OPACITIES" type={formvisibility} value={printOpacities || ""} />
                        {/* This following one is needed for opacities to work!*/}
                        <input readOnly={true} name="LAYERS" type={formvisibility} value={printLayers || ""} />
                        <input readOnly={true} name="COLORS" type={formvisibility} value={printColors || ""} />
                        <input readOnly={true} name={mapName + ":LAYERS"} type={formvisibility} value={printLayers || ""} />
                        <input readOnly={true} name={mapName + ":HIGHLIGHT_GEOM"} type={formvisibility} value={highlightParams.geoms.join(";")} />
                        <input readOnly={true} name={mapName + ":HIGHLIGHT_SYMBOL"} type={formvisibility} value={highlightParams.styles.join(";")} />
                        <input readOnly={true} name={mapName + ":HIGHLIGHT_LABELSTRING"} type={formvisibility} value={highlightParams.labels.join(";")} />
                        <input readOnly={true} name={mapName + ":HIGHLIGHT_LABELCOLOR"} type={formvisibility} value={highlightParams.labelFillColors.join(";")} />
                        <input readOnly={true} name={mapName + ":HIGHLIGHT_LABELBUFFERCOLOR"} type={formvisibility} value={highlightParams.labelOultineColors.join(";")} />
                        <input readOnly={true} name={mapName + ":HIGHLIGHT_LABELBUFFERSIZE"} type={formvisibility} value={highlightParams.labelOutlineSizes.join(";")} />
                        <input readOnly={true} name={mapName + ":HIGHLIGHT_LABELSIZE"} type={formvisibility} value={highlightParams.labelSizes.join(";")} />
                        {gridIntervalX}
                        {gridIntervalY}
                        {resolutionInput}
                    </div>
                    <div className="button-bar">
                        <button className="button" type="submit" disabled={!printLayers || this.state.printing}>
                            {this.state.printing ? (<span className="print-wait"><Spinner /> <Message msgId="print.wait" /></span>) : (<Message msgId="print.submit" />)}
                        </button>
                    </div>
                </form>
            </div>
        );
    }
    renderPrintFrame = () => {
        let printFrame = null;
        if(this.state.layout) {
            let frame = {
                width: this.state.scale * this.state.layout.map.width / 1000.,
                height: this.state.scale * this.state.layout.map.height / 1000.,
            };
            printFrame = (<PrintFrame key="PrintFrame" map={this.props.map} fixedFrame={frame} />);
        }
        return printFrame;
    }
    renderPrintOutputWindow = () => {
        return (
            <ResizeableWindow key="PrintOutputWindow" title="print.output" icon="print"
                initialWidth={0.5 * window.innerWidth} initialHeight={0.75 * window.innerHeight}
                onClose={() => this.setState({printOutputVisible: false, outputLoaded: false})} visible={this.state.printOutputVisible}
            >
                <div role="body" className="print-output-window-body">
                    {!this.state.outputLoaded ? (
                        <span className="print-output-window-wait">
                            <Spinner /> <Message msgId="print.wait" />
                        </span>
                    ) : null}
                    <iframe name="print-output-window" onLoad={() => this.setState({outputLoaded: true})}/>
                </div>
            </ResizeableWindow>
        )
    }
    render() {
        let minMaxTooltip = LocaleUtils.getMessageById(this.context.messages, this.state.minimized ? "print.maximize" : "print.minimize");
        let extraTitlebarContent = (<Icon title={minMaxTooltip} className="print-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={ev => this.setState({minimized: !this.state.minimized})}/>)
        return (
            <SideBar id="Print" onShow={this.onShow} onHide={this.onHide}
                width="20em" title="appmenu.items.Print" icon={"print"}
                extraTitlebarContent={extraTitlebarContent}>
                {() => ({
                    body: this.state.minimized ? null : this.renderBody(),
                    extra: [
                        this.renderPrintFrame(),
                        this.props.inlinePrintOutput ? this.renderPrintOutputWindow() : null
                    ]
                })}
            </SideBar>
        );
    }
    changeLayout = (ev) => {
        let layout = this.props.theme.print.find(item => item.name == ev.target.value);
        this.setState({layout: layout});
    }
    changeScale = (ev) => {
        this.setState({scale: ev.target.value});
    }
    changeResolution = (ev) => {
        this.setState({dpi: ev.target.value});
    }
    changeRotation = (ev) => {
        if(!ev.target.value) {
            this.setState({rotationNull: true});
        } else {
            this.setState({rotationNull: false});
            let angle = parseFloat(ev.target.value) || 0;
            while(angle < 0) {
                angle += 360;
            }
            while(angle >= 360) {
                angle -= 360;
            }
            this.props.changeRotation(angle / 180. * Math.PI);
        }
    }
    computeCurrentExtent = () => {
        if(!this.props.map || !this.state.layout || !this.state.scale) {
            return [0, 0, 0, 0];
        }
        let center = this.props.map.center;
        let widthm = this.state.scale * this.state.layout.map.width / 1000.;
        let heightm = this.state.scale * this.state.layout.map.height / 1000.;
        let {width, height} = MapUtils.transformExtent(this.props.map.projection, center, widthm, heightm);
        let x1 = center[0]- 0.5 * width;
        let x2 = center[0] + 0.5 * width;
        let y1 = center[1] - 0.5 * height;
        let y2 = center[1] + 0.5 * height;
        return [x1, y1, x2, y2];
    }
    print = (ev) => {
        if(this.props.inlinePrintOutput) {
            this.setState({printOutputVisible: true, outputLoaded: false});
        } else {
            ev.preventDefault();
            this.setState({printing: true});
            let formData = formDataEntries(this.printForm);
            let data = Array.from(formData).map(pair =>
                pair.map(entry => encodeURIComponent(entry).replace(/%20/g,'+')).join("=")
            ).join("&");
            let config = {
                headers: {'Content-Type': 'application/x-www-form-urlencoded' },
                responseType: "arraybuffer"
            }
            axios.post(this.props.theme.printUrl, data, config).then(response => {
                this.setState({printing: false});
                let contentType = response.headers["content-type"];
                FileSaver.saveAs(new Blob([response.data], {type: contentType}), this.props.theme.name + '.pdf');
            }).catch(e => {
                this.setState({printing: false});
                if(e.response) {
                    console.log(new TextDecoder().decode(e.response.data));
                }
                alert('Print failed');
            });
        }
    }
};

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    map: state.map ? state.map : null,
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
