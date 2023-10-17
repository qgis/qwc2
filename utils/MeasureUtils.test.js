import { Polygon, Point, LineString, Circle } from 'ol/geom';
import { Feature } from 'ol';
import Proj4js from 'proj4';
import { register as olProj4Register } from 'ol/proj/proj4';
import { toBeDeepCloseTo, toMatchCloseTo } from 'jest-matcher-deep-close-to';

import MeasureUtils, {
    LengthUnits, MeasUnits, AreaUnits, MeasGeomTypes
} from './MeasureUtils';
import LayerUtils from './LocaleUtils';

jest.mock('./LocaleUtils');
expect.extend({ toBeDeepCloseTo, toMatchCloseTo });

beforeEach(() => {
    LayerUtils.toLocaleFixed.mockImplementation((number, digits) => {
        return number.toFixed(digits);
    });
});

const coords = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
    [0, 0]
];

/**
 * A polygon with no hole.
 */
const somePolygon = new Polygon([coords]);

const feetCRS = "EPSG:2225";
/**
 * By default only a handful of transformations are registered in Proj4js.
 * This function registers the CRS used by the tests.
 * @private
 */
function registerFeetCrs() {
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


describe("getFormattedBearingValue", () => {
    it("should return a formatted bearing value", () => {
        expect(
            MeasureUtils.getFormattedBearingValue(0)
        ).toEqual("N 0° 0' 0'' E");
        expect(
            MeasureUtils.getFormattedBearingValue(45)
        ).toEqual("N 45° 0' 0'' E");
        expect(
            MeasureUtils.getFormattedBearingValue(90)
        ).toEqual("S 90° 0' 0'' E");
        expect(
            MeasureUtils.getFormattedBearingValue(135)
        ).toEqual("S 45° 0' 0'' E");
        expect(
            MeasureUtils.getFormattedBearingValue(180)
        ).toEqual("S 0° 0' 0'' E");
        expect(
            MeasureUtils.getFormattedBearingValue(225)
        ).toEqual("S 45° 0' 0'' W");
        expect(
            MeasureUtils.getFormattedBearingValue(270)
        ).toEqual("N 90° 0' 0'' W");
        expect(
            MeasureUtils.getFormattedBearingValue(315)
        ).toEqual("N 45° 0' 0'' W");
        expect(
            MeasureUtils.getFormattedBearingValue(360)
        ).toEqual("N 0° 0' 0'' E");
    });
    it("should return N/A if the value is negative", () => {
        expect(
            MeasureUtils.getFormattedBearingValue(-1)
        ).toEqual("N/A");
    });
});


describe("getFormattedCoordinate", () => {
    it("should format a single value in array", () => {
        expect(
            MeasureUtils.getFormattedCoordinate([0.123], null, null, 0)
        ).toEqual("0");
        expect(
            MeasureUtils.getFormattedCoordinate([0.126], null, null, 1)
        ).toEqual("0.1");
        expect(
            MeasureUtils.getFormattedCoordinate([0.126], null, null, 2)
        ).toEqual("0.13");
    });
    it("should format multiple values in array", () => {
        expect(
            MeasureUtils.getFormattedCoordinate([0.123, 1, -1], null, null, 0)
        ).toEqual("0, 1, -1");
        expect(
            MeasureUtils.getFormattedCoordinate([0.123, 1, -1], null, null, 1)
        ).toEqual("0.1, 1.0, -1.0");
        expect(
            MeasureUtils.getFormattedCoordinate([0.123, 1, -1], null, null, 2)
        ).toEqual("0.12, 1.00, -1.00");
    });
    it("should work with same CRS in source and destination", () => {
        expect(
            MeasureUtils.getFormattedCoordinate(
                [0.123, 1, -1], "EPSG:4326", "EPSG:4326", 0
            )
        ).toEqual("0, 1, -1");

    });
    it("determines the number of decimals from CRS", () => {
        expect(
            MeasureUtils.getFormattedCoordinate(
                [0.123, 1, -1], "EPSG:4326", "EPSG:4326"
            )
        ).toEqual("0.1230, 1.0000, -1.0000");
        expect(
            MeasureUtils.getFormattedCoordinate(
                [0.123, 1, -1], "EPSG:3857", "EPSG:3857"
            )
        ).toEqual("0, 1, -1");
    });
    it("converts the coordinates", () => {
        expect(
            MeasureUtils.getFormattedCoordinate(
                [500000, 500000], "EPSG:3857", "EPSG:4326"
            )
        ).toEqual("4.4916, 4.4870");
        expect(
            MeasureUtils.getFormattedCoordinate(
                [0, 0], "EPSG:3857", "EPSG:4326"
            )
        ).toEqual("0.0000, 0.0000");
        expect(
            MeasureUtils.getFormattedCoordinate(
                [45, 45], "EPSG:4326", "EPSG:3857"
            )
        ).toEqual("5009377, 5621521");
    });
});


describe("formatDuration", () => {
    it("should format values", () => {
        expect(
            MeasureUtils.formatDuration(0)
        ).toEqual("00:00:00");
        expect(
            MeasureUtils.formatDuration(60)
        ).toEqual("00:01:00");
        expect(
            MeasureUtils.formatDuration(61)
        ).toEqual("00:01:01");
        expect(
            MeasureUtils.formatDuration(60 * 60)
        ).toEqual("01:00:00");
    });
    it("should wrap around at 24 hours", () => {
        expect(
            MeasureUtils.formatDuration(60 * 60 * 24)
        ).toEqual("00:00:00");
        expect(
            MeasureUtils.formatDuration(60 * 60 * 24 + 61)
        ).toEqual("00:01:01");
    });
    it("should handle negative values", () => {
        expect(
            MeasureUtils.formatDuration(-1)
        ).toEqual("23:59:59");
    });
    it("should ignore fractional part", () => {
        expect(
            MeasureUtils.formatDuration(61.123)
        ).toEqual("00:01:01");
        expect(
            MeasureUtils.formatDuration(61.99)
        ).toEqual("00:01:01");
    });
});

describe("formatMeasurement", () => {
    describe("metric", () => {
        describe("area", () => {
            describe("square-kilometers", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            1000001, true, 'metric', 0, true
                        )
                    ).toEqual("1 km²");
                    expect(
                        MeasureUtils.formatMeasurement(
                            1120000, true, 'metric', 2, true
                        )
                    ).toEqual("1.12 km²");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            1000001, true, 'metric', 0, false
                        )
                    ).toEqual("1");
                    expect(
                        MeasureUtils.formatMeasurement(
                            1120000, true, 'metric', 2, false
                        )
                    ).toEqual("1.12");
                });
            });
            describe("hectares", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            10001, true, 'metric', 0, true
                        )
                    ).toEqual("1 ha");
                    expect(
                        MeasureUtils.formatMeasurement(
                            11200, true, 'metric', 2, true
                        )
                    ).toEqual("1.12 ha");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            10001, true, 'metric', 0, false
                        )
                    ).toEqual("1");
                    expect(
                        MeasureUtils.formatMeasurement(
                            11200, true, 'metric', 2, false
                        )
                    ).toEqual("1.12");
                });
            });
            describe("square meters", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            1001.12, true, 'metric', 0, true
                        )
                    ).toEqual("1001 m²");
                    expect(
                        MeasureUtils.formatMeasurement(
                            1001.12, true, 'metric', 2, true
                        )
                    ).toEqual("1001.12 m²");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            1001.12, true, 'metric', 0, false
                        )
                    ).toEqual("1001");
                    expect(
                        MeasureUtils.formatMeasurement(
                            1001.12, true, 'metric', 2, false
                        )
                    ).toEqual("1001.12");
                });
            });
        });
        describe("distance", () => {
            describe("kilometers", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            1001, false, 'metric', 0, true
                        )
                    ).toEqual("1 km");
                    expect(
                        MeasureUtils.formatMeasurement(
                            1120, false, 'metric', 2, true
                        )
                    ).toEqual("1.12 km");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            1001, false, 'metric', 0, false
                        )
                    ).toEqual("1");
                    expect(
                        MeasureUtils.formatMeasurement(
                            1120, false, 'metric', 2, false
                        )
                    ).toEqual("1.12");
                });
            });
            describe("meters", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            101.12, false, 'metric', 0, true
                        )
                    ).toEqual("101 m");
                    expect(
                        MeasureUtils.formatMeasurement(
                            101.12, false, 'metric', 2, true
                        )
                    ).toEqual("101.12 m");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            101.12, false, 'metric', 0, false
                        )
                    ).toEqual("101");
                    expect(
                        MeasureUtils.formatMeasurement(
                            101.12, false, 'metric', 2, false
                        )
                    ).toEqual("101.12");
                });
            });
        });
    });
    describe("imperial", () => {
        describe("area", () => {
            describe("square-miles", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 1000000, true, 'imperial', 0, true
                        )
                    ).toEqual("1 mi²");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 1120000, true, 'imperial', 2, true
                        )
                    ).toEqual("1.12 mi²");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 1000000, true, 'imperial', 0, false
                        )
                    ).toEqual("1");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 1120000, true, 'imperial', 2, false
                        )
                    ).toEqual("1.12");
                });
            });
            describe("acres", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            26000, true, 'imperial', 0, true
                        )
                    ).toEqual("6 acre");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 11200, true, 'imperial', 2, true
                        )
                    ).toEqual("7.20 acre");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 10000, true, 'imperial', 0, false
                        )
                    ).toEqual("6");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 11200, true, 'imperial', 2, false
                        )
                    ).toEqual("7.20");
                });
            });
            describe("square-feets", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            260, true, 'imperial', 0, true
                        )
                    ).toEqual("2799 ft²");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 112, true, 'imperial', 2, true
                        )
                    ).toEqual("3134.45 ft²");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            260, true, 'imperial', 0, false
                        )
                    ).toEqual("2799");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 112, true, 'imperial', 2, false
                        )
                    ).toEqual("3134.45");
                });
            });
        });
        describe("distance", () => {
            describe("miles", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 1000, false, 'imperial', 0, true
                        )
                    ).toEqual("2 mi");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 1120, false, 'imperial', 2, true
                        )
                    ).toEqual("1.81 mi");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 1000, false, 'imperial', 0, false
                        )
                    ).toEqual("2");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 1120, false, 'imperial', 2, false
                        )
                    ).toEqual("1.81");
                });
            });
            describe("feets", () => {
                it("should format values with units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            260, false, 'imperial', 0, true
                        )
                    ).toEqual("853 ft");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 112, false, 'imperial', 2, true
                        )
                    ).toEqual("955.38 ft");
                });
                it("should format values without units", () => {
                    expect(
                        MeasureUtils.formatMeasurement(
                            260, false, 'imperial', 0, false
                        )
                    ).toEqual("853");
                    expect(
                        MeasureUtils.formatMeasurement(
                            2.6 * 112, false, 'imperial', 2, false
                        )
                    ).toEqual("955.38");
                });
            });
        });
    });
    describe("acres", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    26000, true, MeasUnits.ACRES, 0, true
                )
            ).toEqual("6 acre");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 11200, true, MeasUnits.ACRES, 2, true
                )
            ).toEqual("7.20 acre");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 10000, true, MeasUnits.ACRES, 0, false
                )
            ).toEqual("6");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 11200, true, MeasUnits.ACRES, 2, false
                )
            ).toEqual("7.20");
        });
    });
    describe("feet", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    260, false, MeasUnits.FEET, 0, true
                )
            ).toEqual("853 ft");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 112, false, MeasUnits.FEET, 2, true
                )
            ).toEqual("955.38 ft");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    260, false, MeasUnits.FEET, 0, false
                )
            ).toEqual("853");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 112, false, MeasUnits.FEET, 2, false
                )
            ).toEqual("955.38");
        });
    });
    describe("hectares", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    10001, true, MeasUnits.HECTARES, 0, true
                )
            ).toEqual("1 ha");
            expect(
                MeasureUtils.formatMeasurement(
                    11200, true, MeasUnits.HECTARES, 2, true
                )
            ).toEqual("1.12 ha");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    10001, true, MeasUnits.HECTARES, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.formatMeasurement(
                    11200, true, MeasUnits.HECTARES, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("kilometres", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    1001, false, MeasUnits.KILOMETRES, 0, true
                )
            ).toEqual("1 km");
            expect(
                MeasureUtils.formatMeasurement(
                    1120, false, MeasUnits.KILOMETRES, 2, true
                )
            ).toEqual("1.12 km");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    1001, false, MeasUnits.KILOMETRES, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.formatMeasurement(
                    1120, false, MeasUnits.KILOMETRES, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("metres", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    101.12, false, MeasUnits.METRES, 0, true
                )
            ).toEqual("101 m");
            expect(
                MeasureUtils.formatMeasurement(
                    101.12, false, MeasUnits.METRES, 2, true
                )
            ).toEqual("101.12 m");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    101.12, false, MeasUnits.METRES, 0, false
                )
            ).toEqual("101");
            expect(
                MeasureUtils.formatMeasurement(
                    101.12, false, MeasUnits.METRES, 2, false
                )
            ).toEqual("101.12");
        });
    });
    describe("miles", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 1000, false, MeasUnits.MILES, 0, true
                )
            ).toEqual("2 mi");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 1120, false, MeasUnits.MILES, 2, true
                )
            ).toEqual("1.81 mi");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 1000, false, MeasUnits.MILES, 0, false
                )
            ).toEqual("2");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 1120, false, MeasUnits.MILES, 2, false
                )
            ).toEqual("1.81");
        });
    });
    describe("square_feet", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    260, true, MeasUnits.SQUARE_FEET, 0, true
                )
            ).toEqual("2799 ft²");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 112, true, MeasUnits.SQUARE_FEET, 2, true
                )
            ).toEqual("3134.45 ft²");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    260, true, MeasUnits.SQUARE_FEET, 0, false
                )
            ).toEqual("2799");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 112, true, MeasUnits.SQUARE_FEET, 2, false
                )
            ).toEqual("3134.45");
        });
    });
    describe("square_kilometres", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    1000001, true, MeasUnits.SQUARE_KILOMETRES, 0, true
                )
            ).toEqual("1 km²");
            expect(
                MeasureUtils.formatMeasurement(
                    1120000, true, MeasUnits.SQUARE_KILOMETRES, 2, true
                )
            ).toEqual("1.12 km²");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    1000001, true, MeasUnits.SQUARE_KILOMETRES, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.formatMeasurement(
                    1120000, true, MeasUnits.SQUARE_KILOMETRES, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("square_metres", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    1001.12, true, MeasUnits.SQUARE_METRES, 0, true
                )
            ).toEqual("1001 m²");
            expect(
                MeasureUtils.formatMeasurement(
                    1001.12, true, MeasUnits.SQUARE_METRES, 2, true
                )
            ).toEqual("1001.12 m²");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    1001.12, true, MeasUnits.SQUARE_METRES, 0, false
                )
            ).toEqual("1001");
            expect(
                MeasureUtils.formatMeasurement(
                    1001.12, true, MeasUnits.SQUARE_METRES, 2, false
                )
            ).toEqual("1001.12");
        });
    });
    describe("square_miles", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 1000000, true, MeasUnits.SQUARE_MILES, 0, true
                )
            ).toEqual("1 mi²");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 1120000, true, MeasUnits.SQUARE_MILES, 2, true
                )
            ).toEqual("1.12 mi²");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 1000000, true, MeasUnits.SQUARE_MILES, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.formatMeasurement(
                    2.6 * 1120000, true, MeasUnits.SQUARE_MILES, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("default", () => {
        it("should append whatever unit we provide", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    260, true, "whatever", 0, true
                )
            ).toEqual("260 whatever");
        });
        it("should print the numbers when the units are supresses", () => {
            expect(
                MeasureUtils.formatMeasurement(
                    260, true, "whatever", 0, false
                )
            ).toEqual("260");
        });
    });
});


