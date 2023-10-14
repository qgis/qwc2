export default {
    verbose: true,
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ["text", "html"],
    moduleFileExtensions: ['js', 'jsx'],
    moduleDirectories: ['node_modules'],
    moduleNameMapper: {
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
            '<rootDir>/__mocks__/fileMock.js',
        '\\.(css|less)$': 'identity-obj-proxy',
        // '^openlayers$': '<rootDir>/libs/openlayers.js',
        // "^ol/(.*)$": "<rootDir>/node_modules/ol/dist/ol.js",
        // "^ol-ext/(.*)$": "<rootDir>/node_modules/ol-ext/dist/ol-ext.js",
        '^openlayers$': "ol",
    },
    transform: {
        "^.+\\.jsx?$": "babel-jest",
    },
    transformIgnorePatterns: [
        'node_modules/(?!(ol|ol-ext)/)',
        'D:\\prog\\qwc-qgis\\qwc2\\node_modules\\ol\\control\\Attribution.js'
    ],
    testEnvironment: "jsdom",
    setupFiles: [
        "jest-canvas-mock",
        './jest.setup.js'
    ],
};
