/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';

import {
    CHANGE_MAP_VIEW, CONFIGURE_MAP, CHANGE_ZOOM_LVL, ZOOM_TO_EXTENT, ZOOM_TO_POINT,
    PAN_TO, CHANGE_ROTATION, CLICK_ON_MAP, TOGGLE_MAPTIPS, SET_TOPBAR_HEIGHT, SET_BOTTOMBAR_HEIGHT, SET_SNAPPING_CONFIG
} from '../actions/map';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import MapUtils from '../utils/MapUtils';
import {UrlParams} from '../utils/PermaLinkUtils';

const defaultState = {
    bbox: {bounds: [0, 0, 0, 0], rotation: 0},
    center: [0, 0],
    dpi: MapUtils.DEFAULT_SCREEN_DPI,
    projection: "EPSG:3857",
    zoom: 0,
    scales: [0],
    resolutions: [0],
    topbarHeight: 0,
    bottombarHeight: 0,
    click: null,
    snapping: {
        enabled: false,
        active: false
    }
};

export default function map(state = defaultState, action) {
    // Always reset mapStateSource, CHANGE_MAP_VIEW will set it if necessary
    if (state.mapStateSource) {
        state = {...state, mapStateSource: null};
    }

    switch (action.type) {
    case CHANGE_MAP_VIEW: {
        const {type, ...params} = action;
        const newState = {...state, ...params};

        const newParams = {};
        const positionFormat = ConfigUtils.getConfigProp("urlPositionFormat");
        const positionCrs = ConfigUtils.getConfigProp("urlPositionCrs") || newState.projection;
        const prec = CoordinatesUtils.getUnits(positionCrs) === 'degrees' ? 4 : 0;
        if (positionFormat === "centerAndZoom") {
            const center = CoordinatesUtils.reproject(newState.center, newState.projection, positionCrs);
            const scale = Math.round(MapUtils.computeForZoom(newState.scales, newState.zoom));
            Object.assign(newParams, {c: center.map(x => x.toFixed(prec)).join(","), s: scale});
        } else {
            const bounds = CoordinatesUtils.reprojectBbox(newState.bbox.bounds, newState.projection, positionCrs);
            Object.assign(newParams, {e: bounds.map(x => x.toFixed(prec)).join(",")});
        }
        if (positionCrs !== newState.projection) {
            Object.assign(newParams, {crs: positionCrs});
        }
        if (!isEmpty(newParams)) {
            UrlParams.updateParams(newParams);
        }

        return newState;
    }
    case CONFIGURE_MAP: {
        const resolutions = MapUtils.getResolutionsForScales(action.scales, action.crs, state.dpi);
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
        return {
            ...state,
            bbox: {...state.bbox, bounds: bounds},
            center: center,
            zoom: zoom,
            projection: action.crs,
            scales: action.scales,
            resolutions: resolutions
        };
    }
    case CHANGE_ZOOM_LVL: {
        return {...state, zoom: action.zoom};
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
        return {
            ...state,
            center: [0.5 * (bounds[0] + bounds[2]), 0.5 * (bounds[1] + bounds[3])],
            zoom: MapUtils.getZoomForExtent(bounds, state.resolutions, state.size, 0, state.scales.length - 1) + action.zoomOffset,
            bbox: {...state.bbox, bounds: bounds}
        };
    }
    case ZOOM_TO_POINT: {
        return {
            ...state,
            center: CoordinatesUtils.reproject(action.pos, action.crs || state.projection, state.projection),
            zoom: action.zoom
        };
    }
    case PAN_TO: {
        return {
            ...state,
            center: CoordinatesUtils.reproject(action.pos, action.crs || state.projection, state.projection)
        };
    }
    case CHANGE_ROTATION: {
        return {
            ...state,
            bbox: {...state.bbox, rotation: action.rotation}
        };
    }
    case CLICK_ON_MAP: {
        return {...state, click: action.click};
    }
    case TOGGLE_MAPTIPS: {
        return {...state, maptips: action.active};
    }
    case SET_TOPBAR_HEIGHT: {
        return {...state, topbarHeight: action.height};
    }
    case SET_BOTTOMBAR_HEIGHT: {
        return {...state, bottombarHeight: action.height};
    }
    case SET_SNAPPING_CONFIG: {
        return {...state, snapping: {enabled: action.enabled, active: action.active}};
    }
    default:
        return state;
    }
}