describe("getFormattedLength", () => {
    describe("meters", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.METRES, 1.12, 0, true
                )
            ).toEqual("1 m");
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.METRES, 1.12, 2, true
                )
            ).toEqual("1.12 m");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.METRES, 1.12, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.METRES, 1.12, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("kilometers", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.KILOMETRES, 1120, 0, true
                )
            ).toEqual("1 km");
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.KILOMETRES, 1120, 2, true
                )
            ).toEqual("1.12 km");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.KILOMETRES, 1120, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.KILOMETRES, 1120, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("feet", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.FEET, 112, 0, true
                )
            ).toEqual("367 ft");
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.FEET, 112, 2, true
                )
            ).toEqual("367.45 ft");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.FEET, 112, 0, false
                )
            ).toEqual("367");
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.FEET, 112, 2, false
                )
            ).toEqual("367.45");
        });
    });
    describe("miles", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.MILES, 5000, 0, true
                )
            ).toEqual("3 mi");
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.MILES, 5000, 2, true
                )
            ).toEqual("3.11 mi");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.MILES, 5000, 0, false
                )
            ).toEqual("3");
            expect(
                MeasureUtils.getFormattedLength(
                    LengthUnits.MILES, 5000, 2, false
                )
            ).toEqual("3.11");
        });
    });
    describe("default", () => {
        it("should append whatever unit we provide", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    "whatever", 260, 0, true
                )
            ).toEqual("260 whatever");
        });
        it("should print the numbers when the units are supresses", () => {
            expect(
                MeasureUtils.getFormattedLength(
                    "whatever", 260, 0, false
                )
            ).toEqual("260");
        });
    });
});


