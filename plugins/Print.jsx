/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import FileSaver from 'file-saver';
import formDataEntries from 'formdata-json';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, addLayerFeatures, clearLayer} from '../actions/layers';
import {changeRotation, panTo} from '../actions/map';
import Icon from '../components/Icon';
import InputContainer from '../components/InputContainer';
import PickFeature from '../components/PickFeature';
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


/**
 * Invokes QGIS Server WMS GetPrint to print the map to PDF.
 *
 * Uses the print layouts defined in the QGIS project.
 */
class Print extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayerFeatures: PropTypes.func,
        /** Whether to allow GeoPDF export. Requires QGIS Server 3.32 or newer. */
        allowGeoPdfExport: PropTypes.bool,
        changeRotation: PropTypes.func,
        clearLayer: PropTypes.func,
        /** The default print dpi.  */
        defaultDpi: PropTypes.number,
        /** The factor to apply to the map scale to determine the initial print map scale.  */
        defaultScaleFactor: PropTypes.number,
        /** Whether to display the map rotation control. */
        displayRotation: PropTypes.bool,
        /** Export layout format mimetypes. If empty, supported formats are listed. If format is not supported by QGIS Server, print will fail */
        formats: PropTypes.arrayOf(PropTypes.string),
        /** Whether the grid is enabled by default. */
        gridInitiallyEnabled: PropTypes.bool,
        /** Whether to hide form fields which contain autopopulated values (i.e. search result label). */
        hideAutopopulatedFields: PropTypes.bool,
        /** Whether to display the print output in an inline dialog instead triggering a download. */
        inlinePrintOutput: PropTypes.bool,
        layers: PropTypes.array,
        map: PropTypes.object,
        panTo: PropTypes.func,
        /** Whether to print external layers. Requires QGIS Server 3.x! */
        printExternalLayers: PropTypes.bool,
        /** Scale factor to apply to line widths, font sizes, ... of redlining drawings passed to GetPrint.  */
        scaleFactor: PropTypes.number,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object
    };
    static defaultProps = {
        printExternalLayers: true,
        inlinePrintOutput: false,
        scaleFactor: 1.9, // Experimentally determined...
        defaultDpi: 300,
        defaultScaleFactor: 0.5,
        displayRotation: true,
        gridInitiallyEnabled: false,
        side: 'right'
    };
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
        printing: false,
        atlasFeatures: [],
        geoPdf: false,
        availableFormats: [],
        selectedFormat: "",
        printOutputData: undefined
    };
    constructor(props) {
        super(props);
        this.printForm = null;
        this.state.grid = props.gridInitiallyEnabled;
        this.fixedMapCenter = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevProps.theme !== this.props.theme) {
            if (this.props.theme && !isEmpty(this.props.theme.print)) {
                const layouts = this.props.theme.print.filter(l => l.map).sort((a, b) => {
                    return a.name.localeCompare(b.name, undefined, {numeric: true});
                });
                const layout = layouts.find(l => l.default) || layouts[0];
                this.setState({layout: layout, atlasFeatures: []});
            } else {
                this.setState({layout: null, atlasFeatures: []});
            }
            this.fixedMapCenter = null;
        }
        if (this.state.atlasFeatures !== prevState.atlasFeatures) {
            if (!isEmpty(this.state.atlasFeatures)) {
                const layer = {
                    id: "print-pick-selection",
                    role: LayerRole.SELECTION,
                    skipPrint: true
                };
                this.props.addLayerFeatures(layer, this.state.atlasFeatures, true);
            } else if (!isEmpty(prevState.atlasFeatures)) {
                this.props.clearLayer("print-pick-selection");
            }
        }
    }
    onShow = () => {
        const defaultFormats = ['application/pdf', 'image/jpeg', 'image/png', 'image/svg'];
        const availableFormats = !isEmpty(this.props.formats) ? this.props.formats : defaultFormats;
        const selectedFormat = availableFormats[0];
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
        this.setState({
            scale: scale,
            initialRotation: this.props.map.bbox.rotation,
            dpi: this.props.defaultDpi,
            availableFormats: availableFormats,
            selectedFormat: selectedFormat
        });
    };
    onHide = () => {
        this.props.changeRotation(this.state.initialRotation);
        this.setState({minimized: false, scale: null, atlasFeatures: []});
    };
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
        if (!isEmpty(this.state.atlasFeatures)) {
            extent = "";
        }
        let rotation = "";
        if (!this.state.rotationNull) {
            rotation = this.props.map.bbox ? Math.round(this.props.map.bbox.rotation / Math.PI * 180) : 0;
        }
        let scaleChooser = (<input min="1" name={mapName + ":scale"} onChange={this.changeScale} role="input" type="number" value={this.state.scale || ""}/>);

        if (this.props.theme.printScales && this.props.theme.printScales.length > 0) {
            scaleChooser = (
                <select name={mapName + ":scale"} onChange={this.changeScale} role="input" value={this.state.scale || ""}>
                    {this.props.theme.printScales.map(scale => (<option key={scale} value={scale}>{scale}</option>))}
                </select>
            );
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

        const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, mapCrs, this.state.scale, printDpi, this.props.scaleFactor);

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

        const extraOptions = Object.fromEntries((this.props.theme.extraPrintParameters || "").split("&").map(entry => entry.split("=")));
        const layouts = this.props.theme.print.filter(l => l.map).sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, {numeric: true});
        });

        const formatMap = {
            "application/pdf": "PDF",
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/svg": "SVG"
        };
        const selectedFormat = this.state.selectedFormat;

        return (
            <div className="print-body">
                <form action={this.props.theme.printUrl} method="POST"
                    onSubmit={this.print} ref={el => { this.printForm = el; }}
                >
                    <input name="TEMPLATE" type="hidden" value={printLegend && this.state.legend ? printLegend : this.state.layout.name} />
                    <table className="options-table"><tbody>
                        <tr>
                            <td>{LocaleUtils.tr("print.layout")}</td>
                            <td>
                                <select onChange={this.changeLayout} value={this.state.layout.name}>
                                    {layouts.filter(l => l.map).map(item => {
                                        return (
                                            <option key={item.name} value={item.name}>{item.name.split('/').pop()}</option>
                                        );
                                    })}
                                </select>
                            </td>
                        </tr>
                        {this.state.availableFormats.length > 1 ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.format")}</td>
                                <td>
                                    <select name="FORMAT" onChange={this.formatChanged} value={this.state.selectedFormat}>
                                        {this.state.availableFormats.map(format => {
                                            return (<option key={format} value={format}>{formatMap[format] || format}</option>);
                                        })}
                                    </select>
                                </td>
                            </tr>
                        ) : null}
                        {this.state.layout.atlasCoverageLayer ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.atlasfeature")}</td>
                                <td>
                                    {!isEmpty(this.state.atlasFeatures) ? (
                                        <div className="print-atlas-features">
                                            {this.state.atlasFeatures.map(feature => (
                                                <span key={feature.id}>
                                                    <span>{feature.properties[feature.displayfield]}</span>
                                                    <Icon icon="remove" onClick={() => this.deselectAtlasFeature(feature)} />
                                                </span>
                                            ))}
                                            <input name="ATLAS_PK" type="hidden" value={this.state.atlasFeatures.map(feature => feature.properties[this.state.layout.atlas_pk] ?? feature.id).join(",")} />
                                        </div>
                                    ) : (
                                        <input disabled placeholder={LocaleUtils.tr("print.pickatlasfeature", this.state.layout.atlasCoverageLayer)} type="text" />
                                    )}
                                </td>
                            </tr>
                        ) : null}
                        {isEmpty(this.state.atlasFeatures) ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.scale")}</td>
                                <td>
                                    <InputContainer>
                                        <span role="prefix">1&nbsp;:&nbsp;</span>
                                        {scaleChooser}
                                    </InputContainer>
                                </td>
                            </tr>
                        ) : null}
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
                            const opts = {
                                rows: 1,
                                name: label.toUpperCase(),
                                ...this.props.theme.printLabelConfig?.[label]
                            };
                            return this.renderPrintLabelField(label, opts);
                        })}
                        {selectedFormat === "application/pdf" && this.props.allowGeoPdfExport ? (
                            <tr>
                                <td>GeoPDF</td>
                                <td>
                                    <ToggleSwitch active={this.state.geoPdf} onChange={(newstate) => this.setState({geoPdf: newstate})} />
                                </td>
                            </tr>
                        ) : null}
                    </tbody></table>
                    <div>
                        <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
                        <input name={mapName + ":extent"} readOnly type={formvisibility} value={extent || ""} />
                        <input name="SERVICE" readOnly type={formvisibility} value="WMS" />
                        <input name="VERSION" readOnly type={formvisibility} value={version} />
                        <input name="REQUEST" readOnly type={formvisibility} value="GetPrint" />
                        <input name="FORMAT" readOnly type={formvisibility} value={selectedFormat} />
                        <input name="TRANSPARENT" readOnly type={formvisibility} value="true" />
                        <input name="SRS" readOnly type={formvisibility} value={mapCrs} />
                        {Object.entries(printParams).map(([key, value]) => (<input key={key} name={key} type={formvisibility} value={value} />))}
                        <input name="CONTENT_DISPOSITION" readOnly type={formvisibility} value={this.props.inlinePrintOutput ? "inline" : "attachment"} />
                        <input name={mapName + ":LAYERS"} readOnly type={formvisibility} value={printParams.LAYERS} />
                        <input name={mapName + ":STYLES"} readOnly type={formvisibility} value={printParams.STYLES} />
                        <input name={mapName + ":FILTER"} readOnly type={formvisibility} value={printParams.FILTER} />
                        <input name={mapName + ":HIGHLIGHT_GEOM"} readOnly type={formvisibility} value={highlightParams.geoms.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_SYMBOL"} readOnly type={formvisibility} value={highlightParams.styles.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELSTRING"} readOnly type={formvisibility} value={highlightParams.labels.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELCOLOR"} readOnly type={formvisibility} value={highlightParams.labelFillColors.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELBUFFERCOLOR"} readOnly type={formvisibility} value={highlightParams.labelOutlineColors.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELBUFFERSIZE"} readOnly type={formvisibility} value={highlightParams.labelOutlineSizes.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABELSIZE"} readOnly type={formvisibility} value={highlightParams.labelSizes.join(";")} />
                        <input name={mapName + ":HIGHLIGHT_LABEL_DISTANCE"} readOnly type={formvisibility} value={highlightParams.labelDist.join(";")} />
                        {selectedFormat === "application/pdf" && this.props.allowGeoPdfExport  ? (<input name="FORMAT_OPTIONS" readOnly type={formvisibility} value={this.state.geoPdf ? "WRITE_GEO_PDF:true" : "WRITE_GEO_PDF:false"} />) : null}
                        {gridIntervalX}
                        {gridIntervalY}
                        {resolutionInput}
                        {Object.entries(dimensionValues).map(([key, value]) => (
                            <input key={key} name={key} readOnly type="hidden" value={value} />
                        ))}
                        {Object.entries(extraOptions).map(([key, value]) => (<input key={key} name={key} readOnly type="hidden" value={value} />))}
                    </div>
                    <div className="button-bar">
                        <button className="button" disabled={!printParams.LAYERS || this.state.printing} type="submit">
                            {this.state.printing ? (<span className="print-wait"><Spinner /> {LocaleUtils.tr("print.wait")}</span>) : LocaleUtils.tr("print.submit")}
                        </button>
                    </div>
                </form>
            </div>
        );
    };
    renderPrintLabelField = (label, opts) => {
        let defaultValue = opts.defaultValue || "";
        let autopopulated = false;
        if (label === this.props.theme.printLabelForSearchResult) {
            defaultValue = this.getSearchMarkerLabel();
            autopopulated = true;
        } else if (label === this.props.theme.printLabelForAttribution) {
            defaultValue = this.getAttributionLabel();
            autopopulated = true;
        }
        if (autopopulated && this.props.hideAutopopulatedFields) {
            return (<tr key={"label." + label}><td colSpan="2"><input defaultValue={defaultValue} name={opts.name} type="hidden" /></td></tr>);
        } else {
            if (opts.options) {
                return (
                    <tr key={"label." + label}>
                        <td>{MiscUtils.capitalizeFirst(label)}</td>
                        <td>
                            <select defaultValue={defaultValue} name={opts.name}>
                                {opts.options.map(value => (<option key={value} value={value}>{value}</option>))}
                            </select>
                        </td>
                    </tr>
                );
            } else {
                const style = {};
                if (opts.rows || opts.cols) {
                    style.resize = 'none';
                }
                if (opts.rows) {
                    style.width = 'initial';
                }
                return (
                    <tr key={"label." + label}>
                        <td>{MiscUtils.capitalizeFirst(label)}</td>
                        <td><textarea {...opts} defaultValue={defaultValue} readOnly={autopopulated} style={style} /></td>
                    </tr>
                );
            }
        }
    };
    getSearchMarkerLabel = () => {
        const searchsellayer = this.props.layers.find(layer => layer.id === "searchselection");
        const feature = (searchsellayer?.features || []).find(f => f.id === "searchmarker");
        return feature?.properties?.label || "";
    };
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
    };
    renderPrintFrame = () => {
        let printFrame = null;
        if (this.state.layout && isEmpty(this.state.atlasFeatures)) {
            const frame = {
                width: this.state.scale * this.state.layout.map.width / 1000,
                height: this.state.scale * this.state.layout.map.height / 1000
            };
            printFrame = (<PrintFrame fixedFrame={frame} key="PrintFrame" map={this.props.map} modal={!isEmpty(this.state.atlasFeatures)} />);
        }
        return printFrame;
    };
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
                    <iframe name="print-output-window" onLoad={() => this.setState({outputLoaded: true})} src={this.state.pdfData}/>
                </div>
            </ResizeableWindow>
        );
    };
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("print.maximize") : LocaleUtils.tr("print.minimize");
        const extraTitlebarContent = (<Icon className="print-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState((state) => ({minimized: !state.minimized}))} title={minMaxTooltip}/>);
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
            this.renderPrintOutputWindow(),
            this.props.active && this.state.layout && this.state.layout.atlasCoverageLayer ? (
                <PickFeature
                    featurePicked={this.selectAtlasFeature}
                    key="FeaturePicker"
                    layer={this.state.layout.atlasCoverageLayer}
                />
            ) : null
        ];
    }
    selectAtlasFeature = (layer, feature) => {
        if (!feature) {
            return;
        }
        this.setState((state) => {
            const index = state.atlasFeatures.findIndex(f => f.id === feature.id);
            if (index >= 0) {
                const newAtlasFeatures = state.atlasFeatures.slice(0);
                newAtlasFeatures.splice(index, 1);
                return {atlasFeatures: newAtlasFeatures};
            } else {
                return {atlasFeatures: [...state.atlasFeatures, feature]};
            }
        });
    };
    deselectAtlasFeature = (feature) => {
        this.setState((state) => {
            const index = state.atlasFeatures.find(f => f.id === feature.id);
            const newAtlasFeatures = state.atlasFeatures.slice(0);
            newAtlasFeatures.splice(index, 1);
            return {atlasFeatures: newAtlasFeatures};
        });
    };
    changeLayout = (ev) => {
        const layout = this.props.theme.print.find(item => item.name === ev.target.value);
        this.setState({layout: layout, atlasFeature: null});
        this.fixedMapCenter = null;
    };
    changeScale = (ev) => {
        this.setState({scale: ev.target.value});
    };
    changeResolution = (ev) => {
        this.setState({dpi: ev.target.value});
    };
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
    };
    formatChanged = (ev) => {
        this.setState({selectedFormat: ev.target.value});
    };
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
    };
    print = (ev) => {
        if (this.props.inlinePrintOutput) {
            this.setState({printOutputVisible: true, outputLoaded: false});
        }
        ev.preventDefault();
        this.setState({printing: true});
        const formData = formDataEntries(new FormData(this.printForm));
        const data = Object.entries(formData).map((pair) =>
            pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
        ).join("&");
        const config = {
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            responseType: "arraybuffer"
        };
        axios.post(this.props.theme.printUrl, data, config).then(response => {
            this.setState({printing: false});
            const contentType = response.headers["content-type"];
            const file = new Blob([response.data], { type: contentType });
            if (this.props.inlinePrintOutput) {
                const fileURL = URL.createObjectURL(file);
                this.setState({ pdfData: fileURL, outputLoaded: true });
            } else {
                const ext = this.state.selectedFormat.split(";")[0].split("/").pop();
                FileSaver.saveAs(file, this.props.theme.name + '.' + ext);
            }
        }).catch(e => {
            this.setState({printing: false});
            if (e.response) {
                /* eslint-disable-next-line */
                console.log(new TextDecoder().decode(e.response.data));
            }
            /* eslint-disable-next-line */
            alert('Print failed');
        });
    };
}

const selector = (state) => ({
    active: state.task.id === 'Print',
    theme: state.theme.current,
    map: state.map,
    layers: state.layers.flat
});

export default connect(selector, {
    addLayerFeatures: addLayerFeatures,
    clearLayer: clearLayer,
    changeRotation: changeRotation,
    panTo: panTo
})(Print);
