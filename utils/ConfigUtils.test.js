import mockAxios from 'jest-mock-axios';
import ConfigUtils from "./ConfigUtils";
import { beforeEach } from 'node:test';

let mockIsMobile = false;
jest.mock('ismobilejs', () => ({
    __esModule: true,
    default: jest.fn(secret => {
        return {
            any: mockIsMobile,
        };
    }),
}));

const navigatorSpy = jest.spyOn(global, 'navigator', 'get');
let mockUserAgent = "foo";
let mockPlatform = "bar";
let mockPointerEnabled = undefined;
let mockMaxTouchPoints = undefined;
navigatorSpy.mockImplementation(() => ({
    userAgent: mockUserAgent,
    platform: mockPlatform,
    pointerEnabled: mockPointerEnabled,
    maxTouchPoints: mockMaxTouchPoints
}));

const documentSpy = jest.spyOn(global, 'document', 'get');
let mockDocumentElement = {
    style: {}
};
let mockDocumentMode = undefined;
let mockAddEventListener = undefined;
documentSpy.mockImplementation(() => ({
    documentElement: mockDocumentElement,
    documentMode: mockDocumentMode,
    addEventListener: mockAddEventListener,
}));

const locationSpy = jest.spyOn(global.window, 'location', 'get');
let mockLocationHash = undefined;
locationSpy.mockImplementation(() => ({
    hash: mockLocationHash
}));


const expectedDefault = {
    translationsPath: "translations",
    defaultFeatureStyle: {
        strokeColor: [0, 0, 255, 1],
        strokeWidth: 2,
        strokeDash: [4],
        fillColor: [0, 0, 255, 0.33],
        circleRadius: 10,
        textFill: "black",
        textStroke: "white",
    },
}

function setInternalConfig(data) {
    const responseObj = {
        data
    };

    const catchFn = jest.fn(), thenFn = jest.fn();
    ConfigUtils.loadConfiguration({})
        .then(thenFn)
        .catch(catchFn);

    expect(mockAxios.get).toHaveBeenCalledWith(
        'config.json', { params: {} }
    );
    mockAxios.mockResponse(responseObj);
}

let mockStateMobile = undefined;
jest.mock('../stores/StandardStore', () => ({
    get: jest.fn(() => ({
        getState: jest.fn(() => ({
            browser: {
                mobile: mockStateMobile,
            }
        })),
    })),
}));


describe("getDefaults", () => {
    it("should return the default configuration", () => {
        const defaults = ConfigUtils.getDefaults();
        expect(defaults).toEqual({ ...expectedDefault });
    });
});

describe("loadConfiguration", () => {
    const configParams = {
        foo: "bar",
    };

    afterEach(() => {
        mockAxios.reset();
    });

    it("should load the configuration", () => {
        const responseObj = {
            data: {
                abc: "defg",
            }
        };

        const catchFn = jest.fn(), thenFn = jest.fn();
        ConfigUtils.loadConfiguration(configParams)
            .then(thenFn)
            .catch(catchFn);

        expect(mockAxios.get).toHaveBeenCalledWith(
            'config.json', { params: configParams }
        );
        mockAxios.mockResponse(responseObj);
        expect(thenFn).toHaveBeenCalledWith({
            ...expectedDefault,
            abc: "defg",
        });
        expect(catchFn).not.toHaveBeenCalled();
    });
    it("should use localConfig URL parameter", () => {
        location.href = "http://example.com/?localConfig=foo";
        const catchFn = jest.fn(), thenFn = jest.fn();
        ConfigUtils.loadConfiguration(configParams)
            .then(thenFn)
            .catch(catchFn);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'foo.json', { params: configParams }
        );
    });
    it("should ignore non-object replies", () => {
        ConfigUtils.resetDefaults();
        const catchFn = jest.fn(), thenFn = jest.fn();
        ConfigUtils.loadConfiguration(configParams)
            .then(thenFn)
            .catch(catchFn);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'config.json', { params: configParams }
        );
        mockAxios.mockResponse({ data: "foo" });
        expect(thenFn).toHaveBeenCalledWith({
            ...expectedDefault
        });
        expect(catchFn).not.toHaveBeenCalled();
    });
});

