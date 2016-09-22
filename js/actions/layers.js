/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const UrlParams = require("../utils/UrlParams");
const store = require("../stores/store");

function changeLayerProperties(layer, properties) {
    return (dispatch, getState) => {
      if(properties.visibility) {
        try {
          // Find name for layerid
          var layerObj = getState().layers.flat.find((obj) => {return obj.id === layer});
          if(layerObj) {
            UrlParams.updateParams({bl: layerObj.name});
          }
        } catch(e) {}
      }
      dispatch(require('../../MapStore2/web/client/actions/layers').changeLayerProperties(layer, properties));
    }

}

module.exports = {changeLayerProperties};
