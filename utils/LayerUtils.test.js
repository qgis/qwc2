import LayerUtils from './LayerUtils';

const uuidRegex = /[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/;

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

});

describe("buildWMSLayerUrlParam", () => {

});

describe("cloneLayer", () => {

});

describe("collectGroupLayers", () => {

});

describe("collectPrintParams", () => {

});

describe("collectWMSSublayerParams", () => {

});

describe("completeExternalLayer", () => {

});

describe("computeLayerVisibility", () => {

});

describe("createExternalLayerPlaceholder", () => {

});

describe("createSeparatorLayer", () => {

});

describe("ensureMutuallyExclusive", () => {

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

});

describe("getAttribution", () => {

});

describe("getLegendUrl", () => {

});

describe("getSublayerNames", () => {

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
                name: "one",
                sublayers: [{
                    id: "one-one",
                    name: "one-one",
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
            uuid: expect.stringMatching(uuidRegex)
        }, {
            id: "two",
            uuid: expect.stringMatching(uuidRegex)
        }]);
    });
});

describe("insertLayer", () => {

});

describe("insertPermalinkLayers", () => {

});

describe("insertSeparator", () => {

});

describe("layerScaleInRange", () => {

});

describe("mergeSubLayers", () => {

});

describe("pathEqualOrBelow", () => {

});

describe("removeLayer", () => {

});

describe("reorderLayer", () => {

});

describe("replaceLayerGroups", () => {

});

describe("restoreLayerParams", () => {

});

describe("restoreOrderedLayerParams", () => {

});

describe("searchLayer", () => {

});

describe("searchSubLayer", () => {

});

describe("setGroupVisibilities", () => {

});

describe("splitLayerUrlParam", () => {

});

describe("sublayerVisible", () => {

});
