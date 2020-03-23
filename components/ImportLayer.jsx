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
const ProxyUtils = require('../utils/ProxyUtils');
const {LayerRole,addLayer,addLayerFeatures} = require('../actions/layers');
const FileSelector = require('./widgets/FileSelector');
const ConfigUtils = require('../utils/ConfigUtils');
const LayerUtils = require('../utils/LayerUtils');
const ServiceLayerUtils = require('../utils/ServiceLayerUtils');
const VectorLayerUtils = require('../utils/VectorLayerUtils');
const Icon = require('./Icon');
require('./style/ImportLayer.css');


class ImportLayerList extends React.PureComponent {
    static propTypes = {
        serviceLayers: PropTypes.array,
        filter: PropTypes.string,
        pendingRequests: PropTypes.number
    }
    state = {
        serviceLayers: []
    }
    componentWillReceiveProps(newProps) {
        this.setState({serviceLayers: newProps.serviceLayers || []});
    }
    renderServiceLayerListEntry(entry, filter, path, level = 0, idx) {
        let hasSublayers = !isEmpty(entry.sublayers);
        let sublayers = hasSublayers ? entry.sublayers.map((sublayer,idx) => this.renderServiceLayerListEntry(sublayer, filter, [...path, idx], level + 1, idx)) : [];
        if(sublayers.filter(item => item).length == 0 && filter && !removeDiacritics(entry.title).match(filter)) {
            return null;
        }
        let type = entry.resource ? entry.resource.slice(0, 3) : entry.type;
        let key = (entry.resource || (entry.type + ":" + entry.name)) + ":" + idx;
        return (
            <div key={key} style={{paddingLeft: level + 'em'}}>
                <div className="importlayer-list-entry">
                    {hasSublayers ? (<Icon onClick={ev => this.toggleLayerListEntry(path)} icon={entry.expanded ? 'tree_minus' : 'tree_plus'} />) : null}
                    <span onClick={ev => this.addServiceLayer(entry)}>
                        <span className="importlayer-list-entry-service">{type}</span>
                        {entry.title}
                    </span>
                </div>
                <div style={{display: entry.expanded ? 'block' : 'none'}}>
                {sublayers}
                </div>
            </div>
        );
    }
    toggleLayerListEntry = (path) => {
        let newServiceLayers = [...this.state.serviceLayers];
        newServiceLayers[path[0]] = assign({}, newServiceLayers[path[0]]);
        let cur = newServiceLayers[path[0]];
        for(let idx of path.slice(1)) {
            cur.sublayers[idx] = assign({}, cur.sublayers[idx]);
            cur = cur.sublayers[idx];
        }
        cur.expanded = !cur.expanded;
        this.setState({serviceLayers: newServiceLayers});
    }
    render() {
        let filter = new RegExp(removeDiacritics(this.props.filter).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "i");
        let emptyEntry = null;
        if(isEmpty(this.state.serviceLayers) && this.props.pendingRequests === 0) {
            emptyEntry = (
                    <div className="layertree-item-noresults"><Message msgId="importlayer.noresults" /></div>
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
        if(entry.resource) {
            let params = LayerUtils.splitLayerUrlParam(entry.resource);
            ServiceLayerUtils.findLayers(params.type, params.url, [params], (source, layer) => {
                if(layer) {
                    this.props.addLayer(assign({
                        id: entry.name + Date.now().toString(),
                        role: LayerRole.USERLAYER
                    }, layer, {sublayers: null}));
                }
            });
        } else if(entry.type === "wms" || entry.type === "wfs") {
            this.props.addLayer(assign({
                id: entry.name + Date.now().toString(),
                role: LayerRole.USERLAYER
            }, entry, {sublayers: null}));
        }
    }
}

class ImportLayer extends React.Component {
    static propTypes = {
        theme: PropTypes.object,
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func
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
        let placeholder = LocaleUtils.getMessageById(this.context.messages, "importlayer.urlplaceholder");
        let urlPresets = ConfigUtils.getConfigProp("importLayerUrlPresets", this.props.theme);
        if(this.state.type === "Local") {
            return (<FileSelector file={this.state.file} accept=".kml,.json,.geojson" onFileSelected={this.onFileSelected} />);
        } else {
            return (
                <EditableSelect
                    readOnly={this.state.pendingRequests > 0} placeholder={placeholder} options={urlPresets}
                    onChange={value => this.setState({url: value})} onSubmit={this.scanService} />
            );
        }
    }
    render() {
        let button = null;
        if(this.state.type === "URL") {
            button = (
                <button disabled={!this.state.url || this.state.pendingRequests > 0} className="button importlayer-addbutton" onClick={this.scanService}>
                    {this.state.pendingRequests > 0 ? (<Spinner />) : null}
                    <Message msgId="importlayer.connect" />
                </button>
            );
        } else {
            button = (
                <button disabled={this.state.file === null} className="button importlayer-addbutton" type="button" onClick={this.importFileLayer}>
                    <Message msgId="importlayer.addlayer" />
                </button>
            );
        }
        let layerList = null;
        if(this.state.serviceLayers != null) {
            let filterplaceholder = LocaleUtils.getMessageById(this.context.messages, "importlayer.filter");
            layerList = [
                (<input key="importlayer-list-filter" className="importlayer-list-filter" type="text" value={this.state.filter} placeholder={filterplaceholder} onChange={ev => this.setState({filter: ev.target.value})}/>),
                (<ImportLayerList key="importlayer-list" serviceLayers={this.state.serviceLayers} filter={this.state.filter} pendingRequests={this.state.pendingRequests} />)
            ];
        }
        let disableLocal = ConfigUtils.getConfigProp("disableImportingLocalLayers", this.props.theme);
        return (
            <div id="ImportLayer">
                <div className="importlayer-input-fields">
                    <select disabled={this.state.pendingRequests > 0} value={this.state.type} onChange={ev => this.setState({type: ev.target.value, file: null, url: "", serviceLayers: null, filter: ""})}>
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
        if(!url) {
            return;
        }
        if(!url.match(/^[^:]+:\/\/.*$/)) {
            url = location.protocol + "//" + url;
        }
        let pendingRequests = 0;
        this.setState({pendingRequests: pendingRequests, serviceLayers: null, filter: ""});
        // Attempt to load catalog
        if(url.toLowerCase().endsWith(".json") || url.toLowerCase().endsWith(".xml")) {
            this.setState({pendingRequests: ++pendingRequests});
            let type;
            if(url.toLowerCase().endsWith(".json")) {
                type = "json";
            } else if(url.toLowerCase().endsWith(".xml")) {
                type = "xml";
            }
            axios.get(ProxyUtils.addProxyIfNeeded(url)).then(response => {
                if(type === "xml") {
                    pendingRequests = this.state.pendingRequests - 1;
                    this.setState({pendingRequests: pendingRequests});

                    // Load from QGIS WMS/WFS connections
                    let parser = new DOMParser();
                    let doc = parser.parseFromString(response.data, "text/xml");
                    for(let service of ["wms", "wfs"]) {
                        let connections = doc.getElementsByTagName("qgs" + service.toUpperCase() + "Connections");
                        if(!connections.length) {
                            continue;
                        }
                        for(let conn of [].slice.call(connections[0].getElementsByTagName(service))) {
                            let url = conn.attributes.url.value;
                            url += (url.includes("?") ? "&" : "?") + "service=" + service.toUpperCase() + "&request=GetCapabilities";
                            this.setState({pendingRequests: ++pendingRequests});
                            axios.get(ProxyUtils.addProxyIfNeeded(url)).then(response => {
                                let result = service === "wms" ? ServiceLayerUtils.getWMSLayers(response.data, true) : ServiceLayerUtils.getWFSLayers(response.data);
                                this.setState({
                                    pendingRequests: this.state.pendingRequests - 1,
                                    serviceLayers: (this.state.serviceLayers || []).concat(result)
                                });
                            }).catch(err => {
                                this.setState({pendingRequests: this.state.pendingRequests - 1});
                            });
                        }
                    }
                } else if(type === "json" && response.data.catalog) {
                    // Load as JSON catalog
                    this.setState({
                        pendingRequests: this.state.pendingRequests - 1,
                        serviceLayers: response.data.catalog
                    });
                }
            }).catch(err => {
                this.setState({pendingRequests: this.state.pendingRequests - 1});
            });
            return;
        }
        // Attempt to load as WMS
        let wmsParams = "?service=WMS&request=GetCapabilities";
        this.setState({pendingRequests: ++pendingRequests});
        axios.get(ProxyUtils.addProxyIfNeeded(url.split("?")[0] + wmsParams)).then(response => {
            let result = ServiceLayerUtils.getWMSLayers(response.data);
            this.setState({
                pendingRequests: this.state.pendingRequests - 1,
                serviceLayers: (this.state.serviceLayers || []).concat(result)
            });
        }).catch(err => {
            this.setState({pendingRequests: this.state.pendingRequests - 1});
        });
        // Attempt to load as WFS
        let wfsParams = "?service=WFS&request=GetCapabilities"
        this.setState({pendingRequests: ++pendingRequests});
        axios.get(ProxyUtils.addProxyIfNeeded(url.split("?")[0] + wfsParams)).then(response => {
            let result = ServiceLayerUtils.getWFSLayers(response.data);
            this.setState({
                pendingRequests: this.state.pendingRequests - 1,
                serviceLayers: (this.state.serviceLayers || []).concat(result)
            });
        }).catch(err => {
            this.setState({pendingRequests: this.state.pendingRequests - 1});
        });
    }
    importFileLayer = () => {
        if(!this.state.file) {
            return;
        }
        let file = this.state.file;
        let reader = new FileReader();
        reader.onload = (ev) => {
            if(file.name.toLowerCase().endsWith(".kml")) {
                this.addKMLLayer(file.name, ev.target.result);
            } else if(file.name.toLowerCase().endsWith(".geojson") || file.name.toLowerCase().endsWith(".json")) {
                let data = {};
                try {
                    data = JSON.parse(ev.target.result);
                } catch(e) {}
                this.addGeoJSONLayer(file.name, data);
            }
            this.setState({file: null});
        }
        reader.readAsText(this.state.file);
    }
    addKMLLayer = (filename, data) => {
        this.addGeoJSONLayer(filename, {features: VectorLayerUtils.kmlToGeoJSON(data)});
    }
    addGeoJSONLayer = (filename, data) => {
        if(!isEmpty(data.features)) {
            let features = data.features.map(feature => ({...feature, crs: feature.crs || "EPSG:4326"}));
            this.props.addLayerFeatures({
                id: filename + Date.now(),
                name: filename,
                title: filename.replace(/\.[^/.]+$/, ""),
                role: LayerRole.USERLAYER,
                zoomToExtent: true
            }, features, true);
        } else {
            alert(LocaleUtils.getMessageById(this.context.messages, "importlayer.nofeatures"));
        }
    }
};

module.exports = connect((state) => ({
}), {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures
})(ImportLayer);
