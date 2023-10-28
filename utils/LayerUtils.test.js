import LayerUtils from './LayerUtils';
import { LayerRole } from '../actions/layers';

const uuidRegex = /[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/;

let mockUrlReverseLayerOrder = false;
let mockExternalLayerFeatureInfoFormats = undefined;
let mockQgisServerVersion = 3;
jest.mock("./ConfigUtils", () => ({
    __esModule: true,
    default: {
        getConfigProp: (name) => {
            if (name === 'urlReverseLayerOrder') {
                return mockUrlReverseLayerOrder;
            } else if (name === 'externalLayerFeatureInfoFormats') {
                return mockExternalLayerFeatureInfoFormats;
            } else if (name === 'qgisServerVersion') {
                return mockQgisServerVersion;
            } else {
                throw new Error(`Unknown config prop: ${name}`);
            }
        },
    },
}));

let mockGetUnits = 'm';
let mockAxisOrder = 'ne';
jest.mock("./CoordinatesUtils", () => ({
    __esModule: true,
    default: {
        getUnits: () => mockGetUnits,
        getAxisOrder: () => mockAxisOrder,
    },
}));


beforeEach(() => {
    mockUrlReverseLayerOrder = false;
    mockExternalLayerFeatureInfoFormats = undefined;
    mockQgisServerVersion = 3;
    mockGetUnits = 'm';
    mockAxisOrder = 'ne';
});


describe("addExternalLayerPrintParams", () => {
    const printCrs = "EPSG:3857";
    let params;
    let counterRef;
    beforeEach(() => {
        params = {
            LAYERS: [],
            OPACITIES: [],
            COLORS: [],
        };
        counterRef = [0];
    });
    it("ignores git versions other than 2 and 3", () => {
        mockQgisServerVersion = 1;
        expect(() => {
            LayerUtils.addExternalLayerPrintParams({
                name: "lorem",
                role: LayerRole.USERLAYER,
                type: "wms",
            }, params, printCrs, counterRef);
        }).toThrow("Unsupported qgisServerVersion: 1");
        expect(params).toEqual(params);
        expect(counterRef[0]).toBe(0);
    });
    it("ignores non-WMS layers", () => {
        mockQgisServerVersion = 3;
        LayerUtils.addExternalLayerPrintParams({
            name: "lorem",
            role: LayerRole.USERLAYER,
            type: "xyz",
        }, params, printCrs, counterRef);
        expect(params).toEqual(params);
        expect(counterRef[0]).toBe(0);
    });
    it("deals with WMS, QGis 3 layers", () => {
        mockQgisServerVersion = 3;
        LayerUtils.addExternalLayerPrintParams({
            name: "lorem",
            role: LayerRole.USERLAYER,
            type: "wms",
            url: "ipsum",
            params: {
                LAYERS: "dolor",
                OPACITIES: "255",
                COLORS: "",
            }
        }, params, printCrs, counterRef);
        expect(params).toEqual({
            LAYERS: ["EXTERNAL_WMS:A"],
            OPACITIES: ["255"],
            COLORS: [""],
            "A:contextualWMSLegend": "0",
            "A:crs": "EPSG:3857",
            "A:dpiMode": "7",
            "A:format": "image/png",
            "A:layers": "dolor",
            "A:styles": "",
            "A:url": "http://localhost/ipsum",
        });
        expect(counterRef[0]).toBe(1);
    });
    it("deals with WMS, QGis 2 layers", () => {
        mockQgisServerVersion = 2;
        LayerUtils.addExternalLayerPrintParams({
            name: "lorem",
            role: LayerRole.USERLAYER,
            type: "wms",
            url: "ipsum",
            params: {
                LAYERS: "dolor",
                OPACITIES: "255",
                COLORS: "",
            }
        }, params, printCrs, counterRef);
        expect(params).toEqual({
            LAYERS: ["wms:ipsum#dolor"],
            OPACITIES: ["255"],
            COLORS: [""],
        });
        expect(counterRef[0]).toBe(0);
    });
    it("deals with WFS, QGis 2 layers", () => {
        mockQgisServerVersion = 2;
        LayerUtils.addExternalLayerPrintParams({
            name: "lorem",
            role: LayerRole.USERLAYER,
            type: "wfs",
            url: "ipsum",
            opacity: 127,
            color: "#123456",
        }, params, printCrs, counterRef);
        expect(params).toEqual({
            LAYERS: ["wfs:ipsum#lorem"],
            OPACITIES: [127],
            COLORS: ["#123456"],
        });
        expect(counterRef[0]).toBe(0);
    });
});


describe("addUUIDs", () => {
    it("should assign a new uuid if one is missing", () => {
        const layer = {};
        LayerUtils.addUUIDs(layer);
        expect(layer.uuid).toMatch(uuidRegex);
    });
    it("should keep the old uuid if present", () => {
        const uuid = "lorem";
        const layer = { uuid };
        LayerUtils.addUUIDs(layer);
        expect(layer.uuid).toBe(uuid);
    });
    it("should allocate a new uuid if already present", () => {
        const uuid = "lorem";
        const layer = { uuid };
        const used = new Set();
        used.add(uuid, used);
        LayerUtils.addUUIDs(layer, used);
        expect(layer.uuid).not.toBe(uuid);
        expect(layer.uuid).toMatch(uuidRegex);
    });
    it("should deal with sub-layers", () => {
        const used = new Set();
        const subLayers = [{
            sublayers: [{}]
        }]
        const layer = {
            sublayers: subLayers
        };
        LayerUtils.addUUIDs(layer, used);
        expect(layer.uuid).toMatch(uuidRegex);
        expect(layer.sublayers).not.toBe(subLayers);
        expect(layer.sublayers[0].uuid).toMatch(uuidRegex);
        expect(layer.sublayers[0].sublayers[0].uuid).toMatch(uuidRegex);
    });
});


describe("buildWMSLayerParams", () => {
    describe("without sublayers", () => {
        it("should work with a simple layer", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem"
            })).toEqual({
                params: {
                    LAYERS: "lorem",
                    OPACITIES: "255",
                    STYLES: "",
                },
                queryLayers: []
            });
        });
        it("should use layer opacity", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                opacity: 191
            })).toEqual({
                params: {
                    LAYERS: "lorem",
                    OPACITIES: "191",
                    STYLES: "",
                },
                queryLayers: []
            });
        });
        it("should filter out empty strings", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                opacity: 0,
                params: {
                    LAYERS: "ipsum,,dolor",
                    OPACITIES: "191,,255",
                }
            })).toEqual({
                params: {
                    LAYERS: "ipsum,dolor",
                    OPACITIES: "0,0",
                    STYLES: "",
                },
                queryLayers: []
            });
        });
        it("should copy the style", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                params: {
                    STYLES: "ipsum,dolor"
                }
            })).toEqual({
                params: {
                    LAYERS: "lorem",
                    OPACITIES: "255",
                    STYLES: "ipsum,dolor",
                },
                queryLayers: []
            });
        });
        it("should include dimensionValues content", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                dimensionValues: {
                    "ipsum": "dolor",
                    "sit": "amet",
                }
            })).toEqual({
                params: {
                    LAYERS: "lorem",
                    OPACITIES: "255",
                    STYLES: "",
                    ipsum: "dolor",
                    sit: "amet",
                },
                queryLayers: []
            });
        });
        it("should add the layer to queryLayers", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                queryable: true
            })).toEqual({
                params: {
                    LAYERS: "lorem",
                    OPACITIES: "255",
                    STYLES: "",
                },
                queryLayers: ["lorem"]
            });
        });
    });
    describe("with sublayers", () => {
        it("excludes invisible layers", () => {
            expect(LayerUtils.buildWMSLayerParams({
                sublayers: [{
                    name: "lorem"
                }]
            })).toEqual({
                params: {
                    LAYERS: "",
                    OPACITIES: "",
                    STYLES: "",
                },
                queryLayers: []
            });
        });
        it("includes visible sublayers", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                visibility: true,
                sublayers: [{
                    name: "ipsum"
                }]
            })).toEqual({
                params: {
                    LAYERS: "ipsum",
                    OPACITIES: "255",
                    STYLES: "",
                },
                queryLayers: []
            });
        });
        it("adds the styles", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                visibility: true,
                sublayers: [{
                    name: "ipsum",
                    style: "dolor",
                    opacity: 191
                }]
            })).toEqual({
                params: {
                    LAYERS: "ipsum",
                    OPACITIES: "191",
                    STYLES: "dolor",
                },
                queryLayers: []
            });
        });
        it("adds queryable layers", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                visibility: true,
                sublayers: [{
                    name: "ipsum",
                    queryable: true
                }]
            })).toEqual({
                params: {
                    LAYERS: "ipsum",
                    OPACITIES: "255",
                    STYLES: "",
                },
                queryLayers: ["ipsum"]
            });
        });
        it("includes multiple visible sublayers", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                visibility: true,
                sublayers: [{
                    name: "ipsum",
                }, {
                    name: "dolor",
                }]
            })).toEqual({
                params: {
                    LAYERS: "dolor,ipsum",
                    OPACITIES: "255,255",
                    STYLES: ",",
                },
                queryLayers: []
            });
        });
        it("adds the styles from multiple layers", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                visibility: true,
                sublayers: [{
                    name: "ipsum",
                    style: "dolor",
                    opacity: 191
                }, {
                    name: "sit",
                    style: "amet",
                    opacity: 215
                }]
            })).toEqual({
                params: {
                    LAYERS: "sit,ipsum",
                    OPACITIES: "215,191",
                    STYLES: "amet,dolor",
                },
                queryLayers: []
            });
        });
        it("adds multiple queryable layers", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                visibility: true,
                sublayers: [{
                    name: "ipsum",
                    queryable: true
                }, {
                    name: "dolor",
                    queryable: true
                }]
            })).toEqual({
                params: {
                    LAYERS: "dolor,ipsum",
                    OPACITIES: "255,255",
                    STYLES: ",",
                },
                queryLayers: ["ipsum", "dolor"]
            });
        });
        it("follows the drawing order", () => {
            expect(LayerUtils.buildWMSLayerParams({
                name: "lorem",
                visibility: true,
                drawingOrder: ["dolor", "ipsum", "sit"],
                sublayers: [{
                    name: "ipsum",
                    opacity: 191
                }, {
                    name: "dolor",
                    style: "sit",
                }, {
                    name: "amet",
                    queryable: true
                }]
            })).toEqual({
                params: {
                    LAYERS: "dolor,ipsum",
                    OPACITIES: "255,191",
                    STYLES: "sit,",
                },
                queryLayers: ["amet"]
            });
        });
    });
});


