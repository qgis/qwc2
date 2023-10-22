import mockAxios from 'jest-mock-axios';
import IdUtil from "./IdentifyUtils";
import { LayerRole } from '../actions/layers';


let mockComputeForZoom = 5;
jest.mock("./MapUtils", () => ({
    __esModule: true,
    default: {
        computeForZoom: () => mockComputeForZoom,
    },
}));

let mockSearchSubLayer = true;
let mockLayerScaleInRange = true;
jest.mock("./LayerUtils", () => ({
    __esModule: true,
    default: {
        searchSubLayer: () => mockSearchSubLayer,
        layerScaleInRange: () => mockLayerScaleInRange,
    },
}));

let mockWmsMaxGetUrlLength = 500;
jest.mock("./ConfigUtils", () => ({
    __esModule: true,
    default: {
        getConfigProp: (name) => {
            if (name === 'wmsMaxGetUrlLength')
                return mockWmsMaxGetUrlLength;
        }
    },
}));

let mockGetUnits = 'm';
jest.mock("./CoordinatesUtils", () => ({
    __esModule: true,
    default: {
        getUnits: () => mockGetUnits
    },
}));


describe("buildFilterRequest", () => {
    it("should build a request", () => {
        expect(IdUtil.buildFilterRequest(
            {
                id: "abcd",
                version: "ipsum",
                styles: "sit",
                dimensionValues: {},
                params: {},
                featureInfoUrl: "dolor?lorem=dolor",
            },
            ["a", "b", "c"],
            "filterGeom",
            {
                resolutions: [1, 2, 3],
                zoom: 0,
                projection: "EPSG:4326",
            },
            {
                "lorem": "dolor",
            }
        )).toEqual({
            "params": {
                "FILTER_GEOM": "filterGeom",
                "crs": "EPSG:4326",
                "feature_count": 100,
                "height": 101,
                "id": "abcd",
                "info_format": "text/plain",
                "layers": [
                    "a",
                    "b",
                    "c",
                ],
                "lorem": "dolor",
                "query_layers": [
                    "a",
                    "b",
                    "c",
                ],
                "request": "GetFeatureInfo",
                "service": "WMS",
                "srs": "EPSG:4326",
                "styles": undefined,
                "version": "ipsum",
                "width": 101,
                "with_geometry": true,
                "with_maptip": false,
            },
            "url": "dolor",
        });
    });
});

describe("buildRequest", () => {
    it("should build a request", () => {
        expect(IdUtil.buildRequest(
            {
                id: "abcd",
                version: "ipsum",
                styles: "sit",
                dimensionValues: {},
                params: {},
                featureInfoUrl: "dolor?lorem=dolor",
            },
            ["a", "b", "c"],
            [12, 13],
            {
                resolutions: [1, 2, 3],
                zoom: 0,
                projection: "EPSG:4326",
            }
        )).toEqual({
            "params": {
                "bbox": "-240.5,-239.5,264.5,265.5",
                "crs": "EPSG:4326",
                "feature_count": 100,
                "height": 101,
                "i": 51,
                "id": "abcd",
                "info_format": "text/plain",
                "j": 51,
                "layers": [
                    "a",
                    "b",
                    "c",
                ],
                "lorem": "dolor",
                "query_layers": [
                    "a",
                    "b",
                    "c",
                ],
                "request": "GetFeatureInfo",
                "service": "WMS",
                "srs": "EPSG:4326",
                "styles": undefined,
                "version": "ipsum",
                "width": 101,
                "with_geometry": true,
                "with_maptip": false,
                "x": 51,
                "y": 51,
            },
            "url": "dolor",
        });
    });
});

describe("determineDisplayName", () => {

});

