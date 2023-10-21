/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * NOTE: This sample editing interface is designed to work with
 *       the counterpart at
 *       https://github.com/qwc-services/qwc-data-service
 *
 * You can use any other editing backend by implementing the
 * getFeature, addFeature, editFeature and deleteFeature methods as necessary.
 */
import axios from 'axios';
import isEmpty from 'lodash.isempty';
import ConfigUtils from './ConfigUtils';
import LocaleUtils from './LocaleUtils';


/**
 * @callback FeatureCallback
 * 
 * The methods that deal with single features take a callback function as
 * parameter. The callback function is called with the result of the operation.
 * The result is either a feature or null, depending on whether the operation
 * was successful or not.
 * 
 * @param {object|null} feature - the feature returned
 */


/**
 * @callback FeaturesCallback
 * 
 * The methods that deal with multiple features take a callback function as
 * parameter. The callback function is called with the result of the operation.
 * The result is either an array of features or null, depending on whether
 * the operation was successful or not.
 * 
 * @param {object[]|null} features - the features returned
 */


/**
 * Build an error message from an axios error response.
 * 
 * @param {object} err - the axios error response
 * 
 * @return {string} the error message
 * @private
 */
function buildErrMsg(err) {
    let message;
    if (err.response && err.response.data && err.response.data.message) {
        message = err.response.data.message;
        if (!isEmpty(err.response.data.geometry_errors)) {
            message += ":\n";
            message += err.response.data.geometry_errors.map((entry, index) => {
                let entryMsg = " - " + entry.reason;
                if (entry.location) {
                    entryMsg += " at " + entry.location;
                }
                if (index) {
                    entryMsg = "\n" + entryMsg;
                }
                return entryMsg;
            });
        }
        if (!isEmpty(err.response.data.data_errors)) {
            message += (
                ":\n - " +
                err.response.data.data_errors.join("\n - ")
            );
        }
        if (!isEmpty(err.response.data.validation_errors)) {
            message += (
                ":\n - " +
                err.response.data.validation_errors.join("\n - ")
            );
        }
        if (!isEmpty(err.response.data.attachment_errors)) {
            message += (
                ":\n - " +
                err.response.data.attachment_errors.join("\n - ")
            );
        }
    } else {
        message = LocaleUtils.tr("editing.commitfailed");
        if (err.response && err.response.statusText) {
            message += ": " + err.response.statusText;
        }
    }
    return message;
}


/**
 * Utility functions for editing layers in the map.
 * 
 * NOTE: This sample editing interface is designed to work with
 *       the counterpart at
 *       https://github.com/qwc-services/qwc-data-service
 *
 * You can use any other editing backend by implementing the
 * getFeature, addFeature, editFeature and deleteFeature methods as necessary.
 * 
 * @namespace
 */
