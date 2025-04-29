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
import utif from 'utif';

import {setCurrentTask} from '../../actions/task';
import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';
import SideBar from '../SideBar';
import Spinner from '../widgets/Spinner';

import './../../plugins/style/MapExport.css';
import './style/MapExport3D.css';


class MapExport3D extends React.Component {
    static propTypes = {
        hideAutopopulatedFields: PropTypes.bool,
        sceneContext: PropTypes.object,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
    };
    state = {
        minimized: false,
        layouts: [],
        selectedFormat: 'image/jpeg',
        layout: "",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        exporting: false
    };
    onShow = () => {
        if (!isEmpty(this.props.theme?.print)) {
            const layouts = this.props.theme.print.filter(l => l.map).sort((a, b) => {
                return a.name.split('/').pop().localeCompare(b.name.split('/').pop(), undefined, {numeric: true});
            });
            const layout = layouts.find(l => l.default) || layouts[0];
            this.setState({layouts: layouts, layout: layout});
        } else {
            this.setState({layouts: [], layout: ""});
        }
    };
    formatChanged = (ev) => {
        this.setState({selectedFormat: ev.target.value});
    };
    layoutChanged = (ev) => {
        const layout = this.props.theme.print.find(item => item.name === ev.target.value);
        this.setState({layout: layout});
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
    renderExportFrame = () => {
        const boxStyle = {
            left: this.state.x + 'px',
            top: this.state.y + 'px',
            width: this.state.width + 'px',
            height: this.state.height + 'px'
        };
        return (
            <div className="mapexport3d-event-container" onPointerDown={this.startSelection}>
                <div className="mapexport3d-frame" style={boxStyle}>
                    <span className="mapexport3d-frame-label">
                        {this.state.width + " x " + this.state.height}
                    </span>
                </div>
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
                    extra: this.renderExportFrame()
                })}
            </SideBar>
        );
    }
    startSelection = (ev) => {
        if (ev.shiftKey) {
            const target = ev.currentTarget;
            const view = ev.view;
            view.addEventListener('pointerup', () => {
                target.style.pointerEvents = '';
                view.document.body.style.userSelect = '';
            }, {once: true});
            // Move behind
            target.style.pointerEvents = 'none';
            view.document.body.style.userSelect = 'none';
            this.props.sceneContext.scene.domElement.dispatchEvent(new PointerEvent('pointerdown', ev));
            return;
        } else if (ev.button === 0) {
            const rect = ev.currentTarget.getBoundingClientRect();
            this.setState({
                x: Math.round(ev.clientX - rect.left),
                y: Math.round(ev.clientY - rect.top),
                width: 0,
                height: 0
            });
            const constrainRatio = this.state.selectedFormat === "application/pdf" && this.state.layout;
            const ratio = constrainRatio ? this.state.layout.map.height / this.state.layout.map.width : null;
            const onMouseMove = (event) => {
                this.setState((state) => {
                    const width = Math.round(Math.max(0, Math.round(event.clientX - rect.left) - state.x));
                    const height = constrainRatio ? Math.round(width * ratio) : Math.round(Math.max(0, Math.round(event.clientY - rect.top) - state.y));
                    return {
                        width: width,
                        height: height
                    };
                });
            };
            ev.view.addEventListener('pointermove', onMouseMove);
            ev.view.addEventListener('pointerup', () => {
                ev.view.removeEventListener('pointermove', onMouseMove);
            }, {once: true});
        }
    };
    export = (ev) => {
        ev.preventDefault();
        const form = ev.target;
        this.setState({exporting: true});
        const {x, y, width, height} = this.state;
        if (width > 0 && height > 0) {
            const data = this.props.sceneContext.scene.renderer.domElement.toDataURL('image/png');
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.src = data;
            img.onload = () => {
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, -x, -y);
                if (this.state.selectedFormat === "application/pdf") {
                    canvas.toBlob((blob) => {
                        blob.arrayBuffer().then(imgBuffer => this.exportToPdf(form, imgBuffer));
                    }, "image/png");
                } else if (this.state.selectedFormat === "image/tiff") {
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const blob = new Blob([utif.encodeImage(imageData.data, width, height)], { type: "image/tiff" });
                    FileSaver.saveAs(blob, "export." + this.state.selectedFormat.replace(/.*\//, ''));
                    this.setState({exporting: false});
                } else {
                    canvas.toBlob((blob) => {
                        FileSaver.saveAs(blob, "export." + this.state.selectedFormat.replace(/.*\//, ''));
                        this.setState({exporting: false});
                    }, this.state.selectedFormat);
                }
            };
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
