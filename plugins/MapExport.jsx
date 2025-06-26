/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import {TextEncoder, TextDecoder} from "@kayahr/text-encoding";
import axios from 'axios';
import dayjs from 'dayjs';
import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import Icon from '../components/Icon';
import PrintSelection from '../components/PrintSelection';
import SideBar from '../components/SideBar';
import NumberInput from '../components/widgets/NumberInput';
import Spinner from '../components/widgets/Spinner';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import {explodeDxf, implodeDxf, mergeDxf} from '../utils/DxfUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/MapExport.css';
import "@kayahr/text-encoding/encodings/windows-1252";


/**
 * Allows exporting a selected portion of the map to a variety of formats.
 */
class MapExport extends React.Component {
    static propTypes = {
        /** Whitelist of allowed export format mimetypes. If empty, supported formats are listed. */
        allowedFormats: PropTypes.arrayOf(PropTypes.string),
        /** List of scales at which to export the map. If empty, scale can be freely specified. If `false`, the map can only be exported at the current scale. */
        allowedScales: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.number), PropTypes.bool]),
        /** Default export format mimetype. If empty, first available format is used. */
        defaultFormat: PropTypes.string,
        /** The factor to apply to the map scale to determine the initial export map scale (if `allowedScales` is not `false`).  */
        defaultScaleFactor: PropTypes.number,
        /** List of dpis at which to export the map. If empty, the default server dpi is used.  */
        dpis: PropTypes.arrayOf(PropTypes.number),
        /** Whether to include external layers in the image. Requires QGIS Server 3.x! */
        exportExternalLayers: PropTypes.bool,
        /** Template for the name of the generated files when downloading. Can contain the placeholders `{username}`, `{tenant}`, `{theme}`, `{timestamp}`. */
        fileNameTemplate: PropTypes.string,
        /** Custom export configuration per format.
         *  If more than one configuration per format is provided, a selection combo will be displayed.
         *  `labelMsgId` is a translation string message id for the combo label. If not defined, `name` will be displayed.
         *  `extraQuery` will be appended to the query string (replacing any existing parameters).
         *  `formatOptions` will be passed as FORMAT_OPTIONS.
         *  `baseLayer` will be appended to the LAYERS instead of the background layer.
         *  `projections` is a list of export projections. If empty, the map projection is automatically used. */
        formatConfiguration: PropTypes.shape({
            format: PropTypes.arrayOf(PropTypes.shape({
                name: PropTypes.string,
                labelMsgId: PropTypes.string,
                extraQuery: PropTypes.string,
                formatOptions: PropTypes.string,
                baseLayer: PropTypes.string,
                projections: PropTypes.array
            }))
        }),
        layers: PropTypes.array,
        map: PropTypes.object,
        /** List of image sizes to offer, in addition to the free-hand selection. The width and height are in millimeters. */
        pageSizes: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string,
            width: PropTypes.number,
            height: PropTypes.number
        })),
        setIdentifyEnabled: PropTypes.func,
        setSnappingConfig: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object
    };
    static defaultProps = {
        defaultScaleFactor: 1,
        exportExternalLayers: true,
        fileNameTemplate: '{theme}_{timestamp}',
        side: 'right',
        pageSizes: []
    };
    constructor(props) {
        super(props);
        this.form = null;
        this.state.dpi = (props.dpis || [])[0] || 96;
    }
    state = {
        extents: [],
        exporting: false,
        availableFormats: [],
        selectedFormat: null,
        selectedFormatConfiguration: '',
        exportProjection: null,
        scale: null,
        pageSize: null,
        dpi: 96
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.state.pageSize === null && prevState.pageSize !== null) {
            this.setState({extents: []});
        }
    }
    changeFormat = (ev) => {
        const selectedFormat = ev.target.value;
        const formatConfigurations = this.props.formatConfiguration?.[selectedFormat.split(";")[0]] || [];
        this.setState({
            selectedFormat: selectedFormat,
            selectedFormatConfiguration: formatConfigurations[0]?.name,
            exportProjection: this.getExportProjection(formatConfigurations[0]?.projections)
        });
    };
    setSelectedFormatConfiguration = (ev) => {
        const selectedFormatConfiguration = ev.target.value;
        const formatConfigurations = this.props.formatConfiguration?.[this.state.selectedFormat.split(";")[0]] || [];
        const formatConfiguration = formatConfigurations.find(entry => entry.name === selectedFormatConfiguration);
        this.setState({
            selectedFormatConfiguration: selectedFormatConfiguration,
            exportProjection: this.getExportProjection(formatConfiguration.projections)
        });
    };
    getExportProjection = (projections) => {
        if (isEmpty(projections)) {
            return this.props.map.projection;
        } else {
            return projections.indexOf(this.props.map.projection) !== -1 ? this.props.map.projection : projections[0];
        }
    };
    changeScale = (value) => {
        this.setState({scale: Math.max(1, parseInt(value, 10) || 0)});
    };
    changeResolution = (ev) => {
        this.setState({dpi: parseInt(ev.target.value, 10) || 0});
    };
    renderBody = () => {
        if (!this.props.theme || !this.state.selectedFormat) {
            return null;
        }
        const formatMap = {
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/png; mode=16bit": "PNG 16bit",
            "image/png; mode=8bit": "PNG 8bit",
            "image/png; mode=1bit": "PNG 1bit",
            "image/geotiff": "GeoTIFF",
            "image/tiff": "GeoTIFF",
            "application/dxf": "DXF",
            "application/pdf": "GeoPDF"
        };
        const formatConfigurations = this.props.formatConfiguration?.[this.state.selectedFormat.split(";")[0]] || [];
        const formatConfiguration = formatConfigurations.find(entry => entry.name === this.state.selectedFormatConfiguration);

        let scaleChooser = null;
        if (!isEmpty(this.props.allowedScales)) {
            scaleChooser = (
                <select onChange={this.changeScale} value={this.state.scale || ""}>
                    <option hidden value={this.state.scale || ""}>{this.state.scale || ""}</option>
                    {this.props.allowedScales.map(scale => (<option key={scale} value={scale}>1 : {scale}</option>))}
                </select>);
        } else if (this.props.allowedScales !== false) {
            scaleChooser = (
                <NumberInput min={1} mobile onChange={this.changeScale} prefix="1 : " value={this.state.scale || null} />
            );
        }
        return (
            <div className="mapexport-body">
                <form action="#" method="POST" onSubmit={this.export} ref={el => { this.form = el; }}>
                    <table className="options-table">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("mapexport.format")}</td>
                                <td>
                                    <select onChange={this.changeFormat} value={this.state.selectedFormat}>
                                        {this.state.availableFormats.map(format => {
                                            return (<option key={format} value={format}>{formatMap[format] || format}</option>);
                                        })}
                                    </select>
                                </td>
                            </tr>
                            {formatConfigurations.length > 1 ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.configuration")}</td>
                                    <td>
                                        <select onChange={this.setSelectedFormatConfiguration} value={this.state.selectedFormatConfiguration}>
                                            {formatConfigurations.map(config => {
                                                return (<option key={config.name} value={config.name}>{config.labelMsgId ? LocaleUtils.tr(config.labelMsgId) : config.name}</option>);
                                            })}
                                        </select>
                                    </td>
                                </tr>
                            ) : null}
                            {!isEmpty(this.props.pageSizes) ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.size")}</td>
                                    <td>
                                        <select onChange={(ev) => this.setState({pageSize: ev.target.value || null})} value={this.state.pageSize || ""}>
                                            <option value="">{LocaleUtils.tr("mapexport.usersize")}</option>
                                            {this.props.pageSizes.map((entry, idx) => (
                                                <option key={"size_" + idx} value={idx}>{entry.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ) : null}
                            {scaleChooser && this.state.pageSize !== null ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.scale")}</td>
                                    <td>
                                        {scaleChooser}
                                    </td>
                                </tr>
                            ) : null}
                            {this.props.dpis ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.resolution")}</td>
                                    <td>
                                        <select onChange={this.changeResolution} value={this.state.dpi}>
                                            {this.props.dpis.map(dpi => {
                                                return (<option key={dpi + "dpi"} value={dpi}>{dpi + " dpi"}</option>);
                                            })}
                                        </select>
                                    </td>
                                </tr>
                            ) : null}
                            {(formatConfiguration?.projections || []).length > 1 ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.projection")}</td>
                                    <td>
                                        <select onChange={ev => this.setState({exportProjection: ev.target.value})} value={this.state.exportProjection}>
                                            {formatConfiguration.projections.map(proj => (
                                                <option key={proj} value={proj}>{proj}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                    <div className="button-bar">
                        <button className="button" disabled={this.state.exporting || isEmpty(this.state.extents)} type="submit">
                            {this.state.exporting ? (
                                <span className="mapexport-wait"><Spinner /> {LocaleUtils.tr("mapexport.wait")}</span>
                            ) : LocaleUtils.tr("mapexport.submit")}
                        </button>
                    </div>
                </form>
            </div>
        );
    };
    renderPrintSelection = () => {
        if (this.state.pageSize !== null) {
            const pageSize = this.props.pageSizes[this.state.pageSize];
            const frame = {
                width: pageSize.width,
                height: pageSize.height
            };
            return (<PrintSelection allowRotation={false} allowScaling={this.props.allowedScales !== false}
                center={this.props.map.center} fixedFrame={frame} geometryChanged={this.geometryChanged} key="PrintSelection" scale={this.state.scale}
            />);
        } else {
            return (<PrintSelection allowRotation={false} geometryChanged={this.geometryChanged} key="PrintSelection" />);
        }
    };
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("print.maximize") : LocaleUtils.tr("print.minimize");
        const extraTitlebarContent = (<Icon className="mapexport-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState((state) => ({minimized: !state.minimized}))} title={minMaxTooltip}/>);
        return (
            <SideBar extraClasses="MapExport" extraTitlebarContent={extraTitlebarContent} icon={"rasterexport"} id="MapExport" key="MapExport"
                onHide={this.onHide} onShow={this.onShow} side={this.props.side}
                title={LocaleUtils.tr("appmenu.items.MapExport")} width="20em">
                {() => ({
                    body: this.state.minimized ? null : this.renderBody(),
                    extra: [
                        this.renderPrintSelection()
                    ]
                })}
            </SideBar>
        );
    }
    onShow = () => {
        let scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom) * this.props.defaultScaleFactor);
        if (!isEmpty(this.props.allowedScales)) {
            let closestVal = Math.abs(scale - this.props.allowedScales[0]);
            let closestIdx = 0;
            for (let i = 1; i < this.props.allowedScales.length; ++i) {
                const currVal = Math.abs(scale - this.props.allowedScales[i]);
                if (currVal < closestVal) {
                    closestVal = currVal;
                    closestIdx = i;
                }
            }
            scale = this.props.allowedScales[closestIdx];
        }
        let availableFormats = this.props.theme.availableFormats;
        if (!isEmpty(this.props.allowedFormats)) {
            availableFormats = availableFormats.filter(fmt => this.props.allowedFormats.includes(fmt));
        }
        const selectedFormat = this.props.defaultFormat && availableFormats.includes(this.props.defaultFormat) ? this.props.defaultFormat : availableFormats[0];
        const formatConfigurations = this.props.formatConfiguration?.[selectedFormat.split(";")[0]] || [];
        this.setState({
            scale: scale,
            availableFormats: availableFormats,
            selectedFormat: selectedFormat,
            selectedFormatConfiguration: formatConfigurations[0]?.name,
            exportProjection: this.getExportProjection(formatConfigurations[0]?.projections)
        });
        this.props.setSnappingConfig(false, false);
    };
    onHide = () => {
        this.setState({
            extents: [],
            width: 0,
            height: 0,
            scale: null,
            pageSize: null
        });
    };
    geometryChanged = (center, extents, rotation, scale) => {
        this.setState(state => ({
            extents: extents,
            scale: scale ?? state.scale
        }));
    };
    export = (ev) => {
        ev.preventDefault();
        this.setState({exporting: true});

        const format = this.state.selectedFormat.split(";")[0];
        const formatConfiguration = (this.props.formatConfiguration?.[format] || []).find(entry => entry.name === this.state.selectedFormatConfiguration);

        const version = this.props.theme.version;
        const crs = this.state.exportProjection;
        const extent = CoordinatesUtils.reprojectBbox(this.state.extents.at(0) ?? [0, 0, 0, 0], this.props.map.projection, crs);
        const formattedExtent = (CoordinatesUtils.getAxisOrder(crs).substring(0, 2) === 'ne' && version === '1.3.0') ?
            extent[1] + "," + extent[0] + "," + extent[3] + "," + extent[2] :
            extent.join(',');

        const getPixelFromCoordinate = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK);
        const p1 = getPixelFromCoordinate(extent.slice(0, 2));
        const p2 = getPixelFromCoordinate(extent.slice(2, 4));
        const width = Math.round(Math.abs(p1[0] - p2[0]) * this.state.dpi / 96);
        const height = Math.round(Math.abs(p1[1] - p2[1]) * this.state.dpi / 96);

        const ext = format.split("/").pop();
        const timestamp = dayjs(new Date()).format("YYYYMMDD_HHmmss");
        const fileName = this.props.fileNameTemplate
            .replace("{username}", ConfigUtils.getConfigProp("username", null, ""))
            .replace("{tenant}", ConfigUtils.getConfigProp("tenant", null, ""))
            .replace("{theme}", this.props.theme.id)
            .replace("{timestamp}", timestamp) + "." + ext;


        const params = {};

        // Base request params
        params.SERVICE = "WMS";
        params.VERSION = version;
        params.REQUEST = "GetMap";
        params.FORMAT = this.state.selectedFormat;
        params.DPI = this.state.dpi;
        params.TRANSPARENT = true;
        params.TILED = false;
        params.CRS = crs;
        params.BBOX = formattedExtent;
        params.WIDTH = width;
        params.HEIGHT = height;
        params.filename = fileName;

        // Dimension values
        this.props.layers.forEach(layer => {
            if (layer.role === LayerRole.THEME) {
                Object.entries(layer.dimensionValues || {}).forEach(([key, value]) => {
                    if (value !== undefined) {
                        params[key] = value;
                    }
                });
            }
        });

        // Add parameters from custom format configuration
        if (formatConfiguration) {
            const keyCaseMap = Object.keys(params).reduce((res, key) => ({...res, [key.toLowerCase()]: key}), {});
            (formatConfiguration.extraQuery || "").split(/[?&]/).filter(Boolean).forEach(entry => {
                const [key, value] = entry.split("=");
                const caseKey = keyCaseMap[key.toLowerCase()] || key;
                params[caseKey] = (value ?? "");
            });
            params.FORMAT_OPTIONS = formatConfiguration.formatOptions ?? "";
            if (formatConfiguration.baseLayer) {
                const layers = params[keyCaseMap.layers].split(",");
                if (!layers.includes(formatConfiguration.baseLayer)) {
                    params[keyCaseMap.layers] = [formatConfiguration.baseLayer, ...layers];
                }
            }
        }

        if (this.state.selectedFormat === "application/dxf") {
            this.dxfExport(params, fileName);
        } else {
            this.genericExport(params, fileName, formatConfiguration);
        }
    };
    genericExport = (params, fileName, formatConfiguration) => {
        // Layer params
        const exportExternalLayers = this.props.exportExternalLayers && ConfigUtils.getConfigProp("qgisServerVersion", null, 3) >= 3;
        const exportParams = LayerUtils.collectPrintParams(this.props.layers, this.props.theme, this.state.scale, this.state.exportProjection, exportExternalLayers, !!formatConfiguration?.baseLayer);
        Object.assign(params, exportParams);

        // Highlight params
        const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, this.state.exportProjection, this.state.scale, this.state.dpi);
        params.HIGHLIGHT_GEOM = highlightParams.geoms.join(";");
        params.HIGHLIGHT_SYMBOL = highlightParams.styles.join(";");
        params.HIGHLIGHT_LABELSTRING = highlightParams.labels.join(";");
        params.HIGHLIGHT_LABELCOLOR = highlightParams.labelFillColors.join(";");
        params.HIGHLIGHT_LABELBUFFERCOLOR = highlightParams.labelOutlineColors.join(";");
        params.HIGHLIGHT_LABELBUFFERSIZE = highlightParams.labelOutlineSizes.join(";");
        params.HIGHLIGHT_LABELSIZE = highlightParams.labelSizes.join(";");
        params.HIGHLIGHT_LABEL_DISTANCE = highlightParams.labelDist.join(";");
        params.HIGHLIGHT_LABEL_ROTATION = highlightParams.labelRotations.join(";");

        // Watermark params
        Object.keys(this.props.theme.watermark || {}).forEach(key => {
            params["WATERMARK_" + key.toUpperCase()] = this.props.theme.watermark[key];
        });

        const data = Object.entries(params).map((pair) =>
            pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
        ).join("&");
        const config = {
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            responseType: "arraybuffer"
        };
        axios.post(this.props.theme.url, data, config).then(response => {
            this.setState({exporting: false});
            const contentType = response.headers["content-type"];

            FileSaver.saveAs(new Blob([response.data], {type: contentType}), fileName);
        }).catch(e => {
            this.setState({exporting: false});
            if (e.response) {
                /* eslint-disable-next-line */
                console.log(new TextDecoder().decode(e.response.data));
            }
            /* eslint-disable-next-line */
            alert('Export failed');
        });
    };
    dxfExport = (baseParams, fileName) => {
        const promises = this.props.layers.filter(
            layer => layer.type === 'wms' && layer.role > LayerRole.BACKGROUND && layer.mapFormats?.includes("application/dxf")
        ).reverse().map(layer => {
            const params = {
                ...baseParams,
                LAYERS: layer.params.LAYERS,
                OPACITIES: layer.params.OPACITIES,
                STYLES: layer.params.STYLES,
                FILTER: layer.params.FILTER ?? '',
                FILTER_GEOM: layer.params.FILTER_GEOM ?? ''
            };
            const data = Object.entries(params).map((pair) =>
                pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
            ).join("&");
            const config = {
                headers: {'Content-Type': 'application/x-www-form-urlencoded' },
                responseType: "arraybuffer"
            };
            return new Promise((resolve, reject) => {
                axios.post(layer.url, data, config).then(response => {
                    resolve(response);
                }).catch((e) => {
                    /* eslint-disable-next-line */
                    console.warn(e);
                    resolve(null);
                });
            });
        });
        Promise.all(promises).then((responses) => {
            const decoder = new TextDecoder("iso-8859-1");
            const dxfDocuments = responses.filter(
                response => response.headers['content-type'] === "application/dxf"
            ).map(response => explodeDxf(decoder.decode(response.data)));
            const dxfDocument = mergeDxf(dxfDocuments);
            const result = implodeDxf(dxfDocument);
            const encoder = new TextEncoder("iso-8859-1");
            FileSaver.saveAs(new Blob([encoder.encode(result)], {type: "application/dxf"}), fileName);
            /*
            responses.forEach((response, idx) => {
                FileSaver.saveAs(new Blob([response.data], {type: "application/dxf"}), "orig_" + idx + "_" + fileName);
            });
            */
            this.setState({exporting: false});
        });
    };
}

const selector = (state) => ({
    theme: state.theme.current,
    map: state.map,
    layers: state.layers.flat
});

export default connect(selector, {
    setSnappingConfig: setSnappingConfig
})(MapExport);
