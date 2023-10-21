import mockAxios from 'jest-mock-axios';
import EdIface from './EditingInterface';

let mockEditServiceUrl = "url-foo/";
jest.mock("./ConfigUtils", () => ({
    __esModule: true,
    default: {
        getConfigProp: (name) => {
            if (name === 'editServiceUrl') {
                return mockEditServiceUrl;
            }
        },
    },
}));

let mockLocale = "xy";
jest.mock("./LocaleUtils", () => ({
    __esModule: true,
    default: {
        lang: () => mockLocale,
        tr: (msg) => msg,
    },
}));


afterEach(() => {
    mockAxios.reset();
});

describe("addFeatureMultipart", () => {
    const formData = new FormData();
    formData.append('feature', 'Fred');
    formData.append('file', 'XX-YY');
    const args = ["layer-x", formData];
    const postArgs = {
        "headers": {
            "Accept-Language": "xy",
            "Content-Type": "multipart/form-data",
        },
    };
    const response = {
        data: {
            abc: "def"
        }
    };
    const result = {
        "__version__": 1585688400000,
        abc: "def"
    };
    it("should return response data", () => {
        const callback = jest.fn();
        EdIface.addFeatureMultipart(...args, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            'url-foo/layer-x/multipart', formData, postArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith(true, result);
    });
    it("should return an error if connection fails", () => {
        mockAxios.post.mockRejectedValueOnce({
            response: {
                data: {
                    abcd: "efg"
                }
            }
        });
        const callback = jest.fn((result, error) => {
            expect(result).toBe(false);
            expect(error).toBe("editing.commitfailed");
        });
        EdIface.addFeatureMultipart(...args, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            'url-foo/layer-x/multipart', formData, postArgs
        );
    });
    it("should return the error in the message", () => {
        mockAxios.post.mockRejectedValueOnce({
            response: {
                data: {
                    message: "foo-err"
                }
            }
        });
        const callback = jest.fn((result, error) => {
            expect(result).toBe(false);
            expect(error).toBe("foo-err");
        });
        EdIface.addFeatureMultipart(...args, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            'url-foo/layer-x/multipart', formData, postArgs
        );
    });
    it("should return the error in statusText", () => {
        mockAxios.post.mockRejectedValueOnce({
            response: {
                statusText: "foo-err"
            }
        });
        const callback = jest.fn((result, error) => {
            expect(result).toBe(false);
            expect(error).toBe("editing.commitfailed: foo-err");
        });
        EdIface.addFeatureMultipart(...args, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            'url-foo/layer-x/multipart', formData, postArgs
        );
    });
    it("should return the various errors", () => {
        mockAxios.post.mockRejectedValueOnce({
            response: {
                data: {
                    message: "foo-err",
                    geometry_errors: [{
                        reason: "lorem",
                        location: 123
                    }, {
                        reason: "ipsum",
                        location: 456
                    }],
                    data_errors: [
                        "dolor", "sit", "amet"
                    ],
                    validation_errors: [
                        "consectetur", "adipiscing", "elit"
                    ],
                    attachment_errors: [
                        "sed", "do", "eiusmod", "tempor"
                    ]
                }
            }
        });
        const callback = jest.fn((result, error) => {
            expect(result).toBe(false);
            expect(error).toBe(
                "foo-err:\n" + 
                " - lorem at 123,\n" + 
                " - ipsum at 456:\n" + 
                " - dolor\n" + 
                " - sit\n" + 
                " - amet:\n" + 
                " - consectetur\n" + 
                " - adipiscing\n" + 
                " - elit:\n" + 
                " - sed\n" + 
                " - do\n" + 
                " - eiusmod\n" + 
                " - tempor"
            );
        });
        EdIface.addFeatureMultipart(...args, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            'url-foo/layer-x/multipart', formData, postArgs
        );
    });
});

describe("deleteFeature", () => {
    const args = ["layer-x", "123456"];
    const postArgs = {
        "headers": {
            "Accept-Language": "xy",
        },
    };
    it("should return response data", () => {
        const callback = jest.fn();
        EdIface.deleteFeature(...args, callback);
        expect(mockAxios.delete).toHaveBeenCalledWith(
            'url-foo/layer-x/123456', postArgs
        );
        mockAxios.mockResponse({});
        expect(callback).toHaveBeenCalledWith(true, "123456");
    });
    it("should return an error if connection fails", () => {
        mockAxios.delete.mockRejectedValueOnce({
            response: {
                data: {
                    abcd: "efg"
                }
            }
        });
        const callback = jest.fn((result, error) => {
            expect(result).toBe(false);
            expect(error).toBe("editing.commitfailed");
        });
        EdIface.deleteFeature(...args, callback);
        expect(mockAxios.delete).toHaveBeenCalledWith(
            'url-foo/layer-x/123456', postArgs
        );
    });
});

describe("editFeatureMultipart", () => {
    const formData = new FormData();
    formData.append('feature', 'Fred');
    formData.append('file', 'XX-YY');
    const args = ["layer-x", "123456", formData];
    const postArgs = {
        "headers": {
            "Accept-Language": "xy",
            "Content-Type": "multipart/form-data",
        },
    };
    const response = {
        data: {
            abc: "def"
        }
    };
    const result = {
        "__version__": 1585688400000,
        abc: "def"
    };
    it("should return response data", () => {
        const callback = jest.fn();
        EdIface.editFeatureMultipart(...args, callback);
        expect(mockAxios.put).toHaveBeenCalledWith(
            'url-foo/layer-x/multipart/123456', formData, postArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith(true, result);
    });
    it("should return an error if connection fails", () => {
        mockAxios.put.mockRejectedValueOnce({
            response: {
                data: {
                    abcd: "efg"
                }
            }
        });
        const callback = jest.fn((result, error) => {
            expect(result).toBe(false);
            expect(error).toBe("editing.commitfailed");
        });
        EdIface.editFeatureMultipart(...args, callback);
        expect(mockAxios.put).toHaveBeenCalledWith(
            'url-foo/layer-x/multipart/123456', formData, postArgs
        );
    });
});

describe("getExtent", () => {
    const args = ["layer-x", "EPSG:3857"];
    const getArgs = {
        "headers": {
            "Accept-Language": "xy",
        },
        "params": {
            "crs": "EPSG:3857",
            filter: undefined,
        },
    };
    const response = {
        data: "foo-data",
    };
    it("should return an extent", () => {
        const callback = jest.fn();
        EdIface.getExtent(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/extent', getArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith("foo-data");
    });
    it("should return null if connection fails", () => {
        mockAxios.get.mockRejectedValueOnce(new Error("foo-err"));
        const callback = jest.fn((result) => {
            expect(result).toBe(null);
        });
        EdIface.getExtent(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/extent', getArgs
        );
    });
    it("should forward filters", () => {
        const callback = jest.fn();
        EdIface.getExtent(
            ...args, callback, [["<name>", "<op>", "<value>"]]
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/extent', {
            ...getArgs,
            params: {
                ...getArgs.params,
                filter: '[["<name>","<op>","<value>"]]',
            },
        });
    });
});

describe("getFeature", () => {
    const args = ["layer-x", [0, 0], "EPSG:3857", 1 / 0.0254, 10];
    const getArgs = {
        "headers": {
            "Accept-Language": "xy",
        },
        "params": {
            "bbox": "-1,-1,1,1",
            "crs": "EPSG:3857",
            "filter": undefined,
        },
    };
    const response = {
        data: {
            features: [
                {
                    geometry: {
                        coordinates: [0, 0],
                        type: "Point",
                    },
                    id: "id-foo",
                    properties: {},
                    type: "Feature",
                },
            ],
            type: "FeatureCollection",
        },
    };
    const result = {
        features: [
            {
                "__version__": 1585688400000,
                geometry: {
                    coordinates: [0, 0],
                    type: "Point",
                },
                id: "id-foo",
                properties: {},
                type: "Feature",
            },
        ],
        type: "FeatureCollection",
    };
    it("should return a feature", () => {
        const callback = jest.fn();
        EdIface.getFeature(...args, callback, null);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', getArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith(result);
    });
    it("should forward filters", () => {
        const callback = jest.fn();
        EdIface.getFeature(
            ...args, callback, [["<name>", "<op>", "<value>"]]
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', {
            ...getArgs,
            params: {
                ...getArgs.params,
                filter: '[["<name>","<op>","<value>"]]',
            },
        }
        );
    });
    it("should return null if connection fails", () => {
        mockAxios.get.mockRejectedValueOnce(new Error("foo-err"));
        const callback = jest.fn((result) => {
            expect(result).toBe(null);
        });
        EdIface.getFeature(...args, callback, null);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', getArgs
        );
    });
    it("should return null if data is missing", () => {
        const callback = jest.fn((result) => {
            expect(result).toBe(null);
        });
        EdIface.getFeature(...args, callback, null);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', getArgs
        );
        mockAxios.mockResponse({ a: "b" });
        expect(callback).toHaveBeenCalledWith(null);
    });
    it("should return null if the array is empty", () => {
        const callback = jest.fn((result) => {
            expect(result).toBe(null);
        });
        EdIface.getFeature(...args, callback, null);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', getArgs
        );
        mockAxios.mockResponse({ data: { features: [] } });
        expect(callback).toHaveBeenCalledWith(null);
    });
});

