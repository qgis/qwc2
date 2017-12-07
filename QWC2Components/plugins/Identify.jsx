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
const MapInfoUtils = require('../../MapStore2Components/utils/MapInfoUtils');
const Spinner = require('../../MapStore2Components/components/misc/spinners/BasicSpinner/BasicSpinner');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {getFeatureInfo, purgeMapInfoResults} = require('../../MapStore2Components/actions/mapInfo');
const {addMarker, removeMarker} = require('../actions/layers');
const ResizeableWindow = require("../components/ResizeableWindow");
const {IdentifyViewer} = require('../components/IdentifyViewer');

class Identify extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        format: PropTypes.string,
        maxItems: PropTypes.number,
        point: PropTypes.object,
        map: PropTypes.object,
        layers: PropTypes.array,
        requests: PropTypes.array,
        responses: PropTypes.array,
        purgeResults: PropTypes.func,
        buildRequest: PropTypes.func,
        sendRequest: PropTypes.func,
        addMarker: PropTypes.func,
        removeMarker: PropTypes.func,
        enableExport: PropTypes.bool,
        initialWidth: PropTypes.number,
        initialHeight: PropTypes.number
    }
    static defaultProps = {
        format: "text/xml",
        maxItems: 10,
        enableExport: true,
        initialWidth: 320,
        initialHeight: 400
    }
    queryFilter = (l) => {
        // All non-background WMS layers with a non-empty queryLayers list
        return l.type === 'wms' && l.group !== "background" && (l.queryLayers || []).length > 0
    }
    componentWillReceiveProps(newProps) {
        if (this.needsRefresh(newProps)) {
            if(newProps.point.modifiers.ctrl !== true) {
                this.props.purgeResults();
            }
            const queryableLayers = newProps.layers.filter(this.queryFilter);
            queryableLayers.forEach((layer) => {
                const {url, request, metadata} = MapInfoUtils.buildIdentifyRequest(layer, newProps);
                if (url) {
                    this.props.sendRequest(url, request, metadata, {});
                }
            });
            let latlng = newProps.point.latlng;
            this.props.addMarker('mapinfo', [latlng.lng, latlng.lat]);
        }
        if (!newProps.enabled && this.props.enabled) {
            this.onClose();
        }
    }
    needsRefresh = (props) => {
        if (props.enabled && props.point && props.point.pixel) {
            if (!this.props.point.pixel || this.props.point.pixel.x !== props.point.pixel.x ||
                    this.props.point.pixel.y !== props.point.pixel.y ) {
                return true;
            }
            if (!this.props.point.pixel || props.point.pixel && this.props.format !== props.format) {
                return true;
            }
        }
        return false;
    }
    onClose = () => {
        this.props.removeMarker('mapinfo');
        this.props.purgeResults();
    }
    renderHeader = (missing) => {
        return (
            <span role="header">
                { (missing !== 0 ) ? <Spinner value={missing} sSize="sp-small" /> : null }
                {this.props.headerGlyph ? <Glyphicon glyph={this.props.headerGlyph} /> : null}&nbsp;<Message msgId="identifyTitle" />
                <button onClick={this.onModalHiding} className="close">{this.props.closeGlyph ? <Glyphicon glyph={this.props.closeGlyph}/> : <span>×</span>}</button>
            </span>
        );
    }
    render() {
        if (!this.props.enabled || this.props.requests.length === 0) {
            return null;
        }
        let missingResponses = this.props.requests.length - this.props.responses.length;
        return (
            <ResizeableWindow title="identifyTitle" glyphicon="info-sign" onClose={this.onClose} initialWidth={this.props.initialWidth} initialHeight={this.props.initialHeight}>
                <IdentifyViewer role="body"
                    map={this.props.map}
                    missingResponses={missingResponses}
                    responses={this.props.responses}
                    enableExport={this.props.enableExport} />
            </ResizeableWindow>
        );
    }
};

const selector = (state) => ({
    enabled: state.mapInfo && state.mapInfo.enabled,
    responses: state.mapInfo && state.mapInfo.responses || [],
    requests: state.mapInfo && state.mapInfo.requests || [],
    map: state.map ? state.map : null,
    point: state.map && state.map.clickPoint || {},
    layers: state.layers && state.layers.flat || []
});

const IdentifyPlugin = connect(selector, {
    sendRequest: getFeatureInfo,
    purgeResults: purgeMapInfoResults,
    addMarker: addMarker,
    removeMarker: removeMarker
})(Identify);

module.exports = {
    IdentifyPlugin: IdentifyPlugin,
    reducers: {
        mapInfo: require('../../MapStore2Components/reducers/mapInfo')
    }
};
