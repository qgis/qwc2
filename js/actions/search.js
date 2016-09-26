/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TEXT_SEARCH_RESULTS_LOADED} = require("../../MapStore2/web/client/actions/search");
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const UrlParams = require("../utils/UrlParams");

function searchResultLoaded(results) {
     return {
         type: TEXT_SEARCH_RESULTS_LOADED,
         results: results
     };
 }

function qwc2TextSearch(text) {
    UrlParams.updateParams({s: text});

    return (dispatch) => {
        fetch(ConfigUtils.getConfigProp("searchUrl") + text)
        .then((response) => { return response.json(); })
        .then((obj) => { dispatch(searchResultLoaded(obj.results)); });
    };
}

module.exports = {qwc2TextSearch};