describe("getFeatureById", () => {
    const args = ["layer-x", "1234", "EPSG:3857"];
    const getArgs = {
        "headers": {
            "Accept-Language": "xy",
        },
        "params": {
            "crs": "EPSG:3857",
            "filter": undefined,
        },
    };
    const response = {
        data: {
            geometry: {
                coordinates: [0, 0],
                type: "Point",
            },
            id: "id-foo",
            properties: {},
        },
        type: "Feature",
    };
    const result = {
        "__version__": 1585688400000,
        geometry: {
            coordinates: [0, 0],
            type: "Point",
        },
        id: "id-foo",
        properties: {},
    };
    it("should return a feature", () => {
        const callback = jest.fn();
        EdIface.getFeatureById(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/1234', getArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith(result);
    });
    it("should return null if connection fails", () => {
        mockAxios.get.mockRejectedValueOnce(new Error("foo-err"));
        const callback = jest.fn((result) => {
            expect(result).toBe(null);
        });
        EdIface.getFeatureById(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/1234', getArgs
        );
    });
});

describe("getFeatures", () => {
    const args = ["layer-x", "EPSG:3857"];
    const getArgs = {
        "headers": {
            "Accept-Language": "xy",
        },
        "params": {
            "bbox": undefined,
            "crs": "EPSG:3857",
            "filter": undefined,
        },
    };
    const response = {
        data: {
            features: [
                {
                    geometry: {
                        coordinates: [0, 0],
                        type: "Point",
                    },
                    id: "id-foo",
                    properties: {},
                    type: "Feature",
                },
            ],
            type: "FeatureCollection",
        },
    };
    const result = {
        features: [
            {
                "__version__": 1585688400000,
                geometry: {
                    coordinates: [0, 0],
                    type: "Point",
                },
                id: "id-foo",
                properties: {},
                type: "Feature",
            },
        ],
        type: "FeatureCollection",
    };
    it("should return a list of features", () => {
        const callback = jest.fn();
        EdIface.getFeatures(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', getArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith(result);
    });
    it("should forward filters", () => {
        const callback = jest.fn();
        EdIface.getFeatures(
            ...args, callback, null, [["<name>", "<op>", "<value>"]]
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', {
            ...getArgs,
            params: {
                ...getArgs.params,
                filter: '[["<name>","<op>","<value>"]]',
            },
        }
        );
    });
    it("should forward bounding box", () => {
        const callback = jest.fn();
        EdIface.getFeatures(
            ...args, callback, [0, 0, 1, 1]
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', {
            ...getArgs,
            params: {
                ...getArgs.params,
                bbox: "0,0,1,1",
            },
        });
    });
    it("should return null if connection fails", () => {
        mockAxios.get.mockRejectedValueOnce(new Error("foo-err"));
        const callback = jest.fn((result) => {
            expect(result).toBe(null);
        });
        EdIface.getFeatures(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', getArgs
        );
    });
    it("should return null if data is missing", () => {
        const callback = jest.fn((result) => {
            expect(result).toBe(null);
        });
        EdIface.getFeatures(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/', getArgs
        );
        mockAxios.mockResponse({ a: "b" });
        expect(callback).toHaveBeenCalledWith(null);
    });
});

