import VecLyUt from './VectorLayerUtils';


let mockQgisServerVersion = 3;
let mockDefaultFeatureStyle = {
    textFill: "#000123",
    textStroke: "#fff456",
};
jest.mock("./ConfigUtils", () => ({
    __esModule: true,
    default: {
        getConfigProp: (name) => {
            if (name === 'qgisServerVersion') {
                return mockQgisServerVersion;
            } else if (name === 'defaultFeatureStyle') {
                return mockDefaultFeatureStyle;
            }
        },
    },
}));


describe("computeFeatureBBox", () => {
    it("should work with a point", () => {
        expect(VecLyUt.computeFeatureBBox({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [1, 2],
            },
        })).toEqual([1, 2, 1, 2]);
    });
    it("should work with a line-string", () => {
        expect(VecLyUt.computeFeatureBBox({
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: [[1, 2], [3, 4]],
            },
        })).toEqual([1, 2, 3, 4]);
    });
});

describe("computeFeaturesBBox", () => {
    it("should work with a point", () => {
        expect(VecLyUt.computeFeaturesBBox([{
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [1, 2],
            },
        }])).toEqual({
            crs: "EPSG:4326",
            bounds: [1, 2, 1, 2],
        });
    });
    it("should work with two points", () => {
        expect(VecLyUt.computeFeaturesBBox([{
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [1, 2],
            },
        }, {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [4, 5],
            },
        }])).toEqual({
            crs: "EPSG:4326",
            bounds: [1, 2, 4, 5],
        });
    });
});

describe("convert3dto2d", () => {
    it("should be transparent to anything that is not an array", () => {
        expect(VecLyUt.convert3dto2d(null)).toBeNull();
        expect(VecLyUt.convert3dto2d(undefined)).toBeUndefined();
        expect(VecLyUt.convert3dto2d("")).toBe("");
        expect(VecLyUt.convert3dto2d(123)).toBe(123);
        expect(VecLyUt.convert3dto2d({})).toEqual({});
    });
    it("should work with a 2d array", () => {
        expect(VecLyUt.convert3dto2d(
            [[1, 2], [3, 4]]
        )).toEqual([[1, 2], [3, 4]]);
    });
    it("should work with a 3d array", () => {
        expect(VecLyUt.convert3dto2d(
            [[1, 2, 3], [4, 5, 6]]
        )).toEqual([[1, 2], [4, 5]]);
    });
    it("should work with nested 2d array", () => {
        expect(VecLyUt.convert3dto2d([
            [[1, 2], [3, 4]],
            [[5, 6], [7, 8]],
        ])).toEqual([
            [[1, 2], [3, 4]],
            [[5, 6], [7, 8]],
        ]);
    });
    it("should work with nested 3d array", () => {
        expect(VecLyUt.convert3dto2d([
            [[1, 2, 3], [4, 5, 6]],
            [[7, 8, 9], [10, 11, 12]],
        ])).toEqual([
            [[1, 2], [4, 5]],
            [[7, 8], [10, 11]],
        ]);
    });
});

