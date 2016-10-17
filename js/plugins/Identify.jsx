/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const {connect} = require('react-redux');
const {getFeatureInfo, getVectorInfo, purgeMapInfoResults, showMapinfoMarker, hideMapinfoMarker, showMapinfoRevGeocode, hideMapinfoRevGeocode} = require('../../MapStore2/web/client/actions/mapInfo');
const {changeMousePointer} = require('../../MapStore2/web/client/actions/map');
const {changeMapInfoFormat} = require('../../MapStore2/web/client/actions/mapInfo');
const {GmlIdentifyViewer} = require('../components/GmlIdentifyViewer');

require('./style/Identify.css');

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
            enabled: false,
            format: 'application/vnd.ogc.gml',
            panelClassName: "identify-dialog",
            headerClassName: "identify-dialog-header",
            closeGlyph: "remove"
        }
    },
    render() {
        const Identify = require("../../MapStore2/web/client/components/data/identify/Identify.jsx");
        return (<Identify {...this.props} viewer={GmlIdentifyViewer} viewerOptions={{map: this.props.map}} />);
    }
});

const selector = (state) => ({
    //enabled: state.mapInfo && state.mapInfo.enabled,
    enabled: !state.measurement || (!state.measurement.lineMeasureEnabled && !state.measurement.areaMeasureEnabled && !state.measurement.bearingMeasureEnabled),
    responses: state.mapInfo && state.mapInfo.responses || [],
    requests: state.mapInfo && state.mapInfo.requests || [],
    format: state.mapInfo && state.mapInfo.infoFormat,
    map: state.map ? state.map.present : null,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    point: state.mapInfo && state.mapInfo.clickPoint,
    showModalReverse: state.mapInfo && state.mapInfo.showModalReverse,
    reverseGeocodeData: state.mapInfo && state.mapInfo.reverseGeocodeData,
    layers: state.layers && state.layers.flat || []
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

module.exports = {
    IdentifyPlugin: IdentifyPlugin,
    reducers: {
        mapInfo: require('../../MapStore2/web/client/reducers/mapInfo')
    }
};
