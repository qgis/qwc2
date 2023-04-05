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
import {LayerRole} from '../actions/layers';
import {changeRotation} from '../actions/map';
import Icon from '../components/Icon';
import InputContainer from '../components/InputContainer';
import PrintFrame from '../components/PrintFrame';
import ResizeableWindow from '../components/ResizeableWindow';
import SideBar from '../components/SideBar';
import Spinner from '../components/Spinner';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import './style/Print.css';

class Print extends React.Component {
    static propTypes = {
        changeRotation: PropTypes.func,
        defaultDpi: PropTypes.number,
        defaultScaleFactor: PropTypes.number,
        displayRotation: PropTypes.bool,
        gridInitiallyEnabled: PropTypes.bool,
        hideAutopopulatedFields: PropTypes.bool,
        inlinePrintOutput: PropTypes.bool,
        layers: PropTypes.array,
        map: PropTypes.object,
        printExternalLayers: PropTypes.bool, // Caution: requires explicit server-side support!
        scaleFactor: PropTypes.number,
        side: PropTypes.string,
        theme: PropTypes.object
    }
    static defaultProps = {
        printExternalLayers: true,
        inlinePrintOutput: false,
        scaleFactor: 1.9, // Experimentally determined...
        defaultDpi: 300,
        defaultScaleFactor: 0.5,
        displayRotation: true,
        gridInitiallyEnabled: false,
        side: 'right'
    }
    state = {
        layout: null,
        scale: null,
        dpi: 300,
        initialRotation: 0,
        grid: false,
        legend: false,
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
    componentDidUpdate(prevProps) {
        if (prevProps.theme !== this.props.theme) {
            if (this.props.theme && !isEmpty(this.props.theme.print)) {
                const layout = this.props.theme.print.filter(l => l.map).find(l => l.default) || this.props.theme.print[0];
                this.setState({layout: layout});
            } else {
                this.setState({layout: null});
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
            return (<div className="print-body" role="body">{LocaleUtils.tr("print.nolayouts")}</div>);
        }
        const themeLayers = this.props.layers.filter(layer => layer.role === LayerRole.THEME);
        if (!this.props.theme || (!this.props.printExternalLayers && isEmpty(themeLayers))) {
            return (<div className="print-body" role="body">{LocaleUtils.tr("print.notheme")}</div>);
        }

        const formvisibility = 'hidden';
        const printDpi = parseInt(this.state.dpi, 10);
        const mapCrs = this.props.map.projection;
        const version = this.props.theme.version;

        const mapName = this.state.layout.map.name;
        const printParams = LayerUtils.collectPrintParams(this.props.layers, this.props.theme, this.state.scale, mapCrs, this.props.printExternalLayers);

        let extent = this.computeCurrentExtent();
        extent = (CoordinatesUtils.getAxisOrder(mapCrs).substr(0, 2) === 'ne' && version === '1.3.0') ?
            extent[1] + "," + extent[0] + "," + extent[3] + "," + extent[2] :
            extent.join(',');
        let rotation = "";
        if (!this.state.rotationNull) {
            rotation = this.props.map.bbox ? Math.round(this.props.map.bbox.rotation / Math.PI * 180) : 0;
        }
        let scaleChooser = (<input min="1" name={mapName + ":scale"} onChange={this.changeScale} role="input" type="number" value={this.state.scale || ""}/>);

        if (this.props.theme.printScales && this.props.theme.printScales.length > 0) {
            scaleChooser = (
                <select name={mapName + ":scale"} onChange={this.changeScale} role="input" value={this.state.scale || ""}>
                    {this.props.theme.printScales.map(scale => (<option key={scale} value={scale}>{scale}</option>))}
                </select>);
        }
        let resolutionChooser = null;
        let resolutionInput = null;
        if (!isEmpty(this.props.theme.printResolutions)) {
            if (this.props.theme.printResolutions.length > 1) {
                resolutionChooser = (
                    <select name={"DPI"} onChange={this.changeResolution} role="input" value={this.state.dpi || ""}>
                        {this.props.theme.printResolutions.map(res => (<option key={res} value={res}>{res}</option>))}
                    </select>);
            } else {
                resolutionInput = (<input name="DPI" readOnly role="input" type={formvisibility} value={this.props.theme.printResolutions[0]} />);
            }
        } else {
            resolutionChooser = (<input max="1200" min="50" name="DPI" onChange={this.changeResolution} role="input" type="number" value={this.state.dpi || ""} />);
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
        const printLegend = this.state.layout.legendLayout;

        const labels = this.state.layout && this.state.layout.labels ? this.state.layout.labels : [];

        const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, mapCrs, printDpi, this.props.scaleFactor);

        const dimensionValues = this.props.layers.reduce((res, layer) => {
            if (layer.role === LayerRole.THEME) {
                Object.entries(layer.dimensionValues || {}).forEach(([key, value]) => {
                    if (value !== undefined) {
                        res[key] = value;
                    }
                });
            }
            return res;
        }, {});

        return (
            <div className="print-body">
                <form action={this.props.theme.printUrl} method="POST"
                    onSubmit={this.print} ref={el => { this.printForm = el; }}
                    target="print-output-window"
                >
                    <input name="TEMPLATE" type="hidden" value={printLegend && this.state.legend ? printLegend : this.state.layout.name} />
                    <table className="options-table"><tbody>
                        <tr>
                            <td>{LocaleUtils.tr("print.layout")}</td>
                            <td>
                                <select onChange={this.changeLayout} value={this.state.layout.name}>
                                    {this.props.theme.print.filter(l => l.map).map(item => {
                                        return (
                                            <option key={item.name} value={item.name}>{item.name}</option>
                                        );
                                    })}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("print.scale")}</td>
                            <td>
                                <InputContainer>
                                    <span role="prefix">1&nbsp;:&nbsp;</span>
                                    {scaleChooser}
                                </InputContainer>
                            </td>
                        </tr>
                        {resolutionChooser ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.resolution")}</td>
                                <td>
                                    <InputContainer>
                                        {resolutionChooser}
                                        <span role="suffix">&nbsp;dpi</span>
                                    </InputContainer>
                                </td>
                            </tr>
                        ) : null}
                        {this.props.displayRotation === true ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.rotation")}</td>
                                <td>
                                    <input name={mapName + ":rotation"} onChange={this.changeRotation} type="number" value={rotation}/>
                                </td>
                            </tr>
                        ) : null}
                        {printGrid ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.grid")}</td>
                                <td>
                                    <ToggleSwitch active={this.state.grid} onChange={(newstate) => this.setState({grid: newstate})} />
                                </td>
                            </tr>
                        ) : null}
                        {printLegend ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.legend")}</td>
                                <td>
                                    <ToggleSwitch active={this.state.legend} onChange={(newstate) => this.setState({legend: newstate})} />
                                </td>
                            </tr>
                        ) : null}
                        {(labels || []).map(label => {
                            // Omit labels which start with __
                            if (label.startsWith("__")) {
                                return null;
                            }
                            const opts = {rows: 1, name: label.toUpperCase()};
                            if (this.props.theme.printLabelConfig) {
                                Object.assign(opts, this.props.theme.printLabelConfig[label]);
                            }
                            return this.renderPrintLabelField(label, opts);
                        })}
                    </tbody></table>
                    <div>
                        <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
                        <input name={mapName + ":extent"} readOnly type={formvisibility} value={extent || ""} />
                        <input name="SERVICE" readOnly type={formvisibility} value="WMS" />
                        <input name="VERSION" readOnly type={formvisibility} value={version} />
                        <input name="REQUEST" readOnly type={formvisibility} value="GetPrint" />
                        <input name="FORMAT" readOnly type={formvisibility} value="pdf" />
                        <input name="TRANSPARENT" readOnly type={formvisibility} value="true" />
                        <input name="SRS" readOnly type={formvisibility} value={mapCrs} />
                        {Object.entries(printParams).map(([key, value]) => (<input key={key} name={key} type={formvisibility} value={value} />))}
                        <input name="CONTENT_DISPOSITION" readOnly type={formvisibility} value={this.props.inlinePrintOutput ? "inline" : "attachment"} />
                        <input name={mapName + ":LAYERS"} readOnly type={formvisibility} value={printParams.LAYERS} />
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
                        {Object.entries(dimensionValues).map(([key, value]) => (
                            <input key={key} name={key} readOnly type="hidden" value={value} />
                        ))}
                    </div>
                    <div className="button-bar">
                        <button className="button" disabled={!printParams.LAYERS || this.state.printing} type="submit">
                            {this.state.printing ? (<span className="print-wait"><Spinner /> {LocaleUtils.tr("print.wait")}</span>) : LocaleUtils.tr("print.submit")}
                        </button>
                    </div>
                </form>
            </div>
        );
    }
    renderPrintLabelField = (label, opts) => {
        if (this.props.theme.printLabelForSearchResult === label) {
            if (this.props.hideAutopopulatedFields) {
                return (<tr key={"label." + label}><td colSpan="2"><input defaultValue={this.getSearchMarkerLabel()} name={opts.name} type="hidden" /></td></tr>);
            } else {
                return (
                    <tr key={"label." + label}>
                        <td>{MiscUtils.capitalizeFirst(label)}</td>
                        <td><textarea {...opts} defaultValue={this.getSearchMarkerLabel()} readOnly /></td>
                    </tr>
                );
            }
        } else if (this.props.theme.printLabelForAttribution === label) {
            if (this.props.hideAutopopulatedFields) {
                return (<tr key={"label." + label}><td colSpan="2"><input defaultValue={this.getAttributionLabel()} name={opts.name} type="hidden" /></td></tr>);
            } else {
                return (
                    <tr key={"label." + label}>
                        <td>{MiscUtils.capitalizeFirst(label)}</td>
                        <td><textarea {...opts} defaultValue={this.getAttributionLabel()} readOnly /></td>
                    </tr>
                );
            }
        } else {
            return (
                <tr key={"label." + label}>
                    <td>{MiscUtils.capitalizeFirst(label)}</td>
                    <td><textarea {...opts}/></td>
                </tr>
            );
        }
    }
    getSearchMarkerLabel = () => {
        const searchsellayer = this.props.layers.find(layer => layer.id === "searchselection");
        if (searchsellayer && searchsellayer.features) {
            const feature = searchsellayer.features.find(f => f.id === "searchmarker");
            if (feature && feature.properties) {
                return feature.properties.label;
            }
        }
        return "";
    }
    getAttributionLabel = () => {
        const copyrights = this.props.layers.reduce((res, layer) => ({...res, ...LayerUtils.getAttribution(layer, this.props.map)}), {});
        const el = document.createElement("span");
        return Object.entries(copyrights).map(([key, value]) => {
            if (value.title) {
                el.innerHTML = value.title;
                return el.innerText;
            } else {
                el.innerHTML = key;
                return el.innerText;
            }
        }).join(" | ");
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
                title={LocaleUtils.trmsg("print.output")} visible={this.state.printOutputVisible}
            >
                <div className="print-output-window-body" role="body">
                    {!this.state.outputLoaded ? (
                        <span className="print-output-window-wait">
                            <Spinner /> {LocaleUtils.tr("print.wait")}
                        </span>
                    ) : null}
                    <iframe name="print-output-window" onLoad={() => this.setState({outputLoaded: true})}/>
                </div>
            </ResizeableWindow>
        );
    }
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("print.maximize") : LocaleUtils.tr("print.minimize");
        const extraTitlebarContent = (<Icon className="print-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState({minimized: !this.state.minimized})} title={minMaxTooltip}/>);
        return [
            (
                <SideBar extraTitlebarContent={extraTitlebarContent} icon={"print"} id="Print" key="Print"
                    onHide={this.onHide} onShow={this.onShow} side={this.props.side}
                    title="appmenu.items.Print" width="20em">
                    {() => ({
                        body: this.state.minimized ? null : this.renderBody(),
                        extra: [
                            this.renderPrintFrame()
                        ]
                    })}
                </SideBar>
            ),
            this.renderPrintOutputWindow()
        ];
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
                    /* eslint-disable-next-line */
                    console.log(new TextDecoder().decode(e.response.data));
                }
                /* eslint-disable-next-line */
                alert('Print failed');
            });
        }
    }
}

const selector = (state) => ({
    theme: state.theme.current,
    map: state.map,
    layers: state.layers.flat
});

export default connect(selector, {
    changeRotation: changeRotation
})(Print);
