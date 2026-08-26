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
import PropTypes from 'prop-types';

import {addLayer, addLayerFeatures} from '../actions/layers';
import EditableSelect from '../components/widgets/EditableSelect';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import FileImportUtils from '../utils/FileImportUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import ComboBox from './widgets/ComboBox';
import FileSelector from './widgets/FileSelector';
import LayerCatalogWidget from './widgets/LayerCatalogWidget';
import Spinner from './widgets/Spinner';

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
        addingLayer: false,
        fileCrs: null
    };
    renderInputField() {
        const placeholder = LocaleUtils.tr("importlayer.urlplaceholder");
        const urlPresets = ConfigUtils.getConfigProp("importLayerUrlPresets", this.props.theme) || [];
        if (this.state.type === "Local") {
            return (
                <FileSelector
                    accept=".kml,.kmz,.json,.geojson,.pdf,.zip,.dxf" file={this.state.file}
                    onFileSelected={this.onFileSelected}
                    title={LocaleUtils.tr("importlayer.supportedformats")} />
            );
        } else {
            return (
                <EditableSelect
                    onChange={value => this.setState({url: value})} onSubmit={this.scanService} options={urlPresets}
                    placeholder={placeholder} readOnly={this.state.pendingRequests > 0} value={this.state.url} />
            );
        }
    }
    renderCrsSelector() {
        // DXF contains plain numbers, the user needs to specify how to interpret them
        if (!this.state.file || !this.state.file.name.toLowerCase().endsWith(".dxf")) {
            return null;
        }
        const availableCRS = CoordinatesUtils.getAvailableCRS();
        return (
            <div className="importlayer-file-crs">
                <div className="importlayer-file-crs-field">
                    <span>{LocaleUtils.tr("importlayer.filecrs")}</span>
                    <ComboBox filterable onChange={value => this.setState({fileCrs: value})} value={this.state.fileCrs ?? this.props.mapCrs}>
                        {Object.entries(availableCRS).map(([code, entry]) => (
                            <div key={code} value={code}>{entry.label}</div>
                        ))}
                    </ComboBox>
                </div>
                <div className="importlayer-file-crs-hint">{LocaleUtils.tr("importlayer.filecrshint")}</div>
            </div>
        );
    }
    render() {
        let button = null;
        if (this.state.type === "URL") {
            button = (
                <button className="button importlayer-addbutton" disabled={!this.state.url || this.state.pendingRequests > 0} onClick={() => this.scanService()}>
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
            layerList = (
                <LayerCatalogWidget
                    addLayer={this.props.addLayer} catalog={this.state.serviceLayers}
                    pendingRequests={this.state.pendingRequests} />
            );
        }
        const disableLocal = ConfigUtils.getConfigProp("disableImportingLocalLayers", this.props.theme);
        return (
            <div className="ImportLayer">
                <div className="importlayer-input-fields controlgroup">
                    <select
                        disabled={this.state.pendingRequests > 0}
                        onChange={ev => this.setState({type: ev.target.value, file: null, url: "", serviceLayers: null, fileCrs: null})} value={this.state.type}
                    >
                        <option value="URL">{LocaleUtils.tr("importlayer.url")}</option>
                        {!disableLocal ? (<option value="Local">{LocaleUtils.tr("importlayer.localfile")}</option>) : null}
                    </select>
                    {this.renderInputField()}
                </div>
                {this.renderCrsSelector()}
                {button}
                {layerList}
            </div>
        );
    }
    onFileSelected = (file) => {
        this.setState({file});
    };
    scanService = (url) => {
        let reqUrl = url ?? this.state.url;
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
        ServiceLayerUtils.getWFSCapabilities(reqUrl).then(({capabilities, requestUrl}) => {
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
        const options = {crs: this.state.fileCrs ?? this.props.mapCrs};
        FileImportUtils.importFile(this.state.file, this.props.mapCrs, this.props.addLayer, this.props.addLayerFeatures, options).finally(() => {
            this.setState({file: null, addingLayer: false, fileCrs: null});
        });
    };
}

export default connect((state) => ({
    mapCrs: state.map.projection,
    themes: state.theme.themes
}), {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures
})(ImportLayer);
