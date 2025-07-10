#!/usr/bin/env node

/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const fs = require("fs");
const path = require("path");
const reactDocs = require("react-docgen");

const qwcPluginDir = __dirname + '/../plugins';
let pluginData = [];

fs.readdirSync(qwcPluginDir).forEach(entry => {
    if (entry.endsWith(".jsx")) {
        const file = path.resolve(qwcPluginDir, entry);
        const contents = fs.readFileSync(file);
        pluginData.push(reactDocs.parse(contents, reactDocs.resolver.findAllComponentDefinitions));
    }
});
fs.readdirSync(qwcPluginDir + "/map").forEach(entry => {
    if (entry.endsWith(".jsx")) {
        const file = path.resolve(qwcPluginDir, "map", entry);
        const contents = fs.readFileSync(file);
        pluginData.push(reactDocs.parse(contents, reactDocs.resolver.findAllComponentDefinitions));
    }
});
pluginData = pluginData.flat();

function parsePropType(type) {
    if (type.name === 'shape') {
        return '{\n' +
                Object.entries(type.value).map(([key, value]) => { return '  ' + key + ": " + parsePropType(value) + ',\n'; }).join('') +
                '}';
    } else if (type.name === 'arrayOf') {
        return '[' + parsePropType(type.value) + "]";
    } else if (type.name === 'union') {
        return '{' + type.value.map(entry => parsePropType(entry)).join(", ") + '}';
    } else {
        return type.name;
    }
}

// Write markdown output
let output = "";
output += "Plugin reference\n";
output += "================\n";
output += "\n";

pluginData.forEach(plugin => {
    if (!plugin.description) {
        return;
    }
    output += `* [${plugin.displayName}](#${plugin.displayName.toLowerCase()})\n`;
});
output += "\n";
output += "---\n";
pluginData.forEach(plugin => {
    if (!plugin.description) {
        return;
    }
    output += `${plugin.displayName}<a name="${plugin.displayName.toLowerCase()}"></a>\n`;
    output += "----------------------------------------------------------------\n";
    output += plugin.description + "\n\n";

    const props = Object.entries(plugin.props || {}).filter(entry => entry[1].description);
    if (props.length > 0) {
        output += "| Property | Type | Description | Default value |\n";
        output += "|----------|------|-------------|---------------|\n";
        props.forEach(([name, prop]) => {
            if (!prop.description) {
                return;
            }
            const defaultValue = prop.defaultValue ? prop.defaultValue.value.split("\n").map(x => '`' + x.replace(' ', ' ') + '`').join("<br />") : "`undefined`";
            const type = "`" + parsePropType(prop.type).replaceAll(' ', ' ').replaceAll("\n", "`<br />`") + "`";
            output += `| ${name} | ${type} | ${prop.description.replaceAll("\n", "<br />")} | ${defaultValue} |\n`;
        });
        output += "\n";
    }

    plugin.methods.forEach(method => {
        if (method.docblock) {
            const params = method.params.map(param => param.name).join(",");
            output += `**${method.name}(${params})**\n\n`;
            output += (method.docblock || "") + "\n";
            output += "\n";
        }
    });
});

fs.writeFileSync(__dirname + '/../doc/plugins.md', output);
/* eslint-disable-next-line */
console.log("Plugin documentation written to doc/plugins.md!");
