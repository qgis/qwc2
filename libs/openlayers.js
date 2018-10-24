/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

require('ol/ol.css');

module.exports = {
  inherits: require('ol').inherits,
  Attribution: require('ol/control/Attribution').default,
  Collection: require('ol/Collection').default,
  control: {
    defaults: require('ol/control').defaults,
    OverviewMap: require('ol/control/OverviewMap').default,
    ScaleLine: require('ol/control/ScaleLine').default,
    Zoom: require('ol/control/Zoom').default
  },
  events: {
    condition: require('ol/events/condition')
  },
  extent: require('ol/extent'),
  Feature: require('ol/Feature').default,
  format: {
    GeoJSON: require('ol/format/GeoJSON').default,
    GML2: require('ol/format/GML2').default,
    GML3: require('ol/format/GML3').default,
    KML: require('ol/format/KML').default,
    WFS: require('ol/format/WFS').default,
    WMSCapabilities: require('ol/format/WMSCapabilities').default,
    WKT: require('ol/format/WKT').default
  },
  Geolocation: require('ol/Geolocation').default,
  geom: {
    Circle: require('ol/geom/Circle').default,
    GeometryCollection: require('ol/geom/GeometryCollection').default,
    MultiPoint: require('ol/geom/MultiPoint').default,
    Point: require('ol/geom/Point').default,
    Polygon: require('ol/geom/Polygon').default
  },
  Graticule: require('ol/Graticule').default,
  interaction: {
    defaults: require('ol/interaction').defaults,
    DoubleClickZoom: require('ol/interaction/DoubleClickZoom').default,
    DragPan: require('ol/interaction/DragPan').default,
    Draw: require('ol/interaction/Draw').default,
    Modify: require('ol/interaction/Modify').default,
    MouseWheelZoom: require('ol/interaction/MouseWheelZoom').default,
    Select: require('ol/interaction/Select').default,
    Translate: require('ol/interaction/Translate').default
  },
  layer: {
    Image: require('ol/layer/Image').default,
    Tile: require('ol/layer/Tile').default,
    Vector: require('ol/layer/Vector').default
  },
  loadingstrategy: require('ol/loadingstrategy'),
  Map: require('ol/Map').default,
  Object: require('ol/Object').default,
  Overlay: require('ol/Overlay').default,
  proj: require('ol/proj'),
  source: {
    BingMaps: require('ol/source/BingMaps').default,
    ImageWMS: require('ol/source/ImageWMS').default,
    OSM: require('ol/source/OSM').default,
    TileWMS: require('ol/source/TileWMS').default,
    Vector: require('ol/source/Vector').default,
    WMTS: require('ol/source/WMTS').default,
    XYZ: require('ol/source/XYZ').default
  },
  sphere: require('ol/sphere'),
  style: {
    Circle: require('ol/style/Circle').default,
    Fill: require('ol/style/Fill').default,
    Icon: require('ol/style/Icon').default,
    RegularShape: require('ol/style/RegularShape').default,
    Stroke: require('ol/style/Stroke').default,
    Style: require('ol/style/Style').default,
    Text: require('ol/style/Text').default
  },
  tilegrid: {
    TileGrid: require('ol/tilegrid/TileGrid').default,
    WMTS: require('ol/tilegrid/WMTS').default
  },
  View: require('ol/View').default
};
