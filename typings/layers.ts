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


/**
 * The data for a layer in the state.
 */
export interface LayerData {
    /**
     * The ID of the layer.
     */
    id: string;

    /**
     * The type of the layer.
     */
    type: "vector" | "wms" | "wmts" | "placeholder";

    /**
     * The label for the label in the UI.
     */
    name: string;

    /**
     * The UUID of the layer.
     */
    uuid: string;

    /**
     * The list of features for the layer.
     */
    features: Record<string, any>;

    /**
     * The role of the layer.
     * @see {@link LayerRole}
     */
    role: number;

    /**
     * Can this layer be queried?
     */
    queryable: boolean;

    /**
     * Is this layer visible?
     */
    visibility: boolean;

    /**
     * The opacity of the layer [0-255].
     */
    opacity: number;

    /**
     * Is the layer tree hidden?
     */
    layertreehidden: boolean;

    /**
     * The bounding box for this layer.
     */
    bbox: [number, number, number, number];

    /**
     * TODO: Time-related?
     */
    dimensionValues: Record<string, any>;

    /**
     * The date and time of the last revision.
     */
    rev: Date;

    /**
     * Is the layer loading?
     */
    loading: boolean;
    
    /**
     * The list of sub-layers.
     */
    sublayers?: LayerData[];
}

