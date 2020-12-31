/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    CHANGE_MAP_VIEW, CONFIGURE_MAP, CHANGE_ZOOM_LVL, ZOOM_TO_EXTENT, ZOOM_TO_POINT,
    PAN_TO, CHANGE_ROTATION, CLICK_ON_MAP, CLICK_FEATURE_ON_MAP, TOGGLE_MAPTIPS,
    SET_TOPBAR_HEIGHT
} from '../actions/map';
import assign from 'object-assign';
import isEmpty from 'lodash.isempty';
import MapUtils from '../utils/MapUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';

const defaultState = {
    bbox: {bounds: [0, 0, 0, 0], rotation: 0},
    center: [0, 0],
    projection: "EPSG:4326",
    zoom: 0,
    scales: [0],
    resolutions: [0],
    topbarHeight: 0
};

export default function map(state = defaultState, action) {
    // Always reset mapStateSource, CHANGE_MAP_VIEW will set it if necessary
    if (state.mapStateSource) {
        state = assign({}, state, {mapStateSource: null});
    }

    switch (action.type) {
    case CHANGE_MAP_VIEW: {
        const {type, ...params} = action;
        const newState = assign({}, state, params);

        const newParams = {};
        const positionFormat = ConfigUtils.getConfigProp("urlPositionFormat");
        const positionCrs = ConfigUtils.getConfigProp("urlPositionCrs") || newState.projection;
        const bounds = CoordinatesUtils.reprojectBbox(newState.bbox.bounds, newState.projection, positionCrs);
        const roundfactor = CoordinatesUtils.getUnits(positionCrs) === 'degrees' ? 100000 : 1;
        if (positionFormat === "centerAndZoom") {
            const x = Math.round(0.5 * (bounds[0] + bounds[2]) * roundfactor) / roundfactor;
            const y = Math.round(0.5 * (bounds[1] + bounds[3]) * roundfactor) / roundfactor;
            const scale = Math.round(MapUtils.computeForZoom(newState.scales, newState.zoom));
            assign(newParams, {c: x + "," + y, s: scale});
        } else {
            const xmin = Math.round(bounds[0] * roundfactor) / roundfactor;
            const ymin = Math.round(bounds[1] * roundfactor) / roundfactor;
            const xmax = Math.round(bounds[2] * roundfactor) / roundfactor;
            const ymax = Math.round(bounds[3] * roundfactor) / roundfactor;
            assign(newParams, {e: xmin + "," + ymin + "," + xmax + "," + ymax});
        }
        if (positionCrs !== newState.projection) {
            assign(newParams, {crs: positionCrs});
        }
        if (!isEmpty(newParams)) {
            UrlParams.updateParams(newParams);
        }

        return newState;
    }
    case CONFIGURE_MAP: {
        const resolutions = MapUtils.getResolutionsForScales(action.scales, action.crs, state.dpi || null);
        let bounds;
        let center;
        let zoom;
        if (action.view.center) {
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
        const bounds = CoordinatesUtils.reprojectBbox(action.extent, action.crs || state.projection, state.projection);
        const padding = (state.topbarHeight + 10) / state.size.height;
        const width = bounds[2] - bounds[0];
        const height = bounds[3] - bounds[1];
        bounds[0] -= padding * width;
        bounds[2] += padding * width;
        bounds[1] -= padding * height;
        bounds[3] += padding * height;
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
    case CLICK_FEATURE_ON_MAP: {
        return assign({}, state, {clickFeature: action.feature});
    }
    case TOGGLE_MAPTIPS: {
        return assign({}, state, {maptips: action.active});
    }
    case SET_TOPBAR_HEIGHT: {
        return assign({}, state, {topbarHeight: action.height});
    }
    default:
        return state;
    }
}