describe("getKeyValues", () => {
    const getArgs = {
        "headers": {
            "Accept-Language": "xy",
        },
        "params": {
            "filter": undefined
        },
    };
    const response = {
        data: "foo"
    };
    it("should return the data", () => {
        const callback = jest.fn();
        EdIface.getKeyValues("getKeyValues", callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/keyvals?tables=getKeyValues', getArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith("foo");
    });
    it("should return empty object in case of error", () => {
        mockAxios.get.mockRejectedValueOnce(new Error("foo-err"));
        const callback = jest.fn((result) => {
            expect(result).toEqual({});
        });
        EdIface.getKeyValues("getKeyValues", callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/keyvals?tables=getKeyValues', getArgs
        );
    });
});

describe("getRelations", () => {
    const args = ["layer-x", "56789", "XYZ", "EPSG:3857"];
    const getArgs = {
        "headers": {
            "Accept-Language": "xy",
        },
        "params": {
            "crs": "EPSG:3857",
            "tables": "XYZ",
        },
    };
    const response = {
        data: "foo"
    };
    it("should return the data", () => {
        const callback = jest.fn();
        EdIface.getRelations(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/56789/relations', getArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith("foo");
    });
    it("should return empty object in case of error", () => {
        mockAxios.get.mockRejectedValueOnce(new Error("foo-err"));
        const callback = jest.fn((result) => {
            expect(result).toEqual({});
        });
        EdIface.getRelations(...args, callback);
        expect(mockAxios.get).toHaveBeenCalledWith(
            'url-foo/layer-x/56789/relations', getArgs
        );
    });
});

describe("writeRelations", () => {
    const formData = new FormData();
    formData.append('feature', 'Fred');    
    const args = ["layer-x", "56789", formData, "EPSG:3857"];
    const getArgs = {
        "headers": {
            "Content-Type": "multipart/form-data",
            "Accept-Language": "xy",
        },
        "params": {
            "crs": "EPSG:3857",
        },
    };
    const response = {
        data: "foo"
    };
    it("should return the data", () => {
        const callback = jest.fn();
        EdIface.writeRelations(...args, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            'url-foo/layer-x/56789/relations', formData, getArgs
        );
        mockAxios.mockResponse({ ...response });
        expect(callback).toHaveBeenCalledWith("foo");
    });
    it("should return an error if connection fails", () => {
        mockAxios.post.mockRejectedValueOnce({
            response: {
                data: {
                    abcd: "efg"
                }
            }
        });
        const callback = jest.fn((result, error) => {
            expect(result).toBe(false);
            expect(error).toBe("editing.commitfailed");
        });
        EdIface.writeRelations(...args, callback);
        expect(mockAxios.post).toHaveBeenCalledWith(
            'url-foo/layer-x/56789/relations', formData, getArgs
        );
    });
});