const EditingInterface = {

    /**
     * Get a feature at a given map position.
     * 
     * @param {string} layerId - the edit layer id
     * @param {number[]} mapPos - the map position as `[x, y]`
     * @param {string} mapCrs - the map crs
     * @param {number} mapScale - the map scale denominator
     * @param {number} dpi - the map resolution in dots per inch
     * @param {FeatureCallback} callback - function(result), on success
     *  result is a feature, on failure, result is null
     * @param {object} filter - the filter expression as 
     * `[["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...],`
     * or null
     */
    getFeature(
        layerId, mapPos, mapCrs, mapScale, dpi, callback, filter = null
    ) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + '/';

        // 10px tolerance
        const tol = (10.0 / dpi) * 0.0254 * mapScale;
        const bbox = (
            (mapPos[0] - tol) + "," +
            (mapPos[1] - tol) + "," +
            (mapPos[0] + tol) + "," +
            (mapPos[1] + tol)
        );

        const params = {
            bbox,
            crs: mapCrs,
            filter: filter ? JSON.stringify(filter) : undefined
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(req, { headers, params }).then(response => {
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
    },

    /**
     * Get a feature by id.
     * 
     * @param {string} layerId - the edit layer id
     * @param {string} featureId - the feature id
     * @param {string} mapCrs - the map crs
     * @param {FeatureCallback} callback - function(result), on success
     *  result is a feature, on failure, result is null
     */
    getFeatureById(layerId, featureId, mapCrs, callback) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + '/' + featureId;
        const params = {
            crs: mapCrs
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(req, { headers, params }).then(response => {
            response.data.__version__ = +new Date();
            callback(response.data);
        }).catch(() => {
            console.log("getFeatureById failed");
            callback(null);
        });
    },

    /**
     * Get features.
     * 
     * @param {string} layerId - the edit layer id
     * @param {string} mapCrs - the map crs
     * @param {FeaturesCallback} callback - on success
     * result is a collection of features, on failure, result is null
     * @param {number[]} bbox - the filter bounding box as 
     *  `[xmin, xmax, ymin, xmax]`, or null
     * @param {object} filter - the filter expression as
     *  `[["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...],`
     *  or null
     */
    getFeatures(layerId, mapCrs, callback, bbox = null, filter = null) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + '/';
        const params = {
            crs: mapCrs,
            bbox: bbox ? bbox.join(",") : undefined,
            filter: filter ? JSON.stringify(filter) : undefined
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(req, { headers, params }).then(response => {
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
    },

    /**
     * Get the extent of a layer.
     * 
     * @param {string} layerId - the edit layer id
     * @param {string} mapCrs - the map crs
     * @param {function} callback - function(result), on success result is
     *  a {"bbox": [xmin, ymin, xmax, ymax]} object, on failure, result is null
     * @param {object} filter - the filter expression as
     *  `[["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...],`
     *  or null
     */
    getExtent(layerId, mapCrs, callback, filter = null) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + "/extent";
        const params = {
            crs: mapCrs,
            filter: filter ? JSON.stringify(filter) : undefined
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(req, { headers, params }).then(response => {
            callback(response.data);
        }).catch(() => callback(null));
    },

    /**
     * Add a feature.
     * 
     * @param {string} layerId - the edit layer id
     * @param {FormData} featureData - contains a 'feature' entry
     * containing the GeoJSON serialized feature and optionally one or more
     * 'file:' prefixed file upload entries
     * @param {function} callback - function(success, result),
     *  if success = true, result is the committed GeoJSON feature,
     *  if success = false, result is an error message
     */
    addFeatureMultipart(layerId, featureData, callback) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + '/multipart';
        const headers = {
            "Content-Type": "multipart/form-data",
            "Accept-Language": LocaleUtils.lang()
        };
        axios.post(req, featureData, { headers }).then(response => {
            response.data.__version__ = +new Date();
            callback(true, response.data);
        }).catch(err => callback(false, buildErrMsg(err)));
    },

    /**
     * Edit a feature.
     * 
     * @param {string} layerId - the edit layer id
     * @param {string} featureId - the id of the feature to edit
     * @param {FormData} featureData - a FormData instance, with a 'feature'
     *  entry containing the GeoJSON serialized feature and optionally one
     *  or more 'file:' prefixed file upload entries
     * @param {function} callback - function(success, result),
     *  if success = true, result is the committed GeoJSON feature,
     *  if success = false, result is an error message
     */
    editFeatureMultipart(layerId, featureId, featureData, callback) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + '/multipart/' + featureId;
        const headers = {
            "Content-Type": "multipart/form-data",
            "Accept-Language": LocaleUtils.lang()
        };
        axios.put(req, featureData, { headers }).then(response => {
            response.data.__version__ = +new Date();
            callback(true, response.data);
        }).catch(err => callback(false, buildErrMsg(err)));
    },

    /**
     * Delete a feature.
     * 
     * @param {string} layerId - the edit layer id
     * @param {string} featureId - the id of the feature to delete
     * @param {function} callback - function(success, result),
     *  if success = true, result is null,
     *  if success = false, result is an error message
     */
    deleteFeature(layerId, featureId, callback) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + '/' + featureId;
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.delete(req, { headers }).then(() => {
            callback(true, featureId);
        }).catch(err => callback(false, buildErrMsg(err)));
    },

    /**
     * Get relations for a feature.
     * 
     * @param {string} layerId - the edit layer id
     * @param {string} featureId - the id of the feature to get relations for
     * @param {string[]} tables - the list of tables to get relations for
     * @param {string} mapCrs - the map crs
     * @param {function} callback - function(result), on success result is
     * a {"relations": {"<table>": [{"id": <id>, "feature": <feature>}, ...]}},
     * on failure, result is an empty object
     */
    getRelations(layerId, featureId, tables, mapCrs, callback) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + '/' + featureId + "/relations";
        const params = {
            tables: tables,
            crs: mapCrs
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(req, { headers, params }).then(response => {
            callback(response.data);
        }).catch(() => callback({}));
    },

    /**
     * Write relations for a feature.
     * 
     * @param {string} layerId - the edit layer id
     * @param {string} featureId - the id of the feature to write relations for
     * @param {FormData} relationData - the relation data as a FormData instance,
     * with a 'relations' entry containing the relation data
     * @param {string} mapCrs - the map crs
     * @param {function} callback - function(result), on success result is
     * a {"relations": {"<table>": [{"id": <id>, "feature": <feature>}, ...]}},
     * on failure, result is false and an error message
     */
    writeRelations(layerId, featureId, relationData, mapCrs, callback) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + layerId + '/' + featureId + "/relations";
        const params = {
            crs: mapCrs
        };
        const headers = {
            "Content-Type": "multipart/form-data",
            "Accept-Language": LocaleUtils.lang()
        };
        axios.post(req, relationData, { headers, params }).then(response => {
            callback(response.data);
        }).catch(err => callback(false, buildErrMsg(err)));
    },

    /**
     * Get key values.
     * 
     * @param {string} keyvalues - the key-values to get as
     *  `<dataset>:<key_column>:<value_column>,<dataset>:<key_column>:<value_column>,...`
     * @param {function} callback - function(result), on success result is
     *  a {"keyvalues": {"<dataset>": [{"key": <key>, "value": <value}, ...]}},
     *  on failure, result is an empty object
     * @param {object} filter - the filter expression as
     *  `[["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...],`
     *  or null
     * 
     * @namespace EditingInterface
     */
    getKeyValues(keyvalues, callback, filter = null) {
        const SERVICE_URL = ConfigUtils.getConfigProp("editServiceUrl");
        const req = SERVICE_URL + "keyvals?tables=" + keyvalues;
        const params = {
            filter: filter ? JSON.stringify(filter) : undefined
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(req, { headers, params }).then(response => {
            callback(response.data);
        }).catch(() => callback({}));
    },
};

export default EditingInterface;
