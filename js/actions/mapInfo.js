/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const mapInfoGetFeatureInfo = require('../../MapStore2/web/client/actions/mapInfo').getFeatureInfo;

function getFeatureInfo(wmsBasePath, requestParams, lMetaData, layerOptions = {}) {
    // NOTE: ignore options from layer to prevent unnecessary params in GetFeatureInfo request
    return mapInfoGetFeatureInfo(wmsBasePath, requestParams, lMetaData, {});
}

module.exports = {
    getFeatureInfo
};
