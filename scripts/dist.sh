#/bin/bash

rm -rf dist
for dir in actions components libs plugins reducers scripts selectors stores utils;
do
mkdir -p dist/$dir
npx babel $dir --copy-files --out-dir dist/$dir --extensions ".js,.jsx" --minified
done
mkdir -p dist/static/translations
mkdir -p dist/icons
cp -a icons/*.svg dist/icons/
cp -a static/translations/*.json dist/static/translations/
cp -a package.json dist/
cp -a LICENSE dist/
cp -a README_npm.md dist/README.md

if [[ $(git rev-parse --abbrev-ref HEAD) == *-lts ]]; then
  sed -Ei 's|"name":\s*"qwc2",|"name": "qwc2-lts",|' dist/package.json
  sed -Ei 's|"version":\s*"([0-9]+\.[0-9]+\.[0-9]+)-lts",|"version": "\1",|' dist/package.json
fi

echo "Ready to publish!"
echo "Run publish in the dist folder to publish the package."
