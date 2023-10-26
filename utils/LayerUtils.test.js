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

});

describe("createSeparatorLayer", () => {

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
        }])).toMatchObject([{
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
        ).toMatchObject([{
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
        ).toMatchObject([{
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

});

describe("insertSeparator", () => {

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
        ]
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
