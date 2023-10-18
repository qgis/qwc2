import MapUtils from './MapUtils';
import { feetCRS } from '../config/setupTests';

let mockAllowFractionalZoom = false;

jest.mock("./ConfigUtils", () => {
    return {
        __esModule: true,
        default: {
            getConfigProp: (key) => {
                if (key === "allowFractionalZoom") {
                    return mockAllowFractionalZoom;
                }
                throw new Error("Unknown key");
            },
        },
    }
});

let mockProjectionUnits = undefined;

jest.mock("./CoordinatesUtils", () => {
    return {
        __esModule: true,
        default: {
            getUnits: (projection) => {
                if (projection === "EPSG:4326") {
                    return "degrees";
                } else if (projection === "EPSG:3857") {
                    return "m";
                } else if (projection === "EPSG:2225" /* feetCRS */) {
                    return "us-ft";
                } else {
                    return mockProjectionUnits;
                }
            },
        },
    }
});


describe("registerHook", () => {
    it("should register the hook", () => {
        const hook = () => { };
        MapUtils.registerHook("test", hook);
        expect(MapUtils.getHook("test")).toBe(hook);
        const hook2 = () => { };
        MapUtils.registerHook("test", hook2);
        expect(MapUtils.getHook("test")).toBe(hook2);
    })
});


describe("getHook", () => {
    it("should return undefined if the name is not known", () => {
        expect(MapUtils.getHook("test-unknown")).toBeUndefined();
    })
});


describe("dpi2dpm", () => {
    it("should convert", () => {
        expect(MapUtils.dpi2dpm(1)).toBeCloseTo(39.3700, 3);
        expect(MapUtils.dpi2dpm(-1)).toBeCloseTo(-39.3700, 3);
        expect(MapUtils.dpi2dpm(72)).toBeCloseTo(2834.6457, 3);
    });
    it("should use default DPI", () => {
        expect(MapUtils.dpi2dpm()).toBeCloseTo(3779.5275, 3);
        expect(MapUtils.dpi2dpm(undefined)).toBeCloseTo(3779.5275, 3);
        expect(MapUtils.dpi2dpm(null)).toBeCloseTo(3779.5275, 3);
        expect(MapUtils.dpi2dpm(0)).toBeCloseTo(3779.5275, 3);
    });
});


describe("dpi2dpu", () => {
    it("should convert to Pseudo-Mercator map", () => {
        expect(
            MapUtils.dpi2dpu(1, "EPSG:3857")
        ).toBeCloseTo(39.3700, 3);
    });
    it("should convert to WGS map", () => {
        expect(
            MapUtils.dpi2dpu(1, "EPSG:4326")
        ).toBeCloseTo(4377750.9560, 3);
    });
    it(`should convert to ${feetCRS} map`, () => {
        expect(
            MapUtils.dpi2dpu(1, feetCRS)
        ).toBeCloseTo(12.000, 3);
    });
});


describe("getGoogleMercatorScales", () => {
    it("should compute the scales with default DPI", () => {
        expect(MapUtils.getGoogleMercatorScales(
            0, 1
        )).toBeDeepCloseTo([
            591658710.90, 295829355.45
        ], 1);
        expect(MapUtils.getGoogleMercatorScales(
            5, 10
        )).toBeDeepCloseTo([
            18489334.71,
            9244667.35,
            4622333.67,
            2311166.83,
            1155583.42,
            577791.71,
        ], 1);
    });
    it("should compute the scales with DPI = 72", () => {
        expect(MapUtils.getGoogleMercatorScales(
            0, 1, 72
        )).toBeDeepCloseTo([
            443744033.18, 221872016.59
        ], 1);
    });
});


describe("getResolutionsForScales", () => {
    it("should get the resolutions for default DPI", () => {
        expect(
            MapUtils.getResolutionsForScales([
                18489334.71,
                9244667.35,
                4622333.67,
                2311166.83,
                1155583.42,
                577791.71,
                1,
                0
            ], "EPSG:3857")
        ).toBeDeepCloseTo([
            4891.96,
            2445.98,
            1222.99,
            611.49,
            305.75,
            152.87,
            0.00,
            0.00
        ], 1)
    });
    it("should get the resolutions for DPI = 72", () => {
        expect(
            MapUtils.getResolutionsForScales([
                18489334.71,
                9244667.35,
                4622333.67,
                2311166.83,
                1155583.42,
                577791.71,
                1,
                0
            ], "EPSG:3857", 72)
        ).toBeDeepCloseTo([
            6522.62,
            3261.31,
            1630.65,
            815.32,
            407.66,
            203.83,
            0.00,
            0.00,
        ], 1)
    });
});


