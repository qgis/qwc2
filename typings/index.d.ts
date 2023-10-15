import { Size } from "ol/size";

/**
 * The size of the tile.
 */
export type TileSize = [number, number];

/**
 * Information about the source of the layer.
 */
export interface LayerAttribution {
    Title: string;
    OnlineResource: string;
}

/**
 * The bounding box for a layer which includes the CRS.
 */
export interface LayerBox {
    crs: string;
    bounds: any;
}

/**
 * Common interface for all layers.
 */
export interface BaseLayer {
    name: string;
    title: string;
    abstract: boolean;
    attribution: LayerAttribution;
    url: string;
    bbox: LayerBox;
}


/**
 * A WMTS (tiled) layer.
 */
export interface WmstLayer extends BaseLayer {
    type: "wmts";
    capabilitiesUrl: string;
    tileMatrixPrefix: string;
    tileMatrixSet: string;
    originX: number;
    originY: number;
    projection: string;
    tileSize: Size;
    style: object;
    format: string;
    requestEncoding: string;
    resolutions: number[];
}


/**
 * A WMS (untiled) layer.
 */
export interface WmsLayer extends BaseLayer {
    type: "wms";
    featureInfoUrl: string;
    legendUrl: string;
    version: string;
    infoFormats: string[];
    queryable: boolean;
    sublayers: null | WmsLayer[];
    expanded: boolean;
    visibility: true;
    opacity: 255;
    extwmsparams: any;
    minScale: number;
    maxScale: number;
}


/**
 * A layer in Qwc2.
 */
export type Layer = WmsLayer | WmstLayer;
