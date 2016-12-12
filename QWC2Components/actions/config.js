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
const MapUtils = require('../../MapStore2/web/client/utils/MapUtils');
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

    // Set map center and zoom based on extent param
    let bounds = (params.e || "").split(";").map(x => parseFloat(x));
    if (bounds.length === 4) {
        let bbox = {
            bounds: {
                minx: bounds[0],
                miny: bounds[1],
                maxx: bounds[2],
                maxy: bounds[3]
            },
            crs: "EPSG:4326",
            rotation: 0
        };
        mapConfig.map.bbox = bbox;
        UrlParams.updateParams({i: undefined});
    } else {
        UrlParams.updateParams({i: 1});
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
