/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, addLayerFeatures, clearLayer} from '../actions/layers';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import PopupMenu from './PopupMenu';

import './style/PickFeature.css';


class PickFeature extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        clearLayer: PropTypes.func,
        /** Optional: Function which accepts a GeoJSON feature and returns whether it should be accepted (true) or discarded (false) */
        featureFilter: PropTypes.func,
        featurePicked: PropTypes.func,
        /** Optional: Restrict pick to specified layer name */
        layer: PropTypes.string,
        layers: PropTypes.array,
        map: PropTypes.object
    };
    static defaultState = {
        pickResults: null,
        clickPos: null,
        highlightedFeature: null,
        pendingQueries: 0
    };
    constructor(props) {
        super(props);
        this.state = PickFeature.defaultState;
    }
    componentDidUpdate(prevProps) {
        if (this.props.map.click) {
            const clickPoint = this.queryPoint(prevProps);
            let queryLayers = [];
            if (this.props.layer) {
                queryLayers = [this.props.layers.find((l) => l.role === LayerRole.THEME && LayerUtils.searchSubLayer(l, 'name', this.props.layer))].filter(Boolean);
            } else {
                queryLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
            }
            if (clickPoint && !isEmpty(queryLayers)) {
                const clickPos = this.props.map.click.pixel;
                this.setState({pickResults: {}, clickPos: clickPos, pendingQueries: queryLayers.length});
                queryLayers.forEach(layer => {
                    const request = IdentifyUtils.buildRequest(layer, this.props.layer || layer.queryLayers.join(","), clickPoint, this.props.map);
                    IdentifyUtils.sendRequest(request, (response) => {
                        const result = IdentifyUtils.parseResponse(response, layer, request.params.info_format, clickPoint, this.props.map.projection, false, this.props.layers);
                        if (this.props.featureFilter) {
                            Object.entries(result).forEach(([layername, features]) => {
                                result[layername] = features.filter(this.props.featureFilter);
                            });
                        }
                        this.setState((state) => {
                            const newState = {
                                pickResults: {
                                    ...state.pickResults,
                                    ...result
                                },
                                pendingQueries: state.pendingQueries - 1
                            };
                            if (newState.pendingQueries === 0) {
                                const entries = Object.entries(newState.pickResults);
                                if (entries.length === 1 && entries[0][1].length === 1) {
                                    this.props.featurePicked(entries[0][0], entries[0][1][0]);
                                }
                            }
                            return newState;
                        });
                    });
                });
            }
        }
    }

    queryPoint = (prevProps) => {
        if (this.props.map.click.button !== 0 || this.props.map.click === prevProps.map.click) {
            return null;
        }
        return this.props.map.click.coordinate;
    };
    render() {
        if (!this.state.pickResults || this.state.pendingQueries > 0) {
            return null;
        }
        return (
            <PopupMenu
                className="PickFeatureMenu"
                onClose={this.onClose}
                x={this.state.clickPos[0]} y={this.state.clickPos[1]}
            >
                {Object.entries(this.state.pickResults).map(([key, features]) => features.map(feature => (
                    <div
                        key={key + ":" + feature.id}
                        onClickCapture={() => this.props.featurePicked(key, feature)}
                        onMouseOut={() => this.clearHighlight(key, feature)}
                        onMouseOver={() => this.highlightFeature(key, feature)}
                    >
                        {feature.displayname}
                    </div>
                )))}
            </PopupMenu>
        );
    }
    highlightFeature = (key, feature) => {
        const layer = {
            id: "pick-feature-selection",
            role: LayerRole.SELECTION
        };
        this.props.addLayerFeatures(layer, [feature], true);
        this.setState({highlightedFeature: key + ":" + feature.id});
    };
    clearHighlight = (key, feature) => {
        if (this.state.highlightedFeature === key + ":" + feature.id) {
            this.setState({highlightFeature: null});
            this.props.clearLayer("pick-feature-selection");
        }
    };
    onClose = () => {
        this.setState(PickFeature.defaultState);
        this.props.clearLayer("pick-feature-selection");
    };
}

export default connect((state) => ({
    layers: state.layers.flat,
    map: state.map
}), {
    addLayerFeatures: addLayerFeatures,
    clearLayer: clearLayer
})(PickFeature);
