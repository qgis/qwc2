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
import ol from 'openlayers';
import pointInPolygon from 'point-in-polygon';
import polygonIntersectTest from 'polygon-intersect-test';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole, addLayerFeatures, clearLayer} from '../actions/layers';
import IdentifyUtils from '../utils/IdentifyUtils';
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
        layerFilter: PropTypes.shape({
            url: PropTypes.string,
            name: PropTypes.string
        }),
        /** Optional: Filter function to restrict pick layers */
        layerFilterFunc: PropTypes.func,
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
            let queryWmsLayers = [];
            let queryVectorLayers = [];
            if (this.props.layerFilter) {
                queryWmsLayers = [this.props.layers.find((l) => l.url === this.props.layerFilter.url)].filter(Boolean);
            } else {
                queryWmsLayers = IdentifyUtils.getQueryLayers(this.props.layers, this.props.map);
                queryVectorLayers = this.props.layers.filter(layer => {
                    return layer.visibility && LayerRole.USERLAYER && (layer.type === 'vector' || layer.type === 'wfs');
                });
            }
            if (this.props.layerFilterFunc) {
                queryWmsLayers = queryWmsLayers.filter(this.props.layerFilterFunc);
                queryVectorLayers = queryVectorLayers.filter(this.props.layerFilterFunc);
            }

            if (isEmpty(queryWmsLayers) && isEmpty(queryVectorLayers)) {
                return;
            }
            this.setState(state => {
                const coordinates = this.props.pickGeomType === "Point" ? [[state.pickGeom.coordinates]] : state.pickGeom.coordinates;
                let maxX = coordinates[0][0][0];
                let maxY = coordinates[0][0][1];
                for (let i = 1; i < coordinates[0].length; ++i) {
                    if (coordinates[0][i][0] > maxX) {
                        maxX = coordinates[0][i][0];
                        maxY = coordinates[0][i][1];
                    }
                }
                const reqId = uuidv4();
                const getPixelFromCoordinate = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK);
                const clickPos = getPixelFromCoordinate([maxX, maxY], false);
                if (!isEmpty(queryWmsLayers)) {
                    queryWmsLayers.forEach(layer => {
                        let request = null;
                        if (this.props.pickGeomType === 'Point') {
                            request = IdentifyUtils.buildRequest(layer, this.props.layerFilter?.name || layer.queryLayers.join(","), state.pickGeom.coordinates, this.props.map);
                        } else if (this.props.pickGeomType === 'Polygon') {
                            const filter = VectorLayerUtils.geoJSONGeomToWkt(this.state.pickGeom);
                            request = IdentifyUtils.buildFilterRequest(layer, this.props.layerFilter?.name || layer.queryLayers.join(","), filter, this.props.map);
                        } else {
                            return;
                        }
                        IdentifyUtils.sendRequest(request, (response) => this.handleIdentifyResponse(response, reqId, layer, request.params.info_format));
                    });
                }
                const pickResults = {};
                if (!isEmpty(queryVectorLayers)) {
                    const olMap = MapUtils.getHook(MapUtils.GET_MAP);
                    const layerMap = queryVectorLayers.reduce((res, layer) => ({...res, [layer.id]: layer}), {});
                    const format = new ol.format.GeoJSON();
                    if (this.props.pickGeomType === 'Point') {
                        olMap.forEachFeatureAtPixel(clickPos, (feature, layer) => {
                            const layerid = layer?.get?.('id');
                            if (layerid in layerMap) {
                                const featureObj = format.writeFeatureObject(feature);
                                const layername = layerMap[layerid].name;
                                pickResults[layername] = pickResults[layername] || [];
                                pickResults[layername].push(featureObj);
                            }
                        });
                    } else if (this.props.pickGeomType === 'Polygon') {
                        const extent = ol.extent.boundingExtent(coordinates[0]);
                        olMap.getLayers().forEach(layer => {
                            if (!(layer.get('id') in layerMap)) {
                                return;
                            }
                            layer.getSource().forEachFeatureIntersectingExtent(extent, (feature) => {
                                let intersects = false;
                                if (feature.getGeometry().getType() === "Point") {
                                    intersects = pointInPolygon(feature.getGeometry().getCoordinates(), coordinates[0]);
                                } else if (feature.getGeometry().getType() === "LineString") {
                                    intersects = true; // TODO
                                } else if (feature.getGeometry().getType() === "Polygon") {
                                    intersects = polygonIntersectTest(feature.getGeometry().getCoordinates()[0], coordinates[0]);
                                }
                                if (!intersects) {
                                    return;
                                }
                                const featureObj = format.writeFeatureObject(feature);
                                const layername = layerMap[layer.get('id')].name;
                                pickResults[layername] = pickResults[layername] || [];
                                pickResults[layername].push(featureObj);
                            });
                        });
                    }
                }
                return {pickResults: pickResults, clickPos: clickPos, pendingQueries: queryWmsLayers.length, reqId: reqId};
            });
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
                                {layername + ": " + (feature.displayname ?? feature.id)}
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
