/**
 * The geometry types supported by the measurement tool.
 * 
 * @see {@link MeasureUtils.MeasGeomTypes}
 * TODO: remove MeasureUtils.MeasGeomTypes when
 * the project is migrated to TypeScript
 */
export enum MeasGeomTypes {
    POINT ='Point',
    LINE_STRING ='LineString',
    POLYGON ='Polygon',
    ELLIPSE ='Ellipse',
    SQUARE ='Square',
    BOX ='Box',
    CIRCLE ='Circle',
    BEARING ='Bearing',
}


/**
 * Length units used for measurements on the map.
 */
export enum LengthUnits {
    FEET ="ft",
    METRES ="m",
    KILOMETRES ="km",
    MILES ="mi",
};


/**
 * Area units used for measurements on the map.
 */
export enum AreaUnits {
    SQUARE_FEET ="sqft",
    SQUARE_METRES ="sqm",
    SQUARE_KILOMETRES ="sqkm",
    SQUARE_MILES ="sqmi",
    HECTARES ="ha",
    ACRES ="acre",
};


/**
 * The state of the measurements in the redux store.
 */
export interface MeasurementsState {
    /**
     * The type of the geometry.
     */
    geomType: MeasGeomTypes;

    /**
     * The coordinates of the geometry.
     * 
     * This is a list of coordinates, where each coordinate
     * is a list of two numbers.
     */
    coordinates: number[][];

    /**
     * The length of the geometry defined by `coordinates`.
     */
    length: number;

    /**
     * The area of the geometry defined by `coordinates`.
     */
    area: number;

    /**
     * The bearing of the geometry defined by `coordinates`.
     */
    bearing: number;

    /**
     * The unit used for the length.
     */
    lenUnit: LengthUnits;

    /**
     * The unit used for the area.
     */
    areaUnit: AreaUnits;

    /**
     * The number of decimals to use when displaying the measurements.
     */
    decimals: number;
}


/**
 * The settings expected by the `updateFeatureMeasurements` function.
 */
export interface UpdateFeatMeasSetting {
    /**
     * The unit used for the length.
     */
    lenUnit?: LengthUnits;

    /**
     * The unit used for the area.
     */
    areaUnit?: AreaUnits;

    /**
     * The number of decimals to use when displaying the measurements.
     */
    decimals?: number;

    /**
     * The coordinate system of the coordinates.
     */
    mapCrs: string;

    /**
     * The coordinate system used for presenting 
     * coordinates to the user.
     */
    displayCrs: string;
}
