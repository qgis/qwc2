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
    } catch(e) {
        return {}
    }
}

const cleanMessages = (data, ref) => {
    for (let property of Object.keys(data)) {
        let omit = ref && !(property in ref);
        if (typeof data[property] == "object") {
            if(omit) {
                delete data[property];
            } else {
                cleanMessages(data[property], ref ? ref[property] : undefined);
            }
        } else if(data[property] === "" || omit) {
            delete data[property];
        }
    }
    return data;
};

const createSkel = (strings) => {
    let skel = {"locale": "", "messages": {}};
    for(let string of strings) {
        let path = string.split(".");
        let cur = skel.messages;
        for(let i = 0; i < path.length - 1; ++i) {
            cur[path[i]] = cur[path[i]] || {};
            cur = cur[path[i]];
        }
        cur[path[path.length - 1]] = "";
    }
    return skel;
}

// Determine workspaces
let workspaces = readJSON('/package.json').workspaces || [];
workspaces.push('node_modules/qwc2');

// Generate workspace translations
for(let workspace of workspaces) {
    console.log("Generating translations for " + workspace);
    let config = readJSON('/' + workspace + '/translations/tsconfig.json');
    let strings = config.strings || [];
    let skel = createSkel(strings);

    for(let lang of config.languages || []) {
        let langskel = merge(skel, {"locale": lang});

        // Merge translations
        let data = merge(langskel, cleanMessages(readJSON('/' + workspace + '/translations/data.' + lang), langskel));
        // Write updated translations file
        try {
            fs.writeFileSync(process.cwd() + '/' + workspace + '/translations/data.' + lang, JSON.stringify(data, null, 2) + "\n");
            console.log('Wrote ' + workspace + '/translations/data.' + lang);
        } catch(e) {
            console.error('Failed to write ' + workspace + '/translations/data.' + lang + ': ' + e);
        }
    }
}

// Generate application translations
let config = readJSON('/translations/tsconfig.json');
let strings = config.strings || [];
let skel = createSkel(strings);
for(let lang of config.languages || []) {
    let langskel = merge(skel, {"locale": lang});

    let origData = readJSON('/translations/data.' + lang);
    let data = merge(langskel, cleanMessages(readJSON('/translations/data.' + lang), langskel));

    // Merge translations from workspaces
    for(let workspace of workspaces) {
        data = merge(data, readJSON('/' + workspace + '/translations/data.' + lang));
    }

    // Revert to original values for strings specified in overrides
    for(let path of config.overrides || []) {
        let value = objectPath.get(origData.messages, path);
        if(value !== undefined) {
            objectPath.set(data.messages, path, value);
        }
    }

    // Write output
    try {
        fs.writeFileSync(process.cwd() + '/translations/data.' + lang, JSON.stringify(data, null, 2) + "\n");
        console.log('Wrote translations/data.' + lang);
    } catch(e) {
        console.error('Failed to write translations/data.' + lang + ': ' + e);
    }
}
