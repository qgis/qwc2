/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const isEmpty = require('lodash.isempty');
const axios = require('axios');
const assign = require('object-assign');
const removeDiacritics = require('diacritics').remove;
const Spinner = require('./Spinner');
const Message = require('../components/I18N/Message');
const EditableSelect = require('../components/widgets/EditableSelect');
const LocaleUtils = require('../utils/LocaleUtils');
const {addLayer, addLayerFeatures} = require('../actions/layers');
const FileSelector = require('./widgets/FileSelector');
const ConfigUtils = require('../utils/ConfigUtils');
const LayerUtils = require('../utils/LayerUtils');
const ServiceLayerUtils = require('../utils/ServiceLayerUtils');
const VectorLayerUtils = require('../utils/VectorLayerUtils');
const Icon = require('./Icon');
require('./style/ImportLayer.css');


class ImportLayerList extends React.PureComponent {
    static propTypes = {
        addLayer: PropTypes.func,
        filter: PropTypes.string,
        pendingRequests: PropTypes.number,
        serviceLayers: PropTypes.array
    }
    state = {
        serviceLayers: []
    }
    constructor(props) {
        super(props);
        this.state.serviceLayers = this.props.serviceLayers || [];
    }
    static getDerivedStateFromProps(nextProps) {
        return {serviceLayers: nextProps.serviceLayers || []};
    }
    renderServiceLayerListEntry(entry, filter, path, level = 0, idx) {
        const hasSublayers = !isEmpty(entry.sublayers);
        const sublayers = hasSublayers ? entry.sublayers.map((sublayer, i) => this.renderServiceLayerListEntry(sublayer, filter, [...path, i], level + 1, i)) : [];
        if (sublayers.filter(item => item).length === 0 && filter && !removeDiacritics(entry.title).match(filter)) {
            return null;
        }
        const type = entry.resource ? entry.resource.slice(0, entry.resource.indexOf(":")) : entry.type;
        const key = (entry.resource || (entry.type + ":" + entry.name)) + ":" + idx;
        return (
            <div key={key} style={{paddingLeft: level + 'em'}}>
                <div className="importlayer-list-entry">
                    {hasSublayers ? (<Icon icon={entry.expanded ? 'tree_minus' : 'tree_plus'} onClick={() => this.toggleLayerListEntry(path)} />) : null}
                    <span onClick={() => this.addServiceLayer(entry)}>
                        <span className="importlayer-list-entry-service">{type}</span>
                        {entry.title}
                    </span>
                </div>
                {entry.expanded ? sublayers : null}
            </div>
        );
    }
    toggleLayerListEntry = (path) => {
        const newServiceLayers = [...this.state.serviceLayers];
        newServiceLayers[path[0]] = assign({}, newServiceLayers[path[0]]);
        let cur = newServiceLayers[path[0]];
        for (const idx of path.slice(1)) {
            cur.sublayers[idx] = assign({}, cur.sublayers[idx]);
            cur = cur.sublayers[idx];
        }
        cur.expanded = !cur.expanded;
        this.setState({serviceLayers: newServiceLayers});
    }
    render() {
        const filter = new RegExp(removeDiacritics(this.props.filter).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i");
        let emptyEntry = null;
        if (isEmpty(this.state.serviceLayers) && this.props.pendingRequests === 0) {
            emptyEntry = (
                <div className="layertree-item-noresults"><Message msgId="importlayer.noresults" /></div>
            );
        } else if (isEmpty(this.state.serviceLayers)) {
            emptyEntry = (
                <div className="layertree-item-noresults"><Message msgId="importlayer.loading" /></div>
            );
        }
        return (
            <div className="importlayer-list">
                {this.state.serviceLayers.map((entry, idx) => this.renderServiceLayerListEntry(entry, filter, [idx], 0, idx))}
                {emptyEntry}
            </div>
        );
    }
    addServiceLayer = (entry) => {
        if (entry.resource) {
            const params = LayerUtils.splitLayerUrlParam(entry.resource);
            ServiceLayerUtils.findLayers(params.type, params.url, [params], this.props.mapCrs, (id, layer) => {
                if (layer) {
                    this.props.addLayer(layer);
                }
            });
        } else if (entry.type === "wms" || entry.type === "wfs" || entry.type === "wmts") {
            this.props.addLayer(assign({}, entry, {sublayers: null}));
        }
    }
}

class ImportLayer extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        mapCrs: PropTypes.string,
        theme: PropTypes.object
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    state = {
        type: 'URL',
        file: null,
        url: '',
        pendingRequests: 0,
        serviceLayers: null,
        filter: ""
    }
    renderInputField() {
        const placeholder = LocaleUtils.getMessageById(this.context.messages, "importlayer.urlplaceholder");
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
                    <Message msgId="importlayer.connect" />
                </button>
            );
        } else {
            button = (
                <button className="button importlayer-addbutton" disabled={this.state.file === null} onClick={this.importFileLayer} type="button">
                    <Message msgId="importlayer.addlayer" />
                </button>
            );
        }
        let layerList = null;
        if (this.state.serviceLayers !== null) {
            const filterplaceholder = LocaleUtils.getMessageById(this.context.messages, "importlayer.filter");
            layerList = [
                (<input className="importlayer-list-filter" key="importlayer-list-filter" onChange={ev => this.setState({filter: ev.target.value})} placeholder={filterplaceholder} type="text" value={this.state.filter}/>),
                (<ImportLayerList addLayer={this.props.addLayer} filter={this.state.filter} key="importlayer-list" pendingRequests={this.state.pendingRequests} serviceLayers={this.state.serviceLayers} />)
            ];
        }
        const disableLocal = ConfigUtils.getConfigProp("disableImportingLocalLayers", this.props.theme);
        return (
            <div id="ImportLayer">
                <div className="importlayer-input-fields">
                    <select disabled={this.state.pendingRequests > 0} onChange={ev => this.setState({type: ev.target.value, file: null, url: "", serviceLayers: null, filter: ""})} value={this.state.type}>
                        <option value="URL">{LocaleUtils.getMessageById(this.context.messages, "importlayer.url")}</option>
                        {!disableLocal ? (<option value="Local">{LocaleUtils.getMessageById(this.context.messages, "importlayer.localfile")}</option>) : null}
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
        let url = this.state.url;
        if (!url) {
            return;
        }
        if (!url.match(/^[^:]+:\/\/.*$/) && !url.startsWith("/")) {
            url = location.protocol + "//" + url;
        }
        let pendingRequests = 0;
        this.setState({pendingRequests: pendingRequests, serviceLayers: null, filter: ""});
        // Attempt to load catalog
        if (url.toLowerCase().endsWith(".json") || (url.toLowerCase().endsWith(".xml") && !url.toLowerCase().endsWith("wmtscapabilities.xml"))) {
            this.setState({pendingRequests: ++pendingRequests});
            let type;
            if (url.toLowerCase().endsWith(".json")) {
                type = "json";
            } else if (url.toLowerCase().endsWith(".xml")) {
                type = "xml";
            }
            axios.get(url).then(response => {
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
                                const result = service === "wms" ? ServiceLayerUtils.getWMSLayers(response.data, true) : ServiceLayerUtils.getWFSLayers(connResponse.data);
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
        axios.get(url).then(response => {
            const result = ServiceLayerUtils.getWMTSLayers(response.data, url, this.props.mapCrs);
            this.setState({
                pendingRequests: this.state.pendingRequests - 1,
                serviceLayers: (this.state.serviceLayers || []).concat(result)
            });
        }).catch(() => {
            this.setState({pendingRequests: this.state.pendingRequests - 1});
        });

        // Attempt to load as WMS
        const wmsParams = "?service=WMS&request=GetCapabilities&version=1.3.0";
        this.setState({pendingRequests: ++pendingRequests});
        axios.get(url.split("?")[0] + wmsParams).then(response => {
            const result = ServiceLayerUtils.getWMSLayers(response.data);
            this.setState({
                pendingRequests: this.state.pendingRequests - 1,
                serviceLayers: (this.state.serviceLayers || []).concat(result)
            });
        }).catch(() => {
            this.setState({pendingRequests: this.state.pendingRequests - 1});
        });

        // Attempt to load as WFS
        const wfsParams = "?service=WFS&request=GetCapabilities";
        this.setState({pendingRequests: ++pendingRequests});
        axios.get(url.split("?")[0] + wfsParams).then(response => {
            const result = ServiceLayerUtils.getWFSLayers(response.data);
            this.setState({
                pendingRequests: this.state.pendingRequests - 1,
                serviceLayers: (this.state.serviceLayers || []).concat(result)
            });
        }).catch(() => {
            this.setState({pendingRequests: this.state.pendingRequests - 1});
        });
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
                } catch (e) {
                    /* Pass */
                }
                this.addGeoJSONLayer(file.name, data);
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
                defaultCrs = data.crs.properties.name.replace(/urn:ogc:def:crs:EPSG::(\d+)/, "EPSG:$1");
            }
            const features = data.features.map(feature => {
                let crs = defaultCrs;
                if (feature.crs && feature.crs.properties && feature.crs.properties.name) {
                    crs = feature.crs.properties.name.replace(/urn:ogc:def:crs:EPSG::(\d+)/, "EPSG:$1");
                } else if (typeof feature.crs === "string") {
                    crs = feature.crs;
                }
                return {...feature, crs: crs};
            });
            this.props.addLayerFeatures({
                name: filename,
                title: filename.replace(/\.[^/.]+$/, ""),
                zoomToExtent: true
            }, features, true);
        } else {
            alert(LocaleUtils.getMessageById(this.context.messages, "importlayer.nofeatures"));
        }
    }
}

module.exports = connect((state) => ({
    mapCrs: state.map.projection
}), {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures
})(ImportLayer);