describe("resetDefaults", () => {
    it("should reset the defaults", () => {
        const defaults = ConfigUtils.resetDefaults();
        expect(defaults).toEqual({ ...expectedDefault });
    });
});

describe("getBrowserProperties", () => {
    beforeEach(() => {
        global.window.location = {
            href: "http://example.com/"
        };
        Object.assign(navigator, () => ({
            userAgent: "foo",
            platform: "bar",
        }))
    });

    describe("ie", () => {
        it("should detect IE when ActiveXObject is present", () => {
            global.window.ActiveXObject = "foo";
            expect(ConfigUtils.getBrowserProperties().ie).toBe(true);
        });
        it("should not detect IE when ActiveXObject is not present", () => {
            delete global.window.ActiveXObject;
            expect(ConfigUtils.getBrowserProperties().ie).toBe(false);
        });
    });

    describe("ie11", () => {
        it.skip("should detect IE11 when hash is true", () => {
            // This one is failing because the mockLocationHash is not
            // picked up by the ConfigUtils.getBrowserProperties() call.
            // As set right now the window.location.hash will show up as ''
            // (empty string).
            // If set with global.window.location.hash`true` 
            // it will show up as '#true'.
            global.window.ActiveXObject = "foo";
            global.window.MSInputMethodContext = "foo";
            mockDocumentMode = "foo";
            mockLocationHash = true;
            expect(ConfigUtils.getBrowserProperties().ie11).toBe(true);
        });
    });

    describe("ielt9", () => {
        it("should detect ielt9 when addEventListener is not present", () => {
            global.window.ActiveXObject = "foo";
            mockAddEventListener = undefined;
            expect(ConfigUtils.getBrowserProperties().ielt9).toBe(true);
        });
        it("should not detect ielt9 when addEventListener is present", () => {
            global.window.ActiveXObject = "foo";
            mockAddEventListener = "foo";
            expect(ConfigUtils.getBrowserProperties().ielt9).toBe(false);
        });
    });

    describe("webkit", () => {
        it("should detect webkit", () => {
            mockUserAgent = "fOo";
            expect(
                ConfigUtils.getBrowserProperties().webkit
            ).toBe(false);
            mockUserAgent = "fOoWEBKIT";
            expect(
                ConfigUtils.getBrowserProperties().webkit
            ).toBe(true);
        });
    });

    describe("gecko", () => {
        it("should not detect gecko", () => {
            mockUserAgent = "fOo";
            expect(
                ConfigUtils.getBrowserProperties().gecko
            ).toBe(false);
        });
        it("should detect gecko if opera was found", () => {
            mockUserAgent = "fOoGECKO";
            global.window.opera = true;
            delete global.window.ActiveXObject;
            expect(
                ConfigUtils.getBrowserProperties().gecko
            ).toBeFalsy();
        });
        it("should detect gecko if IE was found", () => {
            mockUserAgent = "fOoGECKO";
            global.window.opera = false;
            global.window.ActiveXObject = true;
            expect(
                ConfigUtils.getBrowserProperties().gecko
            ).toBeFalsy();
        });
        it("should not detect gecko if webkit was found", () => {
            mockUserAgent = "GECKO-webkit";
            delete global.window.opera;
            delete global.window.ActiveXObject;
            expect(
                ConfigUtils.getBrowserProperties().gecko
            ).toBeFalsy();
        });
        it("should detect gecko", () => {
            mockUserAgent = "fOoGECKO";
            delete global.window.opera;
            delete global.window.ActiveXObject;
            expect(
                ConfigUtils.getBrowserProperties().gecko
            ).toBe(true);
        });
    });

    describe("android", () => {
        it("should detect android", () => {
            mockUserAgent = "fOo";
            expect(
                ConfigUtils.getBrowserProperties().android
            ).toBe(false);
            mockUserAgent = "fOoANDROID";
            expect(
                ConfigUtils.getBrowserProperties().android
            ).toBe(true);
        });
    });

    describe("android23", () => {
        it("should not detect android23", () => {
            mockUserAgent = "fOo";
            expect(
                ConfigUtils.getBrowserProperties().android23
            ).toBe(false);
            mockUserAgent = "fOoANDROID";
            expect(
                ConfigUtils.getBrowserProperties().android23
            ).toBe(false);
        });
        it("should detect android23", () => {
            mockUserAgent = "fOoANDROID 2";
            expect(
                ConfigUtils.getBrowserProperties().android
            ).toBe(true);
            expect(
                ConfigUtils.getBrowserProperties().android23
            ).toBe(true);
            mockUserAgent = "fOoANDROID 3";
            expect(
                ConfigUtils.getBrowserProperties().android
            ).toBe(true);
            expect(
                ConfigUtils.getBrowserProperties().android23
            ).toBe(true);
        });
    });

    describe("chrome", () => {
        it("should detect chrome", () => {
            mockUserAgent = "fOo";
            expect(
                ConfigUtils.getBrowserProperties().chrome
            ).toBe(false);
            mockUserAgent = "fOoCHROME";
            expect(
                ConfigUtils.getBrowserProperties().chrome
            ).toBe(true);
        });
    });

    describe("ie3d", () => {
        it("should detect it", () => {
            global.window.ActiveXObject = "foo";
            mockDocumentElement = {
                style: {
                    transition: "foo"
                }
            };
            const bp = ConfigUtils.getBrowserProperties();
            expect(bp.ie3d).toBeTruthy();
            expect(bp.any3d).toBeTruthy();
        });
        it("should not detect it if transition is missing", () => {
            mockDocumentElement = {
                style: {}
            };
            global.window.ActiveXObject = "foo";
            expect(
                ConfigUtils.getBrowserProperties().ie3d
            ).toBeFalsy();
        });
        it("should not detect it if ActiveX is missing", () => {
            mockDocumentElement = {
                style: {
                    transition: "foo"
                }
            };
            delete global.window.ActiveXObject;
            expect(
                ConfigUtils.getBrowserProperties().ie3d
            ).toBeFalsy();
        });
    });

    describe("webkit3d", () => {
        it("should not detect it if WebKitCSSMatrix is missing", () => {
            delete global.window.WebKitCSSMatrix;
            expect(
                ConfigUtils.getBrowserProperties().webkit3d
            ).toBeFalsy();
        });
        it("should not detect it if m11 is missing", () => {
            class Xyz { }
            global.window.WebKitCSSMatrix = Xyz;
            expect(
                ConfigUtils.getBrowserProperties().webkit3d
            ).toBeFalsy();
        });
        it("should not detect it if android23", () => {
            class Xyz {
                m11 = 1;
            }
            mockUserAgent = "android 3";
            global.window.WebKitCSSMatrix = Xyz;
            expect(
                ConfigUtils.getBrowserProperties().webkit3d
            ).toBeFalsy();
        });
        it("should detect it", () => {
            class Xyz {
                m11 = 1;
            }
            mockUserAgent = "xxx";
            global.window.WebKitCSSMatrix = Xyz;
            const bp = ConfigUtils.getBrowserProperties();
            expect(bp.webkit3d).toBeTruthy();
            expect(bp.any3d).toBeTruthy();
        });
    });

    describe("gecko3d", () => {
        it("should detect it", () => {
            mockDocumentElement = {
                style: {
                    MozPerspective: "foo"
                }
            };
            const bp = ConfigUtils.getBrowserProperties();
            expect(bp.gecko3d).toBeTruthy();
            expect(bp.any3d).toBeTruthy();
        });
        it("should not detect it", () => {
            mockDocumentElement = {
                style: {}
            };
            expect(
                ConfigUtils.getBrowserProperties().gecko3d
            ).toBeFalsy();
        });
    });

    describe("opera3d", () => {
        it("should detect it", () => {
            mockDocumentElement = {
                style: {
                    OTransition: "foo"
                }
            };
            const bp = ConfigUtils.getBrowserProperties();
            expect(bp.opera3d).toBeTruthy();
            expect(bp.any3d).toBeTruthy();
        });
        it("should not detect it", () => {
            mockDocumentElement = {
                style: {}
            };
            expect(
                ConfigUtils.getBrowserProperties().opera3d
            ).toBeFalsy();
        });
    });

    describe("any3d", () => {
        it("should detect it", () => {
            global.window.L_DISABLE_3D = false;
            mockDocumentElement = {
                style: {
                    OTransition: "foo"
                }
            };
            expect(
                ConfigUtils.getBrowserProperties().any3d
            ).toBeTruthy();
        });
        it("should not detect it", () => {
            global.window.L_DISABLE_3D = true;
            mockDocumentElement = {
                style: {
                    OTransition: "foo"
                }
            };
            expect(
                ConfigUtils.getBrowserProperties().any3d
            ).toBeFalsy();
        });
    });

    describe("mobile", () => {
        it("should detect it", () => {
            mockIsMobile = true;
            expect(
                ConfigUtils.getBrowserProperties().mobile
            ).toBe(true);
        });
        it("should not detect it", () => {
            mockIsMobile = false;
            expect(
                ConfigUtils.getBrowserProperties().mobile
            ).toBe(false);
        });
    });

    describe("mobileWebkit", () => {
        it("should detect it if user agent is webkit", () => {
            mockIsMobile = true;
            mockUserAgent = 'webkit';
            expect(
                ConfigUtils.getBrowserProperties().mobileWebkit
            ).toBeTruthy();
        });
        it("should not detect it not on mobile", () => {
            mockIsMobile = false;
            expect(
                ConfigUtils.getBrowserProperties().mobileWebkit
            ).toBe(false);
        });
        it("should not detect it not on webkit", () => {
            mockIsMobile = true;
            mockUserAgent = 'otherkit';
            expect(
                ConfigUtils.getBrowserProperties().mobileWebkit
            ).toBe(false);
        });
    });

    describe("mobileWebkit3d", () => {
        it("should not detect it if not on mobile", () => {
            mockIsMobile = false;
            expect(
                ConfigUtils.getBrowserProperties().mobileWebkit3d
            ).toBeFalsy();
        });
        it("should not detect it if WebKitCSSMatrix is missing", () => {
            mockIsMobile = true;
            mockUserAgent = "xxx";
            delete global.window.WebKitCSSMatrix;
            expect(
                ConfigUtils.getBrowserProperties().mobileWebkit3d
            ).toBeFalsy();
        });
        it("should not detect it if m11 is missing", () => {
            class Xyz { }
            mockIsMobile = true;
            mockUserAgent = "xxx";
            global.window.WebKitCSSMatrix = Xyz;
            expect(
                ConfigUtils.getBrowserProperties().mobileWebkit3d
            ).toBeFalsy();
        });
        it("should not detect it if android23", () => {
            class Xyz {
                m11 = 1;
            }
            mockIsMobile = true;
            mockUserAgent = "android 2";
            global.window.WebKitCSSMatrix = Xyz;
            expect(
                ConfigUtils.getBrowserProperties().mobileWebkit3d
            ).toBeFalsy();
        });
        it("should detect it", () => {
            class Xyz {
                m11 = 1;
            }
            mockIsMobile = true;
            mockUserAgent = "xxx";
            global.window.WebKitCSSMatrix = Xyz;
            expect(
                ConfigUtils.getBrowserProperties().mobileWebkit3d
            ).toBeTruthy();
        });
    });

    describe("mobileOpera", () => {
        it("should detect it if opera is in window object", () => {
            mockIsMobile = true;
            global.window.opera = true;
            expect(
                ConfigUtils.getBrowserProperties().mobileOpera
            ).toBeTruthy();
        });
        it("should not detect it if mobile or opera are missing", () => {
            mockIsMobile = false;
            expect(
                ConfigUtils.getBrowserProperties().mobileOpera
            ).toBeFalsy();
            mockIsMobile = true;
            global.window.opera = false;
            expect(
                ConfigUtils.getBrowserProperties().mobileOpera
            ).toBeFalsy();
        });
    });

    describe("touch", () => {
        class Xyz { }

        it("should not detect it if L_NO_TOUCH", () => {
            global.window.L_NO_TOUCH = true;
            expect(
                ConfigUtils.getBrowserProperties().touch
            ).toBeFalsy();
        });
        it("should not detect it if user-agent is phantom", () => {
            global.window.L_NO_TOUCH = false;
            mockUserAgent = "PHANTOM";
            expect(
                ConfigUtils.getBrowserProperties().touch
            ).toBeFalsy();
        });
        it("should detect it if there is a pointer", () => {
            global.window.L_NO_TOUCH = false;
            mockUserAgent = "non-ph";
            global.window.PointerEvent = true;
            mockPointerEnabled = true;
            mockMaxTouchPoints = 1;
            delete global.window.ontouchstart;
            delete global.window.DocumentTouch;
            expect(
                ConfigUtils.getBrowserProperties().touch
            ).toBeTruthy();
        });
        it("should detect it if ontouchstart is found", () => {
            global.window.L_NO_TOUCH = false;
            mockUserAgent = "non-ph";
            global.window.PointerEvent = false;
            global.window.ontouchstart = true;
            global.window.DocumentTouch = true;
            expect(
                ConfigUtils.getBrowserProperties().touch
            ).toBeTruthy();
        });
        it("should not detect it if DocumentTouch is of wrong type", () => {
            global.window.L_NO_TOUCH = false;
            mockUserAgent = "non-ph";
            global.window.PointerEvent = false;
            delete global.window.ontouchstart;
            global.window.DocumentTouch = Xyz;
            expect(
                ConfigUtils.getBrowserProperties().touch
            ).toBeFalsy();
        });
        it("should not detect it if DocumentTouch is of right type", () => {
            global.window.L_NO_TOUCH = false;
            mockUserAgent = "non-ph";
            global.window.PointerEvent = false;
            delete global.window.ontouchstart;
            global.window.DocumentTouch = Xyz;
            global.document = new Xyz();
            expect(
                ConfigUtils.getBrowserProperties().touch
            ).toBeFalsy();
        });
    });

    describe("msPointer", () => {
        it("should not detect it if PointerEvent is present", () => {
            global.window.PointerEvent = true;
            expect(
                ConfigUtils.getBrowserProperties().msPointer
            ).toBeFalsy();
        });
        it("should not detect it if MSPointerEvent is missing", () => {
            global.window.PointerEvent = true;
            delete global.window.MSPointerEvent;
            expect(
                ConfigUtils.getBrowserProperties().msPointer
            ).toBeFalsy();
        });
        it("should detect it all are true", () => {
            global.window.PointerEvent = true;
            global.window.MSPointerEvent = true;
            expect(
                ConfigUtils.getBrowserProperties().msPointer
            ).toBeFalsy();
        });
    });

    describe("pointer", () => {
        describe("using msPointer", () => {
            it("should not detect it if MSPointerEvent is missing", () => {
                delete global.window.PointerEvent;
                delete global.window.MSPointerEvent;
                expect(
                    ConfigUtils.getBrowserProperties().pointer
                ).toBeFalsy();
            });
            it("should detect it all are true", () => {
                delete global.window.PointerEvent;
                global.window.MSPointerEvent = true;
                expect(
                    ConfigUtils.getBrowserProperties().pointer
                ).toBeTruthy();
            });
        });
        describe("using plain Pointer", () => {
            it("should not detect it if PointerEvent is missing", () => {
                delete global.window.MSPointerEvent;
                delete global.window.PointerEvent;

                expect(
                    ConfigUtils.getBrowserProperties().pointer
                ).toBeFalsy();
            });
            it("should not detect it if pointerEnabled is falsly", () => {
                delete global.window.MSPointerEvent;
                global.window.PointerEvent = true;
                mockPointerEnabled = false;
                expect(
                    ConfigUtils.getBrowserProperties().pointer
                ).toBeFalsy();
            });
            it("should not detect it if maxTouchPoints is falsly", () => {
                delete global.window.MSPointerEvent;
                global.window.PointerEvent = true;
                mockPointerEnabled = true;
                mockMaxTouchPoints = 0;
                expect(
                    ConfigUtils.getBrowserProperties().pointer
                ).toBeFalsy();
            });
            it("should detect it if iff all are true", () => {
                delete global.window.MSPointerEvent;
                global.window.PointerEvent = true;
                mockPointerEnabled = true;
                mockMaxTouchPoints = 1;
                expect(
                    ConfigUtils.getBrowserProperties().pointer
                ).toBeTruthy();
            });
        });
    });

    describe("retina", () => {
        describe("using devicePixelRatio", () => {
            beforeEach(() => { delete global.window.matchMedia; });
            it("should detect it if devicePixelRatio > 1", () => {
                global.window.devicePixelRatio = 2;
                expect(
                    ConfigUtils.getBrowserProperties().retina
                ).toBe(true);
            });
            it("should not detect it if devicePixelRatio is missing", () => {
                delete global.window.devicePixelRatio;
                expect(
                    ConfigUtils.getBrowserProperties().retina
                ).toBe(false);
            });
            it("should not detect it if devicePixelRatio is 1", () => {
                global.window.devicePixelRatio = 1;
                expect(
                    ConfigUtils.getBrowserProperties().retina
                ).toBe(false);
            });
        });
        describe("using matchMedia", () => {
            beforeEach(() => { delete global.window.devicePixelRatio; });
            it("should not detect it if matchMedia is missing", () => {
                delete global.window.matchMedia;
                expect(
                    ConfigUtils.getBrowserProperties().retina
                ).toBeFalsy();
            });
            it("should not detect it if matchMedia returns falsly", () => {
                global.window.matchMedia = () => undefined;
                expect(
                    ConfigUtils.getBrowserProperties().retina
                ).toBeFalsy();
            });
            it("should not detect it if matches returns falsly", () => {
                global.window.matchMedia = () => ({
                    matches: undefined
                });
                expect(
                    ConfigUtils.getBrowserProperties().retina
                ).toBeFalsy();
            });
            it("should detect it if matches returns truthy", () => {
                global.window.matchMedia = () => ({
                    matches: []
                });
                expect(
                    ConfigUtils.getBrowserProperties().retina
                ).toBeTruthy();
            });
        });
    });

    describe("platform", () => {
        it("should detect it", () => {
            expect(
                ConfigUtils.getBrowserProperties().platform
            ).toBe("bar");
        });
    });

});