describe("buildWMSLayerUrlParam", () => {
    it("should return an empty string if no params are passed", () => {
        expect(LayerUtils.buildWMSLayerUrlParam([])).toBe("");
    });
    it("should ignore layer types other than theme and user", () => {
        expect(LayerUtils.buildWMSLayerUrlParam([{
            role: LayerRole.BACKGROUND
        }, {
            role: LayerRole.SELECTION
        }, {
            role: LayerRole.MARKER
        }, {
            role: LayerRole.USERLAYER,
            type: "xyz"
        }])).toBe("");
    });
    describe("with theme layers", () => {
        it("should accept theme layers", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.THEME,
                name: "lorem"
            }])).toBe("lorem~");
        });
        it("should use opacity", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.THEME,
                name: "lorem",
                opacity: 123
            }])).toBe("lorem[52]~");
        });
        it("should use visibility", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.THEME,
                name: "lorem",
                visibility: false
            }])).toBe("lorem!");
        });
        it("should work with sublayers", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.THEME,
                name: "lorem",
                sublayers: [{
                    name: "ipsum"
                }, {
                    name: "dolor",
                    sublayers: [{
                        name: "sit",
                        opacity: 73
                    }, {
                        name: "amet",
                        visibility: false
                    }]
                }]
            }])).toBe("ipsum~,sit[71]~,amet!");
        });
        it("should reverse the layers", () => {
            mockUrlReverseLayerOrder = true;
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.THEME,
                name: "lorem",
                sublayers: [{
                    name: "ipsum"
                }, {
                    name: "dolor",
                    sublayers: [{
                        name: "sit",
                        opacity: 73
                    }, {
                        name: "amet",
                        visibility: false
                    }]
                }]
            }])).toBe("amet!,sit[71]~,ipsum~");
        });
    });
    describe("with WMS user layers", () => {
        it("should accept WMS user layers", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "wms",
                url: "ipsum",
                name: "lorem"
            }])).toBe("wms:ipsum#lorem~");
        });
        it("should use opacity", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "wms",
                url: "ipsum",
                name: "lorem",
                opacity: 123
            }])).toBe("wms:ipsum#lorem[52]~");
        });
        it("should use visibility", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "wms",
                url: "ipsum",
                name: "lorem",
                visibility: false
            }])).toBe("wms:ipsum#lorem!");
        });
        it("should use extended wms params", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "wms",
                url: "ipsum",
                name: "lorem",
                visibility: false,
                extwmsparams: {
                    "tempor": "incididunt",
                    "ut": "labore"
                }
            }])).toBe(
                "wms:ipsum?extwms.tempor=incididunt&extwms.ut=labore#lorem!"
            );
        });
        it("should work with sublayers", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "wms",
                url: "ipsum",
                name: "lorem",
                sublayers: [{
                    name: "dolor"
                }, {
                    name: "sit",
                    sublayers: [{
                        name: "amet",
                        opacity: 73
                    }, {
                        name: "consectetur",
                        visibility: false
                    }]
                }]
            }])).toBe(
                "wms:ipsum#dolor~,wms:ipsum#amet[71]~,wms:ipsum#consectetur!"
            );
        });
    });
    describe("with WFS and WMTS user layers", () => {
        it("should accept the layers", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "wfs",
                url: "ipsum",
                name: "lorem"
            }, {
                role: LayerRole.USERLAYER,
                type: "wmts",
                capabilitiesUrl: "ipsum",
                name: "lorem"
            }])).toBe("wfs:ipsum#lorem,wmts:ipsum#lorem");
        });
        it("should use opacity", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "wfs",
                url: "ipsum",
                name: "lorem",
                opacity: 123
            }, {
                role: LayerRole.USERLAYER,
                type: "wmts",
                capabilitiesUrl: "sit",
                name: "dolor",
                opacity: 10
            }])).toBe("wfs:ipsum#lorem[52],wmts:sit#dolor[96]");
        });
        it("should use visibility", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "wfs",
                capabilitiesUrl: "ipsum",
                name: "lorem",
                visibility: false
            }, {
                role: LayerRole.USERLAYER,
                type: "wmts",
                url: "sit",
                name: "dolor",
                visibility: false
            }])).toBe("wfs:ipsum#lorem!,wmts:sit#dolor!");
        });
    });
    describe("with separator layers", () => {
        it("should accept separator layers", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "separator",
                name: "lorem",
                title: "ipsum"
            }])).toBe("sep:ipsum");
        });
        it("should ignore opacity", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                opacity: 123,
                type: "separator",
                name: "lorem",
                title: "ipsum"
            }])).toBe("sep:ipsum");
        });
        it("should ignore visibility", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                visibility: false,
                type: "separator",
                name: "lorem",
                title: "ipsum"
            }])).toBe("sep:ipsum");
        });
        it("should ignore sublayers", () => {
            expect(LayerUtils.buildWMSLayerUrlParam([{
                role: LayerRole.USERLAYER,
                type: "separator",
                name: "lorem",
                title: "ipsum",
                sublayers: [{
                    name: "dolor"
                }]
            }])).toBe("sep:ipsum");
        });
    });
});


describe("cloneLayer", () => {
    it("should clone a layer without sublayers", () => {
        const layer = {
            id: "lorem",
        };
        const clone = LayerUtils.cloneLayer(layer, []);
        const newLayer = clone.newlayer;
        const newSubLayer = clone.newsublayer;
        expect(newLayer).not.toBe(layer);
        expect(newLayer).toEqual(layer);
        expect(newSubLayer).not.toBe(layer);
        expect(newSubLayer).toEqual(layer);
    });
    it("should clone a layer with a sub-layer", () => {
        const subLayer = {
            id: "ipsum",
        };
        const layer = {
            id: "lorem",
            sublayers: [subLayer]
        };
        const clone = LayerUtils.cloneLayer(layer, [0]);
        const newLayer = clone.newlayer;
        const newSubLayer = clone.newsublayer;
        expect(newLayer).not.toBe(layer);
        expect(newLayer).toEqual(layer);
        expect(newSubLayer).not.toBe(subLayer);
        expect(newSubLayer).toEqual(subLayer);
    });
});


describe("collectGroupLayers", () => {
    it("should return an empty list", () => {
        const groupLayers = {};
        LayerUtils.collectGroupLayers({
            name: "lorem"
        }, [], groupLayers);
        expect(groupLayers).toEqual({});
    });
    it("should add the layer to a single group", () => {
        const groupLayers = {};
        LayerUtils.collectGroupLayers({
            name: "lorem"
        }, ['ipsum'], groupLayers);
        expect(groupLayers).toEqual({
            ipsum: ["lorem"]
        });
    });
    it("should add the layer to multiple groups", () => {
        const groupLayers = {};
        LayerUtils.collectGroupLayers({
            name: "lorem"
        }, ['ipsum', 'dolor'], groupLayers);
        expect(groupLayers).toEqual({
            ipsum: ["lorem"],
            dolor: ["lorem"]
        });
    });
    it("should add the layer and sub-layer to a single group", () => {
        const groupLayers = {};
        LayerUtils.collectGroupLayers({
            name: "lorem",
            sublayers: [{
                name: "consectetur"
            }, {
                name: "adipiscing"
            }]
        }, ['ipsum'], groupLayers);
        expect(groupLayers).toEqual({
            ipsum: ["consectetur", "adipiscing"],
            lorem: ["consectetur", "adipiscing"]
        });
    });
    it("should add the layer and sub-layer to multiple groups", () => {
        const groupLayers = {};
        LayerUtils.collectGroupLayers({
            name: "lorem",
            sublayers: [{
                name: "consectetur"
            }, {
                name: "adipiscing"
            }]
        }, ['ipsum', 'dolor'], groupLayers);
        expect(groupLayers).toEqual({
            ipsum: ["consectetur", "adipiscing"],
            dolor: ["consectetur", "adipiscing"],
            lorem: ["consectetur", "adipiscing"]
        });
    });
});


describe("collectPrintParams", () => {
    const emptyResponse = {
        LAYERS: "",
        OPACITIES: "",
        COLORS: "",
    };
    it("should return an empty list if no params are passed", () => {
        expect(
            LayerUtils.collectPrintParams([], {}, 1, "EPSG:3857", true)
        ).toEqual(emptyResponse);
    });
    it("should ignore layer types other than theme and user", () => {
        expect(LayerUtils.collectPrintParams([{
            role: LayerRole.BACKGROUND,
            visibility: false
        }, {
            role: LayerRole.SELECTION
        }, {
            role: LayerRole.MARKER
        }, {
            role: LayerRole.USERLAYER,
            type: "xyz"
        }], {}, 1, "EPSG:3857", true)).toEqual(emptyResponse);
    });
    it("should accept theme layers", () => {
        expect(LayerUtils.collectPrintParams([{
            role: LayerRole.THEME,
            visibility: false,
            params: {
                LAYERS: "lorem",
                OPACITIES: "255",
                COLORS: "",
            }
        }], {}, 1, "EPSG:3857", true)).toEqual({
            LAYERS: "lorem",
            OPACITIES: "255",
            COLORS: "",
        });
    });
    it("should accept user layers", () => {
        expect(LayerUtils.collectPrintParams([{
            role: LayerRole.USERLAYER,
            visibility: true,
            type: "wms",
            url: "ipsum",
            params: {
                LAYERS: "lorem",
                OPACITIES: "255",
                COLORS: "",
            }
        }], {}, 1, "EPSG:3857", true)).toEqual({
            LAYERS: "EXTERNAL_WMS:A",
            OPACITIES: "255",
            COLORS: "",
            "A:contextualWMSLegend": "0",
            "A:crs": "EPSG:3857",
            "A:dpiMode": "7",
            "A:format": "image/png",
            "A:layers": "lorem",
            "A:styles": "",
            "A:url": "http://localhost/ipsum",
        });
    });
    it("should accept background layers", () => {
        expect(LayerUtils.collectPrintParams([{
            name: "ipsum",
            role: LayerRole.BACKGROUND,
            visibility: true,
            params: {
                LAYERS: "lorem",
                OPACITIES: "255",
                COLORS: "",
            }
        }, {
            name: "dolor",
            role: LayerRole.USERLAYER,
        }], {
            backgroundLayers: [{
                name: "ipsum",
                printLayer: "dolor"
            }]
        }, 1, "EPSG:3857", true)).toEqual({
            LAYERS: "dolor",
            OPACITIES: "255",
            COLORS: "",
        });
    });
});