describe("getZoomForExtent", () => {
    const commonArgs = [
        [-180, -90, 180, 90],
        [
            4891.96,
            2445.98,
            1222.99,
            611.49,
            305.75,
            152.87,
        ],
        { width: 256, height: 256 },
    ];
    describe("fractional zoom", () => {
        beforeEach(() => { mockAllowFractionalZoom = true; });
        it("should compute zoom withing allowed range", () => {
            expect(MapUtils.getZoomForExtent(
                ...commonArgs, 0, 21
            )).toBeCloseTo(5.990, 2)
        });
        it("should use minimum value", () => {
            expect(MapUtils.getZoomForExtent(
                ...commonArgs, 7, 21
            )).toBe(7)
        });
        it("should use maximum value", () => {
            expect(MapUtils.getZoomForExtent(
                ...commonArgs, 0, 3
            )).toBe(3)
        });
    });
    describe("integer zoom", () => {
        beforeEach(() => { mockAllowFractionalZoom = false; });
        it("should compute zoom withing allowed range", () => {
            expect(MapUtils.getZoomForExtent(
                ...commonArgs, 0, 21
            )).toBe(5)
        });
        it("should use minimum value", () => {
            expect(MapUtils.getZoomForExtent(
                ...commonArgs, 7, 21
            )).toBe(7)
        });
        it("should use maximum value", () => {
            expect(MapUtils.getZoomForExtent(
                ...commonArgs, 0, 3
            )).toBe(3)
        });
    });
});


describe("getExtentForCenterAndZoom", () => {
    const resSize = [
        [
            4891.96,
            2445.98,
            1222.99,
            611.49,
            305.75,
            152.87,
        ], {
            width: 256, height: 256
        }
    ]
    describe("fractional zoom", () => {
        beforeEach(() => { mockAllowFractionalZoom = true; });
        it("should do a good job", () => {
            expect(MapUtils.getExtentForCenterAndZoom(
                [0, 0], 0.12, ...resSize,
            )).toBeDeepCloseTo([
                -588600.62, -588600.62,
                588600.62, 588600.62
            ], 1);
            expect(MapUtils.getExtentForCenterAndZoom(
                [1, 1], 0.12, ...resSize,
            )).toBeDeepCloseTo([
                -588599.62, -588599.62,
                588601.62, 588601.62
            ], 1);
            expect(MapUtils.getExtentForCenterAndZoom(
                [1, 1], 10.12, ...resSize,
            )).toBeDeepCloseTo([
                -19566.36, -19566.36,
                19568.36, 19568.36
            ], 1);
        });
    });
    describe("integer zoom", () => {
        beforeEach(() => { mockAllowFractionalZoom = false; });
        it("should do a good job", () => {
            expect(MapUtils.getExtentForCenterAndZoom(
                [0, 0], 0.12, ...resSize,
            )).toBeDeepCloseTo([
                -626170.88, -626170.88,
                626170.88, 626170.88
            ], 1);
            expect(MapUtils.getExtentForCenterAndZoom(
                [1, 1], 0.12, ...resSize,
            )).toBeDeepCloseTo([
                -626169.88, -626169.88,
                626171.88, 626171.88
            ], 1);
            expect(MapUtils.getExtentForCenterAndZoom(
                [1, 1], 10.12, ...resSize,
            )).toBeDeepCloseTo([
                -19566.36, -19566.36,
                19568.36, 19568.36
            ], 1);
        });
    });
});


describe("transformExtent", () => {
    // NOTE: in these tests we use undefined as the projection
    // so that our mock implementation of getUnits is used
    // and picks up the mockProjectionUnits value.
    const projection = undefined;

    describe("feets", () => {
        beforeEach(() => { mockProjectionUnits = "ft"; });
        it("should transform the extent", () => {
            expect(MapUtils.transformExtent(
                projection, [0, 0], 100, 100
            )).toBeDeepCloseTo({
                width: 328.084,
                height: 328.084
            }, 2);
        });
    });
    describe("us-feets", () => {
        beforeEach(() => { mockProjectionUnits = "us-ft"; });
        it("should transform the extent", () => {
            expect(MapUtils.transformExtent(
                projection, [0, 0], 100, 100
            )).toBeDeepCloseTo({
                width: 328.084,
                height: 328.084
            }, 2);
        });
    });
    describe("meters", () => {
        beforeEach(() => { mockProjectionUnits = "m"; });
        it("should transform the extent", () => {
            expect(MapUtils.transformExtent(
                projection, [0, 0], 100, 100
            )).toEqual({
                width: 100,
                height: 100
            });
        });
    });
    describe("degrees", () => {
        beforeEach(() => { mockProjectionUnits = "degrees"; });
        it("should transform the extent", () => {
            expect(MapUtils.transformExtent(
                projection, [0, 0], 100, 100
            )).toBeDeepCloseTo({
                width: 0.00089831,
                height: 0.00090436
            }, 7);
        });
    });
});


