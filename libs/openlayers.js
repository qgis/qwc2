/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import OlCollection from 'ol/Collection';
import OlFeature from 'ol/Feature';
import OlGeolocation from 'ol/Geolocation';
import OlKinetic from 'ol/Kinetic';
import OlMap from 'ol/Map';
import OlObject from 'ol/Object';
import OlOverlay from 'ol/Overlay';
import OlTileQueue from 'ol/TileQueue';
import OlView from 'ol/View';
import {defaults as olControlDefaults} from 'ol/control';
import OlControlAttribution from 'ol/control/Attribution';
import OlControlOverviewMap from 'ol/control/OverviewMap';
import OlControlScaleLine from 'ol/control/ScaleLine';
import OlControlZoom from 'ol/control/Zoom';
import * as OlEventsCondition from 'ol/events/condition';
import * as OlExtent from 'ol/extent';
import OlFormatGML2 from 'ol/format/GML2';
import OlFormatGML3 from 'ol/format/GML3';
import OlFormatGML32 from 'ol/format/GML32';
import OlFormatGeoJSON from 'ol/format/GeoJSON';
import OlFormatKML from 'ol/format/KML';
import OlFormatMVT from 'ol/format/MVT';
import OlFormatWFS from 'ol/format/WFS';
import OlFormatWKT from 'ol/format/WKT';
import OlFormatWMSCapabilities from 'ol/format/WMSCapabilities';
import OlFormatWMTSCapabilities from 'ol/format/WMTSCapabilities';
import OlGeomCircle from 'ol/geom/Circle';
import OlGeomGeometryCollection from 'ol/geom/GeometryCollection';
import OlGeomMultiPoint from 'ol/geom/MultiPoint';
import OlGeomPoint from 'ol/geom/Point';
import OlGeomPolygon from 'ol/geom/Polygon';
import {fromCircle as olPolygonFromCircle} from 'ol/geom/Polygon';
import {defaults as olInteractionDefaults} from 'ol/interaction';
import OlInteractionDoubleClickZoom from 'ol/interaction/DoubleClickZoom';
import OlInteractionDragBox from 'ol/interaction/DragBox';
import OlInteractionDragPan from 'ol/interaction/DragPan';
import OlInteractionDraw from 'ol/interaction/Draw';
import {createBox as olCreateBox} from 'ol/interaction/Draw';
import OlInteractionInteraction from 'ol/interaction/Interaction';
import OlInteractionKeyboardPan from 'ol/interaction/KeyboardPan';
import OlInteractionKeyboardZoom from 'ol/interaction/KeyboardZoom';
import OlInteractionModify from 'ol/interaction/Modify';
import OlInteractionMouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import OlInteractionPointer from 'ol/interaction/Pointer';
import OlInteractionSelect from 'ol/interaction/Select';
import OlInteractionSnap from 'ol/interaction/Snap';
import OlInteractionTranslate from 'ol/interaction/Translate';
import OlGraticule from 'ol/layer/Graticule';
import OlLayerGroup from 'ol/layer/Group';
import OlLayerImage from 'ol/layer/Image';
import OlLayer from 'ol/layer/Layer';
import OlLayerTile from 'ol/layer/Tile';
import OlLayerVector from 'ol/layer/Vector';
import OlLayerVectorTile from 'ol/layer/VectorTile';
import * as OlLoadingstrategy from 'ol/loadingstrategy';
import * as OlProj from 'ol/proj';
import OlSourceBingMaps from 'ol/source/BingMaps';
import OlSourceImageStatic from 'ol/source/ImageStatic';
import OlSourceImageWMS from 'ol/source/ImageWMS';
import OlSourceOSM from 'ol/source/OSM';
import OlSourceTileWMS from 'ol/source/TileWMS';
import OlSourceVector from 'ol/source/Vector';
import OlSourceVectorTile from 'ol/source/VectorTile';
import OlSourceWMTS from 'ol/source/WMTS';
import OlSourceXYZ from 'ol/source/XYZ';
import * as OlSphere from 'ol/sphere';
import OlStyleCircle from 'ol/style/Circle';
import OlStyleFill from 'ol/style/Fill';
import OlStyleIcon from 'ol/style/Icon';
import OlStyleRegularShape from 'ol/style/RegularShape';
import OlStyleStroke from 'ol/style/Stroke';
import OlStyleStyle from 'ol/style/Style';
import OlStyleText from 'ol/style/Text';
import OlTilegridTileGrid from 'ol/tilegrid/TileGrid';
import OlTilegridWMTS from 'ol/tilegrid/WMTS';
import OlInteractionDrawRegular from 'ol-ext/interaction/DrawRegular';
import OlInteractionTransform from 'ol-ext/interaction/Transform';

