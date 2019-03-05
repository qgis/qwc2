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
const LocaleUtils = require('../utils/LocaleUtils');
const ProxyUtils = require('../utils/ProxyUtils');
const {LayerRole,addLayer,addLayerFeatures} = require('../actions/layers');
const FileSelector = require('./widgets/FileSelector');
const ServiceLayerUtils = require('../utils/ServiceLayerUtils');
const VectorLayerUtils = require('../utils/VectorLayerUtils');
const Icon = require('./Icon');
require('./style/ImportLayer.css');

class ImportLayer extends React.Component {
    static propTypes = {
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
        if(this.state.type === "Local") {
            return (<FileSelector file={this.state.file} accept=".kml" onFileSelected={this.onFileSelected} />);
        } else {
            return (
                <input readOnly={this.state.pendingRequests > 0} type="text"
                    placeholder={placeholder} value={this.state.url}
                    onChange={ev => this.setState({url: ev.target.value.trim()})}
                    onKeyPress={ev => { if(!ev.target.readOnly && ev.key === 'Enter') { this.scanService(); }}}/>
            );
        }
    }
    renderServiceLayerListEntry(entry, filter, path, level = 0, idx) {
        let hasSublayers = !isEmpty(entry.sublayers);
        let sublayers = hasSublayers ? entry.sublayers.map((sublayer,idx) => this.renderServiceLayerListEntry(sublayer, filter, [...path, idx], level + 1, idx)) : [];
        if(sublayers.filter(item => item).length == 0 && filter && !removeDiacritics(entry.title).match(filter)) {
            return null;
        }
        return (
            <div key={entry.type + ":" + entry.name + ":" + idx} style={{paddingLeft: level + 'em'}}>
                <div className="importlayer-list-entry">
                    {hasSublayers ? (<Icon onClick={ev => this.toggleLayerListEntry(path)} icon={entry.expanded ? 'tree_minus' : 'tree_plus'} />) : null}
                    <span onClick={ev => this.addServiceLayer(entry)}>
                        <span className="importlayer-list-entry-service">{entry.type}</span>
                        {entry.title}
                    </span>
                </div>
                <div style={{display: entry.expanded ? 'block' : 'none'}}>
                {sublayers}
                </div>
            </div>
        );
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
            let filter = new RegExp(removeDiacritics(this.state.filter).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "i");
            let emptyEntry = null;
            if(isEmpty(this.state.serviceLayers) && this.state.pendingRequests == 0) {
                emptyEntry = (
                        <div className="layertree-item-noresults"><Message msgId="importlayer.noresults" /></div>
                );
            }
            layerList = [
                (<input key="importlayer-list-filter" className="importlayer-list-filter" type="text" value={this.state.filter} placeholder={filterplaceholder} onChange={ev => this.setState({filter: ev.target.value})}/>),
                (<div key="importlayer-list" className="importlayer-list">
                    {this.state.serviceLayers.map((entry, idx) => this.renderServiceLayerListEntry(entry, filter, [idx], 0, idx))}
                    {emptyEntry}
                </div>)
            ];
        }
        return (
            <div id="ImportLayer">
                <div className="importlayer-input-fields">
                    <select disabled={this.state.pendingRequests > 0} value={this.state.type} onChange={ev => this.setState({type: ev.target.value, file: null, url: "", serviceLayers: null, filter: ""})}>
                        <option value="URL">URL</option>
                        <option value="Local">Local file</option>
                    </select>
                    {this.renderInputField()}
                </div>
                {button}
                {layerList}
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
    onFileSelected = (file) => {
        this.setState({file});
    }
    scanService = () => {
        if(!this.state.url) {
            return;
        }
        let url = this.state.url;
        if(!url.match(/^[^:]+:\/\/.*$/)) {
            url = location.protocol + "//" + url;
        }
        let pendingRequests = 0;
        this.setState({pendingRequests: pendingRequests, serviceLayers: null, filter: ""});
        // Attempt to load as KML
        if(url.toLowerCase().endsWith(".kml")) {
            this.setState({pendingRequests: ++pendingRequests});
            axios.get(ProxyUtils.addProxyIfNeeded(url)).then(response => {
                let basename = url.split('/').pop()
                this.setState({pendingRequests: this.state.pendingRequests - 1, serviceLayers: [{
                    type: "kml",
                    name: basename,
                    title: basename,
                    data: response.data
                }]});
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
            this.setState({
                pendingRequests: this.state.pendingRequests - 1,
                serviceLayers: (this.state.serviceLayers || [])
            });
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
            this.setState({
                pendingRequests: this.state.pendingRequests - 1,
                serviceLayers: (this.state.serviceLayers || [])
            });
        });
    }
    importFileLayer = () => {
        if(!this.state.file) {
            return;
        }
        let file = this.state.file;
        let reader = new FileReader();
        reader.onload = (ev) => {
            this.addKMLLayer(file.name, ev.target.result);
            this.setState({file: null});
        }
        reader.readAsText(this.state.file);
    }
    addKMLLayer = (filename, data) => {
        let features = VectorLayerUtils.kmlToGeoJSON(data);
        if(!isEmpty(features)) {
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
    addServiceLayer = (entry) => {
        if(entry.type === "wms" || entry.type === "wfs") {
            this.props.addLayer(assign({
                id: entry.name + Date.now().toString(),
                role: LayerRole.USERLAYER
            }, entry, {sublayers: null}));
        } else if(entry.type === "kml") {
            this.addKMLLayer(entry.name, entry.data);
        }
    }
};

module.exports = connect((state) => ({
}), {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures
})(ImportLayer);