describe("computeForZoom", () => {
    const scaleLists = [
        4891.96,
        2445.98,
        1222.99,
        611.49,
        305.75,
        152.87,
    ]

    describe("fractional zoom", () => {
        beforeEach(() => { mockAllowFractionalZoom = true; });

        it("computes the value", () => {
            expect(
                MapUtils.computeForZoom(scaleLists, 0.12)
            ).toBeCloseTo(4598.4424, 3);
            expect(
                MapUtils.computeForZoom(scaleLists, 3.14)
            ).toBeCloseTo(568.6864, 3);
            expect(
                MapUtils.computeForZoom(scaleLists, 4.2)
            ).toBeCloseTo(275.174, 3);
            expect(
                MapUtils.computeForZoom(scaleLists, 5.2)
            ).toBeCloseTo(152.87, 3);
            expect(
                MapUtils.computeForZoom(scaleLists, 100.2)
            ).toBeCloseTo(152.87, 3);
        })
    });
    describe("integer zoom", () => {
        beforeEach(() => { mockAllowFractionalZoom = false; });

        it("computes the value", () => {
            expect(
                MapUtils.computeForZoom(scaleLists, 0.12)
            ).toBeCloseTo(4891.96, 3);
            expect(
                MapUtils.computeForZoom(scaleLists, 3.14)
            ).toBeCloseTo(611.49, 3);
            expect(
                MapUtils.computeForZoom(scaleLists, 4.2)
            ).toBeCloseTo(305.75, 3);
            expect(
                MapUtils.computeForZoom(scaleLists, 5.2)
            ).toBeCloseTo(152.87, 3);
            expect(
                MapUtils.computeForZoom(scaleLists, 100.2)
            ).toBeCloseTo(152.87, 3);
        })
    });
});


describe("computeZoom", () => {
    const scaleLists = [
        4891.96,
        2445.98,
        1222.99,
        611.49,
        305.75,
        152.87,
    ]

    describe("fractional zoom", () => {
        beforeEach(() => { mockAllowFractionalZoom = true; });

        it("computes the value", () => {
            expect(
                MapUtils.computeZoom(scaleLists, 0.12)
            ).toBeCloseTo(5.9991, 3);
            expect(
                MapUtils.computeZoom(scaleLists, 3.14)
            ).toBeCloseTo(5.9793, 3);
            expect(
                MapUtils.computeZoom(scaleLists, 100)
            ).toBeCloseTo(5.3458, 3);
            expect(
                MapUtils.computeZoom(scaleLists, 1000)
            ).toBeCloseTo(2.3646, 3);
            expect(
                MapUtils.computeZoom(scaleLists, 5000)
            ).toBeCloseTo(-0.0441, 3);
        })
    });
    describe("integer zoom", () => {
        beforeEach(() => { mockAllowFractionalZoom = false; });

        it("computes the value", () => {
            expect(
                MapUtils.computeZoom(scaleLists, 0.12)
            ).toBe(5);
            expect(
                MapUtils.computeZoom(scaleLists, 3.14)
            ).toBe(5);
            expect(
                MapUtils.computeZoom(scaleLists, 100)
            ).toBe(5);
            expect(
                MapUtils.computeZoom(scaleLists, 1000)
            ).toBe(2);
            expect(
                MapUtils.computeZoom(scaleLists, 5000)
            ).toBe(0);
        })
    });
});


describe("degreesToRadians", () => {
    it("should convert the degrees", () => {
        expect(MapUtils.degreesToRadians(0)).toBe(0);
        expect(MapUtils.degreesToRadians(1)).toBeCloseTo(0.0174532, 6);
        expect(MapUtils.degreesToRadians(45)).toBeCloseTo(0.7853981, 6);
        expect(MapUtils.degreesToRadians(90)).toBeCloseTo(1.5707963, 6);
        expect(MapUtils.degreesToRadians(135)).toBeCloseTo(2.3561944, 6);
        expect(MapUtils.degreesToRadians(180)).toBeCloseTo(3.14159265, 6);
        expect(MapUtils.degreesToRadians(225)).toBeCloseTo(3.92699081, 6);
        expect(MapUtils.degreesToRadians(270)).toBeCloseTo(4.71238898, 6);
        expect(MapUtils.degreesToRadians(315)).toBeCloseTo(5.49778714, 6);
        expect(MapUtils.degreesToRadians(360)).toBeCloseTo(6.28318530, 6);
        expect(MapUtils.degreesToRadians(-45)).toBeCloseTo(-0.7853981, 6);
        expect(MapUtils.degreesToRadians(450)).toBeCloseTo(7.85398163, 6);
    })
});
