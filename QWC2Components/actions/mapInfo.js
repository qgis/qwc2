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
const overlaps = require('turf-overlaps');
const inside = require('turf-inside');
const mapInfoGetFeatureInfo = require('../../MapStore2/web/client/actions/mapInfo').getFeatureInfo;
const {newMapInfoRequest, errorFeatureInfo, loadFeatureInfo} = require('../../MapStore2/web/client/actions/mapInfo');

function getFeatureInfo(wmsBasePath, requestParams, lMetaData, layerOptions = {}) {
    // NOTE: ignore options from layer to prevent unnecessary params in GetFeatureInfo request
    return mapInfoGetFeatureInfo(wmsBasePath, requestParams, lMetaData, {});
}

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
                let filterFeature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [wgs84FilterPoly]
                    }
                };
                response.data.features = response.data.features.filter(feature => {
                    if(feature.geometry.type === "Point") {
                        return inside(feature, filterFeature);
                    } else {
                        return overlaps(filterFeature, feature);
                    }
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
