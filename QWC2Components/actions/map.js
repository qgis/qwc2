/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const UrlParams = require("../utils/UrlParams");
const CoordinatesUtils = require("../../MapStore2/web/client/utils/CoordinatesUtils");
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const MapUtils = require("../../MapStore2/web/client/utils/MapUtils");

function changeMapView(center, zoom, bbox, size, mapStateSource, projection) {
    return (dispatch) => {
        let positionFormat = ConfigUtils.getConfigProp("urlPositionFormat");
        let positionCrs = ConfigUtils.getConfigProp("urlPositionCrs") || projection;
        let bounds = CoordinatesUtils.reprojectBbox(bbox.bounds, bbox.crs, positionCrs);
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
        if(positionCrs && positionCrs !== projection) {
            UrlParams.updateParams({crs: positionCrs});
        }
        dispatch(require('../../MapStore2/web/client/actions/map').changeMapView(center, zoom, bbox, size, mapStateSource, projection));
    };
}

module.exports = {changeMapView};