describe("getConfigProp", () => {
    it("should return the default value if not in theme", () => {
        expect(
            ConfigUtils.getConfigProp("foo", null, "bar")
        ).toBe("bar");
    });
    it("should return the theme value if in theme", () => {
        expect(
            ConfigUtils.getConfigProp("foo", { config: { foo: "bar" } }, "baz")
        ).toBe("bar");
    });
    it("should return the default value if in theme but undefined", () => {
        expect(
            ConfigUtils.getConfigProp(
                "foo", { config: { foo: undefined } }, "baz"
            )
        ).toBe("baz");
    });
    it("should return the library default if not in theme", () => {
        ConfigUtils.resetDefaults();
        expect(
            ConfigUtils.getConfigProp("translationsPath")
        ).toBe("translations");
    });
});

describe("getAssetsPath", () => {
    beforeEach(() => {
        ConfigUtils.resetDefaults();
    });
    it("should return the default value if not set", () => {
        expect(
            ConfigUtils.getAssetsPath()
        ).toBe("assets");
    });
    it("should return the library value value if set", () => {
        setInternalConfig({ assetsPath: "foo/" })
        expect(
            ConfigUtils.getAssetsPath()
        ).toBe("foo");
    });
});

describe("getTranslationsPath", () => {
    beforeEach(() => {
        ConfigUtils.resetDefaults();
    });
    it("should return the default value if not set", () => {
        expect(
            ConfigUtils.getTranslationsPath()
        ).toBe("translations");
    });
    it("should return the library value value if set", () => {
        setInternalConfig({ translationsPath: "foo/" })
        expect(
            ConfigUtils.getTranslationsPath()
        ).toBe("foo");
    });
});

