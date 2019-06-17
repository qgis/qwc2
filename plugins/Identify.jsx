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
const IdentifyUtils = require('../utils/IdentifyUtils');
const Message = require('../components/I18N/Message');
const {sendIdentifyRequest, purgeIdentifyResults, identifyEmpty} = require('../actions/identify');
const {LayerRole, addMarker, removeMarker} = require('../actions/layers');
const ResizeableWindow = require("../components/ResizeableWindow");
const {IdentifyViewer} = require('../components/IdentifyViewer');

class Identify extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        point: PropTypes.object,
        map: PropTypes.object,
        layers: PropTypes.array,
        requests: PropTypes.array,
        responses: PropTypes.array,
        purgeResults: PropTypes.func,
        sendRequest: PropTypes.func,
        identifyEmpty: PropTypes.func,
        addMarker: PropTypes.func,
        removeMarker: PropTypes.func,
        exportFormat: PropTypes.string,
        longAttributesDisplay: PropTypes.string,
        displayResultTree: PropTypes.bool,
        initialWidth: PropTypes.number,
        initialHeight: PropTypes.number,
        params: PropTypes.object,
        attributeCalculator: PropTypes.func
    }
    static defaultProps = {
        exportFormat: "json",
        longAttributesDisplay: 'ellipsis',
        displayResultTree: true,
        initialWidth: 240,
        initialHeight: 320
    }
    componentWillReceiveProps(newProps) {
        if (this.needsRefresh(newProps)) {
            if(newProps.point.modifiers.ctrl !== true) {
                this.props.purgeResults();
            }
            const queryableLayers = newProps.layers.filter((l) => {
                // All non-background WMS layers with a non-empty queryLayers list
                return l.visibility && l.type === 'wms' && l.role !== LayerRole.BACKGROUND && (l.queryLayers || []).length > 0
            });
            queryableLayers.forEach((layer) => {
                this.props.sendRequest(IdentifyUtils.buildRequest(layer, layer.queryLayers.join(","), newProps.point.coordinate, newProps.map, newProps.params));
            });
            if(isEmpty(queryableLayers)) {
                this.props.identifyEmpty();
            }
            this.props.addMarker('identify', newProps.point.coordinate, '', newProps.map.projection);
        }
        if (!newProps.enabled && this.props.enabled) {
            this.onClose();
        }
    }
    needsRefresh = (props) => {
        if (props.enabled && props.point && props.point.button === 0 && props.point.pixel) {
            if (!this.props.point.pixel ||
                this.props.point.pixel[0] !== props.point.pixel[0] ||
                this.props.point.pixel[1] !== props.point.pixel[1] )
            {
                return true;
            }
        }
        return false;
    }
    onClose = () => {
        this.props.removeMarker('identify');
        this.props.purgeResults();
    }
    render() {
        if (this.props.requests.length === 0) {
            return null;
        }
        let missingResponses = this.props.requests.length - this.props.responses.length;
        return (
            <ResizeableWindow title="identify.title" icon="info-sign" onClose={this.onClose} initialX={0} initialY={0} initialWidth={this.props.initialWidth} initialHeight={this.props.initialHeight}>
                <IdentifyViewer role="body"
                    map={this.props.map}
                    missingResponses={missingResponses}
                    responses={this.props.responses}
                    exportFormat={this.props.exportFormat}
                    longAttributesDisplay={this.props.longAttributesDisplay}
                    displayResultTree={this.props.displayResultTree}
                    attributeCalculator={this.props.attributeCalculator} />
            </ResizeableWindow>
        );
    }
};

const selector = (state) => ({
    enabled: state.identify && state.identify.enabled,
    responses: state.identify && state.identify.responses || [],
    requests: state.identify && state.identify.requests || [],
    map: state.map ? state.map : null,
    point: state.map && state.map.clickPoint || {},
    layers: state.layers && state.layers.flat || []
});

const IdentifyPlugin = connect(selector, {
    sendRequest: sendIdentifyRequest,
    purgeResults: purgeIdentifyResults,
    identifyEmpty: identifyEmpty,
    addMarker: addMarker,
    removeMarker: removeMarker
})(Identify);

module.exports = {
    IdentifyPlugin: IdentifyPlugin,
    reducers: {
        identify: require('../reducers/identify')
    }
};
