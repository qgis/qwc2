/**
 * Copyright 2015, GeoSolutions Sas.
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const UrlParams = require("../utils/UrlParams");
const CoordinatesUtils = require("../../MapStore2Components/utils/CoordinatesUtils");
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const MapUtils = require("../../MapStore2Components/utils/MapUtils");

const CHANGE_MAP_VIEW = 'CHANGE_MAP_VIEW';
const CLICK_ON_MAP = 'CLICK_ON_MAP';
const CHANGE_ZOOM_LVL = 'CHANGE_ZOOM_LVL';
const PAN_TO = 'PAN_TO';
const ZOOM_TO_EXTENT = 'ZOOM_TO_EXTENT';
const ZOOM_TO_POINT = 'ZOOM_TO_POINT';
const CHANGE_MAP_CRS = 'CHANGE_MAP_CRS';
const CHANGE_MAP_SCALES = 'CHANGE_MAP_SCALES';
const CHANGE_ROTATION = 'CHANGE_ROTATION';
const SET_SWIPE = 'SET_SWIPE';

function changeMapView(center, zoom, bbox, size, mapStateSource, projection) {
    return (dispatch) => {
        let positionFormat = ConfigUtils.getConfigProp("urlPositionFormat");
        let positionCrs = ConfigUtils.getConfigProp("urlPositionCrs") || projection;
        let bounds = CoordinatesUtils.reprojectBbox(bbox.bounds, projection, positionCrs);
        let roundfactor = CoordinatesUtils.getUnits(positionCrs) === 'degrees' ? 100000. : 1;
        if(positionFormat === "centerAndZoom") {
            let x = Math.round(0.5 * (bounds[0] + bounds[2]) * roundfactor) / roundfactor;
            let y = Math.round(0.5 * (bounds[1] + bounds[3]) * roundfactor) / roundfactor;
            let scale = MapUtils.getScales(projection)[zoom];
            UrlParams.updateParams({c: x + ";" + y, s: scale});
        } else {
            let xmin = Math.round(bounds[0] * roundfactor) / roundfactor;
            let ymin = Math.round(bounds[1] * roundfactor) / roundfactor;
            let xmax = Math.round(bounds[2] * roundfactor) / roundfactor;
            let ymax = Math.round(bounds[3] * roundfactor) / roundfactor;
            UrlParams.updateParams({e: xmin + ";" + ymin + ";" + xmax + ";" + ymax});
        }
        if(positionCrs !== projection) {
            UrlParams.updateParams({crs: positionCrs});
        }
        dispatch({
            type: CHANGE_MAP_VIEW,
            center,
            zoom,
            bbox,
            size,
            mapStateSource,
            projection
        });
    };
}
function changeMapCrs(crs) {
    return {
        type: CHANGE_MAP_CRS,
        crs: crs
    };
}

function changeMapScales(scales) {
    return {
        type: CHANGE_MAP_SCALES,
        scales: scales
    };
}

function clickOnMap(point) {
    return {
        type: CLICK_ON_MAP,
        point: point
    };
}

function changeZoomLevel(zoomLvl, mapStateSource) {
    return {
        type: CHANGE_ZOOM_LVL,
        zoom: zoomLvl,
        mapStateSource: mapStateSource
    };
}

function panTo(pos, crs) {
    return {
        type: PAN_TO,
        pos
    };
}

function zoomToExtent(extent, crs) {
    return {
        type: ZOOM_TO_EXTENT,
        extent,
        crs
    };
}

function zoomToPoint(pos, zoom, crs) {
    return {
        type: ZOOM_TO_POINT,
        pos,
        zoom,
        crs
    }
}

function changeRotation(rotation, mapStateSource) {
    return {
        type: CHANGE_ROTATION,
        rotation,
        mapStateSource
    };
}

function setSwipe(swipe) {
    return {
        type: SET_SWIPE,
        swipe
    };
}

module.exports = {
    CHANGE_MAP_VIEW,
    CLICK_ON_MAP,
    CHANGE_ZOOM_LVL,
    PAN_TO,
    ZOOM_TO_EXTENT,
    ZOOM_TO_POINT,
    CHANGE_MAP_CRS,
    CHANGE_MAP_SCALES,
    CHANGE_ROTATION,
    SET_SWIPE,
    changeMapView,
    clickOnMap,
    changeZoomLevel,
    changeMapCrs,
    changeMapScales,
    zoomToExtent,
    zoomToPoint,
    panTo,
    changeRotation,
    setSwipe
};
