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
const UrlParams = require("../utils/UrlParams");
var axios = require('../../MapStore2/web/client/libs/ajax');

function loadMapConfig(configName, mapId) {
    return (dispatch) => {
      var params = UrlParams.getParams();
      if(params.s) {
        dispatch(searchTextChanged(params.s));
      }

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
              dispatch(configureMap(response.data, mapId));
          } else {
              try {
                  JSON.parse(response.data);
              } catch(e) {
                  dispatch(configureError('Configuration file broken (' + configName + '): ' + e.message));
              }
          }
      }).catch((e) => {
          dispatch(configureError(e));
      });
    };
}

module.exports = {loadMapConfig}