describe("createPrintHighlighParams", () => {
    const emptyParams = {
        "geoms": [],
        "labelFillColors": [],
        "labelOutlineColors": [],
        "labelOutlineSizes": [],
        "labelSizes": [],
        "labels": [],
        "styles": [],
    };
    const goodLayer = {
        type: "vector",
        features: [{
            styleName: "styleName",
            styleOptions: {
                fillColor: "#456000",
                strokeColor: "#123fff",
                strokeWidth: 3,
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [0, 0],
                    [0, 1],
                    [1, 1],
                    [1, 0],
                    [0, 0],
                ]],
            },
        }],
        visibility: true,
        skipPrint: false
    };
    it("should return empty when the list is empty", () => {
        expect(VecLyUt.createPrintHighlighParams(
            [], "EPSG:4326"
        )).toEqual(emptyParams);
    });
    it("should return empty when the list has no vector", () => {
        expect(VecLyUt.createPrintHighlighParams(
            [{
                ...goodLayer,
                type: "xxx",
            }], "EPSG:4326"
        )).toEqual(emptyParams);
    });
    it("should return empty when the list has no features", () => {
        expect(VecLyUt.createPrintHighlighParams(
            [{
                ...goodLayer,
                features: [],
            }], "EPSG:4326"
        )).toEqual(emptyParams);
    });
    it("should return empty when the list has no geometries", () => {
        expect(VecLyUt.createPrintHighlighParams(
            [{
                ...goodLayer,
                features: [
                    {
                        ...goodLayer.features[0],
                        geometry: null,
                    },
                ],
            }], "EPSG:4326"
        )).toEqual(emptyParams);
    });
    it("should return empty when the list has nothing visible", () => {
        expect(VecLyUt.createPrintHighlighParams(
            [{
                ...goodLayer,
                visibility: false,
            }], "EPSG:4326"
        )).toEqual(emptyParams);
    });
    it("should return empty when the list has nothing printable", () => {
        expect(VecLyUt.createPrintHighlighParams(
            [{
                ...goodLayer,
                skipPrint: true
            }], "EPSG:4326"
        )).toEqual(emptyParams);
    });
    it("should return the parameters", () => {
        expect(VecLyUt.createPrintHighlighParams(
            [goodLayer], "EPSG:4326"
        )).toEqual({
            "geoms": [
                "POLYGON ((" +
                "0.0000 0.0000, 0.0000 1.0000, " +
                "1.0000 1.0000, 1.0000 0.0000, " +
                "0.0000 0.0000" +
                "))"
            ],
            "labelFillColors": ["#000123"],
            "labelOutlineColors": ["#fff456"],
            "labelOutlineSizes": [1],
            "labelSizes": [10],
            "labels": [" "],
            "styles": [
                expect.stringContaining('xml')
            ],
        });
    });
});

describe("createSld", () => {
    it("should work with points", () => {
        const sld = VecLyUt.createSld(
            "MultiPoint", "someStyle", {}, 0.5
        )
        expect(sld).toMatch(/PointSymbolizer/);
    });
    it("should work with lines", () => {
        const sld = VecLyUt.createSld(
            "LineString", "someStyle", {}, 0.5
        )
        expect(sld).toMatch(/LineSymbolizer/);
    });
    it("should work with points", () => {
        const sld = VecLyUt.createSld(
            "MultiPolygon", "someStyle", {}, 0.5
        )
        expect(sld).toMatch(/PolygonSymbolizer/);
    });
    it("should return empty if unknown geometry type", () => {
        const sld = VecLyUt.createSld(
            "Lorem", "someStyle", {}, 0.5
        )
        expect(sld).toBeNull();;
    });
});

