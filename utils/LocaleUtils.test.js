import LocaleUtils from './LocaleUtils';

let mockGetConfigPropValue = false;

jest.mock("./ConfigUtils", () => {
    return {
        __esModule: true,
        default: {
            getConfigProp: () => mockGetConfigPropValue,
        },
    }
});

jest.mock('../stores/StandardStore', () => ({
    get: jest.fn(() => ({
        getState: jest.fn(() => ({
            locale: {
                messages: {
                    'test.key': 'test value',
                    'test.key3': '{0} {1}',
                    'test.key4': undefined,
                    'test.key5': null,
                    'test.key6': "",
                },
                current: 'some-locale',
            }
        })),
    })),
}));


afterEach(() => {
    jest.resetModules();
});


describe("tr", () => {
    it("should return the template string for a key", () => {
        expect(LocaleUtils.tr('test.key')).toEqual('test value');
    });
    it("should return the key if the template is not found", () => {
        expect(LocaleUtils.tr('test.key2')).toEqual('test.key2');
    });
    it("should replace placeholders with arguments", () => {
        expect(
            LocaleUtils.tr('test.key3', 'arg1', 'arg2')
        ).toEqual('arg1 arg2');
    });
    it("should print the placeholder if not provided", () => {
        expect(LocaleUtils.tr('test.key3', 'arg1')).toEqual('arg1 {1}');
        expect(
            LocaleUtils.tr('test.key3', undefined, undefined)
        ).toEqual('{0} {1}');
    });
    it("should return the key if the string is empty", () => {
        expect(LocaleUtils.tr('test.key4')).toEqual('test.key4');
        expect(LocaleUtils.tr('test.key5')).toEqual('test.key5');
    });
    it("should return the empty string if that is the value", () => {
        expect(LocaleUtils.tr('test.key6')).toEqual('');
    });
});


describe("trmsg", () => {
    it("should return the argument unchanged", () => {
        expect(LocaleUtils.trmsg('test.key')).toEqual('test.key');
    });
});


describe("trWithFallback", () => {
    it("should return the template string for a key", () => {
        expect(
            LocaleUtils.trWithFallback('test.key', 'Fallback')
        ).toEqual('test value');
    });
    it("should return the fallback if the template is not found", () => {
        expect(
            LocaleUtils.trWithFallback('test.key2', 'Fallback')
        ).toEqual('Fallback');
    });
});


describe("lang", () => {
    it("should return the current language", () => {
        expect(LocaleUtils.lang()).toEqual('some-locale');
    });
});


describe("toLocaleFixed", () => {
    describe("with localeAwareNumbers", () => {
        const value = {
            toLocaleString: jest.fn()
        };
        it("should call toLocaleString with the correct arguments", () => {
            mockGetConfigPropValue = true;
            LocaleUtils.toLocaleFixed(value, 5);
            expect(value.toLocaleString).toHaveBeenCalledWith('some-locale', {
                minimumFractionDigits: 5,
                maximumFractionDigits: 5,
            });
        });
    });
    describe("without localeAwareNumbers", () => {
        it("should call toLocaleString with the correct arguments", () => {
            mockGetConfigPropValue = false;
            expect(
                LocaleUtils.toLocaleFixed(1.2345678, 5)
            ).toBe("1.23457");
        });
    });
});
