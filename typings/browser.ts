
/**
 * Information about current environment.
 */
export interface BrowserData {
    ie: boolean;
    ie11: boolean;
    ielt9: boolean;
    webkit: boolean;
    gecko: boolean;

    android: boolean;
    android23: boolean;

    chrome: boolean;

    ie3d: boolean;
    webkit3d: boolean;
    gecko3d: boolean;
    opera3d: boolean;
    any3d: boolean;

    mobile: boolean;
    mobileWebkit: boolean;
    mobileWebkit3d: boolean;
    mobileOpera: boolean;

    touch: boolean;
    msPointer: boolean;
    pointer: boolean;

    retina: boolean;

    /**
     * A string identifying the platform on which
     * the user's browser is running.
     * 
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/platform
     */
    platform: string;
}
