const webfontsGenerator = require('webfonts-generator');
const glob = require('glob');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');

const readJSON = (path) => {
    try {
        return JSON.parse(fs.readFileSync(process.cwd() + path, "utf8"));
    } catch(e) {
        return {}
    }
}

let workspaces = readJSON('/package.json').workspaces || [];

let icons = glob.sync(path.join(__dirname, '..', "icons/*.svg"));
for(let workspace of workspaces) {
    icons = icons.concat(glob.sync(workspace + "/icons/*.svg"));
}
icons = icons.concat(glob.sync("icons/*.svg"));

// Filter duplicate icons (user icons can override submodule icons, hence reverse)
icons.reverse();
let uniqueIcons = new Set();
icons = icons.filter(icon => {
   let iconName = path.basename(icon);
   if(uniqueIcons.has(iconName)) {
       console.log("* " + icon + " was overridden");
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

}, function(error) {
  if (error) {
    console.log('Fail!', error);
  } else {
    console.log('Done!');
  }
})