describe("collectWMSSubLayerParams", () => {
    it("should return an empty list if visibilities is not set", () => {
        const subLayer = {
            name: "lorem"
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = null;
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual([]);
        expect(opacities).toEqual([]);
        expect(styles).toEqual([]);
        expect(queryable).toEqual([]);
    });
    it("should return an empty list if layer visibility is off", () => {
        const subLayer = {
            name: "lorem",
            visibility: false
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = null;
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual([]);
        expect(opacities).toEqual([]);
        expect(styles).toEqual([]);
        expect(queryable).toEqual([]);
    });
    it("should return the layer if it is visible", () => {
        const subLayer = {
            name: "lorem"
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = [];
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, true
        )
        expect(layerNames).toEqual(["lorem"]);
        expect(opacities).toEqual([255]);
        expect(styles).toEqual([""]);
        expect(queryable).toEqual([]);
        expect(visibilities).toEqual([1]);
    });
    it("should take into account the visibility of its parent", () => {
        const subLayer = {
            name: "lorem"
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = [];
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual(["lorem"]);
        expect(opacities).toEqual([255]);
        expect(styles).toEqual([""]);
        expect(queryable).toEqual([]);
        expect(visibilities).toEqual([0.5]);
    });
    it("should not use a non-integer opacity", () => {
        const subLayer = {
            name: "lorem",
            opacity: "123"
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = [];
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual(["lorem"]);
        expect(opacities).toEqual([255]);
        expect(styles).toEqual([""]);
        expect(queryable).toEqual([]);
        expect(visibilities).toEqual([0.5]);
    });
    it("should use an integer opacity", () => {
        const subLayer = {
            name: "lorem",
            opacity: 123
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = [];
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual(["lorem"]);
        expect(opacities).toEqual([123]);
        expect(styles).toEqual([""]);
        expect(queryable).toEqual([]);
        expect(visibilities).toEqual([0.5]);
    });
    it("should use layer style", () => {
        const subLayer = {
            name: "lorem",
            style: "ipsum"
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = [];
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual(["lorem"]);
        expect(opacities).toEqual([255]);
        expect(styles).toEqual(["ipsum"]);
        expect(queryable).toEqual([]);
        expect(visibilities).toEqual([0.5]);
    });
    it("should add the layer to the list of queryable layers", () => {
        const subLayer = {
            name: "lorem",
            queryable: true
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = [];
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual(["lorem"]);
        expect(opacities).toEqual([255]);
        expect(styles).toEqual([""]);
        expect(queryable).toEqual(["lorem"]);
        expect(visibilities).toEqual([0.5]);
    });
    it("should work with one sub-layer", () => {
        const subLayer = {
            name: "lorem",
            queryable: true,
            style: "ipsum",
            opacity: 12,
            sublayers: [{
                name: "dolor",
                opacity: 123,
                style: "sit",
                queryable: true
            }]
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = [];
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual(["dolor"]);
        expect(opacities).toEqual([123]);
        expect(styles).toEqual(["sit"]);
        expect(queryable).toEqual(["dolor"]);
        expect(visibilities).toEqual([0.5]);
    });
    it("should work with multiple sub-layers", () => {
        const subLayer = {
            name: "lorem",
            queryable: true,
            style: "ipsum",
            opacity: 12,
            sublayers: [{
                name: "dolor",
                opacity: 123,
                style: "sit",
                queryable: true
            }, {
                name: "amet",
                visibility: false,
            }, {
                name: "consectetur",
                opacity: 0,
                style: "",
                queryable: false
            }, {
                name: "adipiscing",
                opacity: 0,
                style: "",
                queryable: true,
                sublayers: [{
                    name: "elit",
                    opacity: 75,
                    style: "sed",
                    queryable: true
                }, {
                    name: "do",
                    visibility: false,
                }, {
                    name: "eiusmod",
                    visibility: false,
                    sublayers: [{
                        name: "tempor",
                        style: "incididunt",
                    }]
                }]
            }]
        };
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const queryable = [];
        const visibilities = [];
        LayerUtils.collectWMSSublayerParams(
            subLayer, layerNames, opacities, styles,
            queryable, visibilities, false
        )
        expect(layerNames).toEqual([
            "dolor", "amet", "consectetur", "elit", "do", "tempor"
        ]);
        expect(opacities).toEqual([123, 255, 0, 75, 255, 255]);
        expect(styles).toEqual(["sit", "", "", "sed", "", "incididunt"]);
        expect(queryable).toEqual(["dolor", "elit"]);
        expect(visibilities).toEqual([
            0.5, 0, 0.5, 0.5, 0, 0.5
        ]);
    });
});


describe("completeExternalLayer", () => {
    describe("non-WMS layers", () => {
        it("adds an uuid", () => {
            const externalLayer = {};
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                title: undefined,
                uuid: expect.stringMatching(uuidRegex)
            });
        });
        it("keeps the title of the layer", () => {
            const externalLayer = {
                title: "lorem"
            };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                title: "lorem",
                uuid: expect.stringMatching(uuidRegex)
            });
        });
        it("uses the name if there's no title", () => {
            const externalLayer = {
                name: "lorem"
            };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                title: "lorem",
                name: "lorem",
                uuid: expect.stringMatching(uuidRegex)
            });
        });
        it("uses the title of the sublayer", () => {
            const externalLayer = {};
            const sublayer = {
                title: "lorem"
            };
            LayerUtils.completeExternalLayer(externalLayer, sublayer);
            expect(externalLayer).toEqual({
                title: "lorem",
                uuid: expect.stringMatching(uuidRegex)
            });
        });
    });
    describe("WMS layers", () => {
        const baseInput = {
            type: "wms",
            featureInfoUrl: "ipsum",
            params: {
                LAYERS: "lorem",
                OPACITIES: "255",
                STYLES: "",
            }
        };
        const baseOutput = {
            title: undefined,
            uuid: expect.stringMatching(uuidRegex),
            type: "wms",
            legendUrl: undefined,
            featureInfoUrl: "ipsum",
            params: {
                LAYERS: "lorem",
                OPACITIES: "255",
                STYLES: "",
            },
            queryLayers: ["lorem",],
            version: "1.3.0",
        }
        beforeEach(() => {
            mockExternalLayerFeatureInfoFormats = {};
        });
        it("adds the defaults", () => {
            const externalLayer = { ...baseInput };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual(baseOutput);
        });
        it("uses the version from the layer", () => {
            const externalLayer = {
                ...baseInput,
                version: "1.1.1"
            };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                ...baseOutput,
                version: "1.1.1"
            });
        });
        it("uses the url property if featureInfoUrl is missing", () => {
            const externalLayer = {
                ...baseInput,
                featureInfoUrl: undefined,
                url: "ipsum"
            };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                ...baseOutput,
                featureInfoUrl: "ipsum",
                url: "ipsum",
                legendUrl: "ipsum"
            });
        });
        it("uses the legendUrl property", () => {
            const externalLayer = {
                ...baseInput,
                legendUrl: "dolor"
            };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                ...baseOutput,
                legendUrl: "dolor"
            });
        });
        it("uses the queryLayers property", () => {
            const externalLayer = {
                ...baseInput,
                queryLayers: ["lorem", "ipsum", "dolor"],
            };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                ...baseOutput,
                queryLayers: ["lorem", "ipsum", "dolor"],
            });
        });
        it("uses the LAYERS in parameters if no queryLayers property", () => {
            const externalLayer = {
                ...baseInput,
                params: {
                    LAYERS: "lorem,ipsum,dolor"
                }
            };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                ...baseOutput,
                params: {
                    LAYERS: "lorem,ipsum,dolor"
                },
                queryLayers: ["lorem", "ipsum", "dolor"],
            });
        });
        it("provides info formats", () => {
            mockExternalLayerFeatureInfoFormats = {
                "ipsum": "dolor",
                "lorem": "sit"
            }
            const externalLayer = {
                ...baseInput,
                featureInfoUrl: "ipsum+lorem"
            };
            LayerUtils.completeExternalLayer(externalLayer, undefined);
            expect(externalLayer).toEqual({
                ...baseOutput,
                featureInfoUrl: "ipsum+lorem",
                infoFormats: ["dolor"]
            });
        });
    });
});


describe("computeLayerVisibility", () => {
    it("should be simple if there are no sub-layers", () => {
        expect(LayerUtils.computeLayerVisibility({
            visibility: true
        })).toBe(1);
        expect(LayerUtils.computeLayerVisibility({
            visibility: false
        })).toBe(0);
    });
    it("should return 0 if visibility is false", () => {
        expect(LayerUtils.computeLayerVisibility({
            visibility: false,
            sublayers: [{
                visibility: true,
            }]
        })).toBe(0);
    });
    it("should use immediate sublayers", () => {
        expect(LayerUtils.computeLayerVisibility({
            sublayers: [{
                visibility: true,
            }, {
                visibility: false,
            }]
        })).toBe(0.5);
    });
    it("should use deep sublayers", () => {
        expect(LayerUtils.computeLayerVisibility({
            sublayers: [{
                visibility: true,
            }, {
                sublayers: [{
                    visibility: true,
                }, {
                    sublayers: [{
                        visibility: true,
                    }, {
                        visibility: false,
                    }]
                }]
            }]
        })).toBe(0.875);
    });
    it("should assume visibility=true", () => {
        expect(LayerUtils.computeLayerVisibility({
            sublayers: [{}, {
                sublayers: [{}, {
                    sublayers: [{}, {
                        visibility: false,
                    }]
                }]
            }]
        })).toBe(0.875);
    });
});

describe("createExternalLayerPlaceholder", () => {
    it("should create the layer and add it to ", () => {
        const externalLayers = {};
        expect(LayerUtils.createExternalLayerPlaceholder({
            name: "ipsum",
            opacity: 0.75,
            visibility: false,
            params: "dolor"
        }, externalLayers, "lorem")).toEqual([{
            layer: {
                id: "lorem",
                type: "placeholder",
                loading: true,
                name: "ipsum",
                title: "ipsum",
                role: LayerRole.USERLAYER,
                uuid: expect.stringMatching(uuidRegex)
            },
            path: [],
            sublayer: {
                id: "lorem",
                type: "placeholder",
                loading: true,
                name: "ipsum",
                title: "ipsum",
                role: LayerRole.USERLAYER,
                uuid: expect.stringMatching(uuidRegex)
            }
        }])
    });
});

describe("createSeparatorLayer", () => {
    it("should create a new layer", () => {
        expect(LayerUtils.createSeparatorLayer("lorem")).toEqual([{
            layer: {
                type: "separator",
                title: "lorem",
                role: LayerRole.USERLAYER,
                uuid: expect.stringMatching(uuidRegex),
                id: expect.stringMatching(uuidRegex),
            },
            path: [],
            sublayer: {
                type: "separator",
                title: "lorem",
                role: LayerRole.USERLAYER,
                uuid: expect.stringMatching(uuidRegex),
                id: expect.stringMatching(uuidRegex),
            }
        }]);
    });
});

