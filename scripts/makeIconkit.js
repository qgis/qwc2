const webfontsGenerator = require('webfonts-generator');
const glob = require('glob');
const mkdirp = require('mkdirp');

mkdirp.sync('icons/build');

webfontsGenerator({
  files: glob.sync("icons/*.svg"),
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