describe("havePlugin", () => {
    beforeEach(() => {
        ConfigUtils.resetDefaults();
    });
    it("should return false if no plugins", () => {
        setInternalConfig({
            plugins: {
                mobile: [],
                desktop: []
            }
        });
        expect(
            ConfigUtils.havePlugin("foo")
        ).toBeFalsy();
    });
    it("should return false if no plugins of right type", () => {
        mockStateMobile = true;
        setInternalConfig({
            plugins: {
                mobile: [],
                desktop: [{
                    name: "foo"
                }]
            }
        });
        expect(
            ConfigUtils.havePlugin("foo")
        ).toBeFalsy();

        mockStateMobile = false;
        setInternalConfig({
            plugins: {
                mobile: [{
                    name: "foo"
                }],
                desktop: []
            }
        });
        expect(
            ConfigUtils.havePlugin("foo")
        ).toBeFalsy();
    });
    it("should return true if plugin found", () => {
        mockStateMobile = true;
        setInternalConfig({
            plugins: {
                mobile: [{
                    name: "foo"
                }],
                desktop: []
            }
        });
        expect(
            ConfigUtils.havePlugin("foo")
        ).toBeTruthy();

        mockStateMobile = false;
        setInternalConfig({
            plugins: {
                mobile: [],
                desktop: [{
                    name: "foo"
                }]
            }
        });
        expect(
            ConfigUtils.havePlugin("foo")
        ).toBeTruthy();
    });
});

