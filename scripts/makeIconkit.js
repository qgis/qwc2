#!/usr/bin/env node

const webfontsGenerator = require('@furkot/webfonts-generator');
const fs = require('fs');
const glob = require('glob');
const mkdirp = require('mkdirp');
const path = require('path');

const readJSON = (filename) => {
    try {
        return JSON.parse(fs.readFileSync(process.cwd() + filename, "utf8"));
    } catch {
        return {};
    }
};

// Determine workspaces / dependencies
const packageJson = readJSON('/package.json');
const workspaces = packageJson.workspaces || [];
const qwcDeps = Object.keys(packageJson.dependencies ?? {qwc2: "0"}).filter(dep => dep.startsWith("qwc"));

let icons = [];
for (const workspace of workspaces) {
    icons = icons.concat(glob.sync(workspace + "/icons/*.svg"));
}
for (const qwcDep of qwcDeps) {
    icons = icons.concat(glob.sync('node_modules/' + qwcDep + '/icons/*.svg'));
}
icons = icons.concat(glob.sync("icons/*.svg"));

// Filter duplicate icons (user icons can override submodule icons, hence reverse)
icons.reverse();
const uniqueIcons = new Set();
icons = icons.filter(icon => {
    const iconName = path.basename(icon);
    if (uniqueIcons.has(iconName)) {
        // eslint-disable-next-line
        console.log("* " + icon + " was overriden");
        return false;
    }
    uniqueIcons.add(iconName);
    return true;
});

mkdirp.sync('icons/build');

webfontsGenerator({
    files: icons,
    dest: 'icons/build',
    fontName: 'qwc2-icons',
    templateOptions: {
        classPrefix: 'icon-',
        baseSelector: '.icon'
    },
    types: ['woff'],
    fontHeight: 1000
}, (error) => {
    if (error) {
        // eslint-disable-next-line
        console.log('Fail!', error);
    } else {
        // eslint-disable-next-line
        console.log('Done!');
    }
});
