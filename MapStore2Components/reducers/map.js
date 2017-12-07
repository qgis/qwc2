/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {CHANGE_MAP_VIEW, CHANGE_MOUSE_POINTER,
    CHANGE_ZOOM_LVL, CHANGE_MAP_CRS, CHANGE_MAP_SCALES, ZOOM_TO_EXTENT, ZOOM_TO_POINT,
    PAN_TO, CHANGE_MAP_STYLE, CHANGE_ROTATION, CLICK_ON_MAP} = require('../actions/map');

const assign = require('object-assign');
const MapUtils = require('../utils/MapUtils');
const CoordinatesUtils = require('../utils/CoordinatesUtils');

function mapConfig(state = {}, action) {
    switch (action.type) {
        case CHANGE_MAP_VIEW:
            const {type, ...params} = action;
            return assign({}, state, params);
        case CHANGE_MOUSE_POINTER:
            return assign({}, state, {
                mousePointer: action.pointer
            });
        case CHANGE_ZOOM_LVL:
            return assign({}, state, {
                zoom: action.zoom,
                mapStateSource: action.mapStateSource
            });
        case CHANGE_MAP_CRS:
            let newBounds = CoordinatesUtils.reprojectBbox(state.bbox.bounds, state.projection, action.crs);

            return assign({}, state, {
                center: CoordinatesUtils.reproject(state.center, state.projection, action.crs),
                bbox: assign({}, state.bbox, {bounds: {minx: newBounds[0], miny: newBounds[1], maxx: newBounds[2], maxy: newBounds[3]}}),
                projection: action.crs
            });
        case CHANGE_MAP_SCALES:
            if (action.scales) {
                const dpi = state.mapOptions && state.mapOptions.view && state.mapOptions.view.DPI || null;
                const resolutions = MapUtils.getResolutionsForScales(action.scales, state.projection || "EPSG:4326", dpi);
                // add or update mapOptions.view.resolutions
                let mapOptions = assign({}, state.mapOptions);
                mapOptions.view = assign({}, mapOptions.view, {
                    resolutions: resolutions,
                    scales: action.scales
                });
                return assign({}, state, {
                    mapOptions: mapOptions
                });
            } else if (state.mapOptions && state.mapOptions.view && state.mapOptions.view && state.mapOptions.view.resolutions) {
                // deeper clone
                let newState = assign({}, state);
                newState.mapOptions = assign({}, newState.mapOptions);
                newState.mapOptions.view = assign({}, newState.mapOptions.view);
                // remove resolutions
                delete newState.mapOptions.view.resolutions;
                // cleanup state
                if (Object.keys(newState.mapOptions.view).length === 0) {
                    delete newState.mapOptions.view;
                }
                if (Object.keys(newState.mapOptions).length === 0) {
                    delete newState.mapOptions;
                }
                return newState;
            }
            return state;
        case ZOOM_TO_EXTENT: {
            let zoom = 0;
            let newBounds = CoordinatesUtils.reprojectBbox(action.extent, action.crs || state.projection, state.projection);
            let newCenter = {x: 0.5 * (newBounds[0] + newBounds[2]), y: 0.5 * (newBounds[1] + newBounds[3])};
            let newZoom = MapUtils.getZoomForExtent(newBounds, state.size, 0, 21, null);
            let newBBox = assign({}, state.bbox, {bounds: newBounds});
            return assign({}, state, {
                center: newCenter,
                zoom: newZoom,
                bbox: newBBox,
                mapStateSource: action.mapStateSource
            });
        }
        case ZOOM_TO_POINT: {
            return assign({}, state, {
                center: CoordinatesUtils.reproject(action.pos, action.crs || state.projection, state.projection),
                zoom: action.zoom,
                mapStateSource: null
            });
        }
        case PAN_TO: {
            return assign({}, state, {
                center: CoordinatesUtils.reproject(action.pos, action.crs || state.projection, state.projection),
            });
        }
        case CHANGE_MAP_STYLE: {
            return assign({}, state, {mapStateSource: action.mapStateSource, style: action.style, resize: state.resize ? state.resize + 1 : 1});
        }
        case CHANGE_ROTATION: {
            let newBbox = assign({}, state.bbox, {rotation: action.rotation});
            return assign({}, state, {bbox: newBbox, mapStateSource: action.mapStateSource});
        }
        case CLICK_ON_MAP: {
            return assign({}, state, {
                clickPoint: action.point
            });
        }
        default:
            return state;
    }
}

module.exports = mapConfig;
