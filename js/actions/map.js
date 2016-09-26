/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const UrlParams = require("../utils/UrlParams");

function changeMapView(center, zoom, bbox, size, mapStateSource, projection) {
    return (dispatch) => {
        UrlParams.updateParams({x: center.x, y: center.y, z: zoom});
        dispatch(require('../../MapStore2/web/client/actions/map').changeMapView(center, zoom, bbox, size, mapStateSource, projection));
    };
}

module.exports = {changeMapView};