describe("getQueryLayers", () => {
    const map = {
        scales: [250000, 100000, 50000, 25000, 10000, 5000],
        zoom: 0,
    }
    it("should return an empty array if no layers are passed", () => {
        expect(IdUtil.getQueryLayers([], map)).toEqual([]);
    });
    it("should filter out invisible layers", () => {
        expect(IdUtil.getQueryLayers([{
            visibility: false
        }], map)).toEqual([]);
    });
    it("should filter out non-wms layers", () => {
        expect(IdUtil.getQueryLayers([{
            visibility: true,
            type: "xyz"
        }], map)).toEqual([]);
    });
    it("should filter out background layers", () => {
        expect(IdUtil.getQueryLayers([{
            visibility: true,
            type: "wms",
            role: LayerRole.BACKGROUND
        }], map)).toEqual([]);
    });
    it("should filter out layers with no query layers", () => {
        expect(IdUtil.getQueryLayers([{
            visibility: true,
            type: "wms",
            role: LayerRole.THEME,
            queryLayers: []
        }], map)).toEqual([]);
    });
    it("should return a simple layer", () => {
        expect(IdUtil.getQueryLayers([{
            visibility: true,
            type: "wms",
            role: LayerRole.THEME,
            queryLayers: [
                "lorem"
            ],
        }], map)).toEqual([
            {
                visibility: true,
                type: "wms",
                role: LayerRole.THEME,
                queryLayers: [
                    "lorem"
                ]
            }
        ]);
    });
    it("should concatenate query layers for same ID", () => {
        expect(IdUtil.getQueryLayers([{
            id: "abcd",
            visibility: true,
            type: "wms",
            role: LayerRole.THEME,
            queryLayers: [
                "lorem",
                "ipsum"
            ]
        }], map)).toEqual([
            {
                id: "abcd",
                visibility: true,
                type: "wms",
                role: LayerRole.THEME,
                queryLayers: [
                    "lorem",
                    "ipsum"
                ]
            }
        ]);
    });
    it("should work with external layer map", () => {
        expect(IdUtil.getQueryLayers([{
            id: "abcd",
            visibility: true,
            type: "wms",
            role: LayerRole.THEME,
            queryLayers: [
                "lorem"
            ],
            externalLayerMap: {
                "lorem": {
                    queryLayers: [
                        "ipsum"
                    ]
                }
            }
        }], map)).toEqual([
            {
                queryLayers: [
                    "ipsum"
                ]
            }
        ]);
    });
    it("should exclude invisible external layer", () => {
        mockLayerScaleInRange = false;
        expect(IdUtil.getQueryLayers([{
            id: "abcd",
            visibility: true,
            type: "wms",
            role: LayerRole.THEME,
            queryLayers: [
                "lorem"
            ],
            externalLayerMap: {
                "lorem": {
                    queryLayers: [
                        "ipsum"
                    ]
                }
            }
        }], map)).toEqual([]);
    });
});

describe("parseGeoJSONResponse", () => {

});

describe("parseGmlResponse", () => {

});

describe("parseResponse", () => {
    it("should parse the response", () => {
        mockGetUnits = 'm';
        IdUtil.parseResponse(
            {}, {}, 
        )
    });
});

describe("parseXmlFeature", () => {

});

describe("parseXmlResponse", () => {

});

describe("sendRequest", () => {
    it("should send a get request", () => {
        const callback = jest.fn();
        const request = {
            url: "url-foo",
            params: {
                foo: "bar",
            },
        };
        const result = "lorem ipsum";
        const response = {
            data: result,
        };
        IdUtil.sendRequest(request, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            "url-foo", { "params": { "foo": "bar" } }
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith(result);
    });
    it("should send a post request", () => {
        mockWmsMaxGetUrlLength = 0;
        const callback = jest.fn();
        const request = {
            url: "url-foo",
            params: {
                foo: "bar",
            },
        };
        const result = "lorem ipsum";
        const response = {
            data: result,
        };
        IdUtil.sendRequest(request, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            "url-foo", "foo=bar", {
            "headers": {
                "content-type": "application/x-www-form-urlencoded"
            }
        });
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith(result);
    });
});

