/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import vectorLayer from './VectorLayer3D';
import wfsLayer from './WFSLayer3D';
import wmsLayer from './WMSLayer3D';
import wmtsLayer from './WMTSLayer3D';

export default {
    vector: vectorLayer,
    wfs: wfsLayer,
    wms: wmsLayer,
    wmts: wmtsLayer
};