describe("ensureMutuallyExclusive", () => {
    it("should not throw if the groups is empty", () => {
        expect(() => LayerUtils.ensureMutuallyExclusive({
            mutuallyExclusive: true,
            sublayers: []
        })).not.toThrow();
        expect(() => LayerUtils.ensureMutuallyExclusive({
            mutuallyExclusive: true,
        })).not.toThrow();
    });
    it("should set visible the only sub-layer", () => {
        const layer = {
            visibility: false
        };
        LayerUtils.ensureMutuallyExclusive({
            mutuallyExclusive: true,
            sublayers: [layer]
        });
        expect(layer.visibility).toBeTruthy();
    });
    it("should set visible the first sub-layer", () => {
        const layer1 = {
            visibility: false
        };
        const layer2 = {
            visibility: false
        };
        LayerUtils.ensureMutuallyExclusive({
            mutuallyExclusive: true,
            sublayers: [layer1, layer2]
        });
        expect(layer1.visibility).toBeTruthy();
        expect(layer2.visibility).toBeFalsy();
    });
    it("should set visible the visible sub-layer", () => {
        const layer1 = {
            visibility: false
        };
        const layer2 = {
            visibility: true
        };
        LayerUtils.ensureMutuallyExclusive({
            mutuallyExclusive: true,
            sublayers: [layer1, layer2]
        });
        expect(layer1.visibility).toBeFalsy();
        expect(layer2.visibility).toBeTruthy();
    });
    it("should set visible the tristate sub-layer", () => {
        const layer1 = {
            visibility: false,
            tristate: false
        };
        const layer2 = {
            visibility: false,
            tristate: true
        };
        LayerUtils.ensureMutuallyExclusive({
            mutuallyExclusive: true,
            sublayers: [layer1, layer2]
        });
        expect(layer1.visibility).toBeFalsy();
        expect(layer2.visibility).toBeTruthy();
    });
    it("should work inside a non mutually-exclusive group", () => {
        const layer1 = {
            visibility: false,
            tristate: false
        };
        const layer2 = {
            visibility: false,
            tristate: true
        };
        LayerUtils.ensureMutuallyExclusive({
            sublayers: [{
                mutuallyExclusive: true,
                sublayers: [layer1, layer2]
            }]
        });
        expect(layer1.visibility).toBeFalsy();
        expect(layer2.visibility).toBeTruthy();
    });
    it("should allow nested mutually-exclusive groups", () => {
        const layer1 = {
            visibility: false,
            tristate: false
        };
        const layer2 = {
            visibility: false,
            tristate: true
        };
        const layer3 = {
            visibility: false
        };
        const layer4 = {
            visibility: false
        };
        LayerUtils.ensureMutuallyExclusive({
            mutuallyExclusive: true,
            sublayers: [
                layer1,
                layer2,
                {
                    mutuallyExclusive: true,
                    sublayers: [layer3, layer4]
                }
            ]
        });
        expect(layer1.visibility).toBeFalsy();
        expect(layer2.visibility).toBeTruthy();
        expect(layer3.visibility).toBeTruthy();
        expect(layer4.visibility).toBeFalsy();
    });
});

describe("explodeLayers", () => {
    it("should work with an empty list", () => {
        expect(LayerUtils.explodeLayers([])).toEqual([]);
    });
    it("should work with a single layer", () => {
        expect(LayerUtils.explodeLayers([{
            id: "one"
        }])).toEqual([{
            layer: { id: "one" },
            path: [],
            sublayer: { id: "one" }
        }]);
    });
    it("should create the list for a 2-item tree", () => {
        expect(LayerUtils.explodeLayers([{
            id: "one",
            sublayers: [{
                id: "one-one"
            }]
        }])).toEqual([{
            layer: {
                id: "one",
                sublayers: [{
                    id: "one-one"
                }]
            },
            path: [0],
            sublayer: { id: "one-one" }
        }]);
    });
    it("should create the list for a 3-item tree", () => {
        expect(LayerUtils.explodeLayers([{
            id: "one",
            sublayers: [{
                id: "one-one"
            }, {
                id: "one-two"
            }]
        }])).toEqual([{
            layer: {
                id: "one",
                sublayers: [{
                    id: "one-one"
                }]
            },
            path: [0],
            sublayer: { id: "one-one" }
        }, {
            layer: {
                id: "one",
                sublayers: [{
                    id: "one-two"
                }]
            },
            path: [1],
            sublayer: { id: "one-two" }
        }]);
    });
    it("should create the list for a 4-item tree", () => {
        expect(LayerUtils.explodeLayers([{
            id: "one",
            sublayers: [{
                id: "one-one",
                sublayers: [{
                    id: "one-one-one",
                }]
            }, {
                id: "one-two"
            }]
        }])).toEqual([{
            layer: {
                id: "one",
                sublayers: [{
                    id: "one-one",
                    sublayers: [{ id: "one-one-one" }]
                }]
            },
            path: [0, 0],
            sublayer: { id: "one-one-one" }
        }, {
            layer: {
                id: "one",
                sublayers: [{
                    id: "one-two"
                }]
            },
            path: [1],
            sublayer: { id: "one-two" }
        }]);
    });

});

describe("explodeSublayers", () => {
    it("should ignore a leaf layer (empty subitems property)", () => {
        const layer = { sublayers: [] };
        const exploded = [];
        const path = [];
        LayerUtils.explodeSublayers(layer, layer, exploded, path);
        expect(exploded).toEqual([]);
        expect(path).toEqual([]);
    });
    it("throws if a layer without subitems member is passed", () => {
        expect(() => {
            LayerUtils.explodeSublayers({}, {}, [], []);
        }).toThrow();
    });
    it("should create the list for a 2-item tree", () => {
        const layer = {
            id: "one",
            sublayers: [{
                id: "one-one"
            }]
        };
        const exploded = [];
        const path = [];
        LayerUtils.explodeSublayers(layer, layer, exploded, path);
        expect(exploded).toEqual([{
            "layer": {
                "id": "one",
                "sublayers": [
                    { "id": "one-one", },
                ],
            },
            "path": [0],
            "sublayer": { "id": "one-one" },
        }]);
        expect(path).toEqual([]);
    });
    it("should create the list for a 3-item tree", () => {
        const layer = {
            id: "one",
            sublayers: [{
                id: "one-one"
            }, {
                id: "one-two"
            }]
        };
        const exploded = [];
        const path = [];
        LayerUtils.explodeSublayers(layer, layer, exploded, path);
        expect(exploded).toEqual([{
            layer: {
                id: "one",
                sublayers: [
                    { id: "one-one", },
                ],
            },
            path: [0],
            sublayer: { id: "one-one" },
        }, {
            layer: {
                id: "one",
                sublayers: [
                    { id: "one-two", },
                ],
            },
            path: [1],
            sublayer: { id: "one-two" },
        }]);
        expect(path).toEqual([]);
        expect(exploded[0]).not.toBe(layer);
        expect(exploded[1]).not.toBe(layer);
    });
    it("should create the list for a 4-item tree", () => {
        const layer = {
            id: "one",
            sublayers: [{
                id: "one-one",
                sublayers: [{
                    id: "one-one-one",
                }]
            }, {
                id: "one-two"
            }]
        };
        const exploded = [];
        const path = [];
        LayerUtils.explodeSublayers(layer, layer, exploded, path);
        expect(exploded).toEqual([{
            layer: {
                id: "one",
                sublayers: [{
                    id: "one-one",
                    sublayers: [{
                        id: "one-one-one",
                    }]
                }],
            },
            path: [0, 0],
            sublayer: { id: "one-one-one" },
        }, {
            layer: {
                id: "one",
                sublayers: [
                    { "id": "one-two", },
                ],
            },
            path: [1],
            sublayer: { id: "one-two" },
        }]);
        expect(path).toEqual([]);
    });

});

describe("extractExternalLayersFromSublayers", () => {
    it("should clone an empty list", () => {
        const sublayers = [];
        const layer = { sublayers };
        const topLayer = {};
        LayerUtils.extractExternalLayersFromSublayers(
            topLayer, layer
        );
        expect(layer.sublayers).toEqual(sublayers);
        expect(layer.sublayers).not.toBe(sublayers);
        expect(topLayer).toEqual({});
    });
    it("should clone a list with a single layer without external data", () => {
        const sublayers = [{
            name: "one"
        }];
        const layer = { sublayers };
        const topLayer = {};
        LayerUtils.extractExternalLayersFromSublayers(
            topLayer, layer
        );
        expect(layer.sublayers).toEqual(sublayers);
        expect(layer.sublayers).not.toBe(sublayers);
        expect(topLayer).toEqual({});
    });
    it("should add external data", () => {
        const sublayers = [{
            name: "lorem",
            externalLayer: {
                name: "ipsum",
            }
        }];
        const layer = { sublayers };
        const topLayer = {
            externalLayerMap: {}
        };
        LayerUtils.extractExternalLayersFromSublayers(
            topLayer, layer
        );
        expect(layer.sublayers).toEqual([{ name: "lorem" }]);
        expect(layer.sublayers).not.toBe(sublayers);
        expect(topLayer).toEqual({
            externalLayerMap: {
                "lorem": {
                    name: "ipsum",
                    title: "ipsum",
                    uuid: expect.stringMatching(uuidRegex),
                }
            }
        });
    });
    it("should add WMS data", () => {
        mockExternalLayerFeatureInfoFormats = undefined;
        const sublayers = [{
            name: "lorem",
            externalLayer: {
                name: "ipsum",
                type: "wms",
                url: "dolor",
                params: {
                    LAYERS: "sit,amet",
                }
            }
        }];
        const layer = { sublayers };
        const topLayer = {
            externalLayerMap: {}
        };
        LayerUtils.extractExternalLayersFromSublayers(
            topLayer, layer
        );
        expect(layer.sublayers).toEqual([{ name: "lorem" }]);
        expect(layer.sublayers).not.toBe(sublayers);
        expect(topLayer).toEqual({
            externalLayerMap: {
                lorem: {
                    name: "ipsum",
                    type: "wms",
                    url: "dolor",
                    title: "ipsum",
                    uuid: expect.stringMatching(uuidRegex),
                    featureInfoUrl: "dolor",
                    legendUrl: "dolor",
                    params: {
                        LAYERS: "sit,amet",
                    },
                    version: "1.3.0",
                    queryLayers: [
                        "sit",
                        "amet",
                    ],
                }
            }
        });
    });
    it("should work with nested data", () => {
        const sublayers = [{
            name: "lorem",
            externalLayer: {
                name: "ipsum",
            },
            sublayers: [{
                name: "dolor",
                externalLayer: {
                    name: "sit",
                },
            }],
        }];
        const layer = { sublayers };
        const topLayer = {
            externalLayerMap: {}
        };
        LayerUtils.extractExternalLayersFromSublayers(
            topLayer, layer
        );
        expect(layer.sublayers).toEqual([
            { name: "lorem", sublayers: [{ name: "dolor" }] },
        ]);
        expect(layer.sublayers).not.toBe(sublayers);
        expect(topLayer).toEqual({
            externalLayerMap: {
                lorem: {
                    name: "ipsum",
                    title: "ipsum",
                    uuid: expect.stringMatching(uuidRegex),
                },
                dolor: {
                    name: "sit",
                    title: "sit",
                    uuid: expect.stringMatching(uuidRegex),
                }
            }
        });
    });
});


describe("getAttribution", () => {

});

