/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

require('ol/ol.css');

const olProj = require('ol/proj').default;
const Proj4js = require('proj4').default;
olProj.setProj4(Proj4js);

module.exports = {
  inherits: require('ol').default.inherits,
  Attribution: require('ol/attribution').default,
  Collection: require('ol/collection').default,
  control: {
    defaults: require('ol/control').default.defaults,
    OverviewMap: require('ol/control/overviewmap').default,
    ScaleLine: require('ol/control/scaleline').default,
    Zoom: require('ol/control/zoom').default
  },
  events: {
    condition: require('ol/events/condition').default
  },
  extent: require('ol/extent').default,
  Feature: require('ol/feature').default,
  format: {
    GeoJSON: require('ol/format/geojson').default,
    GML2: require('ol/format/gml2').default,
    GML3: require('ol/format/gml3').default,
    KML: require('ol/format/kml').default,
    WFS: require('ol/format/wfs').default,
    WMSCapabilities: require('ol/format/wmscapabilities').default,
    WKT: require('ol/format/wkt').default
  },
  Geolocation: require('ol/geolocation').default,
  geom: {
    Circle: require('ol/geom/circle').default,
    GeometryCollection: require('ol/geom/geometrycollection').default,
    MultiPoint: require('ol/geom/multipoint').default,
    Point: require('ol/geom/point').default,
    Polygon: require('ol/geom/polygon').default
  },
  Graticule: require('ol/graticule').default,
  interaction: {
    defaults: require('ol/interaction').default.defaults,
    DoubleClickZoom: require('ol/interaction/doubleclickzoom').default,
    DragPan: require('ol/interaction/dragpan').default,
    Draw: require('ol/interaction/draw').default,
    Modify: require('ol/interaction/modify').default,
    MouseWheelZoom: require('ol/interaction/mousewheelzoom').default,
    Select: require('ol/interaction/select').default,
    Translate: require('ol/interaction/translate').default
  },
  layer: {
    Image: require('ol/layer/image').default,
    Tile: require('ol/layer/tile').default,
    Vector: require('ol/layer/vector').default
  },
  loadingstrategy: require('ol/loadingstrategy').default,
  Map: require('ol/map').default,
  Object: require('ol/object').default,
  Overlay: require('ol/overlay').default,
  proj: require('ol/proj').default,
  source: {
    BingMaps: require('ol/source/bingmaps').default,
    ImageWMS: require('ol/source/imagewms').default,
    OSM: require('ol/source/osm').default,
    TileWMS: require('ol/source/tilewms').default,
    Vector: require('ol/source/vector').default,
    WMTS: require('ol/source/wmts').default,
    XYZ: require('ol/source/xyz').default
  },
  Sphere: require('ol/sphere').default,
  style: {
    Circle: require('ol/style/circle').default,
    Fill: require('ol/style/fill').default,
    Icon: require('ol/style/icon').default,
    RegularShape: require('ol/style/regularshape').default,
    Stroke: require('ol/style/stroke').default,
    Style: require('ol/style/style').default,
    Text: require('ol/style/text').default
  },
  tilegrid: {
    WMTS: require('ol/tilegrid/wmts').default
  },
  View: require('ol/view').default
};
