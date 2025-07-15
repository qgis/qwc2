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
import dayjs from 'dayjs';
import FileSaver from 'file-saver';
import formDataEntries from 'formdata-json';
import JSZip from 'jszip';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, addLayerFeatures, clearLayer} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import Icon from '../components/Icon';
import PickFeature from '../components/PickFeature';
import PrintSelection from '../components/PrintSelection';
import ResizeableWindow from '../components/ResizeableWindow';
import SideBar from '../components/SideBar';
import EditableSelect from '../components/widgets/EditableSelect';
import InputContainer from '../components/widgets/InputContainer';
import NumberInput from '../components/widgets/NumberInput';
import Spinner from '../components/widgets/Spinner';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import ConfigUtils from '../utils/ConfigUtils';
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
        clearLayer: PropTypes.func,
        /** The default print dpi.  */
        defaultDpi: PropTypes.number,
        /** The factor to apply to the map scale to determine the initial print map scale.  */
        defaultScaleFactor: PropTypes.number,
        /** Show an option to print a series of extents. */
        displayPrintSeries: PropTypes.bool,
        /** Whether to display the printing rotation control. */
        displayRotation: PropTypes.bool,
        /** Template for the name of the generated files when downloading. Can contain the placeholders `{layout}`, `{username}`, `{tenant}`, `{theme}`, `{themeTitle}`, `{timestamp}`. */
        fileNameTemplate: PropTypes.string,
        /** Export layout format mimetypes. If format is not supported by QGIS Server, print will fail. */
        formats: PropTypes.arrayOf(PropTypes.string),
        /** Whether the grid is enabled by default. */
        gridInitiallyEnabled: PropTypes.bool,
        /** Whether to hide form fields which contain autopopulated values (i.e. search result label). */
        hideAutopopulatedFields: PropTypes.bool,
        /** Whether to display the print output in an inline dialog instead triggering a download. */
        inlinePrintOutput: PropTypes.bool,
        layers: PropTypes.array,
        map: PropTypes.object,
        /** Whether to print external layers. Requires QGIS Server 3.x! */
        printExternalLayers: PropTypes.bool,
        /** Whether to print highlights on the map, e.g. selected features or redlining. */
        printMapHighlights: PropTypes.bool,
        /** Scale factor to apply to line widths, font sizes, ... of redlining drawings passed to GetPrint.  */
        scaleFactor: PropTypes.number,
        setIdentifyEnabled: PropTypes.func,
        setSnappingConfig: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object
    };
    static defaultProps = {
        defaultDpi: 300,
        defaultScaleFactor: 0.5,
        displayPrintSeries: false,
        displayRotation: true,
        fileNameTemplate: '{theme}_{timestamp}',
        gridInitiallyEnabled: false,
        formats: ['application/pdf', 'image/jpeg', 'image/png', 'image/svg'],
        inlinePrintOutput: false,
        printExternalLayers: true,
        printMapHighlights: true,
        scaleFactor: 1.9, // Experimentally determined...
        side: 'right'
    };
    state = {
        center: null,
        extents: [],
        layout: null,
        layouts: [],
        rotation: 0,
        scale: 0,
        dpi: 300,
        grid: false,
        legend: false,
        minimized: false,
        printOutputVisible: false,
        outputLoaded: false,
        printing: false,
        atlasFeatures: [],
        geoPdf: false,
        selectedFormat: "",
        printOutputData: undefined,
        pdfData: null,
        pdfDataUrl: null,
        downloadMode: "onepdf",
        printSeriesEnabled: false,
        printSeriesOverlap: 0,
        printSeriesSelected: []
    };
    constructor(props) {
        super(props);
        this.printForm = null;
        this.state.grid = props.gridInitiallyEnabled;
        this.state.dpi = props.defaultDpi;
        this.state.selectedFormat = props.formats[0];
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevProps.theme !== this.props.theme) {
            if (this.props.theme && !isEmpty(this.props.theme.print)) {
                const layouts = this.props.theme.print.filter(l => l.map).sort((a, b) => {
                    return a.name.split('/').pop().localeCompare(b.name.split('/').pop(), undefined, {numeric: true});
                });
                const layout = layouts.find(l => l.default) || layouts[0];
                this.setState({layouts: layouts, layout: layout, atlasFeatures: []});
            } else {
                this.setState({layouts: [], layout: null, atlasFeatures: []});
            }
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
        if (this.state.printSeriesEnabled && this.state.selectedFormat !== 'application/pdf') {
            this.setState({ selectedFormat: 'application/pdf' });
        }
    }
    onShow = () => {
        // setup initial extent
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
        const bounds = this.props.map.bbox.bounds;
        const center = this.state.center || [0, 0];
        const resetCenter = (center[0] < bounds[0]) || (center[0] > bounds[2]) || (center[1] < bounds[1]) || (center[1] > bounds[3]);
        const resetScale = (this.state.scale / scale < 0.01) || (this.state.scale / scale > 10);
        if (resetCenter || resetScale) {
            this.setState({
                center: null,
                rotation: 0,
                scale: scale
            });
        }
        this.props.setSnappingConfig(false, false);
    };
    onHide = () => {
        this.setState({minimized: false, printSeriesEnabled: false, atlasFeatures: []});
    };
    renderBody = () => {
        if (!this.state.layout) {
            return (<div className="print-body" role="body">{LocaleUtils.tr("print.nolayouts")}</div>);
        }
        const haveThemeLayers = this.props.layers.find(layer => layer.role === LayerRole.THEME) !== undefined;
        if (!this.props.theme || (!this.props.printExternalLayers && !haveThemeLayers)) {
            return (<div className="print-body" role="body">{LocaleUtils.tr("print.notheme")}</div>);
        }

        const mapName = this.state.layout.map.name;
        const printLegend = this.state.layout.legendLayout;

        const formattedExtent = !isEmpty(this.state.atlasFeatures) ? "" : (this.formatExtent(this.state.extents.at(0) ?? [0, 0, 0, 0]));
        let resolutionChooser = null;
        let resolutionInput = null;
        if (!isEmpty(this.props.theme.printResolutions)) {
            if (this.props.theme.printResolutions.length > 1) {
                resolutionChooser = (
                    <select name={"DPI"} onChange={(ev) => this.changeResolution(ev.target.value)} value={this.state.dpi || ""}>
                        {this.props.theme.printResolutions.map(res => (<option key={res} value={res}>{res} dpi</option>))}
                    </select>
                );
            } else {
                resolutionInput = (<input name="DPI" readOnly type="hidden" value={this.props.theme.printResolutions[0]} />);
            }
        } else {
            resolutionChooser = (<NumberInput max={1200} min={50} mobile name="DPI" onChange={this.changeResolution} suffix=" dpi" value={this.state.dpi || ""} />);
        }

        const formatMap = {
            "application/pdf": "PDF",
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/svg": "SVG"
        };
        const allowGeoPdfExport = this.state.selectedFormat === "application/pdf" && this.props.allowGeoPdfExport;

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
                                    {this.state.layouts.map(item => {
                                        return (
                                            <option key={item.name} value={item.name}>{item.name.split('/').pop()}</option>
                                        );
                                    })}
                                </select>
                            </td>
                        </tr>
                        {this.props.formats.length > 1 ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.format")}</td>
                                <td>
                                    <select disabled={this.state.printSeriesEnabled} name="FORMAT" onChange={this.formatChanged} value={this.state.selectedFormat}>
                                        {this.props.formats.map(format => {
                                            return (<option key={format} value={format}>{formatMap[format] || format}</option>);
                                        })}
                                    </select>
                                </td>
                            </tr>
                        ) : null}
                        {this.state.layout.atlasCoverageLayer && !this.state.printSeriesEnabled ? (
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
                                    {!isEmpty(this.props.theme.printScales) ? (
                                        <InputContainer>
                                            <span role="prefix">1&nbsp;:&nbsp;</span>
                                            <EditableSelect
                                                name={mapName + ":scale"} onChange={this.changeScale}
                                                options={this.props.theme.printScales} role="input" value={this.state.scale || ""}
                                            />
                                        </InputContainer>
                                    ) : (
                                        <NumberInput min={1} mobile name={mapName + ":scale"} onChange={this.changeScale} prefix="1 : " value={this.state.scale || null}/>
                                    )}
                                </td>
                            </tr>
                        ) : null}
                        {resolutionChooser ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.resolution")}</td>
                                <td>
                                    {resolutionChooser}
                                </td>
                            </tr>
                        ) : null}
                        {this.props.displayRotation ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.rotation")}</td>
                                <td>
                                    <InputContainer>
                                        <NumberInput decimals={1} mobile name={mapName + ":rotation"} onChange={this.changeRotation} role="input" value={this.state.rotation} />
                                        <span role="suffix" style={{transform: "rotate(-" + this.state.rotation + "deg)"}}>
                                            <Icon icon="arrow-up" onClick={() => this.setState({rotation: 0})} title={LocaleUtils.tr("map.resetrotation")} />
                                        </span>
                                    </InputContainer>
                                </td>
                            </tr>
                        ) : null}
                        {!isEmpty(this.props.theme.printGrid) ? (
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
                        {this.props.displayPrintSeries ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.series")}</td>
                                <td>
                                    <ToggleSwitch active={this.state.printSeriesEnabled} onChange={(newstate) => this.setState({printSeriesEnabled: newstate, atlasFeatures: []})} />
                                </td>
                            </tr>
                        ) : null}
                        {this.state.printSeriesEnabled ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.overlap")}</td>
                                <td>
                                    <InputContainer>
                                        <input max="20" min="0" onChange={this.changeSeriesOverlap} role="input" type="range" value={this.state.printSeriesOverlap} />
                                        <span role="suffix">{this.state.printSeriesOverlap}&nbsp;%</span>
                                    </InputContainer>
                                </td>
                            </tr>
                        ) : null}
                        {!this.props.inlinePrintOutput && this.state.printSeriesEnabled ? (
                            <tr>
                                <td>{LocaleUtils.tr("print.download")}</td>
                                <td>
                                    <select onChange={this.changeDownloadMode} role="input" value={this.state.downloadMode || ""}>
                                        <option key="onepdf" value="onepdf">{LocaleUtils.tr("print.download_as_onepdf")}</option>
                                        <option key="onezip" value="onezip">{LocaleUtils.tr("print.download_as_onezip")}</option>
                                        <option key="single" value="single">{LocaleUtils.tr("print.download_as_single")}</option>
                                    </select>
                                </td>
                            </tr>
                        ) : null}
                        {(this.state.layout?.labels ?? []).map(label => {
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
                        {allowGeoPdfExport ? (
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
                        <input name={mapName + ":extent"} readOnly type="hidden" value={formattedExtent} />
                        <input name="SERVICE" readOnly type="hidden" value="WMS" />
                        <input name="VERSION" readOnly type="hidden" value={this.props.theme.version} />
                        <input name="REQUEST" readOnly type="hidden" value="GetPrint" />
                        <input name="FORMAT" readOnly type="hidden" value={this.state.selectedFormat} />
                        <input name="TRANSPARENT" readOnly type="hidden" value="true" />
                        <input name="SRS" readOnly type="hidden" value={this.props.map.projection} />
                        <input name="CONTENT_DISPOSITION" readOnly type="hidden" value={this.props.inlinePrintOutput ? "inline" : "attachment"} />
                        {allowGeoPdfExport ? (<input name="FORMAT_OPTIONS" readOnly type="hidden" value={this.state.geoPdf ? "WRITE_GEO_PDF:true" : "WRITE_GEO_PDF:false"} />) : null}
                        {resolutionInput}
                    </div>
                    <div className="button-bar">
                        <button className="button" disabled={this.state.printing} type="submit">
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
                if (opts.cols) {
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
    renderPrintSelection = () => {
        let printSelection = null;
        if (this.state.layout && isEmpty(this.state.atlasFeatures)) {
            const frame = {
                width: this.state.layout.map.width,
                height: this.state.layout.map.height
            };
            printSelection = (<PrintSelection
                allowRotation={this.props.displayRotation && !this.state.printSeriesEnabled}
                allowScaling={!this.state.printSeriesEnabled}
                allowTranslation={!this.state.printSeriesEnabled}
                center={this.state.center || this.props.map.center}
                fixedFrame={frame}
                geometryChanged={this.geometryChanged}
                key="PrintSelection"
                printSeriesChanged={this.printSeriesChanged}
                printSeriesEnabled={this.props.displayPrintSeries && this.state.printSeriesEnabled}
                printSeriesOverlap={this.state.printSeriesOverlap / 100}
                printSeriesSelected={this.state.printSeriesSelected}
                rotation={this.state.rotation}
                scale={this.state.scale}
            />);
        }
        return printSelection;
    };
    formatExtent = (extent) => {
        const mapCrs = this.props.map.projection;
        const version = this.props.theme.version;

        if (CoordinatesUtils.getAxisOrder(mapCrs).substring(0, 2) === 'ne' && version === '1.3.0') {
            return extent[1] + "," + extent[0] + "," + extent[3] + "," + extent[2];
        }

        return extent.join(',');
    };
    geometryChanged = (center, extents, rotation, scale) => {
        this.setState({
            center: center,
            extents: extents,
            rotation: rotation,
            scale: scale
        });
    };
    printSeriesChanged = (selected) => {
        this.setState({
            printSeriesSelected: selected
        });
    };
    renderPrintOutputWindow = () => {
        const extraControls = [{
            icon: 'save',
            title: LocaleUtils.tr('print.save'),
            callback: this.savePrintOutput
        }];
        return (
            <ResizeableWindow extraControls={extraControls} icon="print" initialHeight={0.75 * window.innerHeight}
                initialWidth={0.5 * window.innerWidth} key="PrintOutputWindow"
                onClose={() => this.setState({printOutputVisible: false, outputLoaded: false, pdfData: null, pdfDataUrl: null})}
                title={LocaleUtils.tr("print.output")} visible={this.state.printOutputVisible}
            >
                <div className="print-output-window-body" role="body">
                    {!this.state.outputLoaded ? (
                        <span className="print-output-window-wait">
                            <Spinner /> {LocaleUtils.tr("print.wait")}
                        </span>
                    ) : null}
                    <iframe name="print-output-window" src={this.state.pdfDataUrl}/>
                </div>
            </ResizeableWindow>
        );
    };
    savePrintOutput = () => {
        FileSaver.saveAs(this.state.pdfData.content, this.state.pdfData.fileName);
    };
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("print.maximize") : LocaleUtils.tr("print.minimize");
        const extraTitlebarContent = (<Icon className="print-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState((state) => ({minimized: !state.minimized}))} title={minMaxTooltip}/>);
        return [
            (
                <SideBar extraTitlebarContent={extraTitlebarContent} icon={"print"} id="Print" key="Print"
                    onHide={this.onHide} onShow={this.onShow} side={this.props.side}
                    title={LocaleUtils.tr("appmenu.items.Print")} width="20em">
                    {() => ({
                        body: this.state.minimized ? null : this.renderBody(),
                        extra: [
                            this.renderPrintSelection()
                        ]
                    })}
                </SideBar>
            ),
            this.renderPrintOutputWindow(),
            this.props.active && this.state.layout && this.state.layout.atlasCoverageLayer && !this.state.printSeriesEnabled ? (
                <PickFeature
                    featurePicked={this.selectAtlasFeature}
                    key="FeaturePicker"
                    layerFilter={{url: this.props.theme.url, name: this.state.layout.atlasCoverageLayer}}
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
    };
    changeScale = (value) => {
        this.setState({scale: Math.max(1, parseInt(value, 10) || 0)});
    };
    changeResolution = (value) => {
        this.setState({dpi: value || 300});
    };
    changeRotation = (value) => {
        const angle = value || 0;
        this.setState({rotation: (angle % 360 + 360) % 360});
    };
    changeSeriesOverlap = (ev) => {
        this.setState({printSeriesOverlap: parseInt(ev.target.value, 10) || 0});
    };
    changeDownloadMode = (ev) => {
        this.setState({downloadMode: ev.target.value});
    };
    formatChanged = (ev) => {
        this.setState({selectedFormat: ev.target.value});
    };
    print = (ev) => {
        ev.preventDefault();
        this.setState({ printing: true });
        if (this.props.inlinePrintOutput) {
            this.setState({ printOutputVisible: true, outputLoaded: false, pdfDataUrl: null, pdfData: null });
        }

        const formData = formDataEntries(new FormData(this.printForm));
        const mapCrs = this.props.map.projection;
        const mapName = this.state.layout.map.name;

        // Add base print params
        const printParams = LayerUtils.collectPrintParams(this.props.layers, this.props.theme, this.state.scale, mapCrs, this.props.printExternalLayers);
        Object.entries(printParams).forEach(([key, value]) => {
            formData[key] = value;
        });
        formData[mapName + ":LAYERS"] = printParams.LAYERS;
        formData[mapName + ":STYLES"] = printParams.STYLES;
        formData[mapName + ":FILTER"] = printParams.FILTER;
        formData[mapName + ":FILTER_GEOM"] = printParams.FILTER_GEOM;

        // Add highlight params
        const printDpi = parseInt(this.state.dpi, 10) || 0;

        if (this.props.printMapHighlights) {
            const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, mapCrs, this.state.scale, printDpi, this.props.scaleFactor);
            formData[mapName + ":HIGHLIGHT_GEOM"] = highlightParams.geoms.join(";");
            formData[mapName + ":HIGHLIGHT_SYMBOL"] = highlightParams.styles.join(";");
            formData[mapName + ":HIGHLIGHT_LABELSTRING"] = highlightParams.labels.join(";");
            formData[mapName + ":HIGHLIGHT_LABELCOLOR"] = highlightParams.labelFillColors.join(";");
            formData[mapName + ":HIGHLIGHT_LABELBUFFERCOLOR"] = highlightParams.labelOutlineColors.join(";");
            formData[mapName + ":HIGHLIGHT_LABELBUFFERSIZE"] = highlightParams.labelOutlineSizes.join(";");
            formData[mapName + ":HIGHLIGHT_LABELSIZE"] = highlightParams.labelSizes.join(";");
            formData[mapName + ":HIGHLIGHT_LABEL_DISTANCE"] = highlightParams.labelDist.join(";");
            formData[mapName + ":HIGHLIGHT_LABEL_ROTATION"] = highlightParams.labelRotations.join(";");
        }

        // Add grid params
        const printGrid = this.props.theme.printGrid;
        if (!isEmpty(printGrid)) {
            if (this.state.grid) {
                let cur = 0;
                while (cur < printGrid.length - 1 && this.state.scale < printGrid[cur].s) {
                    cur += 1;
                }
                formData[mapName + ":GRID_INTERVAL_X"] = printGrid[cur].x;
                formData[mapName + ":GRID_INTERVAL_Y"] = printGrid[cur].y;
            } else {
                formData[mapName + ":GRID_INTERVAL_X"] = 0;
                formData[mapName + ":GRID_INTERVAL_Y"] = 0;
            }
        }

        // Add dimension values
        this.props.layers.forEach(layer => {
            if (layer.role === LayerRole.THEME) {
                Object.entries(layer.dimensionValues || {}).forEach(([key, value]) => {
                    if (value !== undefined) {
                        formData[key] = value;
                    }
                });
            }
        });

        // Add extra print parameters
        const extraOptions = Object.fromEntries((this.props.theme.extraPrintParameters || "").split("&").filter(Boolean).map(entry => entry.split("=")));
        Object.entries(extraOptions).forEach(([key, value]) => {
            formData[key] = value;
        });

        let pages = [formData];

        if (this.state.printSeriesEnabled) {
            pages = this.state.extents.map((extent, index) => {
                const fd = structuredClone(formData);
                fd.name = (index + 1).toString().padStart(2, '0');
                fd[this.state.layout.map.name + ':extent'] = this.formatExtent(extent);
                return fd;
            });
        }

        const timestamp = dayjs(new Date()).format("YYYYMMDD_HHmmss");
        const fileName = this.props.fileNameTemplate
            .replace("{layout}", this.state.layout.name)
            .replace("{username}", ConfigUtils.getConfigProp("username", null, ""))
            .replace("{tenant}", ConfigUtils.getConfigProp("tenant", null, ""))
            .replace("{theme}", this.props.theme.id)
            .replace("{themeTitle}", this.props.theme.title || "")
            .replace("{timestamp}", timestamp);

        // batch print all pages
        this.batchPrint(pages, fileName)
            .catch((e) => {
                this.setState({ outputLoaded: true, printOutputVisible: false });
                if (e.response) {
                    /* eslint-disable-next-line */
                    console.warn(new TextDecoder().decode(e.response.data));
                }
                /* eslint-disable-next-line */
                alert('Print failed');
            }).finally(() => {
                this.setState({ printing: false });
            });
    };
    async batchPrint(pages, fileName) {
        // Print pages on server
        const promises = pages.map((formData) => this.printRequest(formData));
        // Collect printing results
        const docs = await Promise.all(promises);
        // Convert into downloadable files
        const files = await this.collectFiles(docs, fileName);
        // Download or display files
        if (this.props.inlinePrintOutput && files.length === 1) {
            const file = files.pop();
            const fileURL = URL.createObjectURL(file.content);
            this.setState({ pdfData: file, pdfDataUrl: fileURL, outputLoaded: true });
        } else {
            for (const file of files) {
                FileSaver.saveAs(file.content, file.fileName);
            }
        }
    }
    async printRequest(formData) {
        const data = Object.entries(formData).map((pair) =>
            pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
        ).join('&');
        const config = {
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            responseType: 'arraybuffer'
        };
        const response = await axios.post(this.props.theme.printUrl, data, config);
        const contentType = response.headers['content-type'];
        return {
            name: formData.name,
            data: response.data,
            contentType: contentType
        };
    }
    async collectFiles(docs, fileName) {
        if (docs.length > 1 && this.state.downloadMode === 'onepdf') {
            const data = await this.collectOnePdf(docs);
            const content = new Blob([data], { type: 'application/pdf' });
            return [{ content, fileName: fileName + '.pdf' }];
        }
        if (docs.length > 1 && this.state.downloadMode === 'onezip') {
            const data = await this.collectOneZip(docs, fileName);
            const content = new Blob([data], { type: 'application/zip' });
            return [{ content, fileName: fileName + '.zip' }];
        }
        return docs.map((doc) => {
            const content = new Blob([doc.data], { type: doc.contentType });
            const ext = this.state.selectedFormat.split(";")[0].split("/").pop();
            const appendix = doc.name ? '_' + doc.name : '';
            return { content, fileName: fileName + appendix + '.' + ext };
        });
    }
    async collectOnePdf(docs) {
        const {PDFDocument} = await import('pdf-lib');
        const mergedDoc = await PDFDocument.create();
        for (const doc of docs) {
            const pdfBytes = await PDFDocument.load(doc.data);
            const copiedPages = await mergedDoc.copyPages(pdfBytes, pdfBytes.getPageIndices());
            for (const page of copiedPages) {
                mergedDoc.addPage(page);
            }
        }
        return await mergedDoc.save();
    }
    async collectOneZip(docs, fileName) {
        const mergedDoc = new JSZip();
        for (const doc of docs) {
            const file = new Blob([doc.data], { type: doc.contentType });
            const ext = this.state.selectedFormat.split(";")[0].split("/").pop();
            const appendix = doc.name ? '_' + doc.name : '';
            mergedDoc.file(fileName + appendix + '.' + ext, file);
        }
        return await mergedDoc.generateAsync({ type: 'arraybuffer' });
    }
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
    setSnappingConfig: setSnappingConfig
})(Print);