describe("getLegendUrl", () => {
    it("simply returns the legendUrl property if not a WMS layer", () => {
        expect(LayerUtils.getLegendUrl({})).toBe("");
        expect(LayerUtils.getLegendUrl({
            legendUrl: "lorem"
        })).toBe("lorem");
        expect(LayerUtils.getLegendUrl({
            legendUrl: "lorem",
            type: "xxx"
        })).toBe("lorem");
    });
    it("should create an url for a simple layer", () => {
        const layer = {
            type: "wms",
            legendUrl: "http://www.example.com/lorem",
            name: "ipsum",
        };
        const sublayer = layer;
        const map = {};
        expect(LayerUtils.getLegendUrl(
            layer, sublayer, undefined, map,
            undefined, undefined, undefined
        )).toBe(
            "http://www.example.com/lorem?" +
            "VERSION=&" +
            "SERVICE=WMS&" +
            "REQUEST=GetLegendGraphic&" +
            "FORMAT=image%2Fpng&" +
            "CRS=&" +
            "SLD_VERSION=1.1.0&" +
            "LAYER=ipsum"
        );
    });
    it("should use the name from the sublayer", () => {
        const layer = {
            type: "wms",
            legendUrl: "http://www.example.com/lorem",
            name: "ipsum",
        };
        const sublayer = {
            name: "dolor"
        };
        const map = {};
        expect(LayerUtils.getLegendUrl(
            layer, sublayer, undefined, map,
            undefined, undefined, undefined
        )).toBe(
            "http://www.example.com/lorem?" +
            "VERSION=&" +
            "SERVICE=WMS&" +
            "REQUEST=GetLegendGraphic&" +
            "FORMAT=image%2Fpng&" +
            "CRS=&" +
            "SLD_VERSION=1.1.0&" +
            "LAYER=dolor"
        );
    });
    it("should kep query parameters in the url", () => {
        const layer = {
            type: "wms",
            legendUrl: "http://www.example.com/lorem?a=b&c=d&q=1&search=sit",
            name: "ipsum",
        };
        const sublayer = {
            name: "dolor"
        };
        const map = {};
        expect(LayerUtils.getLegendUrl(
            layer, sublayer, undefined, map,
            undefined, undefined, undefined
        )).toBe(
            "http://www.example.com/lorem?" +
            "VERSION=&" +
            "a=b&c=d&q=1&search=sit&" +
            "SERVICE=WMS&" +
            "REQUEST=GetLegendGraphic&" +
            "FORMAT=image%2Fpng&" +
            "CRS=&" +
            "SLD_VERSION=1.1.0&" +
            "LAYER=dolor"
        );
    });
    it("should use extra legend parameters", () => {
        const layer = {
            type: "wms",
            legendUrl: "http://www.example.com/lorem",
            name: "ipsum",
        };
        const sublayer = layer;
        const map = {};
        expect(LayerUtils.getLegendUrl(
            layer, sublayer, undefined, map,
            undefined, undefined, "a=b1&c=d2&q=1&search=sit"
        )).toBe(
            "http://www.example.com/lorem?" +
            "VERSION=&" +
            "SERVICE=WMS&" +
            "REQUEST=GetLegendGraphic&" +
            "FORMAT=image%2Fpng&" +
            "CRS=&" +
            "SLD_VERSION=1.1.0&" +
            "a=b1&c=d2&q=1&search=sit&" +
            "LAYER=ipsum"
        );
    });
    describe("scaleDependentLegend", () => {
        const scale = 15.5;
        const map = {};

        it("should accept boolean", () => {
            const layer = {
                type: "wms",
                legendUrl: "http://www.example.com/lorem",
                name: "ipsum",
            };
            const sublayer = layer;
            const scaleDependentLegend = true;
            expect(LayerUtils.getLegendUrl(
                layer, sublayer, scale, map,
                undefined, scaleDependentLegend, undefined
            )).toBe(
                "http://www.example.com/lorem?" +
                "VERSION=&" +
                "SERVICE=WMS&" +
                "REQUEST=GetLegendGraphic&" +
                "FORMAT=image%2Fpng&" +
                "CRS=&" +
                "SLD_VERSION=1.1.0&" +
                "SCALE=16&" +
                "LAYER=ipsum"
            );
        });
        it("should accept theme and ignore non-theme layers", () => {
            const layer = {
                type: "wms",
                legendUrl: "http://www.example.com/lorem",
                name: "ipsum",
                role: LayerRole.USERLAYER,
            };
            const sublayer = layer;
            const scaleDependentLegend = "theme";
            expect(LayerUtils.getLegendUrl(
                layer, sublayer, scale, map,
                undefined, scaleDependentLegend, undefined
            )).toBe(
                "http://www.example.com/lorem?" +
                "VERSION=&" +
                "SERVICE=WMS&" +
                "REQUEST=GetLegendGraphic&" +
                "FORMAT=image%2Fpng&" +
                "CRS=&" +
                "SLD_VERSION=1.1.0&" +
                "LAYER=ipsum"
            );
        });
        it("should accept theme and use it for theme layers", () => {
            const layer = {
                type: "wms",
                legendUrl: "http://www.example.com/lorem",
                name: "ipsum",
                role: LayerRole.THEME,
            };
            const sublayer = layer;
            const scaleDependentLegend = "theme";
            expect(LayerUtils.getLegendUrl(
                layer, sublayer, scale, map,
                undefined, scaleDependentLegend, undefined
            )).toBe(
                "http://www.example.com/lorem?" +
                "VERSION=&" +
                "SERVICE=WMS&" +
                "REQUEST=GetLegendGraphic&" +
                "FORMAT=image%2Fpng&" +
                "CRS=&" +
                "SLD_VERSION=1.1.0&" +
                "SCALE=16&" +
                "LAYER=ipsum"
            );
        });
    });
    describe("bboxDependentLegend", () => {
        const map = {
            size: {
                width: 100,
                height: 200
            },
            bbox: {
                bounds: [0, 0, 100, 200]
            }
        };
        it("should accept boolean", () => {
            mockAxisOrder = "yx";
            const layer = {
                type: "wms",
                legendUrl: "http://www.example.com/lorem",
                name: "ipsum",
            };
            const sublayer = layer;
            const bboxDependentLegend = true;
            expect(LayerUtils.getLegendUrl(
                layer, sublayer, undefined, map,
                bboxDependentLegend, undefined, undefined
            )).toBe(
                "http://www.example.com/lorem?" +
                "VERSION=&" +
                "SERVICE=WMS&" +
                "REQUEST=GetLegendGraphic&" +
                "FORMAT=image%2Fpng&" +
                "CRS=&" +
                "SLD_VERSION=1.1.0&" +
                "WIDTH=100&" +
                "HEIGHT=200&" +
                "BBOX=0%2C0%2C100%2C200&" +
                "LAYER=ipsum"
            );
        });
        it("should account for version 1.3.0", () => {
            mockAxisOrder = "ne";
            const layer = {
                type: "wms",
                legendUrl: "http://www.example.com/lorem",
                name: "ipsum",
                version: "1.3.0"
            };
            const sublayer = layer;
            const bboxDependentLegend = true;
            expect(LayerUtils.getLegendUrl(
                layer, sublayer, undefined, map,
                bboxDependentLegend, undefined, undefined
            )).toBe(
                "http://www.example.com/lorem?" +
                "VERSION=1.3.0&" +
                "SERVICE=WMS&" +
                "REQUEST=GetLegendGraphic&" +
                "FORMAT=image%2Fpng&" +
                "CRS=&" +
                "SLD_VERSION=1.1.0&" +
                "WIDTH=100&" +
                "HEIGHT=200&" +
                "BBOX=0%2C0%2C200%2C100&" +
                "LAYER=ipsum"
            );
        });
    });
    describe("with external layer map", () => {
        it("should create an url for a simple layer", () => {
            const externalLayerMap = {
                "ipsum": {
                    type: "xyz",
                    legendUrl: "http://www.lorem.com/ipsum",
                    name: "ipsum",
                }
            };
            const layer = {
                type: "wms",
                legendUrl: "http://www.example.com/lorem",
                name: "ipsum",
                externalLayerMap
            };
            const sublayer = layer;
            const map = {};
            expect(LayerUtils.getLegendUrl(
                layer, sublayer, undefined, map,
                undefined, undefined, undefined
            )).toBe("http://www.lorem.com/ipsum");
        });
        it("should deal with a wms sub-layer", () => {
            const externalLayerMap = {
                "ipsum": {
                    type: "wms",
                    legendUrl: "http://www.lorem.com/ipsum?a=b&c=d&q=1&search=sit",
                    name: "ipsum",
                    params: {
                        LAYERS: "sit,amet",
                    }
                }
            };
            const layer = {
                type: "wms",
                legendUrl: "http://www.example.com/lorem",
                name: "ipsum",
                externalLayerMap,
                version: "1.2.3",
            };
            const sublayer = layer;
            const map = {
                projection: "EPSG:3857"
            };
            expect(LayerUtils.getLegendUrl(
                layer, sublayer, undefined, map,
                undefined, undefined, undefined
            )).toBe(
                "http://www.lorem.com/ipsum?" +
                "VERSION=1.2.3&" +
                "a=b&c=d&q=1&search=sit&" +
                "SERVICE=WMS&" +
                "REQUEST=GetLegendGraphic&" +
                "FORMAT=image%2Fpng&" +
                "CRS=EPSG%3A3857&" +
                "SLD_VERSION=1.1.0&" +
                "LAYER=sit%2Camet"
            );
        });
    });
});


describe("getSublayerNames", () => {
    it("should deal with no sublayers", () => {
        const layer = { name: "Layer 1" };
        const result = LayerUtils.getSublayerNames(layer);
        expect(result).toEqual(["Layer 1"]);
    });

    it("should use all sublayer names", () => {
        const layer = {
            name: "Layer 1",
            sublayers: [
                { name: "Sublayer 1.1" },
                {
                    name: "Sublayer 1.2",
                    sublayers: [{ name: "Sublayer 1.2.1" }]
                },
            ],
        };
        const result = LayerUtils.getSublayerNames(layer);
        expect(result).toEqual([
            "Layer 1",
            "Sublayer 1.1",
            "Sublayer 1.2",
            "Sublayer 1.2.1",
        ]);
    });

    it("should filter out falsy sublayer names", () => {
        const layer = {
            name: "Layer 1",
            sublayers: [{
                name: "Sublayer 1.1"
            }, {
                name: ""
            }, {
                name: "Sublayer 1.2"
            }],
        };
        const result = LayerUtils.getSublayerNames(layer);
        expect(result).toEqual(["Layer 1", "Sublayer 1.1", "Sublayer 1.2"]);
    });
});


describe("getTimeDimensionValues", () => {

});


describe("implodeLayers", () => {
    it("should return an empty list", () => {
        expect(LayerUtils.implodeLayers([])).toEqual([]);
    });
    it("should work with one item", () => {
        expect(LayerUtils.implodeLayers([{
            layer: {
                id: "one"
            }
        }])).toEqual([{
            id: "one",
            uuid: expect.stringMatching(uuidRegex)
        }]);
    });
    it("should work with two items", () => {
        expect(LayerUtils.implodeLayers([{
            layer: {
                id: "one"
            }
        }, {
            layer: {
                id: "two"
            }
        }])).toEqual([{
            id: "one",
            uuid: expect.stringMatching(uuidRegex)
        }, {
            id: "two",
            uuid: expect.stringMatching(uuidRegex)
        }]);
    });
    it("should work with sub-layers", () => {
        expect(LayerUtils.implodeLayers([{
            layer: {
                id: "one",
                sublayers: [{
                    id: "one-one",
                    sublayers: [{
                        id: "one-one-one",
                    }]
                }],
            },
            path: [0, 0],
            sublayer: { id: "one-one-one" },
        }, {
            layer: {
                id: "one",
                sublayers: [
                    { "id": "one-two", },
                ],
            },
            path: [1],
            sublayer: { id: "one-two" },
        }])).toEqual([{
            id: "one",
            uuid: expect.stringMatching(uuidRegex),
            sublayers: [{
                id: "one-one",
                uuid: expect.stringMatching(uuidRegex),
                sublayers: [{
                    id: "one-one-one",
                    uuid: expect.stringMatching(uuidRegex)
                }]
            }, {
                id: "one-two",
                uuid: expect.stringMatching(uuidRegex),
            }]
        }]);
    });
});

