/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const LayerRegistry = {
    'bing': require('./BingLayer'),
    'google': require('./GoogleLayer'),
    'graticule': require('./GraticuleLayer'),
    'mapquest': require('./MapQuest'),
    'osm': require('./OSMLayer'),
    'overlay': require('./OverlayLayer'),
    'tileprovider': require('./TileProviderLayer'),
    'vector': require('./VectorLayer'),
    'wms': require('./WMSLayer'),
    'wmts': require('./WMTSLayer'),
    'wfs': require('./WFSLayer')
};

module.exports = LayerRegistry;
