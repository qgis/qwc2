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
import {v1 as uuidv1} from 'uuid';

import {LayerRole, addLayerFeatures, clearLayer} from '../actions/layers';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import MapSelection from './MapSelection';
import PopupMenu from './widgets/PopupMenu';
import Spinner from './widgets/Spinner';

import './style/PickFeature.css';


class PickFeature extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        clearLayer: PropTypes.func,
        /** Optional: Function which accepts a GeoJSON feature and returns whether it should be accepted (true) or discarded (false) */
        featureFilter: PropTypes.func,
        featurePicked: PropTypes.func,
        /** The style used for highlighting filter geometries. */
        highlightStyle: PropTypes.shape({
            /* Stroke color rgba array, i.e. [255, 0, 0, 0.5] */
            strokeColor: PropTypes.array,
            /* Stroke width */
            strokeWidth: PropTypes.number,
            /* Stroke dash/gap pattern array. Empty for solid line. */
            strokeDash: PropTypes.array,
            /* Fill color rgba array, i.e. [255, 0, 0, 0.33] */
            fillColor: PropTypes.array
        }),
        /** Optional: Restrict pick to specified layer name */
        layer: PropTypes.string,
        layers: PropTypes.array,
        map: PropTypes.object,
        /** Pick geometry type: Point, Polygon, ... (default: Point) */
        pickGeomType: PropTypes.string
    };
    static defaultProps = {
        pickGeomType: 'Point',
        highlightStyle: {
            strokeColor: [0, 0, 0],
            fillColor: [255, 255, 0, 0.25]
        }
    };
    static defaultState = {
        pickGeom: null,
        pickResults: null,
        clickPos: null,
        highlightedFeature: null,
        pendingQueries: 0,
        reqId: null
    };
    constructor(props) {
        super(props);
        this.state = PickFeature.defaultState;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.pickGeom && this.state.pickGeom !== prevState.pickGeom) {
            let queryLayers = [];
            if (this.props.layer) {
                queryLayers = [this.props.layers.find((l) => l.role === LayerRole.THEME && LayerUtils.searchSubLayer(l, 'name', this.props.layer))].filter(Boolean);
            } else {
                queryLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
            }
            if (!isEmpty(queryLayers)) {
                this.setState(state => {
                    const getPixelFromCoordinate = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK);
                    const coordinates = this.props.pickGeomType === "Point" ? [[state.pickGeom.coordinates]] : state.pickGeom.coordinates;
                    let maxX = coordinates[0][0][0];
                    let maxY = coordinates[0][0][1];
                    for (let i = 1; i < coordinates[0].length; ++i) {
                        if (coordinates[0][i][0] > maxX) {
                            maxX = coordinates[0][i][0];
                            maxY = coordinates[0][i][1];
                        }
                    }
                    const clickPos = getPixelFromCoordinate([maxX, maxY]);
                    const reqId = uuidv1();
                    queryLayers.forEach(layer => {
                        let request = null;
                        if (this.props.pickGeomType === 'Point') {
                            request = IdentifyUtils.buildRequest(layer, this.props.layer || layer.queryLayers.join(","), state.pickGeom.coordinates, this.props.map);
                        } else if (this.props.pickGeomType === 'Polygon') {
                            const filter = VectorLayerUtils.geoJSONGeomToWkt(this.state.pickGeom);
                            request = IdentifyUtils.buildFilterRequest(layer, this.props.layer || layer.queryLayers.join(","), filter, this.props.map);
                        } else {
                            return;
                        }
                        IdentifyUtils.sendRequest(request, (response) => this.handleIdentifyResponse(response, reqId, layer, request.params.info_format));
                    });
                    return {pickResults: {}, clickPos: clickPos, pendingQueries: queryLayers.length, reqId: reqId};
                });
            }
        }
    }
    handleIdentifyResponse = (response, reqId, layer, infoFormat) => {
        if (this.state.reqId !== reqId) {
            return;
        }
        const result = IdentifyUtils.parseResponse(response, layer, infoFormat, this.state.clickPos, this.props.map.projection, false);
        if (this.props.featureFilter) {
            Object.entries(result).forEach(([layername, features]) => {
                result[layername] = features.filter(this.props.featureFilter);
            });
        } else {
            Object.entries(result).forEach(([layername, features]) => {
                result[layername] = features.filter(feature => !!feature.geometry);
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
                    newState.pickResults = null;
                    newState.pickGeom = null;
                } else if (entries.reduce((sum, entry) => sum + entry[1].length, 0) === 0) {
                    newState.pickResults = null;
                    newState.pickGeom = null;
                }
            }
            return newState;
        });
    };
    render() {
        let resultsMenu = null;
        if (this.state.pickResults) {
            resultsMenu = (
                <PopupMenu
                    className="PickFeatureMenu"
                    key="PickResultMenu"
                    onClose={this.onClose}
                    x={this.state.clickPos[0]} y={this.state.clickPos[1]}
                >
                    {this.state.pendingQueries === 0 ? (
                        Object.entries(this.state.pickResults).map(([layername, features]) => features.map(feature => (
                            <div
                                key={layername + ":" + feature.id}
                                onClickCapture={() => this.props.featurePicked(layername, feature)}
                                onMouseOut={() => this.clearHighlight(layername, feature)}
                                onMouseOver={() => this.highlightFeature(layername, feature)}
                            >
                                {layername + ": " + feature.displayname}
                            </div>
                        )))
                    ) : (
                        <div className="pick-feature-menu-querying"><Spinner />{LocaleUtils.tr("pickfeature.querying")}</div>
                    )}
                </PopupMenu>
            );
        }
        return [resultsMenu, (
            <MapSelection
                active
                geomType={this.props.pickGeomType}
                geometry={this.state.pickGeom}
                geometryChanged={geom => this.setState({pickGeom: geom})}
                key="MapSelection"
                styleOptions={this.props.highlightStyle}
            />
        )];
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
