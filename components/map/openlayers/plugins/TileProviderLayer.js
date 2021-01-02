/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assign from 'object-assign';
import ol from 'openlayers';
import TileProvider from '../../../../utils/TileConfigProvider';
import CoordinatesUtils from '../../../../utils/CoordinatesUtils';

function template(str, data) {
    return str.replace(/(?!(\{?[zyx]?\}))\{*([\w_]+)*\}/g, function() {
        const st = arguments[0];
        const key = arguments[1] ? arguments[1] : arguments[2];
        let value = data[key];

        if (value === undefined) {
            throw new Error('No value provided for variable ' + st);

        } else if (typeof value === 'function') {
            value = value(data);
        }
        return value;
    });
}

function getUrls(opt) {
    const urls = [];
    const url = opt.url;
    if (opt.subdomains) {
        for (const c of opt.subdomains) {
            urls.push(template(url.replace("{s}", c), opt));
        }
    } else {
        for (const c of 'abc') {
            urls.push(template(url.replace("{s}", c), opt));
        }
    }
    return urls;
}

function lBoundsToOlExtent(bounds, destPrj) {
    const [ [ miny, minx], [ maxy, maxx ] ] = bounds;
    return CoordinatesUtils.reprojectBbox([minx, miny, maxx, maxy], 'EPSG:4326', destPrj);
}

function tileXYZToOpenlayersOptions(options) {
    const urls = (options.url.match(/(\{s\})/)) ? getUrls(options) : [template(options.url, options)];
    const sourceOpt = assign({}, {
        urls: urls,
        attributions: (options.attribution) ? [new ol.Attribution({ html: options.attribution})] : [],
        maxZoom: (options.maxZoom) ? options.maxZoom : 18,
        minZoom: (options.minZoom) ? options.minZoom : 0 // dosen't affect ol layer rendering UNSUPPORTED
    });
    const source = new ol.source.XYZ(sourceOpt);
    const olOpt = assign({source: source}, (options.bounds) ? {extent: lBoundsToOlExtent(options.bounds, options.projection)} : {});
    return olOpt;
}

export default {
    create: (options) => {
        const [url, opt] = TileProvider.getLayerConfig(options.provider, options);
        opt.url = url;
        return new ol.layer.Tile(tileXYZToOpenlayersOptions(opt));
    }
};
