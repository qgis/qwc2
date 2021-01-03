/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import axios from 'axios';
import isEmpty from 'lodash.isempty';
import FileSaver from 'file-saver';
import formDataEntries from 'form-data-entries';
import Message from '../components/I18N/Message';
import MapUtils from '../utils/MapUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import Spinner from '../components/Spinner';
import {LayerRole} from '../actions/layers';
import {changeRotation} from '../actions/map';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import Icon from '../components/Icon';
import ResizeableWindow from '../components/ResizeableWindow';
import SideBar from '../components/SideBar';
import PrintFrame from '../components/PrintFrame';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import './style/Print.css';

class Print extends React.Component {
    static propTypes = {
        changeRotation: PropTypes.func,
        defaultDpi: PropTypes.number,
        defaultScaleFactor: PropTypes.number,
        displayRotation: PropTypes.bool,
        gridInitiallyEnabled: PropTypes.bool,
        inlinePrintOutput: PropTypes.bool,
        layers: PropTypes.array,
        map: PropTypes.object,
        printExternalLayers: PropTypes.bool, // Caution: requires explicit server-side support!
        scaleFactor: PropTypes.number,
        search: PropTypes.object,
        theme: PropTypes.object
    }
    static defaultProps = {
        printExternalLayers: false,
        inlinePrintOutput: false,
        scaleFactor: 1.9, // Experimentally determined...
        defaultDpi: 300,
        defaultScaleFactor: 0.5,
        displayRotation: true,
        gridInitiallyEnabled: false
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
        this.state.grid = props.gridInitiallyEnabled;
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevProps.theme !== this.props.theme || !this.state.layout) {
            if (this.props.theme && !isEmpty(this.props.theme.print)) {
                const layout = this.props.theme.print.find(l => l.default) || this.props.theme.print[0];
                this.setState({layout: layout});
            }
        }
    }
    onShow = () => {
        let scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom) * this.props.defaultScaleFactor);
        if (this.props.theme.printScales && this.props.theme.printScales.length > 0) {
            let closestVal = Math.abs(scale - this.props.theme.printScales[0]);
            let closestIdx = 0;
            for (let i = 1; i < this.props.theme.printScales.length; ++i) {
                const currVal = Math.abs(scale - this.props.theme.printScales[i]);
                if (currVal < closestVal) {
                    closestVal = currVal;
                    closestIdx = i;
                }
            }
            scale = this.props.theme.printScales[closestIdx];
        }
        this.setState({scale: scale, initialRotation: this.props.map.bbox.rotation, dpi: this.props.defaultDpi});
    }
    onHide = () => {
        this.props.changeRotation(this.state.initialRotation);
        this.setState({minimized: false, scale: null});
    }
    renderBody = () => {
        if (!this.state.layout) {
            return (<div className="print-body" role="body"><Message msgId="print.nolayouts" /></div>);
        }
        const themeLayers = this.props.layers.filter(layer => layer.role === LayerRole.THEME);
        if (!this.props.theme || (!this.props.printExternalLayers && isEmpty(themeLayers))) {
            return (<div className="print-body" role="body"><Message msgId="print.notheme" /></div>);
        }
        let printLayers = [];
        let printOpacities = [];
        let printColors = [];
        for (const layer of this.props.layers) {
            if (layer.role === LayerRole.THEME && layer.params.LAYERS) {
                printLayers.push(layer.params.LAYERS);
                printOpacities.push(layer.params.OPACITIES);
                printColors.push(layer.params.LAYERS.split(",").map(() => "").join(","));
            } else if (this.props.printExternalLayers && layer.role === LayerRole.USERLAYER && layer.visibility && (layer.type === "wms" || layer.type === "wfs")) {
                printLayers.push(layer.type + ':' + layer.url + "#" + layer.name);
                printOpacities.push(layer.opacity);
                printColors.push(layer.color ? layer.color : "");
            }
        }

        const currentLayoutname = this.state.layout ? this.state.layout.name : "";
        const mapName = this.state.layout ? this.state.layout.map.name : "";

        const backgroundLayer = this.props.layers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility === true);
        const backgroundLayerName = backgroundLayer ? backgroundLayer.name : null;
        const themeBackgroundLayer = this.props.theme.backgroundLayers.find(entry => entry.name === backgroundLayerName);
        const printBackgroundLayer = themeBackgroundLayer ? themeBackgroundLayer.printLayer : null;
        if (printBackgroundLayer) {
            let printBgLayerName = printBackgroundLayer;
            if (Array.isArray(printBackgroundLayer)) {
                printBgLayerName = null;
                for (let i = 0; i < printBackgroundLayer.length; ++i) {
                    printBgLayerName = printBackgroundLayer[i].name;
                    if (this.state.scale <= printBackgroundLayer[i].maxScale) {
                        break;
                    }
                }
            }
            if (printBgLayerName) {
                printLayers.push(printBgLayerName);
                printOpacities.push("255");
                printColors.push("");
            }
        }
        printLayers = printLayers.reverse().join(",");
        printOpacities = printOpacities.reverse().join(",");
        printColors = printColors.reverse().join(",");

        const formvisibility = 'hidden';
        const printDpi = parseInt(this.state.dpi, 10);
        const mapCrs = this.props.map.projection;
        const version = this.props.theme.version || "1.3.0";
        let extent = this.computeCurrentExtent();
        extent = (CoordinatesUtils.getAxisOrder(mapCrs).substr(0, 2) === 'ne' && version === '1.3.0') ?
            extent[1] + "," + extent[0] + "," + extent[3] + "," + extent[2] :
            extent.join(',');
        let rotation = "";
        if (!this.state.rotationNull) {
            rotation = this.props.map.bbox ? Math.round(this.props.map.bbox.rotation / Math.PI * 180) : 0;
        }
        let scaleChooser = (<input min="1" name={mapName + ":scale"} onChange={this.changeScale} type="number" value={this.state.scale || ""}/>);

        if (this.props.theme.printScales && this.props.theme.printScales.length > 0) {
            scaleChooser = (
                <select name={mapName + ":scale"} onChange={this.changeScale} value={this.state.scale || ""}>
                    {this.props.theme.printScales.map(scale => (<option key={scale} value={scale}>{scale}</option>))}
                </select>);
        }
        let resolutionChooser = null;
        let resolutionInput = null;
        if (!isEmpty(this.props.theme.printResolutions)) {
            if (this.props.theme.printResolutions.length > 1) {
                resolutionChooser = (
                    <select name={"DPI"} onChange={this.changeResolution} value={this.state.dpi || ""}>
                        {this.props.theme.printResolutions.map(res => (<option key={res} value={res}>{res}</option>))}
                    </select>);
            } else {
                resolutionInput = (<input name="DPI" readOnly type={formvisibility} value={this.props.theme.printResolutions[0]} />);
            }
        } else {
            resolutionChooser = (<input max="1200" min="50" name="DPI" onChange={this.changeResolution} type="number" value={this.state.dpi || ""} />);
        }

        let gridIntervalX = null;
        let gridIntervalY = null;
        const printGrid = this.props.theme.printGrid;
        if (printGrid && printGrid.length > 0 && this.state.scale && this.state.grid) {
            let cur = 0;
            for (; cur < printGrid.length - 1 && this.state.scale < printGrid[cur].s; ++cur);
            gridIntervalX = (<input name={mapName + ":GRID_INTERVAL_X"} readOnly type={formvisibility} value={printGrid[cur].x} />);
            gridIntervalY = (<input name={mapName + ":GRID_INTERVAL_Y"} readOnly type={formvisibility} value={printGrid[cur].y} />);
        }

        const labels = this.state.layout && this.state.layout.labels ? this.state.layout.labels : [];

        const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, mapCrs, printDpi, this.props.scaleFactor);

        return (
            <div className="print-body">
                <form action={this.props.theme.printUrl} method="POST"
                    onSubmit={this.print} ref={el => { this.printForm = el; }}
                    target="print-output-window"
                >
                    <table className="options-table"><tbody>
                        <tr>
                            <td><Message msgId="print.layout" /></td>
                            <td>
                                <select name="TEMPLATE" onChange={this.changeLayout} value={currentLayoutname}>
                                    {this.props.theme.print.map(item => {
                                        return (
                                            <option key={item.name} value={item.name}>{item.name}</option>
                                        );
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
                        {this.props.displayRotation === true ? (
                            <tr>
                                <td><Message msgId="print.rotation" /></td>
                                <td>
                                    <span className="input-frame">
                                        <input name={mapName + ":rotation"} onChange={this.changeRotation} type="number" value={rotation}/>
                                    </span>
                                </td>
                            </tr>
                        ) : null}
                        {printGrid && this.props.displayRotation === true ? (
                            <tr>
                                <td><Message msgId="print.grid" /></td>
                                <td>
                                    <ToggleSwitch active={this.state.grid} onChange={(newstate) => this.setState({grid: newstate})} />
                                </td>
                            </tr>
                        ) : null}
                        {(labels || []).map(label => {
                            const opts = {rows: 1, name: label.toUpperCase()};
                            if (this.props.theme.printLabelConfig) {
                                Object.assign(opts, this.props.theme.printLabelConfig[label]);
                            }
                            return (<tr key={"label." + label}>
                                <td>{label}:</td>
                                <td>
                                    {
                                        this.props.theme.printLabelForSearchResult === label && this.props.search ?
                                            (<textarea {...opts} defaultValue={this.props.search.markerLabel}/>) :
                                            (<textarea {...opts}/>)
                                    }
                                </td>
                            </tr>);
                        })}
                    </tbody></table>
                    <div>
                        <input name={mapName + ":extent"} readOnly type={formvisibility} value={extent || ""} />
                        <input name="SERVICE" readOnly type={formvisibility} value="WMS" />
                        <input name="VERSION" readOnly type={formvisibility} value={version || "1.3.0"} />
                        <input name="REQUEST" readOnly type={formvisibility} value="GetPrint" />
                        <input name="FORMAT" readOnly type={formvisibility} value="pdf" />
                        <input name="TRANSPARENT" readOnly type={formvisibility} value="true" />
                        <input name="SRS" readOnly type={formvisibility} value={mapCrs} />
                        {!isEmpty(themeLayers) && themeLayers[0].params.MAP ? (<input name="MAP" readOnly type={formvisibility} value={themeLayers[0].params.MAP} />) : null}
                        <input name="OPACITIES" readOnly type={formvisibility} value={printOpacities || ""} />
                        {/* This following one is needed for opacities to work!*/}
                        <input name="LAYERS" readOnly type={formvisibility} value={printLayers || ""} />
                        <input name="COLORS" readOnly type={formvisibility} value={printColors || ""} />
                        <input name={mapName + ":LAYERS"} readOnly type={formvisibility} value={printLayers || ""} />
                        <input name={mapName + ":HIGHLIGHT_GEOM"} readOnly type={formvisibility} value={highlightParams.geoms.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_SYMBOL"} readOnly type={formvisibility} value={highlightParams.styles.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELSTRING"} readOnly type={formvisibility} value={highlightParams.labels.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELCOLOR"} readOnly type={formvisibility} value={highlightParams.labelFillColors.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELBUFFERCOLOR"} readOnly type={formvisibility} value={highlightParams.labelOultineColors.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELBUFFERSIZE"} readOnly type={formvisibility} value={highlightParams.labelOutlineSizes.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELSIZE"} readOnly type={formvisibility} value={highlightParams.labelSizes.join(";")} />
                        {gridIntervalX}
                        {gridIntervalY}
                        {resolutionInput}
                    </div>
                    <div className="button-bar">
                        <button className="button" disabled={!printLayers || this.state.printing} type="submit">
                            {this.state.printing ? (<span className="print-wait"><Spinner /> <Message msgId="print.wait" /></span>) : (<Message msgId="print.submit" />)}
                        </button>
                    </div>
                </form>
            </div>
        );
    }
    renderPrintFrame = () => {
        let printFrame = null;
        if (this.state.layout) {
            const frame = {
                width: this.state.scale * this.state.layout.map.width / 1000,
                height: this.state.scale * this.state.layout.map.height / 1000
            };
            printFrame = (<PrintFrame fixedFrame={frame} key="PrintFrame" map={this.props.map} />);
        }
        return printFrame;
    }
    renderPrintOutputWindow = () => {
        return (
            <ResizeableWindow icon="print" initialHeight={0.75 * window.innerHeight} initialWidth={0.5 * window.innerWidth}
                key="PrintOutputWindow" onClose={() => this.setState({printOutputVisible: false, outputLoaded: false})}
                title="print.output" visible={this.state.printOutputVisible}
            >
                <div className="print-output-window-body" role="body">
                    {!this.state.outputLoaded ? (
                        <span className="print-output-window-wait">
                            <Spinner /> <Message msgId="print.wait" />
                        </span>
                    ) : null}
                    <iframe name="print-output-window" onLoad={() => this.setState({outputLoaded: true})}/>
                </div>
            </ResizeableWindow>
        );
    }
    render() {
        const minMaxTooltip = LocaleUtils.getMessageById(this.context.messages, this.state.minimized ? "print.maximize" : "print.minimize");
        const extraTitlebarContent = (<Icon className="print-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState({minimized: !this.state.minimized})} title={minMaxTooltip}/>);
        return (
            <SideBar extraTitlebarContent={extraTitlebarContent} icon={"print"} id="Print"
                onHide={this.onHide} onShow={this.onShow} title="appmenu.items.Print"
                width="20em">
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
        const layout = this.props.theme.print.find(item => item.name === ev.target.value);
        this.setState({layout: layout});
    }
    changeScale = (ev) => {
        this.setState({scale: ev.target.value});
    }
    changeResolution = (ev) => {
        this.setState({dpi: ev.target.value});
    }
    changeRotation = (ev) => {
        if (!ev.target.value) {
            this.setState({rotationNull: true});
        } else {
            this.setState({rotationNull: false});
            let angle = parseFloat(ev.target.value) || 0;
            while (angle < 0) {
                angle += 360;
            }
            while (angle >= 360) {
                angle -= 360;
            }
            this.props.changeRotation(angle / 180 * Math.PI);
        }
    }
    computeCurrentExtent = () => {
        if (!this.props.map || !this.state.layout || !this.state.scale) {
            return [0, 0, 0, 0];
        }
        const center = this.props.map.center;
        const widthm = this.state.scale * this.state.layout.map.width / 1000;
        const heightm = this.state.scale * this.state.layout.map.height / 1000;
        const {width, height} = MapUtils.transformExtent(this.props.map.projection, center, widthm, heightm);
        const x1 = center[0] - 0.5 * width;
        const x2 = center[0] + 0.5 * width;
        const y1 = center[1] - 0.5 * height;
        const y2 = center[1] + 0.5 * height;
        return [x1, y1, x2, y2];
    }
    print = (ev) => {
        if (this.props.inlinePrintOutput) {
            this.setState({printOutputVisible: true, outputLoaded: false});
        } else {
            ev.preventDefault();
            this.setState({printing: true});
            const formData = formDataEntries(this.printForm);
            const data = Array.from(formData).map(pair =>
                pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
            ).join("&");
            const config = {
                headers: {'Content-Type': 'application/x-www-form-urlencoded' },
                responseType: "arraybuffer"
            };
            axios.post(this.props.theme.printUrl, data, config).then(response => {
                this.setState({printing: false});
                const contentType = response.headers["content-type"];
                FileSaver.saveAs(new Blob([response.data], {type: contentType}), this.props.theme.name + '.pdf');
            }).catch(e => {
                this.setState({printing: false});
                if (e.response) {
                    console.log(new TextDecoder().decode(e.response.data));
                }
                alert('Print failed');
            });
        }
    }
}

const selector = (state) => ({
    theme: state.theme.current,
    map: state.map,
    layers: state.layers.flat,
    search: state.search
});

export default connect(selector, {
    changeRotation: changeRotation
})(Print);
