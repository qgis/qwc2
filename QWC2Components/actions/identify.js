/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const axios = require('axios');
const uuid = require('uuid');

const IDENTIFY_EMPTY = 'IDENTIFY_EMPTY';
const IDENTIFY_RESPONSE = 'IDENTIFY_RESPONSE';
const IDENTIFY_REQUEST = 'IDENTIFY_REQUEST';
const SET_IDENTIFY_ENABLED = 'SET_IDENTIFY_ENABLED';
const PURGE_IDENTIFY_RESULTS = 'PURGE_IDENTIFY_RESULTS';


function identifyEmpty() {
    return {
        type: IDENTIFY_EMPTY,
        reqId: uuid.v1()
    };
}

function identifyResponse(reqId, request, data, error=null) {
    return {
        type: IDENTIFY_RESPONSE,
        reqId: reqId,
        request: request,
        data: data,
        error: error
    };
}

function identifyRequest(reqId, request) {
    return {
        type: IDENTIFY_REQUEST,
        reqId: reqId,
        request: request
    };
}

function sendIdentifyRequest(request) {
    const reqId = uuid.v1();
    return (dispatch) => {
        dispatch(identifyRequest(reqId, request));
        axios.get(request.url, {params: request.params}).then((response) => {
            dispatch(identifyResponse(reqId, request, response.data));
        }).catch((e) => {
            dispatch(identifyResponse(reqId, request, null, e));
        });
    };
}

function sendIdentifyRegionRequest(serviceUrl, requestParams, wgs84FilterPoly = null) {
    const defaultParams = {
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
    };

    const params = assign({}, defaultParams, requestParams);
    const reqId = uuid.v1();
    return (dispatch) => {
        dispatch(newMapInfoRequest(reqId, param));
        axios.get(serviceUrl, {params: params}).then((response) => {
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
            dispatch(identifyResponse(reqId, {url: serviceUrl, params}, response.data));
        }).catch((e) => {
            dispatch(identifyResponse(reqId, null, e));
        });
    };
}

function setIdentifyEnabled(enabled) {
    return {
        type: SET_IDENTIFY_ENABLED,
        enabled: enabled
    };
}

function purgeIdentifyResults() {
    return {
        type: PURGE_IDENTIFY_RESULTS
    };
}


module.exports = {
    IDENTIFY_EMPTY,
    IDENTIFY_RESPONSE,
    IDENTIFY_REQUEST,
    SET_IDENTIFY_ENABLED,
    PURGE_IDENTIFY_RESULTS,
    identifyEmpty,
    sendIdentifyRequest,
    setIdentifyEnabled,
    purgeIdentifyResults
};
