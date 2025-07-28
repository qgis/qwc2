/**
 * Copyright 2024 Sourcepole AG
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
import {SRGBColorSpace, Vector2, WebGLRenderTarget} from 'three';
import utif from 'utif';

import {setCurrentTask} from '../../actions/task';
import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import ExportSelection from '../ExportSelection';
import Icon from '../Icon';
import SideBar from '../SideBar';
import NumberInput from '../widgets/NumberInput';
import Spinner from '../widgets/Spinner';

import './../../plugins/style/MapExport.css';


class MapExport3D extends React.Component {
    static propTypes = {
        hideAutopopulatedFields: PropTypes.bool,
        sceneContext: PropTypes.object,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
    };
    static defaultState = {
        minimized: false,
        layouts: [],
        selectedFormat: 'image/jpeg',
        layout: "",
        frame: null,
        frameRatio: null,
        exporting: false,
        exportScaleFactor: 100,
        exportDpi: 300
    };
    state = MapExport3D.defaultState;
    onShow = () => {
        const rect = this.props.sceneContext.scene.domElement.getBoundingClientRect();
        const frame = {
            x: 0.125 * rect.width,
            y: 0.125 * rect.height,
            width: 0.75 * rect.width,
            height: 0.75 * rect.height
        };
        if (!isEmpty(this.props.theme?.print)) {
            const layouts = this.props.theme.print.filter(l => l.map).sort((a, b) => {
                return a.name.split('/').pop().localeCompare(b.name.split('/').pop(), undefined, {numeric: true});
            });
            const exportDpi = this.props.theme.printResolutions?.find(x => x === 300) ?? this.props.theme.printResolutions?.[0] ?? 300;
            this.setState({layouts: layouts, exportDpi: exportDpi, frame: frame});
        } else {
            this.setState({layouts: [], frame: frame});
        }
    };
    onHide = () => {
        this.setState(MapExport3D.defaultState);
    };
    formatChanged = (ev) => {
        let layout = '';
        let frameRatio = null;
        if (ev.target.value === "application/pdf") {
            layout = this.state.layouts.find(l => l.default) || this.state.layouts[0];
            frameRatio = layout.map.height / layout.map.width;
        }
        this.setState(state => ({
            selectedFormat: ev.target.value, layout, frameRatio
        }));
    };
    layoutChanged = (ev) => {
        const layout = this.props.theme.print.find(item => item.name === ev.target.value);
        const frameRatio = layout.map.height / layout.map.width;
        this.setState(state => ({
            layout: layout, frameRatio, height: Math.round(state.width * frameRatio)
        }));
    };
    renderBody = () => {
        const formatMap = {
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/tiff": "TIFF",
            "application/pdf": "PDF"
        };
        const exportDisabled = this.state.exporting || this.state.width === 0 || (
            this.state.selectedFormat === "application/pdf" && !this.state.layout
        );
        const mapName = this.state.layout?.map?.name || "";

        let resolutionChooser = null;
        if (this.state.selectedFormat === 'application/pdf') {
            if (!isEmpty(this.props.theme.printResolutions)) {
                resolutionChooser = (
                    <select onChange={(ev) => this.setState({exportDpi: ev.target.value})} value={this.state.exportDpi}>
                        {this.props.theme.printResolutions.map(res => (
                            <option disabled={isEmpty(this.state.layouts)} key={res} value={res}>{res} dpi</option>
                        ))}
                    </select>
                );
            } else {
                resolutionChooser = (
                    <NumberInput decimals={0} max={500} min={50}
                        onChange={val => this.setState({exportDpi: val})}
                        suffix=" dpi" value={this.state.exportDpi} />
                );
            }
        } else {
            resolutionChooser = (
                <select onChange={(ev) => this.setState({exportScaleFactor: ev.target.value})} value={this.state.exportScaleFactor}>
                    {[100, 150, 200, 250, 300, 350, 400, 450, 500].map(res => (
                        <option key={res} value={res}>{res}%</option>
                    ))}
                </select>
            );
        }

        return (
            <div className="mapexport-body">
                <form onSubmit={this.export}>
                    <table className="options-table">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("mapexport.format")}</td>
                                <td>
                                    <select name="FORMAT" onChange={this.formatChanged} value={this.state.selectedFormat}>
                                        {Object.entries(formatMap).map(([format, label]) => (
                                            <option key={format} value={format}>{label}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                            {this.state.selectedFormat === 'application/pdf' ? (
                                <tr>
                                    <td>{LocaleUtils.tr("print.layout")}</td>
                                    <td>
                                        <select onChange={this.layoutChanged} value={this.state.layout.name}>
                                            {this.state.layouts.map(item => (
                                                <option key={item.name} value={item.name}>{item.name.split('/').pop()}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ) : null}
                            <tr>
                                <td>{LocaleUtils.tr("mapexport.resolution")}</td>
                                <td>
                                    {resolutionChooser}
                                </td>
                            </tr>
                            {this.state.selectedFormat === 'application/pdf' ? (this.state.layout?.labels || []).map(label => {
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
                            }) : null}
                        </tbody>
                    </table>
                    {this.state.selectedFormat === 'application/pdf' ? (
                        <div>
                            <input name="TEMPLATE" type="hidden" value={this.state.layout?.name || ""} />
                            <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
                            <input name={mapName + ":extent"} readOnly type="hidden" value="0,0,0,0" />
                            <input name="SERVICE" readOnly type="hidden" value="WMS" />
                            <input name="VERSION" readOnly type="hidden" value={this.props.theme.version} />
                            <input name="REQUEST" readOnly type="hidden" value="GetPrint" />
                            <input name="TRANSPARENT" readOnly type="hidden" value="true" />
                            <input name="SRS" readOnly type="hidden" value={this.props.theme.mapCrs} />
                            <input name="LAYERS" readOnly type="hidden" value="" />
                            <input name={mapName + ":LAYERS"} readOnly type="hidden" value={""} />
                        </div>
                    ) : null}
                    <div className="button-bar">
                        <button className="button" disabled={exportDisabled} type="submit">
                            {this.state.exporting ? (
                                <span className="mapexport-wait"><Spinner /> {LocaleUtils.tr("mapexport.wait")}</span>
                            ) : LocaleUtils.tr("mapexport.submit")}
                        </button>
                    </div>
                </form>
            </div>
        );
    };
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("print.maximize") : LocaleUtils.tr("print.minimize");
        const minMaxIcon = this.state.minimized ? 'chevron-down' : 'chevron-up';
        const extraTitlebarContent = (
            <Icon className="mapexport-minimize-maximize" icon={minMaxIcon} onClick={() => this.setState((state) => ({minimized: !state.minimized}))} title={minMaxTooltip}/>
        );
        return (
            <SideBar extraClasses="MapExport" extraTitlebarContent={extraTitlebarContent} icon={"rasterexport"}
                id="MapExport3D" onShow={this.onShow} title={LocaleUtils.tr("appmenu.items.MapExport3D")} width="20em"
            >
                {() => ({
                    body: this.renderBody(),
                    extra: (
                        <ExportSelection
                            frame={this.state.frame} frameRatio={this.state.frameRatio}
                            mapElement={this.props.sceneContext.scene.domElement}
                            onFrameChanged={this.onFrameChanged}
                        />
                    )
                })}
            </SideBar>
        );
    }
    onFrameChanged = (frame) => {
        const {x, y, width, height} = frame;
        this.setState({frame: {x, y, width, height}});
    };
    takeScreenshot = (scale, window) => {
        const renderer = this.props.sceneContext.scene.renderer;
        const scene = this.props.sceneContext.scene.scene;
        const camera = this.props.sceneContext.scene.view.camera;

        const originalSize = renderer.getSize(new Vector2());
        const originalRenderTarget = renderer.getRenderTarget();

        const renderWidth = Math.round(originalSize.x * scale);
        const renderHeight = Math.round(originalSize.y * scale);

        const winX = Math.round(window.x * scale);
        const winY = Math.round(window.y * scale);
        const winWidth = Math.round(window.width * scale);
        const winHeight = Math.round(window.height * scale);

        // Render to high-resolution offscreen target
        const renderTarget = new WebGLRenderTarget(renderWidth, renderHeight, {
            colorSpace: SRGBColorSpace
        });
        renderer.setSize(renderWidth, renderHeight);
        renderer.setPixelRatio(1); // important! avoid devicePixelRatio scaling
        renderer.setRenderTarget(renderTarget);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        // Read the pixels from the render target and write to offscreen canvas
        const readBuffer = new Uint8Array(renderWidth * renderHeight * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, renderWidth, renderHeight, readBuffer);

        const canvas = document.createElement('canvas');
        canvas.width = winWidth;
        canvas.height = winHeight;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(winWidth, winHeight);
        for (let y = 0; y < winHeight; y++) {
            const srcRow = (winX + (renderHeight - 1 - winY - y) * renderWidth) * 4;
            const destRow = (y * winWidth) * 4;
            imageData.data.set(readBuffer.subarray(srcRow, srcRow + winWidth * 4), destRow);
        }
        context.putImageData(imageData, 0, 0);

        // Restore original renderer target
        renderer.setSize(originalSize.x, originalSize.y);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setRenderTarget(originalRenderTarget);
        renderer.render(scene, camera);

        return {canvas, imageData};
    };
    export = (ev) => {
        ev.preventDefault();
        if (!this.state.frame || this.state.frame.width <= 0 || this.state.frame.height <= 0) {
            return;
        }
        const form = ev.target;

        let exportScale = this.state.exportScaleFactor / 100;
        if (this.state.selectedFormat === "application/pdf") {
            const mapWidthMM = this.state.layout.map.width;
            const exportWidthPx = this.state.width;
            exportScale = Math.min(5, this.state.exportDpi / (exportWidthPx * 25.4 / mapWidthMM));
        }

        this.setState({exporting: true});
        const {canvas, context} = this.takeScreenshot(exportScale, this.state.frame);

        if (this.state.selectedFormat === "application/pdf") {
            canvas.toBlob((blob) => {
                blob.arrayBuffer().then(imgBuffer => this.exportToPdf(form, imgBuffer));
            }, "image/png");
        } else if (this.state.selectedFormat === "image/tiff") {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const blob = new Blob([utif.encodeImage(imageData.data, canvas.width, canvas.height)], { type: "image/tiff" });
            FileSaver.saveAs(blob, "export." + this.state.selectedFormat.replace(/.*\//, ''));
            this.setState({exporting: false});
        } else {
            canvas.toBlob((blob) => {
                FileSaver.saveAs(blob, "export." + this.state.selectedFormat.replace(/.*\//, ''));
                this.setState({exporting: false});
            }, this.state.selectedFormat);
        }
    };
    async exportToPdf(form, imgBuffer) {
        const formData = {
            ...formDataEntries(new FormData(form)),
            ...Object.fromEntries((this.props.theme.extraPrintParameters || "").split("&").filter(Boolean).map(entry => entry.split("=")))
        };
        const data = Object.entries(formData).map((pair) =>
            pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
        ).join("&");
        const config = {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            responseType: "arraybuffer"
        };
        const response = await axios.post(this.props.theme.printUrl, data, config);
        if (response) {
            const {PDFDocument} = await import('pdf-lib');
            const doc = await PDFDocument.load(response.data);
            const page = doc.getPages()[0];
            const pngImage = await doc.embedPng(imgBuffer);
            const x = this.state.layout.map.x * 2.8346;
            const y = this.state.layout.map.y * 2.8346;
            const width = this.state.layout.map.width * 2.8346;
            const height = this.state.layout.map.height * 2.8346;
            page.drawImage(pngImage, {
                x: x,
                y: y,
                width: width,
                height: height
            });
            const pdfData = await doc.save();
            const blob = new Blob([pdfData], { type: 'application/pdf' });
            FileSaver.saveAs(blob, this.state.layout.name + ".pdf");
            this.setState({exporting: false});
        } else {
            /* eslint-disable-next-line */
            alert('Print failed');
            this.setState({exporting: false});
        }
    }
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
        // TODO
        return "";
    };
    getAttributionLabel = () => {
        // TODO
        return "";
    };
}

export default connect((state) => ({
    theme: state.theme.current
}), {
    setCurrentTask: setCurrentTask
})(MapExport3D);
