/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {configureMap} = require('../../MapStore2/web/client/actions/config');
const {searchTextChanged} = require('../../MapStore2/web/client/actions/search');
const ConfigUtils = require('../../MapStore2/web/client/utils/ConfigUtils');
const UrlParams = require("../utils/UrlParams");
const assign = require('object-assign');
const axios = require('axios');

function restoreMapConfig(dispatch, params) {
    let mapConfig = {
        map: {
            center: {
                x: 0,
                y: 0,
                crs: "EPSG:4326"
            },
            zoom: 0,
            layers: []
        }
    };

    // Set map center based on x, y params
    if (params.x && params.y) {
        try {
            mapConfig.map.center = assign(mapConfig.map.center, {
                x: parseFloat(params.x),
                y: parseFloat(params.y),
                crs: "EPSG:4326"
            });
        } catch(e) {}
    }
    // Set map zoom based on z param
    if (params.z) {
        try {
            mapConfig.map.zoom = parseInt(params.z);
        } catch(e) {}
    }

    dispatch(configureMap(mapConfig, false));

    // Set search text based on url s param
    if (params.s) {
        dispatch(searchTextChanged(params.s));
    }
}

function loadMapConfig() {
    return (dispatch) => {

        var params = UrlParams.getParams();

        if(params.k) {
            axios.get(ConfigUtils.getConfigProp("qwc2serverUrl") + "/resolvepermalink?key=" + params.k)
            .then(response => {
                if(response.data.query) {
                    assign(params, response.data.query);
                    UrlParams.updateParams(params);
                }
                restoreMapConfig(dispatch, params);
            });
        } else {
            restoreMapConfig(dispatch, params);
        }
    };
}

module.exports = {loadMapConfig};
