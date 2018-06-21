#!/bin/bash
set -e

if [ "$1" == "build" ]; then
    npm run clean
    npm run iconfont
    mkdir -p ./dist
    NODE_ENV='production' webpack
    exit 0
fi
if [ "$1" == "prod" ]; then
    if [ -f config.prod.json ]; then
      config="config.prod.json"
    else
      config="config.json"
    fi
    npm run build
    npm run themesconfig
    rm -rf prod/*
    mkdir -p ./prod/translations
    cp -a ./dist ./index.html ./assets ./themes.json ./prod
    cp -a  $config ./prod/config.json
    cp -a ./translations/data.* ./prod/translations
    exit $?
fi
if [ "$1" == "analyze" ]; then
    NODE_ENV='production' webpack --json | webpack-bundle-size-analyzer
    exit 0
fi
if [ "$1" == "release" ]; then
    name=$(grep -oP '"name":\s*"\K(.*)(?=")' package.json)
    version=$(grep -oP '"version":\s*"\K(.*)(?=")' package.json)
    rm -f ${name}-${version}_appbundle.zip ${name}-${version}_source.zip

    npm run prod
    ln -s prod ${name}-${version}_appbundle
    zip -r ${name}-${version}_appbundle.zip ${name}-${version}_appbundle
    rm ${name}-${version}_appbundle

    (
    git ls-files
    git submodule foreach --recursive --quiet 'git ls-files --with-tree="$sha1" | sed "s|^|$toplevel/$path/|"' | sed "s|^$PWD/||g"
    ) | grep -v '.gitignore' | grep -v '.gitmodules' | zip -@ ${name}-${version}_source.zip

    exit 0
fi
echo "Missing or unrecognized command"
exit 1
