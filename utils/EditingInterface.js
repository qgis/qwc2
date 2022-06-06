/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * NOTE: This sample editing interface is designed to work with the counterpart at
 *       https://github.com/qwc-services/qwc-data-service
 *
 * You can use any other editing backend by implementing the getFeature, addFeature,
 * editFeature and deleteFeature methods as necessary.
 */
import axios from 'axios';
import {isEmpty} from 'lodash';
import ConfigUtils from './ConfigUtils';


function buildErrMsg(err) {
    let message = "Commit failed";
    if (err.response && err.response.data && err.response.data.message) {
        message = err.response.data.message;
        if (!isEmpty(err.response.data.geometry_errors)) {
            message += ":\n";
            message += err.response.data.geometry_errors.map(entry => {
                let entrymsg = " - " + entry.reason;
                if (entry.location) {
                    entrymsg += " at " + entry.location;
                }
                return entrymsg;
            });
        }
        if (!isEmpty(err.response.data.data_errors)) {
            message += ":\n - " + err.response.data.data_errors.join("\n - ");
        }
        if (!isEmpty(err.response.data.validation_errors)) {
            message += ":\n - " + err.response.data.validation_errors.join("\n - ");
        }
        if (!isEmpty(err.response.data.attachment_errors)) {
            message += ":\n - " + err.response.data.attachment_errors.join("\n - ");
        }
    } else if (err.response && err.response.statusText) {
        message += ": " + err.response.statusText;
    }
    return message;
}

/*
 layerId: The edit layer id
 mapPos: the map position
 mapCrs: the map crs
 mapScale: the map scale denominator
 dpi: the map resolution
 callback: function(result), on success result is a collection of features, on failure, result is null
*/
function getFeature(layerId, mapPos, mapCrs, mapScale, dpi, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");

    // 10px tolerance
    const tol = (10.0 / dpi) * 0.0254 * mapScale;
    const bbox = (mapPos[0] - tol) + "," + (mapPos[1] - tol) + "," + (mapPos[0] + tol) + "," + (mapPos[1] + tol);

    const req = SERVICE_URL + layerId + '/?bbox=' + bbox + '&crs=' + mapCrs;
    axios.get(req).then(response => {
        if (response.data && !isEmpty(response.data.features)) {
            callback(response.data);
        } else {
            callback(null);
        }
    }).catch(() => callback(null));
}

/*
 layerId: The edit layer id
 featureId: The feature id
 mapCrs: the map crs
 callback: function(result), on success result is a feature, on failure, result is null
*/
function getFeatureById(layerId, featureId, mapCrs, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/' + featureId + '?crs=' + mapCrs;
    axios.get(req).then(response => {
        callback(response.data);
    }).catch(() => callback(null));
}
/*
 layerId: The edit layer id
 mapCrs: the map crs
 callback: function(result), on success result is a collection of features, on failure, result is null
*/
function getFeatures(layerId, mapCrs, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/?crs=' + mapCrs;
    axios.get(req).then(response => {
        if (response.data && !isEmpty(response.data.features)) {
            callback(response.data);
        } else {
            callback(null);
        }
    }).catch(() => callback(null));
}

/*
 layerId: The edit layer id
 featureData: a FormData instance, with a 'feature' entry containing the GeoJSON serialized feature and optionally one or more 'file:' prefixed file upload entries
 callback: function(success, result), if success = true, result is the committed GeoJSON feature, if success = false, result is an error message
*/
function addFeatureMultipart(layerId, featureData, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/multipart';

    axios.post(req, featureData, {
        headers: {'Content-Type': 'multipart/form-data' }
    }).then(response => {
        callback(true, response.data);
    }).catch(err => callback(false, buildErrMsg(err)));
}

/*
 layerId: The edit layer id
 featureId: The id of the feature to edit
 featureData: a FormData instance, with a 'feature' entry containing the GeoJSON serialized feature and optionally one or more 'file:' prefixed file upload entries
 callback: function(success, result), if success = true, result is the committed GeoJSON feature, if success = false, result is an error message
*/
function editFeatureMultipart(layerId, featureId, featureData, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/multipart/' + featureId;
    axios.put(req, featureData, {
        headers: {'Content-Type': 'multipart/form-data' }
    }).then(response => {
        callback(true, response.data);
    }).catch(err => callback(false, buildErrMsg(err)));
}

/*
 layerId: The edit layer id
 featureId: The id of the feature to delete
 callback: function(success, result), if success = true, result is null, if success = false, result is an error message
*/
function deleteFeature(layerId, featureId, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/' + featureId;

    axios.delete(req).then(() => {
        callback(true);
    }).catch(err => callback(false, buildErrMsg(err)));
}

function getRelations(layerId, featureId, tables, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/' + featureId + "/relations?tables=" + tables;
    axios.get(req).then(response => {
        callback(response.data);
    }).catch(() => callback({}));
}

function writeRelations(layerId, featureId, relationData, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/' + featureId + "/relations";

    axios.post(req, relationData, {
        headers: {'Content-Type': 'multipart/form-data' }
    }).then(response => {
        callback(response.data);
    }).catch(err => callback(false, buildErrMsg(err)));
}

function getKeyValues(keyvalues, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + "keyvals?tables=" + keyvalues;
    axios.get(req).then(response => {
        callback(response.data);
    }).catch(() => callback({}));
}

export default {
    getFeature,
    getFeatureById,
    getFeatures,
    addFeatureMultipart,
    editFeatureMultipart,
    deleteFeature,
    writeRelations,
    getRelations,
    getKeyValues
};
