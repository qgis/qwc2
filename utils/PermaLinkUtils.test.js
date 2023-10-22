import mockAxios from 'jest-mock-axios';

import { UrlParams, generatePermaLink } from "./PermaLinkUtils";

let mockPermalinkServiceUrl = '';
let mockStoreAllLayersInPermalink = false;
let mockOmitUrlParameterUpdates = false;
jest.mock("./ConfigUtils", () => ({
    __esModule: true,
    default: {
        getConfigProp: (name) => {
            if (name === 'permalinkServiceUrl') {
                return mockPermalinkServiceUrl;
            } else if (name === 'storeAllLayersInPermalink') {
                return mockStoreAllLayersInPermalink;
            } else if (name === 'omitUrlParameterUpdates') {
                return mockOmitUrlParameterUpdates;
            }
        },
    },
}));


afterEach(() => {
    mockAxios.reset();
});


describe("generatePermaLink", () => {
    beforeEach(() => {
        jest.spyOn(UrlParams, 'getFullUrl').mockReturnValue('bar');
    });
    it("calls the callback if permalinkServiceUrl is not set", () => {
        mockPermalinkServiceUrl = '';
        const callback = jest.fn();
        generatePermaLink({}, callback);
        expect(callback).toHaveBeenCalledWith("bar");
    });
    it("should generate the link", () => {
        mockPermalinkServiceUrl = "permalink-service-url";
        mockStoreAllLayersInPermalink = true;
        const callback = jest.fn();
        generatePermaLink({
            layers: {
                flat: []
            }
        }, callback);

        expect(mockAxios.post).toHaveBeenCalledWith(
            "permalink-service-url/createpermalink", {
            "layers": [],
            "url": "bar",
        });
        mockAxios.mockResponse({
            data: {
                permalink: "foo-bar"
            }
        });
        expect(callback).toHaveBeenCalledWith("foo-bar");
    });
    it("should silently ignore network errors", () => {
        mockAxios.post.mockRejectedValueOnce({});
        mockPermalinkServiceUrl = "permalink-service-url";
        mockStoreAllLayersInPermalink = true;
        const callback = jest.fn((value) => {
            expect(value).toBe("bar");
        });
        generatePermaLink({
            layers: {
                flat: []
            }
        }, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            "permalink-service-url/createpermalink", {
            "layers": [],
            "url": "bar-bar",
        });
    });
});

describe("resolvePermaLink", () => {

});

describe("getUserBookmarks", () => {

});

describe("removeBookmark", () => {

});

describe("createBookmark", () => {

});

describe("updateBookmar", () => {

});

describe("UrlParams", () => {
    describe("clear", () => {

    });

    describe("getFullUrl", () => {

    });

    describe("getParam", () => {

    });

    describe("getParams", () => {

    });

    describe("updateParams", () => {

    });
});
