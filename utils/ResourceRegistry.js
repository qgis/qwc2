/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const REGISTRY = {};

const ResourceRegistry = {
    addResource(key, data) {
        REGISTRY[key] = data;
    },
    removeResource(key) {
        delete REGISTRY[key];
    },
    getResource(key) {
        return REGISTRY[key];
    }
};

export default ResourceRegistry;
