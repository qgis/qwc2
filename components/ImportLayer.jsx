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
import isEmpty from 'lodash.isempty';
import {WorkerMessageHandler} from "pdfjs-dist/build/pdf.worker";
import Proj4js from 'proj4';
import PropTypes from 'prop-types';

import {addLayer, addLayerFeatures} from '../actions/layers';
import EditableSelect from '../components/widgets/EditableSelect';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import Spinner from './Spinner';
import FileSelector from './widgets/FileSelector';
import LayerCatalogWidget from './widgets/LayerCatalogWidget';

import './style/ImportLayer.css';


class ImportLayer extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        mapCrs: PropTypes.string,
        theme: PropTypes.object,
        themes: PropTypes.object
    };
    state = {
        type: 'URL',
        file: null,
        url: '',
        pendingRequests: 0,
        serviceLayers: null,
        addingLayer: false
    };
    renderInputField() {
        const placeholder = LocaleUtils.tr("importlayer.urlplaceholder");
        const urlPresets = ConfigUtils.getConfigProp("importLayerUrlPresets", this.props.theme) || [];
        if (this.state.type === "Local") {
            return (
                <FileSelector accept=".kml,.json,.geojson,.pdf" file={this.state.file} onFileSelected={this.onFileSelected} />
            );
        } else {
            return (
                <EditableSelect
                    onChange={value => this.setState({url: value})} onSubmit={this.scanService} options={urlPresets}
                    placeholder={placeholder} readOnly={this.state.pendingRequests > 0} />
            );
        }
    }
    render() {
        let button = null;
        if (this.state.type === "URL") {
            button = (
                <button className="button importlayer-addbutton" disabled={!this.state.url || this.state.pendingRequests > 0} onClick={this.scanService}>
                    {this.state.pendingRequests > 0 ? (<Spinner />) : null}
                    {LocaleUtils.tr("importlayer.connect")}
                </button>
            );
        } else {
            button = (
                <button className="button importlayer-addbutton" disabled={this.state.file === null || this.state.addingLayer} onClick={this.importFileLayer} type="button">
                    {this.state.addingLayer ? (<Spinner />) : null}
                    {LocaleUtils.tr("importlayer.addlayer")}
                </button>
            );
        }
        let layerList = null;
        if (this.state.serviceLayers !== null) {
            layerList = (<LayerCatalogWidget catalog={this.state.serviceLayers} pendingRequests={this.state.pendingRequests} />);
        }
        const disableLocal = ConfigUtils.getConfigProp("disableImportingLocalLayers", this.props.theme);
        return (
            <div className="ImportLayer">
                <div className="importlayer-input-fields">
                    <select
                        disabled={this.state.pendingRequests > 0}
                        onChange={ev => this.setState({type: ev.target.value, file: null, url: "", serviceLayers: null})} value={this.state.type}
                    >
                        <option value="URL">{LocaleUtils.tr("importlayer.url")}</option>
                        {!disableLocal ? (<option value="Local">{LocaleUtils.tr("importlayer.localfile")}</option>) : null}
                    </select>
                    {this.renderInputField()}
                </div>
                {button}
                {layerList}
            </div>
        );
    }
    onFileSelected = (file) => {
        this.setState({file});
    };
    scanService = () => {
        let reqUrl = this.state.url;
        if (!reqUrl) {
            return;
        }
        if (!reqUrl.match(/^[^:]+:\/\/.*$/) && !reqUrl.startsWith("/")) {
            reqUrl = location.protocol + "//" + reqUrl;
        } else {
            reqUrl = MiscUtils.adjustProtocol(reqUrl);
        }
        let pendingRequests = 0;
        // Attempt to load catalog
        if (reqUrl.toLowerCase().endsWith(".json") || (reqUrl.toLowerCase().endsWith(".xml") && !reqUrl.toLowerCase().endsWith("wmtscapabilities.xml"))) {
            ++pendingRequests;
            let type;
            if (reqUrl.toLowerCase().endsWith(".json")) {
                type = "json";
            } else if (reqUrl.toLowerCase().endsWith(".xml")) {
                type = "xml";
            }
            axios.get(reqUrl).then(response => {
                if (type === "xml") {
                    let catalogPendingRequests = 0;

                    // Load from QGIS WMS/WFS connections
                    const doc = (new DOMParser()).parseFromString(response.data, "text/xml");

                    const parsers = [{
                        type: 'wms',
                        getCapabilities: ServiceLayerUtils.getWMSCapabilities,
                        getLayers: (capabilities, requestUrl) => ServiceLayerUtils.getWMSLayers(capabilities, requestUrl, true)
                    }, {
                        type: 'wfs',
                        getCapabilities: ServiceLayerUtils.getWFSCapabilities,
                        getLayers: (capabilities, requestUrl) => ServiceLayerUtils.getWFSLayers(capabilities, requestUrl, this.props.mapCrs)
                    }];
                    parsers.forEach(parser => {
                        const connections = doc.getElementsByTagName("qgs" + parser.type.toUpperCase() + "Connections");
                        if (connections.length) {
                            for (const conn of [].slice.call(connections[0].getElementsByTagName(parser.type))) {
                                ++catalogPendingRequests;
                                parser.getCapabilities(conn.attributes.url.value).then(({capabilities, requestUrl}) => {
                                    const result = parser.getLayers(capabilities, requestUrl);
                                    this.setState((state) => ({
                                        pendingRequests: state.pendingRequests - 1,
                                        serviceLayers: (state.serviceLayers || []).concat(result)
                                    }));
                                }).catch(() => {
                                    this.setState((state) => ({
                                        pendingRequests: state.pendingRequests - 1,
                                        serviceLayers: state.serviceLayers || []
                                    }));
                                });
                            }
                        }
                    });
                    this.setState((state) => ({pendingRequests: state.pendingRequests - 1 + catalogPendingRequests }));
                } else if (type === "json" && response.data.catalog) {
                    // Load as JSON catalog
                    this.setState((state) => ({
                        pendingRequests: state.pendingRequests - 1,
                        serviceLayers: (state.serviceLayers || []).concat(response.data.catalog)
                    }));
                }
            }).catch(() => {
                this.setState((state) => ({
                    pendingRequests: state.pendingRequests - 1,
                    serviceLayers: state.serviceLayers || []
                }));
            });
        }

        // Attempt to load as WMTS
        ++pendingRequests;
        ServiceLayerUtils.getWMTSCapabilities(reqUrl).then(({capabilities, requestUrl}) => {
            const result = ServiceLayerUtils.getWMTSLayers(capabilities, requestUrl, this.props.mapCrs);
            this.setState((state) => ({
                pendingRequests: state.pendingRequests - 1,
                serviceLayers: (state.serviceLayers || []).concat(result)
            }));
        }).catch(() => {
            this.setState((state) => ({
                pendingRequests: state.pendingRequests - 1,
                serviceLayers: state.serviceLayers || []
            }));
        });

        // Attempt to load as WMS
        ++pendingRequests;
        ServiceLayerUtils.getWMSCapabilities(reqUrl).then(({capabilities, requestUrl}) => {
            const result = ServiceLayerUtils.getWMSLayers(capabilities, requestUrl);
            this.setState((state) => ({
                pendingRequests: state.pendingRequests - 1,
                serviceLayers: (state.serviceLayers || []).concat(result)
            }));
        }).catch(() => {
            this.setState((state) => ({
                pendingRequests: state.pendingRequests - 1,
                serviceLayers: state.serviceLayers || []
            }));
        });

        // Attempt to load as WFS
        ++pendingRequests;
        ServiceLayerUtils.getWFSCapabilies(reqUrl).then(({capabilities, requestUrl}) => {
            const result = ServiceLayerUtils.getWFSLayers(capabilities, requestUrl, this.props.mapCrs);
            this.setState((state) => ({
                pendingRequests: state.pendingRequests - 1,
                serviceLayers: (state.serviceLayers || []).concat(result)
            }));
        }).catch(() => {
            this.setState((state) => ({
                pendingRequests: state.pendingRequests - 1,
                serviceLayers: state.serviceLayers || []
            }));
        });

        this.setState({pendingRequests: pendingRequests, serviceLayers: null});
    };
    importFileLayer = () => {
        if (!this.state.file) {
            return;
        }
        this.setState({addingLayer: true});
        const file = this.state.file;
        if (file.name.toLowerCase().endsWith(".pdf")) {
            this.addGeoPDFLayer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (file.name.toLowerCase().endsWith(".kml")) {
                    this.addKMLLayer(file.name, ev.target.result);
                } else if (file.name.toLowerCase().endsWith(".geojson") || file.name.toLowerCase().endsWith(".json")) {
                    let data = {};
                    try {
                        data = JSON.parse(ev.target.result);
                        this.addGeoJSONLayer(file.name, data);
                    } catch (e) {
                        /* Pass */
                    }
                } else if (file.name.toLowerCase().endsWith(".pdf")) {
                    this.addGeoPDFLayer(file.name, ev.target.result);
                }
                this.setState({file: null, addingLayer: false});
            };
            reader.readAsText(this.state.file);
        }
    };
    addKMLLayer = (filename, data) => {
        this.addGeoJSONLayer(filename, {features: VectorLayerUtils.kmlToGeoJSON(data)});
    };
    addGeoJSONLayer = (filename, data) => {
        if (!isEmpty(data.features)) {
            let defaultCrs = "EPSG:4326";
            if (data.crs && data.crs.properties && data.crs.properties.name) {
                // Extract CRS from FeatureCollection crs
                defaultCrs = CoordinatesUtils.fromOgcUrnCrs(data.crs.properties.name);
            }
            const features = data.features.map(feature => {
                let crs = defaultCrs;
                if (feature.crs && feature.crs.properties && feature.crs.properties.name) {
                    crs = CoordinatesUtils.fromOgcUrnCrs(feature.crs.properties.name);
                } else if (typeof feature.crs === "string") {
                    crs = feature.crs;
                }
                if (feature.geometry && feature.geometry.coordinates) {
                    feature.geometry.coordinates = feature.geometry.coordinates.map(VectorLayerUtils.convert3dto2d);
                }
                return {...feature, crs: crs};
            });
            this.props.addLayerFeatures({
                name: filename,
                title: filename.replace(/\.[^/.]+$/, ""),
                zoomToExtent: true
            }, features, true);
        } else {
            // eslint-disable-next-line
            alert(LocaleUtils.tr("importlayer.nofeatures"));
        }
    };
    addGeoPDFLayer = (file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const pdfText = atob(ev.target.result.slice(28));
            /* FIXME: This is a very ugly way to extract PDF objects */
            const GPTS = pdfText.match(/\/GPTS\s+\[([^\]]+)\]/);
            const LPTS = pdfText.match(/\/LPTS\s+\[([^\]]+)\]/);
            const Viewport = pdfText.match(/<<([^>]+\/Type\s+\/Viewport[^>]+)>>/);
            const EPSG = pdfText.match(/\/EPSG\s*(\d+)/);
            if (!GPTS || !LPTS || !Viewport || !EPSG) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("importlayer.notgeopdf"));
                this.setState({file: null, addingLayer: false});
                return;
            }
            const pairs = (res, value, idx, array) => idx % 2 === 0 ? [...res, array.slice(idx, idx + 2)] : res;
            const gpts = GPTS[1].split(/\s+/).filter(Boolean).map(Number).reduce(pairs, []).map(e => e.reverse()); // lat-lon => lon-lat
            const lpts = LPTS[1].split(/\s+/).filter(Boolean).map(Number).reduce(pairs, []);
            const viewport = Viewport[1].match(/\/BBox\s+\[([^\]]+)\]/)[1].split(/\s+/).filter(Boolean).map(Number);
            const epsg = EPSG[1];
            const projDef = Proj4js.defs('EPSG:' + epsg);
            if (!projDef) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("importlayer.unknownproj", 'EPSG:' + epsg));
                this.setState({file: null, addingLayer: false});
                return;
            }
            // Construct geog CS
            const geogCs = {
                projName: 'longlat',
                ellps: projDef.ellps,
                datum_params: projDef.datum_params,
                no_defs: projDef.no_defs
            };

            // Compute the georeferenced area
            // Note: this is a simplistic implementation, assuming that the frame is rectangular and not skewed
            const getCornerIdx = (x, y) => lpts.findIndex(entry => Math.round(entry[0]) === x && Math.round(entry[1]) === y);
            const idxBL = getCornerIdx(0, 0);
            const idxTR = getCornerIdx(1, 1);

            const computeCorner = (idx) => ({
                pixel: [
                    viewport[0] * (1 - lpts[idx][0]) + viewport[2] * lpts[idx][0],
                    viewport[1] * (1 - lpts[idx][1]) + viewport[3] * lpts[idx][1]
                ],
                coo: Proj4js(geogCs, this.props.mapCrs, gpts[idx])
            });
            const bl = computeCorner(idxBL);
            const tr = computeCorner(idxTR);
            const geoextent = [bl.coo[0], bl.coo[1], tr.coo[0], tr.coo[1]];
            const imgextent = [bl.pixel[0], bl.pixel[1], tr.pixel[0], tr.pixel[1]];

            import('pdfjs-dist/build/pdf').then(pdfjsLib => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = WorkerMessageHandler;

                pdfjsLib.getDocument(ev.target.result).promise.then((pdf) => {
                    pdf.getPage(1).then((page) => {
                        const pageViewport = page.getViewport({scale: 1});
                        const canvas = document.createElement('canvas');
                        canvas.width = imgextent[2] - imgextent[0];
                        canvas.height = imgextent[3] - imgextent[1];
                        const context = canvas.getContext('2d');
                        context.translate(-imgextent[0], -(pageViewport.height - imgextent[3]));
                        page.render({canvasContext: context, viewport: pageViewport}).promise.then(() => {
                            this.props.addLayer({
                                type: "image",
                                name: file.name,
                                title: file.name,
                                url: canvas.toDataURL(),
                                projection: this.props.mapCrs,
                                imageExtent: geoextent
                            });
                            this.setState({file: null, addingLayer: false});
                        });
                    });
                });
            }).catch(() => {
                /* eslint-disable-next-line */
                console.warn("pdfjs import failed");
                this.setState({file: null, addingLayer: false});
            });
        };
        reader.readAsDataURL(file);
    };
}

export default connect((state) => ({
    mapCrs: state.map.projection,
    themes: state.theme.themes
}), {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures
})(ImportLayer);
