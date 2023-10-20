import Proj4js from 'proj4';
import { register as olProj4Register } from 'ol/proj/proj4';
import { 
    toBeDeepCloseTo, toMatchCloseTo 
} from 'jest-matcher-deep-close-to';
import "jest-location-mock";

import { JSDOM } from "jsdom";

expect.extend({ 
    toBeDeepCloseTo, toMatchCloseTo 
});

export const feetCRS = "EPSG:2225";

/**
 * By default only a handful of transformations are registered in Proj4js.
 * This function registers the CRS used by the tests.
 * @private
 */
export function registerFeetCrs() {
    if (Proj4js.defs(feetCRS) === undefined) {
        Proj4js.defs(
            feetCRS,
            "+proj=lcc +lat_0=39.3333333333333 +lon_0=-122 " +
            "+lat_1=41.6666666666667 +lat_2=40 " +
            "+x_0=2000000.0001016 +y_0=500000.0001016 " +
            "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft " +
            "+no_defs +type=crs"
        );
        olProj4Register(Proj4js);
    }
};

registerFeetCrs();

// Window and document mocking.
const dom = new JSDOM();
global.document = dom.window.document;
global.window = dom.window;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
