
export type Color = [number, number, number, number];


/**
 * The default style for features.
 */
export interface DefaultFeatureStyle {
    /**
     * The color of the stroke.
     */
    strokeColor: Color,

    /**
     * The width of the stroke.
     */
    strokeWidth: number,

    /**
     * TODO: ?.
     */
    strokeDash: number[],

    /**
     * The color used to fill the interior of the feature.
     */
    fillColor: Color,

    /**
     * The radius of the circle.
     */
    circleRadius: number,

    /**
     * The color used for filling the letters.
     */
    textFill: string,

    /**
     * The color used for the stroke of the letters.
     */
    textStroke: string
}


/**
 * The configuration data for the application.
 */
export interface ConfigData {
    /**
     * The path where the translation files are served.
     */
    translationsPath: string;

    /**
     * The path where the asset files are served.
     * @default "/assets/"
     */
    assetsPath: string;

    /**
     * The default style for features.
     */
    defaultFeatureStyle: DefaultFeatureStyle

    /**
     * TODO: ?
     * @see {@link MeasureUtils.updateFeatureMeasurements}
     */
    geodesicMeasurements: boolean;
}


/**
 * The configuration state in redux store.
 */
export interface ConfigState extends ConfigData {
    /**
     * TODO: ?
     */
    startupParams: object;

    /**
     * The color scheme for the application.
     * @default "default"
     */
    colorScheme: string;
}
