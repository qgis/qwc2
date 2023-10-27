import { Size } from "ol/size";

/**
 * The unique identifier of a layer.
 */
export type LayerId = string;

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
    /**
     * TODO: What is this? Unique identifier?
     */
    name: string;

    /**
     * The label for the UI.
     */
    title: string;

    /**
     * TODO?
     */
    abstract: boolean;

    /**
     * The source of the layer.
     */
    attribution: LayerAttribution;

    /**
     * The location of the layer.
     */
    url: string;

    /**
     * The extends of this layer and the CRS it is in
     * (e.g. `EPSG:4326`).
     */
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
 * The parameters accepted by the WNS service.
 */
export interface WmsParams {

    /**
     * A comma-separated list of layers.
     */
    LAYERS: string;

    /**
     * A comma-separated list of opacities.
     */
    OPACITIES: string;

    /**
     * A comma-separated list of styles.
     */
    STYLES: string;
}


/**
 * A WMS (un-tiled) layer.
 * 
 * @see https://docs.geoserver.org/stable/en/user/services/wms/reference.html
 */ 
export interface WmsLayer extends BaseLayer {
    type: "wms";

    /**
     * The URL for retrieving detailed information about a feature.
     */
    featureInfoUrl: string;

    /**
     * The legend URL.
     */
    legendUrl: string;

    /**
     * The version of the WMS protocol.
     * 
     * Note that GeoServer supports WMS 1.1.1, the most widely used version
     * of WMS, as well as WMS 1.3.0.
     */
    version: string;

    /**
     * TODO?
     * 
     * @see ConfigUtils, externalLayerFeatureInfoFormats
     */
    infoFormats: string[];

    /**
     * Can this layer be queried?
     */
    queryable: boolean;

    /**
     * The list of sub-layers.
     */
    sublayers?: null | WmsLayer[];

    /**
     * TODO Misplaced?
     */
    expanded: boolean;

    /**
     * TODO Misplaced?
     */
    visibility: true;
    
    /**
     * TODO Misplaced?
     */
    opacity: 255;

    /**
     * TODO?
     */
    extwmsparams: any;

    /**
     * The map scale below which the layer should became invisible.
     */
    minScale?: number;

    /**
     * The map scale above which the layer should became invisible.
     */
    maxScale?: number;

    /**
     * The parameters accepted by the WMS service.
     */
    params: WmsParams;
}


/**
 * An external layer.
 */
export type ExternalLayer = WmsLayer | WmstLayer;



/**
 * The configuration part of the layer.
 */
export interface LayerConfig {

    /**
     * The type of the layer.
     */
    type: "vector" | "wms" | "wmts" | "placeholder" | "separator";

    /**
     * The source URL of this layer.
     */
    url?: string;

    /**
     * TODO: What is the difference to `title` and `id`?
     */
    name: string;

    /**
     * The label for the label in the UI.
     */
    title: string;

    /**
     * Is this layer visible?
     * 
     * Note that the layers are assumed to be visible (`undefined` === `true`)
     * and are only considered invisible if this attribute is `false`.
     */
    visibility?: boolean;

    /**
     * The opacity of the layer [0-255].
     */
    opacity: number;

    /**
     * Parameters for the layer.
     * @todo specifically?
     */
    params: any;
};


/**
 * The key used to index external layers consists
 * of two parts separated by a column: the type and the url
 */
export type ExternalLayerKey = string;

export type ExternalLayerList = Record<ExternalLayerKey, ExternalLayer>;



/**
 * The data for a layer in the state.
 */
export interface LayerData extends LayerConfig {
    /**
     * The ID of the layer.
     */
    id: LayerId;

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
     * TODO ?
     */
    tristate?: boolean;

    /**
     * If true identifies this layer as a group in which only a single
     * sub-layer can be visible at any given time.
     */
    mutuallyExclusive?: boolean;

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

    /**
     * The map scale below which the layer should became visible
     * (inclusive).
     * 
     * This is the actual scale, not the denominator.
     * If `undefined` the layer has no minimum scale.
     */
    minScale?: number;

    /**
     * The map scale above which the layer should became visible
     * (exclusive).
     * 
     * This is the actual scale, not the denominator.
     * If `undefined` the layer has no maximum scale.
     */
    maxScale?: number;

    /**
     * The list of external layers.
     */
    externalLayerMap?: ExternalLayerList;

    /**
     * The external layer data.
     */
    externalLayer?: ExternalLayer;

    /**
     * The drawing order of the sub-layers; each item is a sub-layer name.
     */
    drawingOrder?: string[];
}

