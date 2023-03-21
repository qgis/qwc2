/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import axios from 'axios';
import url from 'url';
import LayerCatalogWidget from './widgets/LayerCatalogWidget';
import Spinner from './Spinner';
import EditableSelect from '../components/widgets/EditableSelect';
import {addLayerFeatures} from '../actions/layers';
import FileSelector from './widgets/FileSelector';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import './style/ImportLayer.css';


class ImportLayer extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        mapCrs: PropTypes.string,
        theme: PropTypes.object,
        themes: PropTypes.object
    }
    state = {
        type: 'URL',
        file: null,
        url: '',
        pendingRequests: 0,
        serviceLayers: null
    }
    renderInputField() {
        const placeholder = LocaleUtils.tr("importlayer.urlplaceholder");
        const urlPresets = ConfigUtils.getConfigProp("importLayerUrlPresets", this.props.theme) || [];
        if (this.state.type === "Local") {
            return (
                <FileSelector accept=".kml,.json,.geojson" file={this.state.file} onFileSelected={this.onFileSelected} />
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
                <button className="button importlayer-addbutton" disabled={this.state.file === null} onClick={this.importFileLayer} type="button">
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
    }
    scanService = () => {
        let reqUrl = this.state.url;
        if (!reqUrl) {
            return;
        }
        if (!reqUrl.match(/^[^:]+:\/\/.*$/) && !reqUrl.startsWith("/")) {
            reqUrl = location.protocol + "//" + reqUrl;
        }
        let pendingRequests = 0;
        this.setState({pendingRequests: pendingRequests, serviceLayers: null});
        // Attempt to load catalog
        if (reqUrl.toLowerCase().endsWith(".json") || (reqUrl.toLowerCase().endsWith(".xml") && !reqUrl.toLowerCase().endsWith("wmtscapabilities.xml"))) {
            this.setState({pendingRequests: ++pendingRequests});
            let type;
            if (reqUrl.toLowerCase().endsWith(".json")) {
                type = "json";
            } else if (reqUrl.toLowerCase().endsWith(".xml")) {
                type = "xml";
            }
            axios.get(reqUrl).then(response => {
                if (type === "xml") {
                    pendingRequests = this.state.pendingRequests - 1;
                    this.setState({pendingRequests: pendingRequests});

                    // Load from QGIS WMS/WFS connections
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.data, "text/xml");
                    for (const service of ["wms", "wfs"]) {
                        const connections = doc.getElementsByTagName("qgs" + service.toUpperCase() + "Connections");
                        if (!connections.length) {
                            continue;
                        }
                        for (const conn of [].slice.call(connections[0].getElementsByTagName(service))) {
                            let connUrl = conn.attributes.url.value;
                            connUrl += (connUrl.includes("?") ? "&" : "?") + "service=" + service.toUpperCase() + "&request=GetCapabilities";
                            this.setState({pendingRequests: ++pendingRequests});
                            axios.get(connUrl).then(connResponse => {
                                const result = service === "wms" ? ServiceLayerUtils.getWMSLayers(connResponse.data, connUrl, true) : ServiceLayerUtils.getWFSLayers(connResponse.data, connUrl, this.props.mapCrs);
                                this.setState({
                                    pendingRequests: this.state.pendingRequests - 1,
                                    serviceLayers: (this.state.serviceLayers || []).concat(result)
                                });
                            }).catch(() => {
                                this.setState({pendingRequests: this.state.pendingRequests - 1, serviceLayers: this.state.serviceLayers || []});
                            });
                        }
                    }
                } else if (type === "json" && response.data.catalog) {
                    // Load as JSON catalog
                    this.setState({
                        pendingRequests: this.state.pendingRequests - 1,
                        serviceLayers: response.data.catalog
                    });
                }
            }).catch(() => {
                this.setState({pendingRequests: this.state.pendingRequests - 1, serviceLayers: this.state.serviceLayers || []});
            });
            return;
        }

        // Attempt to load as WMTS
        this.setState({pendingRequests: ++pendingRequests});
        axios.get(reqUrl).then(response => {
            const result = ServiceLayerUtils.getWMTSLayers(response.data, reqUrl, this.props.mapCrs);
            this.setState({
                pendingRequests: this.state.pendingRequests - 1,
                serviceLayers: (this.state.serviceLayers || []).concat(result)
            });
        }).catch(() => {
            this.setState({pendingRequests: this.state.pendingRequests - 1, serviceLayers: this.state.serviceLayers || []});
        });

        // Attempt to load as WMS
        {
            const urlParts = url.parse(reqUrl, true);
            urlParts.query = {
                ...Object.entries(urlParts.query).reduce((res, [key, val]) => ({...res, [key.toUpperCase()]: val}), {}),
                SERVICE: "WMS",
                REQUEST: "GetCapabilities",
                VERSION: this.props.themes.defaultWMSVersion || "1.3.0"
            };
            delete urlParts.search;

            this.setState({pendingRequests: ++pendingRequests});
            axios.get(url.format(urlParts)).then(response => {
                const result = ServiceLayerUtils.getWMSLayers(response.data, reqUrl);
                this.setState({
                    pendingRequests: this.state.pendingRequests - 1,
                    serviceLayers: (this.state.serviceLayers || []).concat(result)
                });
            }).catch(() => {
                this.setState({pendingRequests: this.state.pendingRequests - 1, serviceLayers: this.state.serviceLayers || []});
            });
        }

        // Attempt to load as WFS
        {
            const urlParts = url.parse(reqUrl, true);
            urlParts.query = {
                ...Object.entries(urlParts.query).reduce((res, [key, val]) => ({...res, [key.toUpperCase()]: val}), {}),
                SERVICE: "WFS",
                REQUEST: "GetCapabilities"
            };
            delete urlParts.search;

            this.setState({pendingRequests: ++pendingRequests});
            axios.get(url.format(urlParts)).then(response => {
                const result = ServiceLayerUtils.getWFSLayers(response.data, reqUrl, this.props.mapCrs);
                this.setState({
                    pendingRequests: this.state.pendingRequests - 1,
                    serviceLayers: (this.state.serviceLayers || []).concat(result)
                });
            }).catch(() => {
                this.setState({pendingRequests: this.state.pendingRequests - 1, serviceLayers: this.state.serviceLayers || []});
            });
        }
    }
    importFileLayer = () => {
        if (!this.state.file) {
            return;
        }
        const file = this.state.file;
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
            }
            this.setState({file: null});
        };
        reader.readAsText(this.state.file);
    }
    addKMLLayer = (filename, data) => {
        this.addGeoJSONLayer(filename, {features: VectorLayerUtils.kmlToGeoJSON(data)});
    }
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
            alert(LocaleUtils.tr("importlayer.nofeatures"));
        }
    }
}

export default connect((state) => ({
    mapCrs: state.map.projection,
    themes: state.theme.themes
}), {
    addLayerFeatures: addLayerFeatures
})(ImportLayer);
