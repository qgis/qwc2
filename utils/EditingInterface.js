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
 */
import axios from 'axios';
import isEmpty from 'lodash.isempty';

import ConfigUtils from './ConfigUtils';
import {computeExpressionFields} from './EditingUtils';
import LocaleUtils from './LocaleUtils';


const EditingInterface = {
    buildErrMsg(err) {
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
    },
    /**
     * Gets features at the specified map position.
     *
     * @param editConfig The edit config of the dataset to query features from
     * @param mapPos The [x, y] map position
     * @param mapCrs The CRS of the map, as an EPSG code
     * @param mapScale The scale denominator, used to compute the pick tolerance
     * @param dpi The screen dpi, used to compute the pick tolerance
     * @param callback Callback invoked with the picked features, taking `{features: [...]}` on success and `null` on failure
     * @param filter An optional feature attribute filter expression
     * @param filterGeom An optional filter geometry
     */
    getFeature(editConfig, mapPos, mapCrs, mapScale, dpi, callback, filter = null, filterGeom = null) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const requestUrl = editServiceUrl + '/' + editConfig.editDataset + '/';

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
        axios.get(requestUrl, {headers, params}).then(response => {
            if (!isEmpty(response?.data?.features)) {
                const version = +new Date();
                const promises = response.data.features.map(feature => {
                    return new Promise(resolve => {
                        computeExpressionFields(editConfig, feature, EditingInterface, mapCrs, newfeature => resolve({
                            ...newfeature, __version__: version
                        }));
                    });
                });
                Promise.all(promises).then(features => callback({features}));
            } else {
                callback(null);
            }
        }).catch(() => {
            callback(null);
        });
    },
    /**
     * Queries a feature by id
     *
     * @param editConfig The edit config of the dataset to query the feature from
     * @param featureId The feature id
     * @param mapCrs The CRS of the map, as an EPSG code
     * @param callback Callback invoked with the picked feature, taking `{<feature>}` on success and `null` on failure
     */
    getFeatureById(editConfig, featureId, mapCrs, callback) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const requestUrl = editServiceUrl + '/' + editConfig.editDataset + '/' + featureId;
        const params = {
            crs: mapCrs
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(requestUrl, {headers, params}).then(response => {
            computeExpressionFields(editConfig, response.data, EditingInterface, mapCrs, newfeature => callback({
                ...newfeature, __version__: +new Date()
            }));
        }).catch(() => {
            callback(null);
        });
    },
    /**
     * Gets the dataset features
     *
     * @param editConfig The edit config of the dataset to query features from
     * @param mapCrs The CRS of the map, as an EPSG code
     * @param callback Callback invoked with the picked features, taking `{features: [...]}` on success and `null` on failure
     * @param filter An optional feature attribute filter expression
     * @param filterGeom An optional filter geometry
     */
    getFeatures(editConfig, mapCrs, callback, bbox = null, filter = null, filterGeom = null) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const requestUrl = editServiceUrl + '/' + editConfig.editDataset + '/';
        const params = {
            crs: mapCrs,
            bbox: bbox ? bbox.join(",") : undefined,
            filter: filter ? JSON.stringify(filter) : undefined,
            filter_geom: filterGeom ? JSON.stringify({...filterGeom, crs: {type: "name", properties: {name: mapCrs}}}) : undefined
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(requestUrl, {headers, params}).then(response => {
            if (!isEmpty(response?.data?.features)) {
                const version = +new Date();
                const promises = response.data.features.map(feature => {
                    return new Promise(resolve => {
                        computeExpressionFields(editConfig, feature, EditingInterface, mapCrs, newfeature => resolve({
                            ...newfeature, __version__: version
                        }));
                    });
                });
                Promise.all(promises).then(features => callback({features}));
            } else {
                callback(null);
            }
        }).catch(() => callback(null));
    },
    /**
     * Query the extent of the dataset features
     * @param editConfig The edit config of the dataset to query features from
     * @param mapCrs The CRS of the map, as an EPSG code
     * @param callback Callback invoked with the feature extent, taking `{bbox: [xmin, ymin, xmax, ymax]}` on success and `null` on failure
     * @param filter An optional feature attribute filter expression
     * @param filterGeom An optional filter geometry
     */
    getExtent(editConfig, mapCrs, callback, filter = null, filterGeom = null) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const requestUrl = editServiceUrl + '/' + editConfig.editDataset + "/extent";
        const params = {
            crs: mapCrs,
            filter: filter ? JSON.stringify(filter) : undefined,
            filter_geom: filterGeom ? JSON.stringify({...filterGeom, crs: {type: "name", properties: {name: mapCrs}}}) : undefined
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(requestUrl, {headers, params}).then(response => {
            callback(response.data);
        }).catch(() => {
            callback(null);
        });
    },
    /**
     * Adds a feature to the dataset
     * @param editConfig The edit config of the dataset to add the feature to
     * @param mapCrs The CRS of the map, as an EPSG code
     * @param featureData A FormData instance, with:
     *  - A 'feature' entry containing the GeoJSON serialized feature
     *  - Zero or more 'file:' prefixed file upload entries
     *  - Zero or more 'relfile:' prefixed file upload entries
     *  - Optionally a 'g-recaptcha-response' entry with the captcha response
     * @param callback Callback invoked with the added feature, taking `(true, {<feature>}` on success and `(false, <Error Message>}` on failure
     */
    addFeatureMultipart(editConfig, mapCrs, featureData, callback) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const requestUrl = editServiceUrl + '/' + editConfig.editDataset + '/multipart';
        const headers = {
            "Content-Type": "multipart/form-data",
            "Accept-Language": LocaleUtils.lang()
        };
        axios.post(requestUrl, featureData, {headers}).then(response => {
            computeExpressionFields(editConfig, response.data, EditingInterface, mapCrs, newfeature => callback(
                true, {...newfeature, __version__: +new Date()}
            ));
        }).catch(err => {
            callback(false, EditingInterface.buildErrMsg(err));
        });
    },
    /**
     * Edits a feature of the dataset
     * @param editConfig The edit config of the edited dataset
     * @param mapCrs The CRS of the map, as an EPSG code
     * @param featureId The ID of the edited feature
     * @param featureData A FormData instance, with:
     *  - A 'feature' entry containing the GeoJSON serialized feature
     *  - Zero or more 'file:' prefixed file upload entries
     *  - Zero or more 'relfile:' prefixed file upload entries
     *  - Optionally a 'g-recaptcha-response' entry with the captcha response
     * @param callback Callback invoked with the edited feature, taking `(true, {<feature>}` on success and `(false, <Error Message>}` on failure
     */
    editFeatureMultipart(editConfig, mapCrs, featureId, featureData, callback) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const requestUrl = editServiceUrl + '/' + editConfig.editDataset + '/multipart/' + featureId;
        const headers = {
            "Content-Type": "multipart/form-data",
            "Accept-Language": LocaleUtils.lang()
        };
        axios.put(requestUrl, featureData, {headers}).then(response => {
            computeExpressionFields(editConfig, response.data, EditingInterface, mapCrs, newfeature => callback(
                true, {...newfeature, __version__: +new Date()}
            ));
        }).catch(err => {
            callback(false, EditingInterface.buildErrMsg(err));
        });
    },
    /*
    layerId: The edit layer id
    featureId: The id of the feature to delete
    callback: function(success, result), if success = true, result is null, if success = false, result is an error message
    recaptchaResponse: Optional, captcha challenge response
    */
    /**
     * Deletes a feature from the dataset
     * @param editConfig The edit config of the dataset from which to delete the feature
     * @param featureId The ID of the edited feature
     * @param callback Callback invoked with the id of the deleted feature, taking `(true, <feature_id>` on success and `(false, <Error Message>}` on failure
     * @param recaptchaResponse Optional captcha challenge response
     */
    deleteFeature(editConfig, featureId, callback, recaptchaResponse = null) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const req = editServiceUrl + '/' + editConfig.editDataset + '/' + featureId;
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        const data = {};
        if (recaptchaResponse) {
            data['g-recaptcha-response'] = recaptchaResponse;
        }

        axios.delete(req, {headers, data}).then(() => {
            callback(true, featureId);
        }).catch(err => {
            callback(false, EditingInterface.buildErrMsg(err));
        });
    },
    /**
     * Queries relation values of a feature
     * @param editConfig The edit config of the feature dataset
     * @param featureId The feature ID
     * @param mapCrs The CRS of the map, as an EPSG code
     * @param tables Comma separated string of relation table names
     * @param editConfigs The theme editConfig block, containing all theme dataset edit configs
     * @param callback Callback invoked with the relation values, taking `{<tablename>: {<relation_values>}}` on success and `{}` on failure
     */
    getRelations(editConfig, featureId, mapCrs, tables, editConfigs, callback) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const req = editServiceUrl + '/' + editConfig.editDataset + '/' + featureId + "/relations";
        const params = {
            tables: tables,
            crs: mapCrs
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(req, {headers, params}).then(response => {
            Promise.all(Object.entries(response.data).map(([reldataset, relvalues]) => {
                return new Promise((resolveTable) => {
                    Promise.all(relvalues.features.map(feature => {
                        return new Promise((resolveFeature) => {
                            const relEditConfig = Object.values(editConfigs).find(entry => entry.editDataset === reldataset);
                            computeExpressionFields(relEditConfig, feature, EditingInterface, mapCrs, resolveFeature);
                        });
                    })).then(newfeatures => resolveTable([reldataset, {...relvalues, features: newfeatures}]));
                });
            })).then(entries => callback(Object.fromEntries(entries)));
        }).catch(() => callback({}));
    },
    /**
     * Query key-value-pairs of a key-value-relation
     * @param keyvalues The keyval string `<keyvaldataset>:<keyfield>:<valuefield>`
     * @param callback Callback invoked with the key-value pairs, taking `{keyvalues: {<keyvaldataset>: [{key: <key>, value: <value>}]}}` on success and `{}` on failure
     * @param filter An optional filter expression, as `[[["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...]]` (one filter expr per keyvalue entry)
     */
    getKeyValues(keyvalues, callback, filter = null) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        const req = editServiceUrl + '/' + "keyvals?tables=" + keyvalues;
        const params = {
            filter: filter ? JSON.stringify(filter) : undefined
        };
        const headers = {
            "Accept-Language": LocaleUtils.lang()
        };
        axios.get(req, {headers, params}).then(response => {
            callback(response.data);
        }).catch(() => callback({}));
    },
    /**
     * Resolve an attachment value to a full URL
     *
     * @param dataset The dataset name
     * @param fileValue The attachment value
     */
    resolveAttachmentUrl(dataset, fileValue) {
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/, '');
        return editServiceUrl + '/' + dataset + "/attachment?file=" + encodeURIComponent(fileValue);
    }
};

export default EditingInterface;
