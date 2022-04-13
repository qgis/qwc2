/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import OlControlAttribution from 'ol/control/Attribution';
import OlCollection from 'ol/Collection';
import {defaults as olControlDefaults} from 'ol/control';
import OlControlOverviewMap from 'ol/control/OverviewMap';
import OlControlScaleLine from 'ol/control/ScaleLine';
import OlControlZoom from 'ol/control/Zoom';
import * as OlEventsCondition from 'ol/events/condition';
import * as OlExtent from 'ol/extent';
import OlFeature from 'ol/Feature';
import OlFormatGeoJSON from 'ol/format/GeoJSON';
import OlFormatGML2 from 'ol/format/GML2';
import OlFormatGML3 from 'ol/format/GML3';
import OlFormatKML from 'ol/format/KML';
import OlFormatWFS from 'ol/format/WFS';
import OlFormatWMSCapabilities from 'ol/format/WMSCapabilities';
import OlFormatWMTSCapabilities from 'ol/format/WMTSCapabilities';
import OlFormatWKT from 'ol/format/WKT';
import OlGeolocation from 'ol/Geolocation';
import OlGeomCircle from 'ol/geom/Circle';
import OlGeomGeometryCollection from 'ol/geom/GeometryCollection';
import OlGeomMultiPoint from 'ol/geom/MultiPoint';
import OlGeomPoint from 'ol/geom/Point';
import OlGeomPolygon from 'ol/geom/Polygon';
import OlGraticule from 'ol/layer/Graticule';
import {defaults as olInteractionDefaults} from 'ol/interaction';
import OlInteractionDoubleClickZoom from 'ol/interaction/DoubleClickZoom';
import OlInteractionDragPan from 'ol/interaction/DragPan';
import OlInteractionDraw from 'ol/interaction/Draw';
import {createBox as olCreateBox} from 'ol/interaction/Draw';
import OlInteractionInteraction from 'ol/interaction/Interaction';
import OlInteractionModify from 'ol/interaction/Modify';
import OlInteractionMouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import OlInteractionSelect from 'ol/interaction/Select';
import OlInteractionSnap from 'ol/interaction/Snap';
import OlInteractionTranslate from 'ol/interaction/Translate';
import OlLayer from 'ol/layer/Layer';
import OlLayerImage from 'ol/layer/Image';
import OlLayerTile from 'ol/layer/Tile';
import OlLayerVector from 'ol/layer/Vector';
import OlLayerGroup from 'ol/layer/Group';
import * as OlLoadingstrategy from 'ol/loadingstrategy';
import OlMap from 'ol/Map';
import OlObject from 'ol/Object';
import OlOverlay from 'ol/Overlay';
import * as OlProj from 'ol/proj';
import OlSourceBingMaps from 'ol/source/BingMaps';
import OlSourceImageWMS from 'ol/source/ImageWMS';
import OlSourceOSM from 'ol/source/OSM';
import OlSourceTileWMS from 'ol/source/TileWMS';
import OlSourceVector from 'ol/source/Vector';
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
import OlTileQueue from 'ol/TileQueue';
import OlTilegridTileGrid from 'ol/tilegrid/TileGrid';
import OlTilegridWMTS from 'ol/tilegrid/WMTS';
import OlView from 'ol/View';
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
        KML: OlFormatKML,
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
        Polygon: OlGeomPolygon
    },
    Graticule: OlGraticule,
    interaction: {
        defaults: olInteractionDefaults,
        DoubleClickZoom: OlInteractionDoubleClickZoom,
        DragPan: OlInteractionDragPan,
        Draw: OlInteractionDraw,
        createBox: olCreateBox,
        Interaction: OlInteractionInteraction,
        Modify: OlInteractionModify,
        MouseWheelZoom: OlInteractionMouseWheelZoom,
        Select: OlInteractionSelect,
        Snap: OlInteractionSnap,
        Translate: OlInteractionTranslate
    },
    layer: {
        Layer: OlLayer,
        Image: OlLayerImage,
        Tile: OlLayerTile,
        Vector: OlLayerVector,
        Group: OlLayerGroup
    },
    loadingstrategy: OlLoadingstrategy,
    Map: OlMap,
    Object: OlObject,
    Overlay: OlOverlay,
    proj: OlProj,
    source: {
        BingMaps: OlSourceBingMaps,
        ImageWMS: OlSourceImageWMS,
        OSM: OlSourceOSM,
        TileWMS: OlSourceTileWMS,
        Vector: OlSourceVector,
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
