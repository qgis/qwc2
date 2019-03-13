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

let commonConfig = readJSON('/qwc2/translations/tsconfig.json');
let applicationConfig = readJSON('/translations/tsconfig.json');

let commonStrings = commonConfig.strings || [];
let applicationStrings = merge(commonStrings, applicationConfig.strings || []);

let langs = commonConfig.languages || [];

// Create skeletons
let commonSkel = createSkel(commonStrings);
let applicationSkel = createSkel(applicationStrings);


for(let lang of langs) {
    let langskel = merge(commonSkel, {"locale": lang});

    // Merge common translations
    let data = merge(langskel, cleanMessages(readJSON('/qwc2/translations/data.' + lang), langskel));
    // Write updated common translations file
    try {
        fs.writeFileSync(process.cwd() + '/qwc2/translations/data.' + lang, JSON.stringify(data, null, 2) + "\n");
        console.log('Wrote qwc2/translations/data.' + lang);
    } catch(e) {
        console.error('Failed to write common translation data.' + lang + ': ' + e);
    }

    // Merge application translations
    if(!(applicationConfig.languages || []).includes(lang)) {
        continue;
    }

    let origAppdata = cleanMessages(merge(applicationSkel, cleanMessages(readJSON('/translations/data.' + lang))), );
    let appdata = merge(origAppdata, cleanMessages(data));
    // Merge app skel again so that empty strings stay visible
    appdata = merge(applicationSkel, appdata);
    // Revert to original values for strings specified in overrides
    if(applicationConfig.overrides) {
        for(let path of applicationConfig.overrides) {
            let value = objectPath.get(origAppdata.messages, path);
            if(value) {
                objectPath.set(appdata.messages, path, value);
            }
        }
    }
    // Write output
    try {
        fs.writeFileSync(process.cwd() + '/translations/data.' + lang, JSON.stringify(appdata, null, 2) + "\n");
        console.log('Wrote translations/data.' + lang);
    } catch(e) {
        console.error('Failed to write application translation data.' + lang + ': ' + e);
    }
}
