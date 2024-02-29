/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import bingLayer from './BingLayer';
import googleLayer from './GoogleLayer';
import graticuleLayer from './GraticuleLayer';
import imageLayer from './ImageLayer';
import mvtLayer from './MVTLayer';
import osmLayer from './OSMLayer';
import overlayLayer from './OverlayLayer';
import vectorLayer from './VectorLayer';
import wfsLayer from './WFSLayer';
import wmsLayer from './WMSLayer';
import wmtsLayer from './WMTSLayer';
import xyzLayer from './XYZLayer';

export default {
    bing: bingLayer,
    google: googleLayer,
    graticule: graticuleLayer,
    image: imageLayer,
    mvt: mvtLayer,
    osm: osmLayer,
    overlay: overlayLayer,
    vector: vectorLayer,
    wms: wmsLayer,
    wmts: wmtsLayer,
    wfs: wfsLayer,
    xyz: xyzLayer
};