describe("geoJSONGeomToWkt", () => {
    describe("Point", () => {
        const goodGeometry = {
            type: "Point",
            coordinates: [1, 2],
        };
        it("should work with plain object", () => {
            expect(
                VecLyUt.geoJSONGeomToWkt(goodGeometry)
            ).toEqual("POINT (1.0000 2.0000)");
        });
        it("should work with feature", () => {
            expect(VecLyUt.geoJSONGeomToWkt({
                type: "Feature",
                geometry: goodGeometry
            })).toEqual("POINT (1.0000 2.0000)");
        });
    });
    describe("LineString", () => {
        const goodGeometry = {
            type: "LineString",
            coordinates: [[1, 2], [3, 4]],
        };
        const goodResult = "LINESTRING (1.0000 2.0000, 3.0000 4.0000)";
        it("should work with plain object", () => {
            expect(
                VecLyUt.geoJSONGeomToWkt(goodGeometry)
            ).toEqual(goodResult);
        });
        it("should work with feature", () => {
            expect(VecLyUt.geoJSONGeomToWkt({
                type: "Feature",
                geometry: goodGeometry
            })).toEqual(goodResult);
        });
    });
    describe("Polygon", () => {
        const goodGeometry = {
            type: "Polygon",
            coordinates: [[[1, 2], [3, 4], [5, 6], [1, 2]]],
        };
        const goodResult = (
            "POLYGON ((" +
            "1.0000 2.0000, " +
            "3.0000 4.0000, " +
            "5.0000 6.0000, " +
            "1.0000 2.0000" +
            "))"
        );
        it("should work with plain object", () => {
            expect(
                VecLyUt.geoJSONGeomToWkt(goodGeometry)
            ).toEqual(goodResult);
        });
        it("should work with feature", () => {
            expect(VecLyUt.geoJSONGeomToWkt({
                type: "Feature",
                geometry: goodGeometry
            })).toEqual(goodResult);
        });
    });
    describe("MultiPoint", () => {
        const goodGeometry = {
            type: "MultiPoint",
            coordinates: [[1, 2], [3, 4]],
        };
        const goodResult = (
            "MULTIPOINT (" +
            "1.0000 2.0000, " +
            "3.0000 4.0000" +
            ")"
        );
        it("should work with plain object", () => {
            expect(
                VecLyUt.geoJSONGeomToWkt(goodGeometry)
            ).toEqual(goodResult);
        });
        it("should work with feature", () => {
            expect(VecLyUt.geoJSONGeomToWkt({
                type: "Feature",
                geometry: goodGeometry
            })).toEqual(goodResult);
        });
    });
    describe("MultiPolygon", () => {
        const goodGeometry = {
            type: "MultiPolygon",
            coordinates: [
                [[[1, 2], [3, 4], [5, 6], [1, 2]]],
                [[[7, 8], [9, 10], [11, 12], [7, 8]]],
            ],
        };
        const goodResult = (
            "MULTIPOLYGON (" +
            "((" +
            "1.0000 2.0000, " +
            "3.0000 4.0000, " +
            "5.0000 6.0000, " +
            "1.0000 2.0000" +
            ")), ((" +
            "7.0000 8.0000, " +
            "9.0000 10.0000, " +
            "11.0000 12.0000, " +
            "7.0000 8.0000" +
            ")))"
        );
        it("should work with plain object", () => {
            expect(
                VecLyUt.geoJSONGeomToWkt(goodGeometry)
            ).toEqual(goodResult);
        });
        it("should work with feature", () => {
            expect(VecLyUt.geoJSONGeomToWkt({
                type: "Feature",
                geometry: goodGeometry
            })).toEqual(goodResult);
        });
    });
    describe("MultiLineString", () => {
        const goodGeometry = {
            type: "MultiLineString",
            coordinates: [
                [[1, 2], [3, 4]],
                [[5, 6], [7, 8]],
            ],
        };
        const goodResult = (
            "MULTILINESTRING (" +
            "(1.0000 2.0000, 3.0000 4.0000), " +
            "(5.0000 6.0000, 7.0000 8.0000)" +
            ")"
        );
        it("should work with plain object", () => {
            expect(
                VecLyUt.geoJSONGeomToWkt(goodGeometry)
            ).toEqual(goodResult);
        });
        it("should work with feature", () => {
            expect(VecLyUt.geoJSONGeomToWkt({
                type: "Feature",
                geometry: goodGeometry
            })).toEqual(goodResult);
        });
    });
    describe("GeometryCollection", () => {
        const goodGeometry = {
            type: "GeometryCollection",
            geometries: [
                {
                    type: "Point",
                    coordinates: [1, 2],
                },
                {
                    type: "LineString",
                    coordinates: [[3, 4], [5, 6]],
                },
            ],
        };
        const goodResult = (
            "GEOMETRYCOLLECTION (" +
            "POINT (1.0000 2.0000), " +
            "LINESTRING (3.0000 4.0000, 5.0000 6.0000)" +
            ")"
        );
        it("should work with plain object", () => {
            expect(
                VecLyUt.geoJSONGeomToWkt(goodGeometry)
            ).toEqual(goodResult);
        });
        it("should work with feature", () => {
            expect(VecLyUt.geoJSONGeomToWkt({
                type: "Feature",
                geometry: goodGeometry
            })).toEqual(goodResult);
        });
    });
    describe("Others", () => {
        const goodGeometry = {
            type: "Point",
            coordinates: [1, 2],
        };
        it("should throw an error if unknown geometry type", () => {
            expect(() => VecLyUt.geoJSONGeomToWkt({
                ...goodGeometry,
                type: "Lorem",
            })).toThrow();
        });
    });
});

