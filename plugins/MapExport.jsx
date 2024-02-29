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
import FileSaver from 'file-saver';
import formDataEntries from 'formdata-json';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import InputContainer from '../components/InputContainer';
import PrintFrame from '../components/PrintFrame';
import SideBar from '../components/SideBar';
import Spinner from '../components/Spinner';
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
        /** Custom export configuration per format.
         *  If more than one configuration per format is provided, a selection combo will be displayed.
         *  `extraQuery` will be appended to the query string (replacing any existing parameters).
         *  `formatOptions` will be passed as FORMAT_OPTIONS.
         *  `baseLayer` will be appended to the LAYERS instead of the background layer. */
        formatConfiguration: PropTypes.shape({
            format: PropTypes.arrayOf(PropTypes.shape({
                name: PropTypes.string,
                extraQuery: PropTypes.string,
                formatOptions: PropTypes.string,
                baseLayer: PropTypes.string
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
        setCurrentTask: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object
    };
    static defaultProps = {
        defaultScaleFactor: 0.5,
        exportExternalLayers: true,
        side: 'right',
        pageSizes: [
            {name: '15 x 15 cm', width: 150, height: 150},
            {name: '30 x 30 cm', width: 300, height: 300}
        ]
    };
    constructor(props) {
        super(props);
        this.form = null;
        this.state.dpi = (props.dpis || [])[0] || 96;
    }
    state = {
        extent: '',
        width: 0,
        height: 0,
        exporting: false,
        availableFormats: [],
        selectedFormat: null,
        selectedFormatConfiguration: '',
        scale: '',
        pageSize: null,
        dpi: 96
    };
    componentDidUpdate(prevProps, prevState) {
        if (
            this.props.map.center !== prevProps.map.center ||
            this.props.map.bbox !== prevProps.map.bbox ||
            this.state.pageSize !== prevState.pageSize ||
            this.state.scale !== prevState.scale ||
            this.state.dpi !== prevState.dpi
        ) {
            if (this.state.pageSize !== null) {
                this.setState((state) => {
                    const scale = this.getExportScale(state);
                    const center = this.props.map.center;
                    const mapCrs = this.props.map.projection;
                    const pageSize = this.props.pageSizes[state.pageSize];
                    const widthm = scale * pageSize.width / 1000;
                    const heightm = scale * pageSize.height / 1000;
                    const {width, height} = MapUtils.transformExtent(mapCrs, center, widthm, heightm);
                    let extent = [center[0] - 0.5 * width, center[1] - 0.5 * height, center[0] + 0.5 * width, center[1] + 0.5 * height];
                    extent = (CoordinatesUtils.getAxisOrder(mapCrs).substr(0, 2) === 'ne' && this.props.theme.version === '1.3.0') ?
                        extent[1] + "," + extent[0] + "," + extent[3] + "," + extent[2] :
                        extent.join(',');
                    return {
                        width: Math.round(pageSize.width / 1000 * 39.3701 * state.dpi),
                        height: Math.round(pageSize.height / 1000 * 39.3701 * state.dpi),
                        extent: extent
                    };
                });
            } else if (prevState.pageSize !== null) {
                this.setState({width: '', height: '', extent: ''});
            }
        }
    }
    formatChanged = (ev) => {
        const selectedFormat = ev.target.value;
        const selectedFormatConfiguration = ((this.props.formatConfiguration?.[selectedFormat] || [])[0] || {}).name;
        this.setState({
            selectedFormat: selectedFormat,
            selectedFormatConfiguration: selectedFormatConfiguration
        });
    };
    dpiChanged = (ev) => {
        this.setState({dpi: parseInt(ev.target.value, 10)});
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
                <select onChange={ev => this.setState({scale: ev.target.value})} role="input" value={this.state.scale}>
                    {this.props.allowedScales.map(scale => (<option key={scale} value={scale}>{scale}</option>))}
                </select>);
        } else if (this.props.allowedScales !== false) {
            scaleChooser = (
                <input min="1" onChange={ev => this.setState({scale: ev.target.value})} role="input" type="number" value={this.state.scale} />
            );
        }
        const filename = this.props.theme.name + "." + this.state.selectedFormat.split(";")[0].split("/").pop();
        const action = this.props.theme.url;
        const exportExternalLayers = this.state.selectedFormat !== "application/dxf" && this.props.exportExternalLayers && ConfigUtils.getConfigProp("qgisServerVersion") >= 3;

        const mapScale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
        let scaleFactor = 1;
        if (this.state.pageSize === null && this.props.allowedScales !== false) {
            scaleFactor = mapScale / this.state.scale;
        }
        const selectedFormatConfiguration = formatConfiguration.find(entry => entry.name === this.state.selectedFormatConfiguration) || {};
        const exportParams = LayerUtils.collectPrintParams(this.props.layers, this.props.theme, this.state.scale, this.props.map.projection, exportExternalLayers, !!selectedFormatConfiguration.baseLayer);
        const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, this.props.map.projection, this.state.scale, this.state.dpi);

        return (
            <div className="mapexport-body">
                <form action={action} method="POST" onSubmit={this.export} ref={el => { this.form = el; }}>
                    <table className="options-table">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("mapexport.format")}</td>
                                <td>
                                    <select name="FORMAT" onChange={this.formatChanged} value={this.state.selectedFormat}>
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
                            {this.props.pageSizes ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.size")}</td>
                                    <td>
                                        <select onChange={(ev) => this.setState({pageSize: ev.target.value || null})} value={this.state.pageSize ?? ""}>
                                            <option value="">{LocaleUtils.tr("mapexport.usersize")}</option>
                                            {this.props.pageSizes.map((entry, idx) => (
                                                <option key={"size_" + idx} value={idx}>{entry.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ) : null}
                            {scaleChooser ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.scale")}</td>
                                    <td>
                                        <InputContainer>
                                            <span role="prefix">1&nbsp;:&nbsp;</span>
                                            {scaleChooser}
                                        </InputContainer>
                                    </td>
                                </tr>
                            ) : null}
                            {this.props.dpis ? (
                                <tr>
                                    <td>{LocaleUtils.tr("mapexport.resolution")}</td>
                                    <td>
                                        <select name="DPI" onChange={this.dpiChanged} value={this.state.dpi}>
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
                    <input name="filename" readOnly type="hidden" value={filename} />
                    <input name="BBOX" readOnly type="hidden" value={this.state.extent} />
                    <input name="WIDTH" readOnly type="hidden" value={Math.round(this.state.width * scaleFactor)} />
                    <input name="HEIGHT" readOnly type="hidden" value={Math.round(this.state.height * scaleFactor)} />
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
                    <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
                    <div className="button-bar">
                        <button className="button" disabled={this.state.exporting || !this.state.extent} type="submit">
                            {this.state.exporting ? (
                                <span className="mapexport-wait"><Spinner /> {LocaleUtils.tr("mapexport.wait")}</span>
                            ) : LocaleUtils.tr("mapexport.submit")}
                        </button>
                    </div>
                </form>
            </div>
        );
    };
    renderFrame = () => {
        if (this.state.pageSize !== null) {
            const px2m =  1 / (this.state.dpi * 39.3701) * this.getExportScale(this.state);
            const frame = {
                width: this.state.width * px2m,
                height: this.state.height * px2m
            };
            return (<PrintFrame fixedFrame={frame} key="PrintFrame" map={this.props.map} />);
        } else {
            return (<PrintFrame bboxSelected={this.bboxSelected} dpi={parseInt(this.state.dpi, 10)} key="PrintFrame" map={this.props.map} />);
        }
    };
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("print.maximize") : LocaleUtils.tr("print.minimize");
        const extraTitlebarContent = (<Icon className="mapexport-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState((state) => ({minimized: !state.minimized}))} title={minMaxTooltip}/>);
        return (
            <SideBar extraTitlebarContent={extraTitlebarContent} icon={"rasterexport"} id="MapExport" key="MapExport"
                onHide={this.onHide} onShow={this.onShow} side={this.props.side}
                title="appmenu.items.MapExport" width="20em">
                {() => ({
                    body: this.state.minimized ? null : this.renderBody(),
                    extra: [
                        this.renderFrame()
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
        const selectedFormatConfiguration = ((this.props.formatConfiguration?.[selectedFormat] || [])[0] || {}).name;
        this.setState({
            scale: scale,
            availableFormats: availableFormats,
            selectedFormat: selectedFormat,
            selectedFormatConfiguration: selectedFormatConfiguration
        });
    };
    onHide = () => {
        this.setState({
            extent: '',
            width: '',
            height: ''
        });
    };
    getExportScale = (state) => {
        if (this.props.allowedScales === false) {
            return Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
        } else {
            return state.scale;
        }
    };
    bboxSelected = (bbox, crs, pixelsize) => {
        const version = this.props.theme.version;
        let extent = '';
        if (bbox) {
            extent = (CoordinatesUtils.getAxisOrder(crs).substr(0, 2) === 'ne' && version === '1.3.0') ?
                bbox[1] + "," + bbox[0] + "," + bbox[3] + "," + bbox[2] :
                bbox.join(',');
        }
        this.setState({
            extent: extent,
            width: pixelsize[0],
            height: pixelsize[1]
        });
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
        axios.post(this.props.theme.url, data, config).then(response => {
            this.setState({exporting: false});
            const contentType = response.headers["content-type"];
            const ext = this.state.selectedFormat.split(";")[0].split("/").pop();
            FileSaver.saveAs(new Blob([response.data], {type: contentType}), this.props.theme.name + '.' + ext);
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
    setCurrentTask: setCurrentTask
})(MapExport);
