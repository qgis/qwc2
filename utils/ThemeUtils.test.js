import ThemeUtils from './ThemeUtils';
import { LayerRole } from '../actions/layers';

let mockLocale = "xy";
jest.mock("./LocaleUtils", () => ({
    __esModule: true,
    default: {
        lang: () => mockLocale,
        tr: (msg) => msg,
    },
}));

let mockAllowReorderingLayers = true;
let mockAssetsPath = '';
jest.mock("./ConfigUtils", () => ({
    __esModule: true,
    default: {
        getConfigProp: (name) => {
            if (name === 'allowReorderingLayers') {
                return mockAllowReorderingLayers;
            }
        },
        getAssetsPath: () => mockAssetsPath,
    },
}));


describe("createThemeBackgroundLayers", () => {
    it("should return empty array if theme has no backgroundLayers", () => {
        const theme = {};
        const themes = {};
        const visibleLayer = "test";
        const externalLayers = {};
        const result = ThemeUtils.createThemeBackgroundLayers(
            theme, themes, visibleLayer, externalLayers
        );
        expect(result).toEqual([]);
    });
    it("should return empty array if theme has no named layers", () => {
        const theme = {
            backgroundLayers: [
                { noName: "test" }
            ]
        };
        const themes = {};
        const visibleLayer = "test";
        const externalLayers = {};
        const result = ThemeUtils.createThemeBackgroundLayers(
            theme, themes, visibleLayer, externalLayers
        );
        expect(result).toEqual([]);
    });
    it("should return empty array if theme has no matching layers", () => {
        const theme = {
            backgroundLayers: [
                { name: "test" }
            ]
        };
        const themes = { backgroundLayers: [] };
        const visibleLayer = "test";
        const externalLayers = {};
        const result = ThemeUtils.createThemeBackgroundLayers(
            theme, themes, visibleLayer, externalLayers
        );
        expect(result).toEqual([]);
    });
    it("should work in simple cases", () => {
        const theme = {
            backgroundLayers: [
                { name: "test" }
            ]
        };
        const themes = {
            backgroundLayers: [
                { name: "test" }
            ]
        };
        const visibleLayer = "test";
        const externalLayers = {};
        const result = ThemeUtils.createThemeBackgroundLayers(
            theme, themes, visibleLayer, externalLayers
        );
        expect(result).toEqual([
            {
                "name": "test",
                "opacity": 255,
                "role": LayerRole.BACKGROUND,
                "thumbnail": "img/mapthumbs/default.jpg",
                "visibility": true,
            },
        ]);
    });
    it("should work with resource marker", () => {
        const theme = {
            backgroundLayers: [
                { name: "test" }
            ]
        };
        const themes = {
            backgroundLayers: [
                {
                    name: "test",
                    resource: 'http://www.example.com/test.png'
                }
            ]
        };
        const visibleLayer = "test";
        const externalLayers = {};
        const result = ThemeUtils.createThemeBackgroundLayers(
            theme, themes, visibleLayer, externalLayers
        );
        expect(result).toEqual([
            {
                "id": expect.stringMatching(/.+-.+-.+-.+-.+/),
                "name": "test",
                "opacity": 255,
                "role": LayerRole.BACKGROUND,
                "thumbnail": "img/mapthumbs/default.jpg",
                "visibility": true,
                "type": "placeholder",
            },
        ]);
    });
    it("should work with wms layers", () => {
        const theme = {
            backgroundLayers: [
                { name: "test" }
            ]
        };
        const themes = {
            backgroundLayers: [
                {
                    name: "test",
                    type: "wms",
                    params: {},
                    version: "1.2.3",
                }
            ]
        };
        const visibleLayer = "test";
        const externalLayers = {};
        const result = ThemeUtils.createThemeBackgroundLayers(
            theme, themes, visibleLayer, externalLayers
        );
        expect(result).toEqual([
            {
                "name": "test",
                "opacity": 255,
                "role": LayerRole.BACKGROUND,
                "thumbnail": "img/mapthumbs/default.jpg",
                "visibility": true,
                "params": {},
                "type": "wms",
                "version": "1.2.3",
            },
        ]);
    });
    it("should work with groups", () => {
        const theme = {
            backgroundLayers: [
                { name: "test" }
            ]
        };
        const themes = {
            backgroundLayers: [
                {
                    name: "group",
                    type: "group",
                    items: [
                        {
                            name: "test",
                            ref: "test",
                        }
                    ]
                },
                {
                    name: "test",
                    type: "wms",
                    params: {},
                    version: "1.2.3",
                }
            ]
        };
        const visibleLayer = "test";
        const externalLayers = {};
        const result = ThemeUtils.createThemeBackgroundLayers(
            theme, themes, visibleLayer, externalLayers
        );
        expect(result).toEqual([
            {
                name: "test",
                opacity: 255,
                role: LayerRole.BACKGROUND,
                thumbnail: "img/mapthumbs/default.jpg",
                visibility: true,
                params: {},
                type: "wms",
                version: "1.2.3",
                visibility: true,
            },
        ]);
    });
    it("should notify the user that background layer is missing", () => {
        const theme = {
            backgroundLayers: [
                { name: "test" },
                {
                    name: "lorem",
                    visibility: true
                },
            ]
        };
        const themes = {
            backgroundLayers: [
                {
                    name: "test",
                    type: "wms",
                    params: {},
                    version: "1.2.3",
                },
                {
                    name: "lorem",
                    type: "wms",
                    params: {},
                    version: "3.2.1"
                },
            ]
        };
        const visibleLayer = "not-found";
        const externalLayers = {};
        const dispatch = jest.fn();
        ThemeUtils.createThemeBackgroundLayers(
            theme, themes, visibleLayer, externalLayers, dispatch
        );
        expect(dispatch).toHaveBeenCalledWith({
            "name": "missingbglayer",
            "notificationType": 2,
            "sticky": true,
            "text": "app.missingbg",
            "type": "SHOW_NOTIFICATION"
        });
    });
    it(
        "should not (!) notify the user that background layer is " +
        "missing but there are no visible layers", () => {
            const theme = {
                backgroundLayers: [
                    { name: "test" },
                    {
                        name: "lorem",
                        visibility: false
                    },
                ]
            };
            const themes = {
                backgroundLayers: [
                    {
                        name: "test",
                        type: "wms",
                        params: {},
                        version: "1.2.3",
                    },
                    {
                        name: "lorem",
                        type: "wms",
                        params: {},
                        version: "3.2.1"
                    },
                ]
            };
            const dispatch = jest.fn();
            const visibleLayer = "not-found";
            const externalLayers = {};
            ThemeUtils.createThemeBackgroundLayers(
                theme, themes, visibleLayer, externalLayers, dispatch
            );
            expect(dispatch).not.toHaveBeenCalled();
        });
});