describe("insertLayer", () => {
    it("should throw an error with an empty list", () => {
        expect(() => {
            LayerUtils.insertLayer([], { id: "one" }, "xxx", null)
        }).toThrow("Failed to find");
    });
    it("should throw an error if before item is not found", () => {
        expect(() => {
            LayerUtils.insertLayer([{
                id: "lorem"
            }], {
                id: "one"
            }, "xxx", null)
        }).toThrow("Failed to find");
    });
    it("should insert the layer before another top layer", () => {
        expect(
            LayerUtils.insertLayer([{
                id: "lorem"
            }], {
                id: "ipsum"
            }, "id", "lorem")
        ).toEqual([{
            id: "ipsum",
            uuid: expect.stringMatching(uuidRegex)
        }, {
            id: "lorem",
            uuid: expect.stringMatching(uuidRegex)
        }]);
    });
    it("should insert the layer before another sub-layer", () => {
        expect(
            LayerUtils.insertLayer([{
                id: "lorem",
                sublayers: [{
                    id: "ipsum"
                }, {
                    id: "dolor",
                    sublayers: [{
                        id: "amet"
                    }, {
                        id: "consectetur"
                    }]
                }]
            }], {
                id: "lorem",
                sublayers: [{
                    id: "dolor",
                    sublayers: [{
                        id: "sit",
                    }]
                }]
            }, "id", "amet")
        ).toEqual([{
            id: "lorem",
            uuid: expect.stringMatching(uuidRegex),
            sublayers: [
                {
                    id: "ipsum",
                    uuid: expect.stringMatching(uuidRegex)
                },
                {
                    id: "dolor",
                    uuid: expect.stringMatching(uuidRegex),
                    sublayers: [
                        {
                            id: "sit",
                            uuid: expect.stringMatching(uuidRegex)
                        },
                        {
                            id: "amet",
                            uuid: expect.stringMatching(uuidRegex)
                        },
                        {
                            id: "consectetur",
                            uuid: expect.stringMatching(uuidRegex)
                        },
                    ],
                },
            ],
        }]);
    });
});

describe("insertPermalinkLayers", () => {
    it("should ignore an empty exploded list", () => {
        const exploded = [];
        LayerUtils.insertPermalinkLayers(exploded, []);
        expect(exploded).toEqual([]);
    });
    it("should ignore an empty input list", () => {
        const exploded = [{
            layer: {},
            path: [],
            sublayer: {}
        }];
        LayerUtils.insertPermalinkLayers(exploded, []);
        expect(exploded).toEqual(exploded);
    });
    it("should insert a top-level layer in an empty list", () => {
        const exploded = [];
        LayerUtils.insertPermalinkLayers(exploded, [{
            id: "lorem",
            uuid: "ipsum",
            role: LayerRole.USERLAYER,
            type: "vector",
            pos: 0
        }]);
        expect(exploded).toEqual([{
            layer: {
                id: "lorem",
                uuid: "ipsum",
                role: LayerRole.USERLAYER,
                type: "vector"
            },
            path: [],
            sublayer: {
                id: "lorem",
                uuid: "ipsum",
                role: LayerRole.USERLAYER,
                type: "vector"
            }
        }]);
    });
    it("should insert a top-level layer", () => {
        const someLayer = {
            id: "sit",
            uuid: "dolor",
        }
        const exploded = [{
            layer: someLayer,
            path: [],
            sublayer: someLayer
        }];
        LayerUtils.insertPermalinkLayers(exploded, [{
            id: "lorem",
            uuid: "ipsum",
            role: LayerRole.USERLAYER,
            type: "vector",
            pos: 0
        }]);
        expect(exploded).toEqual([{
            layer: {
                id: "lorem",
                uuid: "ipsum",
                role: LayerRole.USERLAYER,
                type: "vector"
            },
            path: [],
            sublayer: {
                id: "lorem",
                uuid: "ipsum",
                role: LayerRole.USERLAYER,
                type: "vector"
            }
        }, {
            layer: someLayer,
            path: [],
            sublayer: someLayer
        }]);
    });
});

describe("insertSeparator", () => {
    it("inserts into an empty list throws an error", () => {
        expect(() => {
            LayerUtils.insertSeparator([], "lorem");
        }).toThrow("Failed to find");
    });
    it("inserts into a list with unknown ID throws an error", () => {
        expect(() => {
            LayerUtils.insertSeparator([{
                id: "ipsum",
                role: LayerRole.USERLAYER
            }], "lorem", "xxx", [0, 1, 2]);
        }).toThrow("Failed to find");
    });
    it("inserts before a top-level layer", () => {
        expect(LayerUtils.insertSeparator([{
            id: "ipsum",
            role: LayerRole.USERLAYER
        }], "lorem", "ipsum", [])).toEqual([{
            id: expect.stringMatching(uuidRegex),
            uuid: expect.stringMatching(uuidRegex),
            role: LayerRole.USERLAYER,
            title: "lorem",
            type: "separator",
        }, {
            id: "ipsum",
            role: LayerRole.USERLAYER,
            uuid: expect.stringMatching(uuidRegex)
        }]);
    });
    it("inserts before a sub-layer", () => {
        expect(LayerUtils.insertSeparator([{
            id: "ipsum",
            role: LayerRole.USERLAYER,
            sublayers: [{
                id: "dolor",
                role: LayerRole.USERLAYER
            }, {
                id: "sit",
                role: LayerRole.USERLAYER
            }]
        }], "lorem", "ipsum", [1])).toEqual([{
            "id": "ipsum",
            "role": 3,
            "sublayers": [
                {
                    "id": "dolor",
                    "role": 3,
                    "uuid": expect.stringMatching(uuidRegex),
                },
            ],
            "uuid": expect.stringMatching(uuidRegex),
        },
        {
            "id": expect.stringMatching(uuidRegex),
            "role": 3,
            "title": "lorem",
            "type": "separator",
            "uuid": expect.stringMatching(uuidRegex),
        },
        {
            "id": "ipsum",
            "role": 3,
            "sublayers": [
                {
                    "id": "sit",
                    "role": 3,
                    "uuid": expect.stringMatching(uuidRegex),
                },
            ],
            "uuid": expect.stringMatching(uuidRegex),
        }]);
    });
});

describe("layerScaleInRange", () => {
    it("should be true if no constraints are explicitly set", () => {
        expect(LayerUtils.layerScaleInRange({}, 0)).toBeTruthy();
        expect(LayerUtils.layerScaleInRange({}, 10000)).toBeTruthy();
        expect(LayerUtils.layerScaleInRange({}, "ignored")).toBeTruthy();
    });
    it("should use the lower limit", () => {
        expect(LayerUtils.layerScaleInRange({
            minScale: 1
        }, 0)).toBeFalsy();
        expect(LayerUtils.layerScaleInRange({
            minScale: 1
        }, 1)).toBeTruthy();
        expect(LayerUtils.layerScaleInRange({
            minScale: 1
        }, 2)).toBeTruthy();
    });
    it("should use the upper limit", () => {
        expect(LayerUtils.layerScaleInRange({
            maxScale: 1
        }, 2)).toBeFalsy();
        expect(LayerUtils.layerScaleInRange({
            maxScale: 1
        }, 1)).toBeFalsy();
        expect(LayerUtils.layerScaleInRange({
            maxScale: 1
        }, 0)).toBeTruthy();
    });
    it("should use the both limit", () => {
        expect(LayerUtils.layerScaleInRange({
            minScale: 1,
            maxScale: 2
        }, 0)).toBeFalsy();
        expect(LayerUtils.layerScaleInRange({
            minScale: 1,
            maxScale: 2
        }, 1)).toBeTruthy();
        expect(LayerUtils.layerScaleInRange({
            minScale: 1,
            maxScale: 2
        }, 2)).toBeFalsy();
        expect(LayerUtils.layerScaleInRange({
            minScale: 1,
            maxScale: 2
        }, 3)).toBeFalsy();
    });
    it("should return false (!) in degenerate cases", () => {
        expect(LayerUtils.layerScaleInRange({
            minScale: 1,
            maxScale: 1
        }, 1)).toBeFalsy();
        expect(LayerUtils.layerScaleInRange({
            minScale: 2,
            maxScale: 1
        }, 1)).toBeFalsy();
        expect(LayerUtils.layerScaleInRange({
            minScale: 2,
            maxScale: 1
        }, 0)).toBeFalsy();
        expect(LayerUtils.layerScaleInRange({
            minScale: 2,
            maxScale: 1
        }, 3)).toBeFalsy();
    });
});


