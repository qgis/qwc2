
/** @type {import('jest').Config} */
const config = {
    verbose: true,
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: "coverage",
    coverageReporters: ["text", "html"],
    moduleFileExtensions: ["js", "jsx"],
    moduleDirectories: ["node_modules"],
    moduleNameMapper: {
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
            "<rootDir>/__mocks__/fileMock.js",
        "\\.(css|less)$": "identity-obj-proxy",
        "^openlayers$": "<rootDir>/libs/openlayers.js"
    },
    transform: {
        "^.+\\.jsx?$": "babel-jest",
    },
    transformIgnorePatterns: [
        "node_modules/(?!(ol|ol-ext)/)",
    ],
    testEnvironment: "jsdom",
    setupFiles: [
        "jest-canvas-mock",
    ],
    setupFilesAfterEnv: [
        "./config/setupTests.js",
    ]
};

export default config;
