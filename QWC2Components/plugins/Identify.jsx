/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const MapInfoUtils = require('../../MapStore2/web/client/utils/MapInfoUtils');
const Spinner = require('../../MapStore2/web/client/components/misc/spinners/BasicSpinner/BasicSpinner');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {getFeatureInfo, purgeMapInfoResults, showMapinfoMarker, hideMapinfoMarker} = require('../../MapStore2/web/client/actions/mapInfo');
const ResizeableWindow = require("../components/ResizeableWindow");
const {IdentifyViewer} = require('../components/IdentifyViewer');

const Identify = React.createClass({
    propTypes: {
        enabled: React.PropTypes.bool,
        format: React.PropTypes.string,
        maxItems: React.PropTypes.number,
        point: React.PropTypes.object,
        map: React.PropTypes.object,
        layers: React.PropTypes.array,
        requests: React.PropTypes.array,
        responses: React.PropTypes.array,
        purgeResults: React.PropTypes.func,
        buildRequest: React.PropTypes.func,
        sendRequest: React.PropTypes.func,
        showMarker: React.PropTypes.func,
        hideMarker: React.PropTypes.func,
        enableExport: React.PropTypes.bool
    },
    getDefaultProps() {
        return {
            format: "text/xml",
            maxItems: 10,
            enableExport: true
        };
    },
    queryFilter(l) {
        // All non-background WMS layers with a non-empty queryLayers list
        return l.type === 'wms' && l.group !== "background" && (l.queryLayers || []).length > 0
    },
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
            this.props.showMarker();
        }
        if (!newProps.enabled && this.props.enabled) {
            this.props.hideMarker();
            this.props.purgeResults();
        }
    },
    onClose() {
        this.props.hideMarker();
        this.props.purgeResults();
    },
    renderHeader(missing) {
        return (
            <span role="header">
                { (missing !== 0 ) ? <Spinner value={missing} sSize="sp-small" /> : null }
                {this.props.headerGlyph ? <Glyphicon glyph={this.props.headerGlyph} /> : null}&nbsp;<Message msgId="identifyTitle" />
                <button onClick={this.onModalHiding} className="close">{this.props.closeGlyph ? <Glyphicon glyph={this.props.closeGlyph}/> : <span>×</span>}</button>
            </span>
        );
    },
    render() {
        if (!this.props.enabled || this.props.requests.length === 0) {
            return null;
        }
        let missingResponses = this.props.requests.length - this.props.responses.length;
        return (
            <ResizeableWindow title="identifyTitle" glyphicon="info-sign" onClose={this.onClose} initialWidth={320} initialHeight={400}>
                <IdentifyViewer role="body"
                    map={this.props.map}
                    missingResponses={missingResponses}
                    responses={this.props.responses}
                    enableExport={this.props.enableExport} />
            </ResizeableWindow>
        );
    },
    needsRefresh(props) {
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
});

const selector = (state) => ({
    enabled: state.mapInfo && state.mapInfo.enabled,
    responses: state.mapInfo && state.mapInfo.responses || [],
    requests: state.mapInfo && state.mapInfo.requests || [],
    map: state.map ? state.map.present : null,
    point: state.mapInfo && state.mapInfo.clickPoint || {},
    layers: state.layers && state.layers.flat || []
});

const IdentifyPlugin = connect(selector, {
    sendRequest: getFeatureInfo,
    purgeResults: purgeMapInfoResults,
    showMarker: showMapinfoMarker,
    hideMarker: hideMapinfoMarker
})(Identify);

module.exports = {
    IdentifyPlugin: IdentifyPlugin,
    reducers: {
        mapInfo: require('../../MapStore2/web/client/reducers/mapInfo')
    }
};