describe("mergeSubLayers", () => {
    it("should ignore two layers without sublayers", () => {
        const baseLayer = {
            id: "lorem",
        };
        const addLayer = {
            id: "ipsum",
        };
        expect(
            LayerUtils.mergeSubLayers(baseLayer, addLayer)
        ).toEqual({
            id: "lorem",
        });
    });
    it("should add layers from the second layer", () => {
        const baseLayer = {
            id: "lorem",
        };
        const addLayer = {
            id: "ipsum",
            sublayers: [{
                id: "dolor",
            }],
        };
        expect(
            LayerUtils.mergeSubLayers(baseLayer, addLayer)
        ).toEqual({
            id: "lorem",
            externalLayerMap: {},
            sublayers: [{
                id: "dolor",
                uuid: expect.stringMatching(uuidRegex),
            }],
            uuid: expect.stringMatching(uuidRegex),
        });
    });
    it("should keep existing layers", () => {
        const baseLayer = {
            id: "lorem",
            sublayers: [{
                id: "dolor",
            }],
        };
        const addLayer = {
            id: "ipsum",

        };
        expect(
            LayerUtils.mergeSubLayers(baseLayer, addLayer)
        ).toEqual({
            id: "lorem",
            sublayers: [{
                id: "dolor",
            }],
        });
    });
    it("should merge the layers", () => {
        const baseLayer = {
            id: "lorem",
            name: "lorem",
            sublayers: [{
                id: "dolor",
                name: "dolor",
            }],
        };
        const addLayer = {
            id: "ipsum",
            name: "ipsum",
            sublayers: [{
                id: "sit",
                name: "sit",
            }],
        };
        expect(
            LayerUtils.mergeSubLayers(baseLayer, addLayer)
        ).toEqual({
            id: "lorem",
            name: "lorem",
            externalLayerMap: {},
            sublayers: [{
                id: "sit",
                name: "sit",
                uuid: expect.stringMatching(uuidRegex),
            }, {
                id: "dolor",
                name: "dolor",
                uuid: expect.stringMatching(uuidRegex),
            }],
            uuid: expect.stringMatching(uuidRegex),
        });
    });
    it("should merge layers with same name", () => {
        const baseLayer = {
            id: "lorem",
            name: "lorem",
            sublayers: [{
                id: "one",
                name: "dolor",
            }],
        };
        const addLayer = {
            id: "ipsum",
            name: "ipsum",
            sublayers: [{
                id: "two",
                name: "dolor",
            }],
        };
        expect(
            LayerUtils.mergeSubLayers(baseLayer, addLayer)
        ).toEqual({
            id: "lorem",
            name: "lorem",
            sublayers: [{
                id: "one",
                name: "dolor",
                uuid: expect.stringMatching(uuidRegex),
            }],
            uuid: expect.stringMatching(uuidRegex),
        });
    });
    it("should merge deeply nested layers", () => {
        const baseLayer = {
            id: "lorem",
            name: "lorem",
            sublayers: [{
                id: "dolor",
                name: "dolor",
                sublayers: [{
                    id: "sit",
                    name: "sit",
                    sublayers: [{
                        id: "amet",
                        name: "amet",
                        sublayers: [{
                            id: "consectetur",
                            name: "consectetur",
                        }, {
                            id: "adipiscing",
                            name: "adipiscing",
                        }],
                    }, {
                        id: "elit",
                        name: "elit",
                    }, {
                        id: "sed",
                        name: "sed",
                    }],
                }, {
                    id: "eiusmod",
                    name: "eiusmod",
                }],
            }],
        };
        const addLayer = {
            id: "ipsum",
            name: "ipsum",
            sublayers: [{
                id: "amet2",
                name: "amet",
            }, {
                id: "adipiscing2",
                name: "adipiscing",
            }, {
                id: "tempor",
                name: "tempor",
                sublayers: [{
                    id: "incididunt",
                    name: "incididunt",
                }, {
                    id: "labore",
                    name: "labore",
                }]
            }],
        };
        expect(
            LayerUtils.mergeSubLayers(baseLayer, addLayer)
        ).toEqual({
            externalLayerMap: {},
            id: "lorem",
            name: "lorem",
            sublayers: [{
                id: "amet2",
                name: "amet",
                uuid: expect.stringMatching(uuidRegex),
            }, {
                id: "tempor",
                name: "tempor",
                sublayers: [{
                    id: "incididunt",
                    name: "incididunt",
                    uuid: expect.stringMatching(uuidRegex),
                }, {
                    id: "labore",
                    name: "labore",
                    uuid: expect.stringMatching(uuidRegex),
                }],
                uuid: expect.stringMatching(uuidRegex),
            }, {
                id: "dolor",
                name: "dolor",
                sublayers: [{
                    id: "sit",
                    name: "sit",
                    sublayers: [{
                        id: "amet",
                        name: "amet",
                        sublayers: [{
                            id: "consectetur",
                            name: "consectetur",
                            uuid: expect.stringMatching(uuidRegex),
                        }, {
                            id: "adipiscing",
                            name: "adipiscing",
                            uuid: expect.stringMatching(uuidRegex),
                        }],
                        uuid: expect.stringMatching(uuidRegex),
                    }, {
                        id: "elit",
                        name: "elit",
                        uuid: expect.stringMatching(uuidRegex),
                    }, {
                        id: "sed",
                        name: "sed",
                        uuid: expect.stringMatching(uuidRegex),
                    }],
                    uuid: expect.stringMatching(uuidRegex),
                }, {
                    id: "eiusmod",
                    name: "eiusmod",
                    uuid: expect.stringMatching(uuidRegex),
                }],
                uuid: expect.stringMatching(uuidRegex),
            }],
            uuid: expect.stringMatching(uuidRegex),
        });
    });
});


describe("pathEqualOrBelow", () => {
    it("should consider two empty arrays equal", () => {
        expect(LayerUtils.pathEqualOrBelow([], [])).toBeTruthy();
    });
    it("should accept equal arrays", () => {
        expect(LayerUtils.pathEqualOrBelow([1], [1])).toBeTruthy();
    });
    it("should reject different arrays", () => {
        expect(LayerUtils.pathEqualOrBelow([1], [2])).toBeFalsy();
    });
    it("should accept a goos array", () => {
        expect(LayerUtils.pathEqualOrBelow([1], [1, 2])).toBeTruthy();
    });
    it("should reject a longer array", () => {
        expect(LayerUtils.pathEqualOrBelow([1, 2], [1])).toBeFalsy();
    });
    it("should reject the empty array", () => {
        expect(LayerUtils.pathEqualOrBelow([1], [])).toBeFalsy();
    });
});

describe("removeLayer", () => {
    it("should silently ignore an empty list", () => {
        expect(LayerUtils.removeLayer([], {}, [])).toEqual([]);
    });
    it("should silently ignore a list with an unknown layer", () => {
        expect(LayerUtils.removeLayer([{
            id: "lorem",
            uuid: "ipsum"
        }], {
            uuid: "dolor"
        }, [])).toEqual([{
            id: "lorem",
            uuid: "ipsum"
        }]);
    });
    it("should remove a top-level layer", () => {
        expect(LayerUtils.removeLayer([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "dolor",
            uuid: "sit"
        }, {
            id: "amet",
            uuid: "consectetur"
        }], {
            uuid: "sit"
        }, [])).toEqual([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "amet",
            uuid: "consectetur"
        }]);
    });
    it("should remove a sub-layer", () => {
        expect(LayerUtils.removeLayer([{
            id: "lorem",
            uuid: "ipsum",
            sublayers: [{
                id: "dolor",
                uuid: "sit"
            }, {
                id: "amet",
                uuid: "consectetur"
            }]
        }], {
            uuid: "ipsum"
        }, [0])).toEqual([{
            id: "lorem",
            uuid: "ipsum",
            sublayers: [{
                id: "amet",
                uuid: "consectetur"
            }]
        }]);
    });
    it("should move background layer to the back of the list", () => {
        expect(LayerUtils.removeLayer([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "dolor",
            uuid: "sit",
            role: LayerRole.BACKGROUND
        }, {
            id: "amet",
            uuid: "consectetur"
        }], {
            uuid: "xxx"
        }, [])).toEqual([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "amet",
            uuid: "consectetur"
        }, {
            id: "dolor",
            uuid: "sit",
            role: LayerRole.BACKGROUND
        }]);
    });
    it("should not remove a top-level background layer", () => {
        expect(LayerUtils.removeLayer([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "dolor",
            uuid: "sit",
            role: LayerRole.BACKGROUND
        }, {
            id: "amet",
            uuid: "consectetur"
        }], {
            uuid: "sit"
        }, [])).toEqual([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "amet",
            uuid: "consectetur"
        }, {
            id: "dolor",
            uuid: "sit",
            role: LayerRole.BACKGROUND
        }]);
    });
});

describe("reorderLayer", () => {
    it("should silently ignore an empty list", () => {
        expect(LayerUtils.reorderLayer([], {}, [], 1, true)).toEqual([]);
    });
    it("should silently ignore a list with an unknown layer", () => {
        expect(LayerUtils.reorderLayer([{
            id: "lorem",
            uuid: "ipsum"
        }], {
            uuid: "dolor"
        }, [])).toEqual([{
            id: "lorem",
            uuid: "ipsum"
        }]);
    });
    it("should move a top-level layer one position to the back", () => {
        expect(LayerUtils.reorderLayer([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "dolor",
            uuid: "sit"
        }, {
            id: "amet",
            uuid: "consectetur"
        }], {
            uuid: "sit"
        }, [], 1, true)).toEqual([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "amet",
            uuid: "consectetur"
        }, {
            id: "dolor",
            uuid: "sit"
        }]);
    });
    it("should move background layers to the back", () => {
        expect(LayerUtils.reorderLayer([{
            id: "background",
            uuid: "background",
            role: LayerRole.BACKGROUND
        }, {
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "dolor",
            uuid: "sit"
        }, {
            id: "amet",
            uuid: "consectetur"
        }], {
            uuid: "sit"
        }, [], 1, true)).toEqual([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "amet",
            uuid: "consectetur"
        }, {
            id: "dolor",
            uuid: "sit"
        }, {
            id: "background",
            uuid: "background",
            role: LayerRole.BACKGROUND
        }]);
    });
    it("should move a top-level layer one position to the front", () => {
        expect(LayerUtils.reorderLayer([{
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "dolor",
            uuid: "sit"
        }, {
            id: "amet",
            uuid: "consectetur"
        }], {
            uuid: "sit"
        }, [], -1, true)).toEqual([{
            id: "dolor",
            uuid: "sit"
        }, {
            id: "lorem",
            uuid: "ipsum"
        }, {
            id: "amet",
            uuid: "consectetur"
        }]);
    });
    it("should move a sub-layer one position to the back", () => {
        expect(LayerUtils.reorderLayer([{
            id: "lorem",
            uuid: "ipsum",
            sublayers: [{
                id: "dolor",
                uuid: "sit"
            }, {
                id: "amet",
                uuid: "consectetur"
            }]
        }], {
            uuid: "ipsum"
        }, [0], 1, true)).toEqual([{
            id: "lorem",
            uuid: "ipsum",
            sublayers: [{
                id: "amet",
                uuid: "consectetur"
            }, {
                id: "dolor",
                uuid: "sit"
            }]
        }]);
    });
});

describe("replaceLayerGroups", () => {
    it("deals with an empty array of configurations", () => {
        expect(LayerUtils.replaceLayerGroups([], {})).toEqual([]);
    });
    it("deals with a layer without sublayers", () => {
        expect(LayerUtils.replaceLayerGroups([{
            name: "lorem"
        }], {})).toEqual([{
            name: "lorem"
        }]);
    });
    it("deals with a layer with sublayers", () => {
        expect(LayerUtils.replaceLayerGroups([{
            name: "lorem",
        }], {
            sublayers: [{
                name: "ipsum"
            }]
        })).toEqual([{
            name: "lorem",
        }]);
    });
    it("deals with a layer with sublayers", () => {
        expect(LayerUtils.replaceLayerGroups([{
            name: "lorem",
        }], {
            name: "lorem",
            sublayers: [{
                name: "ipsum"
            }]
        })).toEqual([{
            name: "ipsum",
        }]);
    });
    it("makes the world a better place", () => {
        expect(LayerUtils.replaceLayerGroups([{
            name: "lorem",
            params: "ipsum",
        }], {
            name: "lorem",
            sublayers: [{
                name: "consectetur"
            }, {
                name: "adipiscing"
            }]
        })).toEqual([{
            name: "consectetur",
            params: "ipsum",
        }, {
            name: "adipiscing",
            params: "ipsum",
        }]);
    });
    it("makes the world a better place again", () => {
        expect(LayerUtils.replaceLayerGroups([{
            name: "lorem",
            params: "ipsum",
        }], {
            name: "lorem",
            sublayers: [{
                name: "consectetur",
                sublayers: [{
                    name: "sed"
                }, {
                    name: "eiusmod"
                }]
            }, {
                name: "adipiscing",
                sublayers: [{
                    name: "tempor"
                }, {
                    name: "incididunt"
                }]
            }]
        })).toEqual([{
            name: "sed",
            params: "ipsum",
        }, {
            name: "eiusmod",
            params: "ipsum",
        }, {
            name: "tempor",
            params: "ipsum",
        }, {
            name: "incididunt",
            params: "ipsum",
        }]);
    });
});