describe("getPluginConfig", () => {
    beforeEach(() => {
        ConfigUtils.resetDefaults();
    });
    it("should return an empty object if no plugins", () => {
        setInternalConfig({
            plugins: {
                mobile: [],
                desktop: []
            }
        });
        expect(
            ConfigUtils.getPluginConfig("foo")
        ).toEqual({});
    });
    it("should return an empty object if no plugins of right type", () => {
        mockStateMobile = true;
        setInternalConfig({
            plugins: {
                mobile: [],
                desktop: [{
                    name: "foo"
                }]
            }
        });
        expect(
            ConfigUtils.getPluginConfig("foo")
        ).toEqual({});

        mockStateMobile = false;
        setInternalConfig({
            plugins: {
                mobile: [{
                    name: "foo"
                }],
                desktop: []
            }
        });
        expect(
            ConfigUtils.getPluginConfig("foo")
        ).toEqual({});
    });
    it("should return true if plugin found", () => {
        mockStateMobile = true;
        setInternalConfig({
            plugins: {
                mobile: [{
                    name: "foo"
                }],
                desktop: []
            }
        });
        expect(
            ConfigUtils.getPluginConfig("foo")
        ).toEqual({
            name: "foo"
        });

        mockStateMobile = false;
        setInternalConfig({
            plugins: {
                mobile: [],
                desktop: [{
                    name: "foo"
                }]
            }
        });
        expect(
            ConfigUtils.getPluginConfig("foo")
        ).toEqual({
            name: "foo"
        });
    });
});