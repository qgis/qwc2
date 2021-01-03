/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import {sendIdentifyRequest, setIdentifyFeatureResult, purgeIdentifyResults, identifyEmpty} from '../actions/identify';
import {LayerRole, addMarker, removeMarker, removeLayer} from '../actions/layers';
import IdentifyViewer from '../components/IdentifyViewer';
import TaskBar from '../components/TaskBar';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

class Identify extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        attributeCalculator: PropTypes.func,
        attributeTransform: PropTypes.func,
        click: PropTypes.object,
        displayResultTree: PropTypes.bool,
        enableExport: PropTypes.bool,
        enabled: PropTypes.bool,
        featureInfoReturnsLayerName: PropTypes.bool,
        identifyEmpty: PropTypes.func,
        initialHeight: PropTypes.number,
        initialWidth: PropTypes.number,
        initiallyDocked: PropTypes.bool,
        layers: PropTypes.array,
        longAttributesDisplay: PropTypes.string,
        map: PropTypes.object,
        params: PropTypes.object,
        purgeResults: PropTypes.func,
        removeLayer: PropTypes.func,
        removeMarker: PropTypes.func,
        requests: PropTypes.array,
        responses: PropTypes.array,
        sendRequest: PropTypes.func,
        setIdentifyFeatureResult: PropTypes.func
    }
    static defaultProps = {
        enableExport: true,
        longAttributesDisplay: 'ellipsis',
        displayResultTree: true,
        initialWidth: 240,
        initialHeight: 320,
        featureInfoReturnsLayerName: true
    }
    componentDidUpdate(prevProps, prevState) {
        const clickPoint = this.queryPoint(prevProps);
        if (clickPoint) {
            // Remove any search selection layer to avoid confusion
            this.props.removeLayer("searchselection");

            let queryableLayers = [];
            if (clickPoint) {
                queryableLayers = this.props.layers.filter((l) => {
                    // All non-background WMS layers with a non-empty queryLayers list
                    return l.visibility && l.type === 'wms' && l.role !== LayerRole.BACKGROUND && (l.queryLayers || []).length > 0;
                });
                const mapScale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
                queryableLayers.forEach((layer) => {
                    const layers = [];
                    const queryLayers = layer.queryLayers;
                    for (let i = 0; i < queryLayers.length; ++i) {
                        if (layer.externalLayerMap && layer.externalLayerMap[queryLayers[i]]) {
                            const sublayer = LayerUtils.searchSubLayer(layer, "name", queryLayers[i]);
                            const sublayerInvisible = (sublayer.minScale !== undefined && mapScale < sublayer.minScale) || (sublayer.maxScale !== undefined && mapScale > sublayer.maxScale);
                            if (!isEmpty(layer.externalLayerMap[queryLayers[i]].queryLayers) && !sublayerInvisible) {
                                layers.push(layer.externalLayerMap[queryLayers[i]]);
                            }
                        } else if (layers.length > 0 && layers[layers.length - 1].id === layer.id) {
                            layers[layers.length - 1].queryLayers.push(queryLayers[i]);
                        } else {
                            layers.push({...layer, queryLayers: [queryLayers[i]]});
                        }
                    }
                    layers.forEach(l => this.props.sendRequest(IdentifyUtils.buildRequest(l, l.queryLayers.join(","), clickPoint, this.props.map, this.props.params)));
                });
            }
            let queryFeature = null;
            if (this.props.click.feature) {
                const layer = this.props.layers.find(l => l.id === this.props.click.layer);
                if (layer && layer.role === LayerRole.USERLAYER && layer.type === "vector" && !isEmpty(layer.features)) {
                    queryFeature = layer.features.find(feature =>  feature.id === this.props.click.feature);
                    if (queryFeature && !isEmpty(queryFeature.properties)) {
                        this.props.setIdentifyFeatureResult(this.props.click.coordinate, layer.name, queryFeature);
                    }
                }
            }
            if (isEmpty(queryableLayers) && !queryFeature) {
                this.props.identifyEmpty();
            }
            this.props.addMarker('identify', clickPoint, '', this.props.map.projection);
        }
        if (!this.props.enabled && prevProps.enabled) {
            this.onClose();
        }
    }
    queryPoint = (prevProps) => {
        if (!this.props.enabled || this.props.click.button !== 0 || this.props.click === prevProps.click || this.props.click.feature === "startupposmarker") {
            return null;
        }
        if (this.props.click.modifiers.ctrl !== true) {
            this.props.purgeResults();
        }
        if (this.props.click.feature === 'searchmarker' && this.props.click.geometry) {
            return this.props.click.geometry;
        }
        return this.props.click.coordinate;
    }
    onClose = () => {
        this.props.removeMarker('identify');
        this.props.removeLayer("identifyslection");
        this.props.purgeResults();
    }
    render() {
        const missingResponses = this.props.requests.length - this.props.responses.length;
        return [this.props.requests.length === 0 ? null : (
            <IdentifyViewer attributeCalculator={this.props.attributeCalculator} attributeTransform={this.props.attributeTransform}
                displayResultTree={this.props.displayResultTree}
                enableExport={this.props.enableExport}
                featureInfoReturnsLayerName={this.props.featureInfoReturnsLayerName}
                initialHeight={this.props.initialHeight}
                initialWidth={this.props.initialWidth}
                initiallyDocked={this.props.initiallyDocked}
                key="IdentifyViewer"
                longAttributesDisplay={this.props.longAttributesDisplay}
                map={this.props.map}
                missingResponses={missingResponses}
                onClose={this.onClose}
                responses={this.props.responses} />
        ), (
            <TaskBar key="TaskBar" onHide={this.onClose} task="Identify">
                {() => ({
                    body: LocaleUtils.tr("infotool.clickhelpPoint")
                })}
            </TaskBar>
        )];
    }
}

const selector = (state) => ({
    enabled: state.task.id === "Identify" || state.identify.tool === "Identify",
    responses: state.identify.responses || [],
    requests: state.identify.requests || [],
    map: state.map,
    click: state.map.click || {},
    layers: state.layers.flat
});

export default connect(selector, {
    sendRequest: sendIdentifyRequest,
    setIdentifyFeatureResult: setIdentifyFeatureResult,
    purgeResults: purgeIdentifyResults,
    identifyEmpty: identifyEmpty,
    addMarker: addMarker,
    removeMarker: removeMarker,
    removeLayer: removeLayer
})(Identify);