describe("createThemeLayer", () => {
    it("creates a layer", () => {
        expect(
            ThemeUtils.createThemeLayer({
                id: "lorem",
                url: "http://example.com",
                legendUrl: "http://example.com/legend",
            }, {
                items: [],
                subdirs: []
            })
        ).toEqual({
            "attribution": undefined,
            "bbox": undefined,
            "drawingOrder": undefined,
            "expanded": undefined,
            "externalLayerMap": {},
            "featureInfoUrl": "http://example.com",
            "format": undefined,
            "infoFormats": undefined,
            "legendUrl": "http://example.com/legend",
            "name": undefined,
            "printUrl": "http://example.com",
            "ratio": 1,
            "rev": 1585688400000,
            "role": 2,
            "serverType": "qgis",
            "sublayers": undefined,
            "tileSize": undefined,
            "tiled": undefined,
            "title": undefined,
            "type": "wms",
            "url": "http://example.com/",
            "version": "1.3.0",
            "visibility": true,
        })
    });
});

describe("getThemeById", () => {
    it("should return null if no themes exist", () => {
        const themes = {
            items: [],
            subdirs: []
        };
        const result = ThemeUtils.getThemeById(themes, "test");
        expect(result).toBeNull();
    });
    it("should return the theme", () => {
        const themes = {
            items: [{
                id: "test"
            }],
            subdirs: []
        };
        const result = ThemeUtils.getThemeById(themes, "test");
        expect(result).toEqual({
            id: "test"
        })
    });
    it("should find the theme in sub-dirs", () => {
        const themes = {
            items: [],
            subdirs: [{
                items: [{
                    id: "test"
                }],
                subdirs: []
            }]
        };
        const result = ThemeUtils.getThemeById(themes, "test");
        expect(result).toEqual({
            id: "test"
        })
    });
});