import 'ol/ol.css';


export default {
    Attribution: OlControlAttribution,
    Collection: OlCollection,
    control: {
        defaults: olControlDefaults,
        OverviewMap: OlControlOverviewMap,
        ScaleLine: OlControlScaleLine,
        Zoom: OlControlZoom
    },
    events: {
        condition: OlEventsCondition
    },
    extent: OlExtent,
    Feature: OlFeature,
    format: {
        GeoJSON: OlFormatGeoJSON,
        GML2: OlFormatGML2,
        GML3: OlFormatGML3,
        GML32: OlFormatGML32,
        KML: OlFormatKML,
        MVT: OlFormatMVT,
        WFS: OlFormatWFS,
        WMSCapabilities: OlFormatWMSCapabilities,
        WMTSCapabilities: OlFormatWMTSCapabilities,
        WKT: OlFormatWKT
    },
    Geolocation: OlGeolocation,
    geom: {
        Circle: OlGeomCircle,
        GeometryCollection: OlGeomGeometryCollection,
        MultiPoint: OlGeomMultiPoint,
        Point: OlGeomPoint,
        Polygon: OlGeomPolygon,
        polygonFromCircle: olPolygonFromCircle
    },
    Graticule: OlGraticule,
    interaction: {
        defaults: olInteractionDefaults,
        DoubleClickZoom: OlInteractionDoubleClickZoom,
        DragPan: OlInteractionDragPan,
        DragBox: OlInteractionDragBox,
        Draw: OlInteractionDraw,
        DrawRegular: OlInteractionDrawRegular,
        createBox: olCreateBox,
        Interaction: OlInteractionInteraction,
        Modify: OlInteractionModify,
        MouseWheelZoom: OlInteractionMouseWheelZoom,
        KeyboardZoom: OlInteractionKeyboardZoom,
        KeyboardPan: OlInteractionKeyboardPan,
        Pointer: OlInteractionPointer,
        Select: OlInteractionSelect,
        Snap: OlInteractionSnap,
        Transform: OlInteractionTransform,
        Translate: OlInteractionTranslate
    },
    Kinetic: OlKinetic,
    layer: {
        Layer: OlLayer,
        Image: OlLayerImage,
        Tile: OlLayerTile,
        Vector: OlLayerVector,
        VectorTile: OlLayerVectorTile,
        Group: OlLayerGroup
    },
    loadingstrategy: OlLoadingstrategy,
    Map: OlMap,
    Object: OlObject,
    Overlay: OlOverlay,
    proj: OlProj,
    source: {
        BingMaps: OlSourceBingMaps,
        ImageStatic: OlSourceImageStatic,
        ImageWMS: OlSourceImageWMS,
        OSM: OlSourceOSM,
        TileWMS: OlSourceTileWMS,
        Vector: OlSourceVector,
        VectorTile: OlSourceVectorTile,
        WMTS: OlSourceWMTS,
        XYZ: OlSourceXYZ
    },
    sphere: OlSphere,
    style: {
        Circle: OlStyleCircle,
        Fill: OlStyleFill,
        Icon: OlStyleIcon,
        RegularShape: OlStyleRegularShape,
        Stroke: OlStyleStroke,
        Style: OlStyleStyle,
        Text: OlStyleText
    },
    tilegrid: {
        TileGrid: OlTilegridTileGrid,
        WMTS: OlTilegridWMTS
    },
    View: OlView,
    TileQueue: OlTileQueue
};

// Overrides to inject requestsPaused into view state
OlView.prototype.superGetState = OlView.prototype.getState;
OlView.prototype.getState = function() {
    return {
        ...this.superGetState(),
        requestsPaused: this.requestsPaused_
    };
};

OlView.prototype.setRequestsPaused = function(paused) {
    this.requestsPaused_ = paused;
};

// Overrides to pause image loading when requests are paused
OlLayer.prototype.superRender = OlLayer.prototype.render;
OlLayer.prototype.render = function(frameState, target) {
    if (!frameState.viewState.requestsPaused || !this.getRenderer().getImage) {
        return this.superRender(frameState, target);
    } else if (this.getRenderer().getImage()) {
        return this.getRenderer().renderFrame(frameState, target);
    } else {
        return null;
    }
};

// Overrides to pause tile loading when requests are paused
OlTileQueue.prototype.superLoadMoreTiles = OlTileQueue.prototype.loadMoreTiles;
OlTileQueue.prototype.loadMoreTiles = function(maxTotalLoading, maxNewLoads) {
    if (!this.requestsPaused_) {
        this.superLoadMoreTiles(maxTotalLoading, maxNewLoads);
    }
};

OlTileQueue.prototype.setRequestsPaused = function(paused) {
    this.requestsPaused_ = paused;
};