describe("getFormattedArea", () => {
    describe("square-meters", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_METRES, 1.12, 0, true
                )
            ).toEqual("1 m²");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_METRES, 1.12, 2, true
                )
            ).toEqual("1.12 m²");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_METRES, 1.12, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_METRES, 1.12, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("square-feets", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_FEET, 112, 0, true
                )
            ).toEqual("1206 ft²");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_FEET, 112.73, 2, true
                )
            ).toEqual("1213.41 ft²");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_FEET, 112, 0, false
                )
            ).toEqual("1206");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_FEET, 112.73, 2, false
                )
            ).toEqual("1213.41");
        });
    });
    describe("square-kilometers", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_KILOMETRES, 1120000, 0, true
                )
            ).toEqual("1 km²");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_KILOMETRES, 1120000, 2, true
                )
            ).toEqual("1.12 km²");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_KILOMETRES, 1120000, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_KILOMETRES, 1120000, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("square-miles", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_MILES, 1500000, 0, true
                )
            ).toEqual("1 mi²");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_MILES, 1500000, 2, true
                )
            ).toEqual("0.58 mi²");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_MILES, 1500000, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.SQUARE_MILES, 1500000, 2, false
                )
            ).toEqual("0.58");
        });
    });
    describe("acres", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.ACRES, 11234, 0, true
                )
            ).toEqual("3 acre");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.ACRES, 11234, 2, true
                )
            ).toEqual("2.78 acre");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.ACRES, 11234, 0, false
                )
            ).toEqual("3");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.ACRES, 11234, 2, false
                )
            ).toEqual("2.78");
        });
    });
    describe("hectares", () => {
        it("should format values with units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.HECTARES, 11200, 0, true
                )
            ).toEqual("1 ha");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.HECTARES, 11200, 2, true
                )
            ).toEqual("1.12 ha");
        });
        it("should format values without units", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.HECTARES, 11200, 0, false
                )
            ).toEqual("1");
            expect(
                MeasureUtils.getFormattedArea(
                    AreaUnits.HECTARES, 11200, 2, false
                )
            ).toEqual("1.12");
        });
    });
    describe("default", () => {
        it("should append whatever unit we provide", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    "whatever", 260, 0, true
                )
            ).toEqual("260 whatever");
        });
        it("should print the numbers when the units are supresses", () => {
            expect(
                MeasureUtils.getFormattedArea(
                    "whatever", 260, 0, false
                )
            ).toEqual("260");
        });
    });
});