describe("inheritBaseUrlParams", () => {
    it("should return base url if there is no capability url", () => {
        expect(ThemeUtils.inheritBaseUrlParams("", "xxx", {})).toBe("xxx");
    });
    it("should return capability url if base does not match", () => {
        expect(ThemeUtils.inheritBaseUrlParams("yyy", "xxx", {})).toBe("yyy");
    });
    it("should merge capability url and base url", () => {
        expect(ThemeUtils.inheritBaseUrlParams(
            "http://example.com?a=b&c=d",
            "http://example.com?x=y&z=t",
            {}
        )).toBe("http://example.com/?a=b&c=d");
    });
    it("should use parameters", () => {
        expect(ThemeUtils.inheritBaseUrlParams(
            "http://example.com?a=b&c=d",
            "http://example.com?x=y&z=t",
            {
                lorem: "lorem"
            }
        )).toBe("http://example.com/?lorem=lorem&a=b&c=d");
    });
});

describe("searchThemeGroup", () => {
    const themeItem = {
        title: "abcd",
        keywords: "keywords",
        abstract: "abstract"
    };
    it("should return an empty list if there are no themes", () => {
        expect(ThemeUtils.searchThemeGroup({
            subdirs: []
        }, "xyz")).toEqual([]);
    });
    it("should return an empty list if there is no match", () => {
        expect(ThemeUtils.searchThemeGroup({
            items: [themeItem]
        }, "xyz")).toEqual([]);
    });
    it("should return an item if the title matches", () => {
        expect(ThemeUtils.searchThemeGroup({
            items: [themeItem]
        }, "abcd")).toEqual([themeItem]);
    });
    it("should return an item if the keywords match", () => {
        expect(ThemeUtils.searchThemeGroup({
            items: [themeItem]
        }, "keywords")).toEqual([themeItem]);
    });
    it("should return an item if the abstract matches", () => {
        expect(ThemeUtils.searchThemeGroup({
            items: [themeItem]
        }, "abstract")).toEqual([themeItem]);
    });
    it("should return an item if the title matches in subdirs", () => {
        expect(ThemeUtils.searchThemeGroup({
            subdirs: [{
                items: [themeItem]
            }],
            items: []
        }, "abcd")).toEqual([themeItem]);
    });
    it("should return an item if the keywords match in subdirs", () => {
        expect(ThemeUtils.searchThemeGroup({
            subdirs: [{
                items: [themeItem]
            }],
            items: []
        }, "keywords")).toEqual([themeItem]);
    });
    it("should return an item if the abstract matches in subdirs", () => {
        expect(ThemeUtils.searchThemeGroup({
            subdirs: [{
                items: [themeItem]
            }],
            items: []
        }, "abstract")).toEqual([themeItem]);
    });
});

describe("searchThemes", () => {
    const themeItem = {
        title: "abcd",
        keywords: "keywords",
        abstract: "abstract"
    };
    const goodReply = [{
        "id": "themes",
        "items": [
            {
                "id": undefined,
                "text": "abcd",
                "theme": {
                    "abstract": "abstract",
                    "keywords": "keywords",
                    "title": "abcd",
                },
                "thumbnail": "/undefined",
                "type": 2,
            },
        ],
        "priority": -1,
        "titlemsgid": "search.themes",
    }];
    it("should return an empty list if there are no themes", () => {
        expect(ThemeUtils.searchThemes({
            subdirs: []
        }, "xyz")).toEqual([]);
    });
    it("should return an empty list if there is no match", () => {
        expect(ThemeUtils.searchThemes({
            items: [themeItem]
        }, "xyz")).toEqual([]);
    });
    it("should return an item if the title matches", () => {
        expect(ThemeUtils.searchThemes({
            items: [themeItem]
        }, "abcd")).toEqual(goodReply);
    });
    it("should return an item if the keywords match", () => {
        expect(ThemeUtils.searchThemes({
            items: [themeItem]
        }, "keywords")).toEqual(goodReply);
    });
    it("should return an item if the abstract matches", () => {
        expect(ThemeUtils.searchThemes({
            items: [themeItem]
        }, "abstract")).toEqual(goodReply);
    });
    it("should return an item if the title matches in subdirs", () => {
        expect(ThemeUtils.searchThemes({
            subdirs: [{
                items: [themeItem]
            }],
            items: []
        }, "abcd")).toEqual(goodReply);
    });
    it("should return an item if the keywords match in subdirs", () => {
        expect(ThemeUtils.searchThemes({
            subdirs: [{
                items: [themeItem]
            }],
            items: []
        }, "keywords")).toEqual(goodReply);
    });
    it("should return an item if the abstract matches in subdirs", () => {
        expect(ThemeUtils.searchThemes({
            subdirs: [{
                items: [themeItem]
            }],
            items: []
        }, "abstract")).toEqual(goodReply);
    });
});
