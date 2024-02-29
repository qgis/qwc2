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

import './style/RasterExport.css';


/**
 * Allows exporting a selected portion of the map to an image ("screenshot").
 *
 * Deprecated. Use the MapExport plugin instead.
 */
class RasterExport extends React.Component {
    static propTypes = {
        /** Whitelist of allowed export format mimetypes. If empty, supported formats are listed. */
        allowedFormats: PropTypes.arrayOf(PropTypes.string),
        /** List of scales at which to export the map. */
        allowedScales: PropTypes.arrayOf(PropTypes.number),
        /** Default export format mimetype. If empty, first available format is used. */
        defaultFormat: PropTypes.string,
        /** The factor to apply to the map scale to determine the initial export map scale.  */
        defaultScaleFactor: PropTypes.number,
        /** List of dpis at which to export the map. If empty, the default server dpi is used.  */
        dpis: PropTypes.arrayOf(PropTypes.number),
        /** Whether to include external layers in the image. Requires QGIS Server 3.x! */
        exportExternalLayers: PropTypes.bool,
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
        this.state.dpi = props.dpis[0] || 96;

        /* eslint-disable-next-line */
        console.warn("The RasterExport plugin is deprecated. Use the MapExport plugin instead.");
    }
    state = {
        extent: '',
        width: 0,
        height: 0,
        exporting: false,
        availableFormats: [],
        selectedFormat: null,
        scale: '',
        pageSize: null,
        dpi: 96
    };
    componentDidUpdate(prevProps, prevState) {
        if (
            this.props.map.center !== prevProps.map.center ||
            this.state.pageSize !== prevState.pageSize ||
            this.state.scale !== prevState.scale ||
            this.state.dpi !== prevState.dpi
        ) {
            if (this.state.pageSize !== null) {
                this.setState((state) => {
                    const center = this.props.map.center;
                    const mapCrs = this.props.map.projection;
                    const pageSize = this.props.pageSizes[state.pageSize];
                    const widthm = state.scale * pageSize.width / 1000;
                    const heightm = state.scale * pageSize.height / 1000;
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
        this.setState({selectedFormat: ev.target.value});
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
            "image/tiff": "GeoTIFF"
        };

        let scaleChooser = null;
        if (!isEmpty(this.props.allowedScales)) {
            scaleChooser = (
                <select onChange={ev => this.setState({scale: ev.target.value})} role="input" value={this.state.scale}>
                    {this.props.allowedScales.map(scale => (<option key={scale} value={scale}>{scale}</option>))}
                </select>);
        } else {
            scaleChooser = (
                <input min="1" onChange={ev => this.setState({scale: ev.target.value})} role="input" type="number" value={this.state.scale} />
            );
        }
        const filename = this.props.theme.name + "." + this.state.selectedFormat.split(";")[0].split("/").pop();
        const action = this.props.theme.url;
        const exportExternalLayers = this.props.exportExternalLayers && ConfigUtils.getConfigProp("qgisServerVersion") >= 3;

        const exportParams = LayerUtils.collectPrintParams(this.props.layers, this.props.theme, this.state.scale, this.props.map.projection, exportExternalLayers);

        // Local vector layer features
        const mapCrs = this.props.map.projection;
        const highlightParams = VectorLayerUtils.createPrintHighlighParams(this.props.layers, mapCrs, this.state.scale, this.state.dpi);
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
            <div className="rasterexport-body">
                <form action={action} method="POST" onSubmit={this.export} ref={el => { this.form = el; }}>
                    <table className="options-table">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("rasterexport.format")}</td>
                                <td>
                                    <select name="FORMAT" onChange={this.formatChanged} value={this.state.selectedFormat}>
                                        {this.state.availableFormats.map(format => {
                                            if (format.startsWith('image/')) {
                                                return (<option key={format} value={format}>{formatMap[format] || format}</option>);
                                            } else {
                                                return null;
                                            }
                                        })}
                                    </select>
                                </td>
                            </tr>
                            {this.props.pageSizes ? (
                                <tr>
                                    <td>{LocaleUtils.tr("rasterexport.size")}</td>
                                    <td>
                                        <select onChange={(ev) => this.setState({pageSize: ev.target.value || null})} value={this.state.pageSize ?? ""}>
                                            <option value="">{LocaleUtils.tr("rasterexport.usersize")}</option>
                                            {this.props.pageSizes.map((entry, idx) => (
                                                <option key={"size_" + idx} value={idx}>{entry.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ) : null}
                            {this.state.pageSize !== null ? (
                                <tr>
                                    <td>{LocaleUtils.tr("rasterexport.scale")}</td>
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
                                    <td>{LocaleUtils.tr("rasterexport.resolution")}</td>
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
                    <input name="STYLES" readOnly type="hidden" value="" />
                    <input name="CRS" readOnly type="hidden" value={this.props.map.projection} />
                    <input name="filename" readOnly type="hidden" value={filename} />
                    <input name="BBOX" readOnly type="hidden" value={this.state.extent} />
                    <input name="WIDTH" readOnly type="hidden" value={this.state.width} />
                    <input name="HEIGHT" readOnly type="hidden" value={this.state.height} />
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
                    {Object.entries(dimensionValues).map(([key, value]) => (
                        <input key={key} name={key} readOnly type="hidden" value={value} />
                    ))}
                    <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
                    <div className="button-bar">
                        <button className="button" disabled={this.state.exporting || !this.state.extent} type="submit">
                            {this.state.exporting ? (
                                <span className="rasterexport-wait"><Spinner /> {LocaleUtils.tr("rasterexport.wait")}</span>
                            ) : LocaleUtils.tr("rasterexport.submit")}
                        </button>
                    </div>
                </form>
            </div>
        );
    };
    renderFrame = () => {
        if (this.state.pageSize !== null) {
            const px2m =  1 / (this.state.dpi * 39.3701) * this.state.scale;
            const frame = {
                width: this.state.width * px2m,
                height: this.state.height * px2m
            };
            return (<PrintFrame fixedFrame={frame} key="PrintFrame" map={this.props.map} />);
        } else {
            return (<PrintFrame bboxSelected={this.bboxSelected} dpi={this.state.dpi} key="PrintFrame" map={this.props.map} />);
        }
    };
    render() {
        const minMaxTooltip = this.state.minimized ? LocaleUtils.tr("print.maximize") : LocaleUtils.tr("print.minimize");
        const extraTitlebarContent = (<Icon className="rasterexport-minimize-maximize" icon={this.state.minimized ? 'chevron-down' : 'chevron-up'} onClick={() => this.setState((state) => ({minimized: !state.minimized}))} title={minMaxTooltip}/>);
        return (
            <SideBar extraTitlebarContent={extraTitlebarContent} icon={"rasterexport"} id="RasterExport" key="RasterExport"
                onHide={this.onHide} onShow={this.onShow} side={this.props.side}
                title="appmenu.items.RasterExport" width="20em">
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
        this.setState({scale: scale, availableFormats: availableFormats, selectedFormat: selectedFormat});
    };
    onHide = () => {
        this.setState({
            extent: '',
            width: '',
            height: ''
        });
    };
    bboxSelected = (bbox, crs, pixelsize) => {
        const version = this.props.theme.version;
        let extent = '';
        if (bbox) {
            extent = (CoordinatesUtils.getAxisOrder(crs).substr(0, 2) === 'ne' && version === '1.3.0') ?
                bbox[1] + "," + bbox[0] + "," + bbox[3] + "," + bbox[2] :
                bbox.join(',');
        }
        this.setState((state) => ({
            extent: extent,
            width: Math.round(pixelsize[0] * parseInt(state.dpi || 96, 10) / 96),
            height: Math.round(pixelsize[1] * parseInt(state.dpi || 96, 10) / 96)
        }));
    };
    export = (ev) => {
        ev.preventDefault();
        this.setState({exporting: true});
        const formData = formDataEntries(new FormData(this.form));
        const data = Object.entries(formData).map((pair) =>
            pair.map(entry => encodeURIComponent(entry).replace(/%20/g, '+')).join("=")
        ).join("&");
        const config = {
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            responseType: "arraybuffer"
        };
        axios.post(this.props.theme.url, data, config).then(response => {
            this.setState({exporting: false});
            const contentType = response.headers["content-type"];
            FileSaver.saveAs(new Blob([response.data], {type: contentType}), this.props.theme.name + '.pdf');
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
})(RasterExport);
