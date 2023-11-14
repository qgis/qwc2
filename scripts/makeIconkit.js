const webfontsGenerator = require('@furkot/webfonts-generator');
const glob = require('glob');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');

const readJSON = (filename) => {
    try {
        return JSON.parse(fs.readFileSync(process.cwd() + filename, "utf8"));
    } catch (e) {
        return {};
    }
};

const workspaces = readJSON('/package.json').workspaces || [];

let icons = [];
for (const workspace of workspaces) {
    icons = icons.concat(glob.sync(workspace + "/icons/*.svg"));
}
icons = icons.concat(glob.sync("icons/*.svg"));

// Filter duplicate icons (user icons can override submodule icons, hence reverse)
icons.reverse();
const uniqueIcons = new Set();
icons = icons.filter(icon => {
    const iconName = path.basename(icon);
    if (uniqueIcons.has(iconName)) {
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
        console.log('Fail!', error);
    } else {
        console.log('Done!');
    }
});