describe("restoreLayerParams", () => {
    it("should create a top level layer", () => {
        expect(LayerUtils.restoreLayerParams({
            id: "lorem",
            uuid: "ipsum",
        }, [], [], {})).toEqual([{
            id: "lorem",
            uuid: "ipsum",
            visibility: false
        }]);
    });
    it("should use theme layer configuration", () => {
        expect(LayerUtils.restoreLayerParams({
            id: "lorem",
            uuid: "ipsum",
            name: "dolor",
        }, [{
            name: "dolor",
            type: "theme",
            opacity: 122,
            tristate: true,
        }], [], {})).toEqual([{
            id: "lorem",
            uuid: "ipsum",
            visibility: true,
            name: "dolor",
            opacity: 122
        }]);
    });
    it("should add external layers from config", () => {
        const externalLayers = {};
        expect(LayerUtils.restoreLayerParams({
            id: "lorem",
            uuid: "ipsum",
        }, [{
            name: "dolor",
            id: "sit",
            type: "wms",
            url: "amet",
            opacity: 122,
            visibility: true,
            params: {
                LAYERS: "consectetur",
            }
        }], [], externalLayers)).toEqual([{
            id: "sit",
            loading: true,
            name: "dolor",
            role: LayerRole.USERLAYER,
            title: "dolor",
            type: "placeholder",
            uuid: expect.stringMatching(uuidRegex),
        }, {
            id: "lorem",
            uuid: "ipsum",
            visibility: false
        }]);
        expect(externalLayers).toEqual({
            "wms:amet": [{
                id: "sit",
                name: "dolor",
                opacity: 122,
                params: {
                    LAYERS: "consectetur"
                },
                visibility: true
            }]
        });
    });
    it("should add permalink layers", () => {
        const externalLayers = {};
        expect(LayerUtils.restoreLayerParams({
            id: "lorem",
            uuid: "ipsum",
        }, [], [{
            id: "sit",
            uuid: "amet",
            role: LayerRole.USERLAYER,
            type: "vector",
            pos: 0
        }], {})).toEqual([{
            id: "sit",
            uuid: "amet",
            role: LayerRole.USERLAYER,
            type: "vector",
        }, {
            id: "lorem",
            uuid: "ipsum",
            visibility: false
        }]);
        expect(externalLayers).toEqual({});
    });
});

describe("restoreOrderedLayerParams", () => {

});

describe("searchLayer", () => {

});

describe("searchSubLayer", () => {

});

describe("setGroupVisibilities", () => {
    it("should accept an empty list", () => {
        expect(LayerUtils.setGroupVisibilities([])).toBe(false);
    });
    it("should work with a single top layer", () => {
        let layer = {};
        expect(LayerUtils.setGroupVisibilities([layer])).toBeFalsy();

        layer = { visibility: true };
        expect(LayerUtils.setGroupVisibilities([layer])).toBeTruthy();

        const parts = [
            [true, false, true],
            [false, false, false],
            [true, true, false],
            [false, true, false],
        ];
        for (let part of parts) {
            layer = { visibility: part[0], tristate: part[1] };
            const x = expect(LayerUtils.setGroupVisibilities([layer]));
            if (part[2]) {
                x.toBeTruthy();
            } else {
                x.toBeFalsy();
            }
            expect(layer.tristate).toBeUndefined();
        }

        layer = { visibility: true, tristate: false };
        expect(LayerUtils.setGroupVisibilities([layer])).toBeTruthy();
        expect(layer.tristate).toBeUndefined();

        layer = { visibility: false, tristate: false };
        expect(LayerUtils.setGroupVisibilities([layer])).toBeFalsy();
        expect(layer.tristate).toBeUndefined();

        layer = { visibility: false, tristate: true };
        expect(LayerUtils.setGroupVisibilities([layer])).toBeFalsy();
        expect(layer.tristate).toBeUndefined();

        layer = { visibility: true, tristate: true };
        expect(LayerUtils.setGroupVisibilities([layer])).toBeFalsy();
        expect(layer.tristate).toBeUndefined();
    });
    it("should work with a multiple top layer", () => {
        let layer1 = {};
        let layer2 = {};
        expect(LayerUtils.setGroupVisibilities([layer1, layer2])).toBeFalsy();

        layer1 = { visibility: true };
        layer2 = { visibility: true };
        expect(LayerUtils.setGroupVisibilities([layer1, layer2])).toBeTruthy();

        layer1 = { visibility: true };
        layer2 = { visibility: false };
        expect(LayerUtils.setGroupVisibilities([layer1, layer2])).toBeTruthy();

        //  L1V,   L1Tr,  L2V,  L2Tr,  result
        const parts = [
            [true, true, true, true, false],
            [true, true, true, false, false],
            [true, true, false, true, false],
            [true, true, false, false, false],
            [true, false, true, true, false],
            [true, false, true, false, true],
            [true, false, false, true, false],
            [true, false, false, false, true],
            [false, true, true, true, false],
            [false, true, true, false, false],
            [false, true, false, true, false],
            [false, true, false, false, false],
            [false, false, true, true, false],
            [false, false, true, false, true],
            [false, false, false, true, false],
            [false, false, false, false, false],
        ];
        for (let part of parts) {
            layer1 = { visibility: part[0], tristate: part[1] };
            layer2 = { visibility: part[2], tristate: part[3] };
            const x = expect(
                LayerUtils.setGroupVisibilities([layer1, layer2]),
                `L1V=${part[0]}, L1Tr=${part[1]}, L2V=${part[2]}, ` +
                `L2Tr=${part[3]}, result=${part[4]}`
            );
            if (part[4]) {
                x.toBeTruthy();
            } else {
                x.toBeFalsy();
            }
            expect(layer1.tristate).toBeUndefined();
            expect(layer2.tristate).toBeUndefined();
        }
    });
});

describe("splitLayerUrlParam", () => {
    it("should return defaults with an empty string", () => {
        expect(LayerUtils.splitLayerUrlParam("")).toEqual({
            id: expect.stringMatching(uuidRegex),
            name: "",
            opacity: 255,
            tristate: false,
            type: "theme",
            url: null,
            visibility: true,
        });
    });
    it("should pick up the layer name", () => {
        expect(LayerUtils.splitLayerUrlParam("lorem")).toEqual({
            id: expect.stringMatching(uuidRegex),
            name: "lorem",
            opacity: 255,
            tristate: false,
            type: "theme",
            url: null,
            visibility: true,
        });
    });
    it("should read visibility = false", () => {
        expect(LayerUtils.splitLayerUrlParam("lorem!")).toEqual({
            id: expect.stringMatching(uuidRegex),
            name: "lorem",
            opacity: 255,
            tristate: false,
            type: "theme",
            url: null,
            visibility: false,
        });
    });
    it("should read tristate", () => {
        expect(LayerUtils.splitLayerUrlParam("lorem~")).toEqual({
            id: expect.stringMatching(uuidRegex),
            name: "lorem",
            opacity: 255,
            tristate: true,
            type: "theme",
            url: null,
            visibility: false,
        });
    });
    it("should read opacity", () => {
        expect(LayerUtils.splitLayerUrlParam("lorem[10]")).toEqual({
            id: expect.stringMatching(uuidRegex),
            name: "lorem",
            opacity: 230,
            tristate: false,
            type: "theme",
            url: null,
            visibility: true,
        });
    });
    it("should parse type and url", () => {
        expect(LayerUtils.splitLayerUrlParam("foo:ipsum#lorem")).toEqual({
            id: expect.stringMatching(uuidRegex),
            name: "lorem",
            opacity: 255,
            tristate: false,
            type: "foo",
            url: "ipsum",
            visibility: true,
        });
    });
    it("should parse a separator", () => {
        expect(LayerUtils.splitLayerUrlParam("sep:ipsum")).toEqual({
            id: expect.stringMatching(uuidRegex),
            name: "ipsum",
            opacity: 255,
            tristate: false,
            type: "separator",
            url: null,
            visibility: true,
        });
    });
});

describe("sublayerVisible", () => {
    it("should throw an error if the index is out of bounds", () => {
        expect(() => { LayerUtils.sublayerVisible({}, [0]) }).toThrow(TypeError);
    });
    it("should assume is visible if attribute is missing", () => {
        expect(LayerUtils.sublayerVisible({
            sublayers: [{}]
        }, [0])).toBeTruthy();
    });
    it("should return the value of visible attribute", () => {
        expect(LayerUtils.sublayerVisible({
            sublayers: [{
                visibility: true
            }]
        }, [0])).toBeTruthy();
        expect(LayerUtils.sublayerVisible({
            sublayers: [{
                visibility: false
            }]
        }, [0])).toBeFalsy();
    });
    it("should work with deep trees", () => {
        expect(LayerUtils.sublayerVisible({
            sublayers: [{
                visibility: true,
                sublayers: [{
                    visibility: true,
                    sublayers: [{
                        visibility: true,
                        sublayers: [{
                            visibility: true,
                            sublayers: [{
                                visibility: true,
                            }]
                        }]
                    }]
                }]
            }]
        }, [0, 0, 0, 0, 0])).toBeTruthy();
        expect(LayerUtils.sublayerVisible({
            sublayers: [{
                visibility: true,
                sublayers: [{
                    visibility: true,
                    sublayers: [{
                        visibility: true,
                        sublayers: [{
                            visibility: true,
                            sublayers: [{
                                visibility: false,
                            }]
                        }]
                    }]
                }]
            }]
        }, [0, 0, 0, 0, 0])).toBeFalsy();
        expect(LayerUtils.sublayerVisible({
            sublayers: [{
                visibility: true,
                sublayers: [{
                    visibility: false,
                    sublayers: [{
                        visibility: true,
                        sublayers: [{
                            visibility: true,
                            sublayers: [{
                                visibility: true,
                            }]
                        }]
                    }]
                }]
            }]
        }, [0, 0, 0, 0, 0])).toBeFalsy();
        expect(LayerUtils.sublayerVisible({
            visibility: false,
            sublayers: [{
                visibility: true,
                sublayers: [{
                    visibility: true,
                    sublayers: [{
                        visibility: true,
                        sublayers: [{
                            visibility: true,
                            sublayers: [{
                                visibility: true,
                            }]
                        }]
                    }]
                }]
            }]
        }, [0, 0, 0, 0, 0])).toBeFalsy();
    });
});