describe("getFeatureCenter", () => {
    it("should work with a point", () => {
        expect(VecLyUt.getFeatureCenter({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [1, 2],
            },
        })).toEqual([1, 2]);
    });
    it("should work with a line-string", () => {
        expect(VecLyUt.getFeatureCenter({
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: [[1, 2], [3, 4]],
            },
        })).toEqual([2, 3]);
    }); 
    it("should work with a polygon", () => {
        expect(VecLyUt.getFeatureCenter({
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [[[0, 1], [1, 1], [1, 0], [0, 0]]],
            },
        })).toEqual([0.5, 0.5]);
    });
    it("should work with a multi-point", () => {
        expect(VecLyUt.getFeatureCenter({
            type: "Feature",
            geometry: {
                type: "MultiPoint",
                coordinates: [[1, 2], [3, 4]],
            },
        })).toEqual([1, 2]);
    });
    it("should work with a multi-line-string", () => {
        expect(VecLyUt.getFeatureCenter({
            type: "Feature",
            geometry: {
                type: "MultiLineString",
                coordinates: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]],
            },
        })).toEqual([3, 4]);
    });

    it("should work with a multi-polygon", () => {  
        expect(VecLyUt.getFeatureCenter({
            type: "Feature",
            geometry: {
                type: "MultiPolygon",
                coordinates: [
                    [[[0, 1], [1, 1], [1, 0], [0, 0]]],
                    [[[2, 3], [3, 3], [3, 2], [2, 2]]],
                ],
            },
        })).toEqual([0.5, 0.5]);
    });
    it("should not work with anything else", () => {
        expect(VecLyUt.getFeatureCenter({
            type: "Feature",
            geometry: {
                type: "GeometryCollection",
                geometries: [{
                    type: "Point",
                    coordinates: [1, 2],
                }, {
                    type: "LineString",
                    coordinates: [[3, 4], [5, 6]],
                }],
            },
        })).toBeNull();
    });
});

describe("kmlToGeoJSON", () => {
    it("should work with a simple KML", () => {
        const kml = (
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<kml xmlns="http://www.opengis.net/kml/2.2">' +
            '<Document>' +
            '<Placemark>' +
            '<name>Simple placemark</name>' +
            '<description>A description.</description>' +
            '<Point>' +
            '<coordinates>-122.0822035425683,37.42228990140251,0</coordinates>' +
            '</Point>' +
            '</Placemark>' +
            '</Document>' +
            '</kml>'
        );
        expect(VecLyUt.kmlToGeoJSON(kml)).toEqual([{
            "crs": "EPSG:4326",
            "geometry": {
                "coordinates": [
                    -122.0822035425683, 37.42228990140251, 0
                ],
                "type": "Point"
            },
            "id": 0,
            "properties": {
                "description": "A description.",
                "name": "Simple placemark"
            },
            "styleName": "default",
            "styleOptions": {
                "fillColor": [255, 255, 255, 1],
                "strokeColor": [0, 0, 0, 1],
                "strokeDash": [],
                "strokeWidth": 1,
                "textFill": [255, 255, 255, 1],
                "textStroke": [51, 51, 51, 1]
            },
            "type": "Feature"
        }]);
    });
});

describe("reprojectGeometry", () => {

});

describe("wktToGeoJSON", () => {

});
