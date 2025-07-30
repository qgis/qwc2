/**
 * Copyright 2017-2024 Sourcepole AG
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
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/MapExport.css';


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
        /** Template for the name of the generated files when downloading. */
        fileNameTemplate: PropTypes.string,
        /** Formats to force as available even if the map capabilities report otherwise. Useful if a serviceUrl is defined in a format configuration. */
        forceAvailableFormats: PropTypes.array,
        /** Custom export configuration per format.
         *  If more than one configuration per format is provided, a selection combo will be displayed.
         *  `extraQuery` will be appended to the query string (replacing any existing parameters).
         *  `formatOptions` will be passed as FORMAT_OPTIONS.
         *  `baseLayer` will be appended to the LAYERS instead of the background layer.
         *  `serviceUrl` is the address of a custom service to use instead of the layer OWS service url. */
        formatConfiguration: PropTypes.shape({
            format: PropTypes.arrayOf(PropTypes.shape({
                name: PropTypes.string,
                extraQuery: PropTypes.string,
                formatOptions: PropTypes.string,
                baseLayer: PropTypes.string,
                serviceUrl: PropTypes.string
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
        const selectedFormatConfiguration = ((this.props.formatConfiguration?.[selectedFormat] || [])[0] || {}).name;
        this.setState({
            selectedFormat: selectedFormat,
            selectedFormatConfiguration: selectedFormatConfiguration
        });
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
        const formatConfiguration = this.props.formatConfiguration?.[this.state.selectedFormat.split(";")[0]] || [];

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
        const action = this.props.theme.url;
        const exportExternalLayers = this.state.selectedFormat !== "application/dxf" && this.props.exportExternalLayers && ConfigUtils.getConfigProp("qgisServerVersion", null, 3) >= 3;

        const selectedFormatConfiguration = formatConfiguration.find(entry => entry.name === this.state.selectedFormatConfiguration) || {};
        const exportParams = LayerUtils.collectPrintParams(this.props.layers, this.props.theme, this.state.scale, this.props.map.projection, exportExternalLayers, !!selectedFormatConfiguration.baseLayer);
        const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, this.props.map.projection, this.state.scale, this.state.dpi);

        const version = this.props.theme.version;
        const crs = this.props.map.projection;
        const extent = this.state.extents.at(0) ?? [0, 0, 0, 0];
        const formattedExtent = (CoordinatesUtils.getAxisOrder(crs).substring(0, 2) === 'ne' && version === '1.3.0') ?
            extent[1] + "," + extent[0] + "," + extent[3] + "," + extent[2] :
            extent.join(',');

        const getPixelFromCoordinate = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK);
        const p1 = getPixelFromCoordinate(extent.slice(0, 2));
        const p2 = getPixelFromCoordinate(extent.slice(2, 4));
        const width = Math.abs(p1[0] - p2[0]) * this.state.dpi / 96;
        const height = Math.abs(p1[1] - p2[1]) * this.state.dpi / 96;

        return (
            <div className="mapexport-body">
                <form action={action} method="POST" onSubmit={this.export} ref={el => { this.form = el; }}>
                    <table className="options-table">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("mapexport.format")}</td>
                                <td>
                                    <select name="FORMAT" onChange={this.changeFormat} value={this.state.selectedFormat}>
                                        {this.state.availableFormats.map(format => {
                                            return (<option key={format} value={format}>{formatMap[format] || format}</option>);
                                        })}
                                    </select>
                                </td>
                            </tr>
                            {formatConfiguration.length > 1 ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.configuration")}</td>
                                    <td>
                                        <select onChange={(ev) => this.setState({selectedFormatConfiguration: ev.target.value})} value={this.state.selectedFormatConfiguration}>
                                            {formatConfiguration.map(config => {
                                                return (<option key={config.name} value={config.name}>{config.name}</option>);
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
                            {this.props.dpis && this.state.selectedFormat !== "application/dxf" ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.resolution")}</td>
                                    <td>
                                        <select name="DPI" onChange={this.changeResolution} value={this.state.dpi}>
                                            {this.props.dpis.map(dpi => {
                                                return (<option key={dpi + "dpi"} value={dpi}>{dpi + " dpi"}</option>);
                                            })}
                                        </select>
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                    <input name="SERVICE" readOnly type="hidden" value="WMS" />
                    <input name="VERSION" readOnly type="hidden" value={this.props.theme.version} />
                    <input name="REQUEST" readOnly type="hidden" value="GetMap" />
                    {Object.entries(exportParams).map(([key, value]) => (<input key={key} name={key} type="hidden" value={value} />))}
                    <input name="TRANSPARENT" readOnly type="hidden" value="true" />
                    <input name="TILED" readOnly type="hidden" value="false" />
                    <input name="CRS" readOnly type="hidden" value={this.props.map.projection} />
                    <input name="BBOX" readOnly type="hidden" value={formattedExtent} />
                    <input name="WIDTH" readOnly type="hidden" value={Math.round(width)} />
                    <input name="HEIGHT" readOnly type="hidden" value={Math.round(height)} />
                    {Object.keys(this.props.theme.watermark || {}).map(key => {
                        return (<input key={key} name={"WATERMARK_" + key.toUpperCase()} readOnly type="hidden" value={this.props.theme.watermark[key]} />);
                    })}
                    <input name="HIGHLIGHT_GEOM" readOnly type="hidden" value={highlightParams.geoms.join(";")} />
                    <input name="HIGHLIGHT_SYMBOL" readOnly type="hidden" value={highlightParams.styles.join(";")} />
                    <input name="HIGHLIGHT_LABELSTRING" readOnly type="hidden" value={highlightParams.labels.join(";")} />
                    <input name="HIGHLIGHT_LABELCOLOR" readOnly type="hidden" value={highlightParams.labelFillColors.join(";")} />
                    <input name="HIGHLIGHT_LABELBUFFERCOLOR" readOnly type="hidden" value={highlightParams.labelOutlineColors.join(";")} />
                    <input name="HIGHLIGHT_LABELBUFFERSIZE" readOnly type="hidden" value={highlightParams.labelOutlineSizes.join(";")} />
                    <input name="HIGHLIGHT_LABELSIZE" readOnly type="hidden" value={highlightParams.labelSizes.join(";")} />
                    <input name="HIGHLIGHT_LABEL_DISTANCE" readOnly type="hidden" value={highlightParams.labelDist.join(";")} />
                    <input name={"HIGHLIGHT_LABEL_ROTATION"} readOnly type="hidden" value={highlightParams.labelRotations.join(";")} />
                    <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
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
        let availableFormats = [...this.props.theme.availableFormats];
        (this.props.forceAvailableFormats || []).forEach(format => {
            if (!availableFormats.includes(format)) {
                availableFormats.push(format);
            }
        });
        if (!isEmpty(this.props.allowedFormats)) {
            availableFormats = availableFormats.filter(fmt => this.props.allowedFormats.includes(fmt));
        }
        const selectedFormat = this.props.defaultFormat && availableFormats.includes(this.props.defaultFormat) ? this.props.defaultFormat : availableFormats[0];
        const selectedFormatConfiguration = ((this.props.formatConfiguration?.[selectedFormat] || [])[0] || {}).name;
        this.setState({
            scale: scale,
            availableFormats: availableFormats,
            selectedFormat: selectedFormat,
            selectedFormatConfiguration: selectedFormatConfiguration
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
        const params = formDataEntries(new FormData(this.form));

        // Add dimension values
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
        const format = this.state.selectedFormat.split(";")[0];
        const formatConfiguration = (this.props.formatConfiguration?.[format] || []).find(entry => entry.name === this.state.selectedFormatConfiguration);

        const ext = format.split("/").pop();
        const timestamp = dayjs(new Date()).format("YYYYMMDD_HHmmss");
        const fileName = this.props.fileNameTemplate
            .replace("{theme}", this.props.theme.id)
            .replace("{timestamp}", timestamp) + "." + ext;

        params.filename = fileName;

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

        const data = Object.entries(params).map((pair) =>
            pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
        ).join("&");
        const config = {
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            responseType: "arraybuffer"
        };
        axios.post(formatConfiguration.serviceUrl ?? this.props.theme.url, data, config).then(response => {
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
}

const selector = (state) => ({
    theme: state.theme.current,
    map: state.map,
    layers: state.layers.flat
});

export default connect(selector, {
    setSnappingConfig: setSnappingConfig
})(MapExport);
