/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {getFeatureInfo, getVectorInfo, purgeMapInfoResults, showMapinfoMarker, hideMapinfoMarker, showMapinfoRevGeocode, hideMapinfoRevGeocode} = require('../../MapStore2/web/client/actions/mapInfo');
const {changeMousePointer} = require('../../MapStore2/web/client/actions/map');
const {changeMapInfoFormat} = require('../../MapStore2/web/client/actions/mapInfo');

require('./style/Identify.css');

const GmlIdentifyViewer = React.createClass({
    propTypes: {
        format: React.PropTypes.string,
        missingResponses: React.PropTypes.number,
        requests: React.PropTypes.array,
        responses: React.PropTypes.array
    },
    getDefaultProps() {
        return {};
    },
    getInitialState: function() {
        return {expanded: {}};
    },
    getExpandedClass(path, deflt) {
        let expanded = this.state.expanded[path] !== undefined ? this.state.expanded[path] : deflt;
        return expanded ? "expandable expanded" : "expandable";
    },
    toggleExpanded(path, deflt) {
        let newstate = this.state.expanded[path] !== undefined ? !this.state.expanded[path] : !deflt;
        let diff = {};
        diff[path] = newstate;
        this.setState({expanded: assign({}, this.state.expanded, diff)});
    },
    renderFeature(feature, parentpath) {
        let path = parentpath + "/" + feature.attributes.fid.value;
        let attribs = [].slice.call(feature.children).filter(node => node.nodeName !== "gml:boundedBy");
        if(attribs.length === 0) {
            return null;
        }
        return (
            <li key={feature.attributes.fid.value} className={this.getExpandedClass(path, false)}>
                <span onClick={()=> this.toggleExpanded(path, false)}><Message msgId="identify.feature" /> <b>{feature.attributes.fid.value}</b></span>
                <ul>
                    {attribs.map(attrib => {
                        return (
                            <li>
                                <span className="identify-attr-title"><i>{attrib.nodeName.substr(attrib.nodeName.indexOf(':') + 1)}</i></span>
                                <span className="identify-attr-value">{attrib.textContent}</span>
                            </li>
                        );
                    })}
                </ul>
            </li>
        );
    },
    renderLayer(layer, features, parentpath) {
        let path = parentpath + "/" + layer;
        if(features.length === 0) {
            return null;
        }
        return (
            <li key={layer} className={this.getExpandedClass(path, false)}>
                <span onClick={()=> this.toggleExpanded(path, false)}><Message msgId="identify.layer" /> <b>{layer.substr(layer.indexOf(':') + 1)}</b></span>
                <ul>
                    {features.map(feature => this.renderFeature(feature, path))}
                </ul>
            </li>
        );
    },
    renderResponse(response) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(response.response, "text/xml");
        if(!doc) {
            return null;
        }
        let path = response.layerMetadata.title;
        let features = [].slice.call(doc.firstChild.getElementsByTagName("featureMember"));
        let layerFeatures = {};
        features.map((featureMember) => {
            let layer = featureMember.firstElementChild.nodeName;
            if(layerFeatures[layer] === undefined) {
                layerFeatures[layer] = [];
            }
            layerFeatures[layer].push(featureMember.firstElementChild);
        });

        let layersContents = Object.keys(layerFeatures).map(key => this.renderLayer(key, layerFeatures[key], path));
        if(layersContents.every(item => item == null)) {
            return null;
        }
        return (
            <ul key={response.layerMetadata.title}>
                <li className={this.getExpandedClass(path, true)}>
                    <span onClick={()=> this.toggleExpanded(path, true)}><Message msgId="identify.theme" /> <b>{response.layerMetadata.title}</b></span>
                    <ul>{layersContents}</ul>
                </li>
            </ul>
        );
    },
    render() {
        let responseContents = (this.props.responses || []).map(response => this.renderResponse(response));
        if(responseContents.every(item => item == null)) {
            if(this.props.requests && this.props.requests.length > 0) {
                responseContents = (<Message msgId="identify.querying" />);;
            } else {
                responseContents = (<Message msgId="noFeatureInfo" />);
            }
        }
        return (
            <div id="IdentifyViewer">{responseContents}</div>
        );
    }
});

const Identify = React.createClass({
    propTypes: {
        enabled: React.PropTypes.bool,
        responses: React.PropTypes.array,
        requests: React.PropTypes.array,
        format: React.PropTypes.string,
        map: React.PropTypes.object,
        layers: React.PropTypes.array,
        point: React.PropTypes.object,
        showModalReverse: React.PropTypes.bool,
        reverseGeocodeData: React.PropTypes.object,
        sendRequest: React.PropTypes.func,
        localRequest: React.PropTypes.func,
        purgeResults: React.PropTypes.func,
        changeMousePointer: React.PropTypes.func,
        showMarker: React.PropTypes.func,
        hideMarker: React.PropTypes.func,
        showRevGeocode: React.PropTypes.func,
        hideRevGeocode: React.PropTypes.func,
        panelClassName: React.PropTypes.string,
        headerClassName: React.PropTypes.string,
        closeGlyph: React.PropTypes.string
    },
    getDefaultProps() {
        return {
            enabled: true,
            format: 'application/vnd.ogc.gml',
            panelClassName: "identify-dialog",
            headerClassName: "identify-dialog-header",
            closeGlyph: "remove"
        }
    },
    render() {
        const Identify = require("../../MapStore2/web/client/components/data/identify/Identify.jsx");
        return (<Identify {...this.props} viewer={GmlIdentifyViewer} viewerOptions={{requests: this.props.requests}}/>);
    }
});

const selector = (state) => ({
    //enabled: state.mapInfo && state.mapInfo.enabled,
    responses: state.mapInfo && state.mapInfo.responses || [],
    requests: state.mapInfo && state.mapInfo.requests || [],
    format: state.mapInfo && state.mapInfo.infoFormat,
    map: state.map ? state.map.present : null,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    point: state.mapInfo && state.mapInfo.clickPoint,
    showModalReverse: state.mapInfo && state.mapInfo.showModalReverse,
    reverseGeocodeData: state.mapInfo && state.mapInfo.reverseGeocodeData
});

const IdentifyPlugin = connect(selector, {
    sendRequest: getFeatureInfo,
    localRequest: getVectorInfo,
    purgeResults: purgeMapInfoResults,
    changeMousePointer,
    showMarker: showMapinfoMarker,
    hideMarker: hideMapinfoMarker,
    showRevGeocode: showMapinfoRevGeocode,
    hideRevGeocode: hideMapinfoRevGeocode
})(Identify);
// configuration UI
// const FeatureInfoFormatSelector = connect((state) => ({
//     infoFormat: state.mapInfo && state.mapInfo.infoFormat
// }), {
//     onInfoFormatChange: changeMapInfoFormat
// })(require("../components/misc/FeatureInfoFormatSelector"));

module.exports = {
    IdentifyPlugin: IdentifyPlugin,
    reducers: {
        mapInfo: require('../../MapStore2/web/client/reducers/mapInfo')
    }
};
