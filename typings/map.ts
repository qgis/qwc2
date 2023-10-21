
/**
 * The bounds of the map and current rotation.
 */
export interface MapBox {
    /**
     * The bounds of the map.
     */
    bounds: [number, number, number, number];

    /**
     * The current rotation in radians.
     */
    rotation: number;
}


/**
 * Snapping status.
 */
export interface MapSnapping {
    /**
     * Whether snapping is enabled.
     */
    enabled: boolean;

    /**
     * Whether snapping is active.
     */
    active: boolean;
}


/**
 * The data for the map that is kept in redux store.
 */
export interface MapState {
    /**
     * The bounds of the map and current rotation.
     */
    bbox: MapBox;

    /**
     * The center of the map.
     */
    center: [number, number];

    /**
     * The current resolution in dots-per-inch.
     */
    dpi: number;

    /**
     * The current projection.
     */
    projection: string;

    /**
     * The current zoom level.
     */
    zoom: number;

    /**
     * The list of scales.
     */
    scales: number[];

    /**
     * The list of resolutions.
     */
    resolutions: number[];

    /**
     * The size of the top bar in pixels.
     */
    topbarHeight: number;

    /**
     * TODO: ?
     */
    click: any;

    /**
     * Snapping status.
     */
    snapping: MapSnapping;
}
