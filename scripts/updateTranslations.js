/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs');
const merge = require('deepmerge');
const objectPath = require('object-path');

const readJSON = (path) => {
    try {
        return JSON.parse(fs.readFileSync(process.cwd() + path, "utf8"));
    } catch (e) {
        return {};
    }
};

const cleanMessages = (data, ref) => {
    for (const property of Object.keys(data)) {
        const omit = ref && !(property in ref);
        if (typeof data[property] === "object") {
            if (omit) {
                delete data[property];
            } else {
                cleanMessages(data[property], ref ? ref[property] : undefined);
            }
        } else if (data[property] === "" || omit) {
            delete data[property];
        }
    }
    return data;
};

const createSkel = (strings) => {
    const skel = {locale: "", messages: {}};
    for (const string of strings) {
        const path = string.split(".");
        let cur = skel.messages;
        for (let i = 0; i < path.length - 1; ++i) {
            cur[path[i]] = cur[path[i]] || {};
            cur = cur[path[i]];
        }
        cur[path[path.length - 1]] = "";
    }
    return skel;
};

// Determine workspaces
const workspaces = readJSON('/package.json').workspaces || [];

// Generate workspace translations
for (const workspace of workspaces) {
    console.log("Generating translations for " + workspace);
    const config = readJSON('/' + workspace + '/translations/tsconfig.json');
    const strings = config.strings || [];
    const skel = createSkel(strings);

    for (const lang of config.languages || []) {
        const langskel = merge(skel, {locale: lang});

        // Merge translations
        const data = merge(langskel, cleanMessages(readJSON('/' + workspace + '/translations/' + lang + '.json'), langskel));
        // Write updated translations file
        try {
            fs.writeFileSync(process.cwd() + '/' + workspace + '/translations/' + lang + ".json", JSON.stringify(data, null, 2) + "\n");
            console.log('Wrote ' + workspace + '/translations/' + lang + '.json');
        } catch (e) {
            console.error('Failed to write ' + workspace + '/translations/' + lang + '.json: ' + e);
        }
    }
}

// Generate application translations
const config = readJSON('/translations/tsconfig.json');
const strings = config.strings || [];
const skel = createSkel(strings);
for (const lang of config.languages || []) {
    const langskel = merge(skel, {locale: lang});

    const origData = readJSON('/translations/' + lang + '.json');
    let data = merge(langskel, cleanMessages(readJSON('/translations/' + lang + '.json'), langskel));

    // Merge translations from workspaces
    for (const workspace of workspaces) {
        data = merge(data, readJSON('/' + workspace + '/translations/' + lang + '.json'));
    }

    // Revert to original values for strings specified in overrides
    for (const path of config.overrides || []) {
        const value = objectPath.get(origData.messages, path);
        if (value !== undefined) {
            objectPath.set(data.messages, path, value);
        }
    }

    // Write output
    try {
        fs.writeFileSync(process.cwd() + '/translations/' + lang + '.json', JSON.stringify(data, null, 2) + "\n");
        console.log('Wrote translations/' + lang + '.json');
    } catch (e) {
        console.error('Failed to write translations/' + lang + '.json: ' + e);
    }
}