describe("degToDms", () => {
    it("should print a nice string", () => {
        expect(MeasureUtils.degToDms(0)).toEqual("0° 0' 0'' ");
        expect(MeasureUtils.degToDms(1)).toEqual("1° 0' 0'' ");
        expect(MeasureUtils.degToDms(1.23456789)).toEqual("1° 14' 4'' ");
        expect(MeasureUtils.degToDms(180.23456789)).toEqual("180° 14' 4'' ");
    });
});


describe("updateFeatureMeasurements", () => {
    let feature;
    const settings = {
        lenUnit: "meters",
        areaUnit: "square_meters",
        mapCrs: "EPSG:3857",
        displayCrs: "EPSG:3857",
        decimals: 2,
    };
    beforeEach(() => {
        feature = new Feature();
    });

    describe("Point", () => {
        it("should update the feature with Pseudo-Mercator", () => {
            [
                [0, 0, "0, 0"],
                [1, 1, "1, 1"],
                [1.23456789, 1.23456789, "1, 1"],
            ].forEach(([x, y, label]) => {
                feature.set("geometry", new Point([x, y]));
                MeasureUtils.updateFeatureMeasurements(
                    feature, MeasGeomTypes.POINT, "EPSG:3857", settings
                );
                expect(feature.get("label")).toBe(label);
                expect(feature.get("segment_labels")).toBeUndefined();
                expect(feature.get("measurements")).toEqual({
                    lenUnit: "meters",
                    areaUnit: "square_meters",
                });
            });
        });
        it("should ignore (!) feature's CRS", () => {
            [
                [0, 0, "0, 0"],
                [45, 25, "45, 25"],
                [180, 90, "180, 90"],
            ].forEach(([x, y, label]) => {
                feature.set("geometry", new Point([x, y]));
                MeasureUtils.updateFeatureMeasurements(
                    feature, MeasGeomTypes.POINT, "EPSG:4326", settings
                );
                expect(feature.get("label")).toBe(label);
                expect(feature.get("segment_labels")).toBeUndefined();
                expect(feature.get("measurements")).toEqual({
                    lenUnit: "meters",
                    areaUnit: "square_meters",
                });
            });
        });
        it("should convert from map CRS to display CRS", () => {
            [
                [0, 0, "0, -0"],
                [45, 25, "5009377, 2875745"],
                [180, 90, "20037508, 238107693"],
            ].forEach(([x, y, label]) => {
                feature.set("geometry", new Point([x, y]));
                MeasureUtils.updateFeatureMeasurements(
                    feature, MeasGeomTypes.POINT, "ignored", {
                    ...settings,
                    mapCrs: "EPSG:4326",
                }
                );
                expect(feature.get("label")).toBe(label);
                expect(feature.get("segment_labels")).toBeUndefined();
                expect(feature.get("measurements")).toEqual({
                    lenUnit: "meters",
                    areaUnit: "square_meters",
                });
            });
        });
    });

    describe("LineString", () => {
        beforeEach(() => {
            feature.set("geometry", new LineString(coords));
        });
        it("should update the feature", () => {
            MeasureUtils.updateFeatureMeasurements(
                feature, MeasGeomTypes.LINE_STRING, "EPSG:4326", settings
            );
            expect(feature.get("label")).toBe('');
            expect(feature.get("segment_labels")).toEqual([
                "111195.08 meters",
                "111178.14 meters",
                "111195.08 meters",
                "111195.08 meters",
            ]);
            expect(feature.get("measurements")).toMatchCloseTo({
                lenUnit: "meters",
                areaUnit: "square_meters",
                segment_lengths: [
                    111195.08,
                    111178.14,
                    111195.08,
                    111195.08,
                ],
                length: 444763.38,
            }, 1);
        });
    });

    describe("Polygon", () => {
        beforeEach(() => {
            feature.set("geometry", new Polygon([coords]));
        });
        it("should update the feature", () => {
            MeasureUtils.updateFeatureMeasurements(
                feature, MeasGeomTypes.POLYGON, "EPSG:4326", settings
            );
            expect(feature.get("label")).toBe('12363718145.18 square_meters');
            expect(feature.get("measurements")).toMatchCloseTo({
                lenUnit: "meters",
                areaUnit: "square_meters",
                area: 12363718145.179
            }, 1);
        });
    });

    describe('Circle', () => {
        beforeEach(() => {
            feature.set("geometry", new Circle([1, 1], 1));
        });
        it("should update the feature", () => {
            MeasureUtils.updateFeatureMeasurements(
                feature, MeasGeomTypes.CIRCLE, "EPSG:4326", settings
            );
            expect(feature.get("label")).toBe('r = 1.00 meters');
            expect(feature.get("measurements")).toMatchCloseTo({
                lenUnit: "meters",
                areaUnit: "square_meters",
                radius: 1
            }, 1);
        });
    });

    describe('Bearing', () => {
        beforeEach(() => {
            feature.set("geometry", new LineString([[0, 0], [1, 1]]));
        });
        it("should update the feature", () => {
            MeasureUtils.updateFeatureMeasurements(
                feature, MeasGeomTypes.BEARING, "EPSG:4326", settings
            );
            expect(feature.get("label")).toBe("N 44° 59' 44'' E");
            expect(feature.get("measurements")).toMatchCloseTo({
                lenUnit: "meters",
                areaUnit: "square_meters",
                bearing: 44.9956
            }, 3);
        });
    });
});


