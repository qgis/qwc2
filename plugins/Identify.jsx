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
const assign = require('object-assign');
const isEmpty = require('lodash.isempty');
const IdentifyUtils = require('../utils/IdentifyUtils');
const Message = require('../components/I18N/Message');
const {TaskBar} = require('../components/TaskBar');
const {sendIdentifyRequest, purgeIdentifyResults, identifyEmpty} = require('../actions/identify');
const {LayerRole, addMarker, removeMarker, removeLayer} = require('../actions/layers');
const {IdentifyViewer} = require('../components/IdentifyViewer');

class Identify extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        point: PropTypes.object,
        clickFeature: PropTypes.object,
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
        attributeCalculator: PropTypes.func,
        featureInfoReturnsLayerName: PropTypes.bool,
        removeLayer: PropTypes.func
    }
    static defaultProps = {
        exportFormat: "json",
        longAttributesDisplay: 'ellipsis',
        displayResultTree: true,
        initialWidth: 240,
        initialHeight: 320,
        featureInfoReturnsLayerName: true
    }
    componentWillReceiveProps(newProps) {
        let point = this.queryPoint(newProps);
        if (point) {
            // Remove any search selection layer to avoid confusion
            this.props.removeLayer("searchselection");

            const queryableLayers = newProps.layers.filter((l) => {
                // All non-background WMS layers with a non-empty queryLayers list
                return l.visibility && l.type === 'wms' && l.role !== LayerRole.BACKGROUND && (l.queryLayers || []).length > 0
            });
            queryableLayers.forEach((layer) => {
                let layers = [];
                let queryLayers = layer.queryLayers;
                for(let i = 0; i < queryLayers.length; ++i) {
                    if(layer.externalLayers[queryLayers[i]]) {
                        layers.push(layer.externalLayers[queryLayers[i]]);
                    } else if(layers.length > 0 && layers[layers.length - 1].url === layer.url) {
                        layers[layers.length - 1].queryLayers.push(queryLayers[i]);
                    } else {
                        layers.push(assign({}, layer, {queryLayers: [queryLayers[i]]}));
                    }
                }
                layers.forEach(l => this.props.sendRequest(IdentifyUtils.buildRequest(l, l.queryLayers.join(","), point, newProps.map, newProps.params)));
            });
            if(isEmpty(queryableLayers)) {
                this.props.identifyEmpty();
            }
            this.props.addMarker('identify', point, '', newProps.map.projection);
        }
        if (!newProps.enabled && this.props.enabled) {
            this.onClose();
        }
    }
    queryPoint = (props) => {
        if (props.enabled && props.clickFeature && props.clickFeature.feature === 'searchmarker' && props.clickFeature.geometry) {
            if (this.props.clickFeature !== props.clickFeature)
            {
                return props.clickFeature.geometry;
            }
        }

        if (props.enabled && props.point && props.point.button === 0 && props.point.coordinate) {
            if (!this.props.point.coordinate ||
                this.props.point.coordinate[0] !== props.point.coordinate[0] ||
                this.props.point.coordinate[1] !== props.point.coordinate[1] )
            {
                if(props.point.modifiers.ctrl !== true) {
                    this.props.purgeResults();
                }
                return props.point.coordinate;
            }
        }
        return null;
    }
    onClose = () => {
        this.props.removeMarker('identify');
        this.props.purgeResults();
    }
    render() {
        let missingResponses = this.props.requests.length - this.props.responses.length;
        return [this.props.requests.length === 0 ? null : (
            <IdentifyViewer key="IdentifyViewer" onClose={this.onClose}
                map={this.props.map}
                missingResponses={missingResponses}
                responses={this.props.responses}
                exportFormat={this.props.exportFormat}
                longAttributesDisplay={this.props.longAttributesDisplay}
                displayResultTree={this.props.displayResultTree}
                attributeCalculator={this.props.attributeCalculator}
                initialWidth={this.props.initialWidth}
                initialHeight={this.props.initialHeight}
                featureInfoReturnsLayerName={this.props.featureInfoReturnsLayerName} />
        ), (
            <TaskBar key="TaskBar" task="Identify" onHide={this.onClose}>
                {() => ({
                    body: (<Message msgId={"infotool.clickhelpPoint"} />)
                })}
            </TaskBar>
        )];
    }
};

const selector = (state) => ({
    enabled: state.task.id === "Identify" || state.identify.tool === "Identify",
    responses: state.identify && state.identify.responses || [],
    requests: state.identify && state.identify.requests || [],
    map: state.map ? state.map : null,
    point: state.map && state.map.clickPoint || {},
    clickFeature: state.map.clickFeature || {},
    layers: state.layers && state.layers.flat || []
});

const IdentifyPlugin = connect(selector, {
    sendRequest: sendIdentifyRequest,
    purgeResults: purgeIdentifyResults,
    identifyEmpty: identifyEmpty,
    addMarker: addMarker,
    removeMarker: removeMarker,
    removeLayer: removeLayer
})(Identify);

module.exports = {
    IdentifyPlugin: IdentifyPlugin,
    reducers: {
        identify: require('../reducers/identify')
    }
};
