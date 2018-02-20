/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs');
const merge = require('deepmerge');

const readJSON = (path) => JSON.parse(fs.readFileSync(process.cwd() + path, "utf8"));
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

let commonConfig = readJSON('/qwc2/translations/tsconfig.json');
let applicationConfig = readJSON('/translations/tsconfig.json');

let strings = merge(commonConfig.strings || [], applicationConfig.strings || []);

let langs = applicationConfig.languages || [];

// Create skeleton
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

for(let lang of langs) {
  let langskel = merge(skel, {"locale": lang});

  // Merge common translations
  let data = merge(langskel, cleanMessages(readJSON('/qwc2/translations/data.' + lang), langskel));
  // Write updated common translations file
  try {
    fs.writeFileSync(process.cwd() + '/qwc2/translations/data.' + lang, JSON.stringify(data, null, 2) + "\n");
    console.error('Wrote qwc2/translations/data.' + lang);
  } catch(e) {
    console.error('Failed to write common translation data.' + lang + ': ' + e);
  }

  // Merge application translations
  data = merge(data, cleanMessages(readJSON('/translations/data.' + lang)));
  // Write output
  try {
    fs.writeFileSync(process.cwd() + '/translations/data.' + lang, JSON.stringify(data, null, 2) + "\n");
    console.error('Wrote translations/data.' + lang);
  } catch(e) {
    console.error('Failed to write application translation data.' + lang + ': ' + e);
  }
}
