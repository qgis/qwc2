/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {configureMap, configureError} = require('../../MapStore2/web/client/actions/config');
const {searchTextChanged} = require('../../MapStore2/web/client/actions/search');
const {changeLayerProperties} = require('../../MapStore2/web/client/actions/layers');
const {setCurrentTheme} = require('./theme');
const ConfigUtils = require('../../MapStore2/web/client/utils/ConfigUtils');
const UrlParams = require("../utils/UrlParams");
const assign = require('object-assign');
const axios = require('../../MapStore2/web/client/libs/ajax');

function restoreMapConfig(dispatch, configName, mapId, params) {
    axios.get(configName).then((response) => {
        if (typeof response.data === 'object') {
            // Tweak active layer based on url bl param
            if(params.bl) {
                try {
                    if(response.data.map.layers.find((obj) => { return obj.name === params.bl})) {
                        response.data.map.layers.map((entry) => {
                            entry.visibility = entry.name === params.bl;
                        });
                    }
                } catch(e) {}
            }
            // Set map center based on x, y params
            if(params.x && params.y) {
                try {
                    response.data.map.center = assign(response.data.map.center, {
                        x: parseFloat(params.x),
                        y: parseFloat(params.y),
                        crs: "EPSG:4326"
                    });
                } catch(e) {}
            }
            // Set map zoom based on z param
            if(params.z) {
                try {
                    response.data.map.zoom = parseInt(params.z);
                } catch(e) {}
            }
            dispatch(configureMap(response.data, mapId));

            // Set search text based on url s param
            if(params.s) {
                dispatch(searchTextChanged(params.s));
            }
        } else {
            try {
              JSON.parse(response.data);
            } catch(e) {
              console.log('Configuration file broken (' + configName + '): ' + e.message);
            }
        }
    }).catch((e) => {
        console.log(e.message);
    });
}

function loadMapConfig(configName, mapId) {
    return (dispatch) => {

        var params = UrlParams.getParams();

        if(params.k) {
            fetch(ConfigUtils.getConfigProp("qwc2serverUrl") + "/resolvepermalink?key=" + params.k)
            .then(response => response.json())
            .then(obj => {
                if(obj.query) {
                    assign(params, obj.query);
                    UrlParams.updateParams(params);
                }
                restoreMapConfig(dispatch, configName, mapId, params);
            });
        } else {
            restoreMapConfig(dispatch, configName, mapId, params);
        }
    };
}

module.exports = {loadMapConfig}
