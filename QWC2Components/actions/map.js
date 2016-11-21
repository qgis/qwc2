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
        let x = Math.round(center.x * 100000.) / 100000.;
        let y = Math.round(center.y * 100000.) / 100000.;
        UrlParams.updateParams({x: x, y: y, z: zoom});
        dispatch(require('../../MapStore2/web/client/actions/map').changeMapView(center, zoom, bbox, size, mapStateSource, projection));
    };
}

module.exports = {changeMapView};