describe("computeSegmentLengths", () => {
    describe("geodesic", () => {
        expect(MeasureUtils.computeSegmentLengths(
            coords, "EPSG:4326", true
        )).toBeDeepCloseTo([
            111195.0802,
            111178.1442,
            111195.0802,
            111195.0802,
        ], 3);
        expect(MeasureUtils.computeSegmentLengths(
            coords, "EPSG:3857", true
        )).toBeDeepCloseTo([
            0.99888,
            0.99888,
            0.99888,
            0.99888,
        ], 4);
    });
    describe("degrees", () => {
        expect(MeasureUtils.computeSegmentLengths(
            coords, "EPSG:4326", false
        )).toBeDeepCloseTo([
            111195.0802,
            111178.1442,
            111195.0802,
            111195.0802,
        ], 3);

    });
    describe("feets", () => {
        registerFeetCrs();
        expect(MeasureUtils.computeSegmentLengths(
            coords, feetCRS, false
        )).toBeDeepCloseTo([
            0.3048,
            0.3048,
            0.3048,
            0.3048,
        ], 4);
    });
    describe("meters", () => {
        expect(MeasureUtils.computeSegmentLengths(
            coords, "EPSG:3857", false
        )).toBeDeepCloseTo([
            1,
            1,
            1,
            1,
        ], 4);
    });
});


describe("computeArea", () => {
    describe("geodesic", () => {
        it("should compute the area", () => {
            expect(
                MeasureUtils.computeArea(somePolygon, "EPSG:4326", true)
            ).toBeCloseTo(12363718145.18, 2);
            expect(
                MeasureUtils.computeArea(somePolygon, "EPSG:3857", true)
            ).toBeCloseTo(0.997766, 6);
        });
    });
    describe("degrees", () => {
        it("should compute the area", () => {
            expect(
                MeasureUtils.computeArea(somePolygon, "EPSG:4326", false)
            ).toBeCloseTo(12363718145.18, 2);
        });
    });
    describe("feets", () => {
        it("should compute the area in feets", () => {
            registerFeetCrs();
            expect(
                MeasureUtils.computeArea(somePolygon, feetCRS, false)
            ).toBeCloseTo(0.09290, 5);
        });
    });
    describe("meters", () => {
        it("should compute the area in meters", () => {
            expect(
                MeasureUtils.computeArea(somePolygon, "EPSG:3857", false)
            ).toBe(1);
        });
    });
});
