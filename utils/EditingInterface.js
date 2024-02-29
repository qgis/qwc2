/**
 * Copyright 2017-2024 Sourcepole AG
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
import isEmpty from 'lodash.isempty';

import ConfigUtils from './ConfigUtils';
import LocaleUtils from './LocaleUtils';


function buildErrMsg(err) {
    let message = LocaleUtils.tr("editing.commitfailed");
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
 filter: the filter expression as [["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...], or null
 filterGeom: the filter geometry, as a GeoJSON gemetry, or null
*/
function getFeature(layerId, mapPos, mapCrs, mapScale, dpi, callback, filter = null, filterGeom = null) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/';

    // 10px tolerance
    const tol = (10.0 / dpi) * 0.0254 * mapScale;
    const bbox = (mapPos[0] - tol) + "," + (mapPos[1] - tol) + "," + (mapPos[0] + tol) + "," + (mapPos[1] + tol);

    const params = {
        bbox: bbox,
        crs: mapCrs,
        filter: filter ? JSON.stringify(filter) : undefined,
        filter_geom: filterGeom ? JSON.stringify({...filterGeom, crs: {type: "name", properties: {name: mapCrs}}}) : undefined
    };
    const headers = {
        "Accept-Language": LocaleUtils.lang()
    };
    axios.get(req, {headers, params}).then(response => {
        if (response.data && !isEmpty(response.data.features)) {
            const version = +new Date();
            response.data.features.forEach(feature => {
                feature.__version__ = version;
            });
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
    const req = SERVICE_URL + layerId + '/' + featureId;
    const params = {
        crs: mapCrs
    };
    const headers = {
        "Accept-Language": LocaleUtils.lang()
    };
    axios.get(req, {headers, params}).then(response => {
        response.data.__version__ = +new Date();
        callback(response.data);
    }).catch(() => callback(null));
}

/*
 layerId: The edit layer id
 mapCrs: the map crs
 callback: function(result), on success result is a collection of features, on failure, result is null
 bbox: the filter bounding box as [xmin, xmax, ymin, xmax], or null
 filter: the filter expression as [["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...], or null
 filterGeom: the filter geometry, as a GeoJSON gemetry, or null
*/
function getFeatures(layerId, mapCrs, callback, bbox = null, filter = null, filterGeom = null) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/';
    const params = {
        crs: mapCrs,
        bbox: bbox ? bbox.join(",") : undefined,
        filter: filter ? JSON.stringify(filter) : undefined,
        filter_geom: filterGeom ? JSON.stringify({...filterGeom, crs: {type: "name", properties: {name: mapCrs}}}) : undefined
    };
    const headers = {
        "Accept-Language": LocaleUtils.lang()
    };
    axios.get(req, {headers, params}).then(response => {
        if (response.data && Array.isArray(response.data.features)) {
            const version = +new Date();
            response.data.features.forEach(feature => {
                feature.__version__ = version;
            });
            callback(response.data);
        } else {
            callback(null);
        }
    }).catch(() => callback(null));
}

/*
 layerId: The edit layer id
 mapCrs: the map crs
 callback: function(result), on success result is a {"bbox": [xmin, ymin, xmax, ymax]} object, on failure, result is null
 filter: the filter expression as [["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...], or null
 filterGeom: the filter geometry, as a GeoJSON gemetry, or null
*/
function getExtent(layerId, mapCrs, callback, filter = null, filterGeom = null) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + "/extent";
    const params = {
        crs: mapCrs,
        filter: filter ? JSON.stringify(filter) : undefined,
        filter_geom: filterGeom ? JSON.stringify({...filterGeom, crs: {type: "name", properties: {name: mapCrs}}}) : undefined
    };
    const headers = {
        "Accept-Language": LocaleUtils.lang()
    };
    axios.get(req, {headers, params}).then(response => {
        callback(response.data);
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
    const headers = {
        "Content-Type": "multipart/form-data",
        "Accept-Language": LocaleUtils.lang()
    };
    axios.post(req, featureData, {headers}).then(response => {
        response.data.__version__ = +new Date();
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
    const headers = {
        "Content-Type": "multipart/form-data",
        "Accept-Language": LocaleUtils.lang()
    };
    axios.put(req, featureData, {headers}).then(response => {
        response.data.__version__ = +new Date();
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
    const headers = {
        "Accept-Language": LocaleUtils.lang()
    };
    axios.delete(req, {headers}).then(() => {
        callback(true, featureId);
    }).catch(err => callback(false, buildErrMsg(err)));
}

function getRelations(layerId, featureId, tables, mapCrs, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/' + featureId + "/relations";
    const params = {
        tables: tables,
        crs: mapCrs
    };
    const headers = {
        "Accept-Language": LocaleUtils.lang()
    };
    axios.get(req, {headers, params}).then(response => {
        callback(response.data);
    }).catch(() => callback({}));
}

function writeRelations(layerId, featureId, relationData, mapCrs, callback) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + layerId + '/' + featureId + "/relations";
    const params = {
        crs: mapCrs
    };
    const headers = {
        "Content-Type": "multipart/form-data",
        "Accept-Language": LocaleUtils.lang()
    };
    axios.post(req, relationData, {headers, params}).then(response => {
        callback(response.data);
    }).catch(err => callback(false, buildErrMsg(err)));
}

/*
 keyvalues: <dataset>:<key_column>:<value_column>,<dataset>:<key_column>:<value_column>,...
 callback: function(result), result is a {"keyvalues": {"<dataset>": [{"key": <key>, "value": <value}, ...]}}
 filter: the filter expression as [[["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...]] (one filter expr per keyvalue entry), or null
*/
function getKeyValues(keyvalues, callback, filter = null) {
    const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
    const req = SERVICE_URL + "keyvals?tables=" + keyvalues;
    const params = {
        filter: filter ? JSON.stringify(filter) : undefined
    };
    const headers = {
        "Accept-Language": LocaleUtils.lang()
    };
    axios.get(req, {headers, params}).then(response => {
        callback(response.data);
    }).catch(() => callback({}));
}

export default {
    getFeature,
    getFeatureById,
    getFeatures,
    getExtent,
    addFeatureMultipart,
    editFeatureMultipart,
    deleteFeature,
    writeRelations,
    getRelations,
    getKeyValues
};
