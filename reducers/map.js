/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {
    CHANGE_MAP_VIEW, CONFIGURE_MAP, CHANGE_ZOOM_LVL, ZOOM_TO_EXTENT,
    ZOOM_TO_POINT, PAN_TO, CHANGE_ROTATION, CLICK_ON_MAP, TOGGLE_MAPTIPS
} = require('../actions/map');

const assign = require('object-assign');
const MapUtils = require('../utils/MapUtils');
const {UrlParams} = require("../utils/PermaLinkUtils");
const ConfigUtils = require('../utils/ConfigUtils');
const CoordinatesUtils = require('../utils/CoordinatesUtils');

const defaultState = {
    bbox: {bounds: [0, 0, 0, 0], rotation: 0},
    center: [0, 0],
    projection: "EPSG:4326",
    zoom: 0,
    scales: [0],
    resolutions: [0]
};

function map(state = defaultState, action) {
    // Always reset mapStateSource, CHANGE_MAP_VIEW will set it if necessary
    if(state.mapStateSource) {
        state = assign({}, state, {mapStateSource: null});
    }

    switch (action.type) {
        case CHANGE_MAP_VIEW: {
            const {type, ...params} = action;
            let newState = assign({}, state, params);

            let positionFormat = ConfigUtils.getConfigProp("urlPositionFormat");
            let positionCrs = ConfigUtils.getConfigProp("urlPositionCrs") || newState.projection;
            let bounds = CoordinatesUtils.reprojectBbox(newState.bbox.bounds, newState.projection, positionCrs);
            let roundfactor = CoordinatesUtils.getUnits(positionCrs) === 'degrees' ? 100000. : 1;
            if(positionFormat === "centerAndZoom") {
                let x = Math.round(0.5 * (bounds[0] + bounds[2]) * roundfactor) / roundfactor;
                let y = Math.round(0.5 * (bounds[1] + bounds[3]) * roundfactor) / roundfactor;
                let scale = Math.round(MapUtils.computeForZoom(newState.scales, newState.zoom));
                UrlParams.updateParams({c: x + "," + y, s: scale});
            } else {
                let xmin = Math.round(bounds[0] * roundfactor) / roundfactor;
                let ymin = Math.round(bounds[1] * roundfactor) / roundfactor;
                let xmax = Math.round(bounds[2] * roundfactor) / roundfactor;
                let ymax = Math.round(bounds[3] * roundfactor) / roundfactor;
                UrlParams.updateParams({e: xmin + "," + ymin + "," + xmax + "," + ymax});
            }
            if(positionCrs !== newState.projection) {
                UrlParams.updateParams({crs: positionCrs});
            }

            return newState;
        }
        case CONFIGURE_MAP: {
            let resolutions = MapUtils.getResolutionsForScales(action.scales, action.crs, state.dpi || null);
            let bounds, center, zoom;
            if(action.view.center) {
                center = CoordinatesUtils.reproject(action.view.center, action.view.crs || action.crs, action.crs);
                zoom = action.view.zoom;
                bounds = MapUtils.getExtentForCenterAndZoom(center, zoom, resolutions, state.size);
            } else {
                bounds = CoordinatesUtils.reprojectBbox(action.view.bounds, action.view.crs || state.projection, action.crs);
                center = [0.5 * (bounds[0] + bounds[2]), 0.5 * (bounds[1] + bounds[3])];
                zoom = MapUtils.getZoomForExtent(bounds, resolutions, state.size, 0, action.scales.length - 1);
            }
            return assign({}, state, {
                bbox: assign({}, state.bbox, {bounds: bounds}),
                center: center,
                zoom: zoom,
                projection: action.crs,
                scales: action.scales,
                resolutions: resolutions
            });
        }
        case CHANGE_ZOOM_LVL: {
            return assign({}, state, {zoom: action.zoom});
        }
        case ZOOM_TO_EXTENT: {
            let bounds = CoordinatesUtils.reprojectBbox(action.extent, action.crs || state.projection, state.projection);
            return assign({}, state, {
                center: [0.5 * (bounds[0] + bounds[2]), 0.5 * (bounds[1] + bounds[3])],
                zoom: MapUtils.getZoomForExtent(bounds, state.resolutions, state.size, 0, state.scales.length - 1),
                bbox: assign({}, state.bbox, {bounds: bounds})
            });
        }
        case ZOOM_TO_POINT: {
            return assign({}, state, {
                center: CoordinatesUtils.reproject(action.pos, action.crs || state.projection, state.projection),
                zoom: action.zoom
            });
        }
        case PAN_TO: {
            return assign({}, state, {
                center: CoordinatesUtils.reproject(action.pos, action.crs || state.projection, state.projection)
            });
        }
        case CHANGE_ROTATION: {
            return assign({}, state, {
                bbox: assign({}, state.bbox, {rotation: action.rotation})
            });
        }
        case CLICK_ON_MAP: {
            return assign({}, state, {clickPoint: action.point});
        }
        case TOGGLE_MAPTIPS: {
            return assign({}, state, {maptips: action.active});
        }
        default:
            return state;
    }
}

module.exports = map;
