/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const axios = require('axios');
const uuid = require('uuid');
const jsts = require('jsts');
const {newMapInfoRequest, errorFeatureInfo, loadFeatureInfo} = require('../../MapStore2/web/client/actions/mapInfo');

function getFeature(wfsBasePath, requestParams, lMetaData, wgs84FilterPoly = null) {
    const defaultParams = {
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
    };

    const param = assign({}, defaultParams, requestParams);
    const reqId = uuid.v1();
    return (dispatch) => {
        dispatch(newMapInfoRequest(reqId, param));
        axios.get(wfsBasePath, {params: param}).then((response) => {
            if(wgs84FilterPoly) {
                let geomFactory = new jsts.geom.GeometryFactory();
                let jsonReader = new jsts.io.GeoJSONReader(geomFactory);
                let filterGeom = jsonReader.read({
                    "type": "Polygon",
                    "coordinates": [wgs84FilterPoly]
                });
                response.data.features = response.data.features.filter(feature => {
                    let geom = jsonReader.read(feature.geometry);
                    return filterGeom.contains(geom);
                });
            }
            dispatch(loadFeatureInfo(reqId, response.data, requestParams, lMetaData));
        }).catch((e) => {
            dispatch(errorFeatureInfo(reqId, e, requestParams, lMetaData));
        });
    };
}

module.exports = {
    getFeatureInfo,
    getFeature,
};
