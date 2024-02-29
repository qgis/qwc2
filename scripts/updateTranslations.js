/**
 * Copyright 2017-2024 Sourcepole AG
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

const listDir = (dir, pattern) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        const path = dir + '/' + file;
        const stat = fs.statSync(path);
        if (stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(listDir(path, pattern));
        } else if (pattern.exec(file)) {
            /* Is a file */
            results.push(path);
        }
    });
    return results;
};

const updateTsConfig = (topdir, tsconfig, collectedMsgIds = null) => {
    const files = listDir(topdir, new RegExp("^.*\.jsx?$"));
    const trRegEx = /LocaleUtils\.tr(?:msg)?\((['\"])([A-Za-z0-9\._]+)\1/g;
    const msgIds =  new Set();
    for (const file of files) {
        const data = fs.readFileSync(file).toString();
        for (const match of data.matchAll(trRegEx)) {
            if ((!collectedMsgIds || !collectedMsgIds.has(match[2])) && !match[2].endsWith(".")) {
                msgIds.add(match[2]);
            }
        }
    }
    const msgIdList = Array.from(msgIds);
    msgIdList.sort();

    const json = readJSON(tsconfig);
    json.strings = msgIdList;
    fs.writeFileSync(process.cwd() + '/' + tsconfig, JSON.stringify(json, null, 2) + "\n");
    return msgIds;
};

// Determine workspaces
const workspaces = readJSON('/package.json').workspaces || [];

// Generate workspace translations
let collectedMsgIds = new Set();
for (const workspace of workspaces) {
    /* eslint-disable-next-line */
    console.log("Generating translations for " + workspace);
    const newMsgIds = updateTsConfig(process.cwd() + '/' + workspace, '/' + workspace + '/translations/tsconfig.json');
    collectedMsgIds = new Set([...collectedMsgIds, ...newMsgIds]);
    const config = readJSON('/' + workspace + '/translations/tsconfig.json');
    const strings = [
        ...(config.strings || []),
        ...(config.extra_strings || [])
    ];
    const skel = createSkel(strings);

    for (const lang of config.languages || []) {
        const langskel = merge(skel, {locale: lang});

        // Merge translations
        const data = merge(langskel, cleanMessages(readJSON('/' + workspace + '/translations/' + lang + '.json'), langskel));
        // Write updated translations file
        try {
            fs.writeFileSync(process.cwd() + '/' + workspace + '/translations/' + lang + ".json", JSON.stringify(data, null, 2) + "\n");
            /* eslint-disable-next-line */
            console.log('Wrote ' + workspace + '/translations/' + lang + '.json');
        } catch (e) {
            /* eslint-disable-next-line */
            console.error('Failed to write ' + workspace + '/translations/' + lang + '.json: ' + e);
        }
    }
}

// Generate application translations
updateTsConfig(process.cwd() + '/js', '/static/translations/tsconfig.json', collectedMsgIds);
const config = readJSON('/static/translations/tsconfig.json');
const strings = [
    ...(config.strings || []),
    ...(config.extra_strings || [])
];
const skel = createSkel(strings);
for (const lang of config.languages || []) {
    const langskel = merge(skel, {locale: lang});

    const origData = readJSON('/static/translations/' + lang + '.json');
    let data = merge(langskel, cleanMessages(readJSON('/static/translations/' + lang + '.json'), langskel));

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
        fs.writeFileSync(process.cwd() + '/static/translations/' + lang + '.json', JSON.stringify(data, null, 2) + "\n");
        /* eslint-disable-next-line */
        console.log('Wrote static/translations/' + lang + '.json');
    } catch (e) {
        /* eslint-disable-next-line */
        console.error('Failed to write static/translations/' + lang + '.json: ' + e);
    }
}
