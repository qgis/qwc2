/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import StreamableFeatureSource, {wfsBuilder, tiledLoadingStrategy} from '@giro3d/giro3d/sources/StreamableFeatureSource';
import VectorSource from "@giro3d/giro3d/sources/VectorSource.js";
import axios from 'axios';
import {tile} from "ol/loadingstrategy.js";
import {createXYZ} from "ol/tilegrid.js";
import url from 'url';

import CoordinatesUtils from '../../../utils/CoordinatesUtils';
import FeatureStyles from '../../../utils/FeatureStyles';
import {wfsToOpenlayersOptions} from '../../map/layers/WFSLayer';


export default {
    create3d: (options, projection) => {
        const olOpts = wfsToOpenlayersOptions(options);
        const typeName = options.version < "2.0.0" ? "typeName" : "typeNames";
        let srsName = options.projection;
        if (options.version >= "1.1.0") {
            srsName = CoordinatesUtils.toOgcUrnCrs(options.projection);
        }
        const urlParts = url.parse(options.url, true);
        const urlParams = Object.entries(urlParts.query).reduce((res, [key, val]) => ({...res, [key.toUpperCase()]: val}), {});
        delete urlParts.search;
        urlParts.query = {
            ...urlParams,
            SERVICE: 'WFS',
            VERSION: options.version,
            REQUEST: 'GetFeature',
            [typeName]: options.name,
            outputFormat: olOpts.formatName,
            srsName: srsName
        };

        return new ColorLayer({
            name: options.name,
            source: new VectorSource({
                dataProjection: CoordinateSystem.fromSrid(projection),
                data: {
                    url: url.format(urlParts),
                    format: olOpts.format
                },
                style: (feature) => FeatureStyles.default(feature, {
                    fillColor: options.color,
                    strokeColor: feature.getGeometry().getType().endsWith("LineString") ? options.color : "#000",
                    strokeWidth: 1,
                    strokeDash: [],
                    circleRadius: 5
                }),
                strategy: tile(createXYZ({ tileSize: 512 }))
            })
        });
    },
    update3d: (layer, newOptions, oldOptions, projection) => {
        // pass
    },
    getFields: (options) => {
        return new Promise((resolve, reject) => {

            const typeName = options.version < "2.0.0" ? "typeName" : "typeNames";
            const urlParts = url.parse(options.url, true);
            const urlParams = Object.entries(urlParts.query).reduce((res, [key, val]) => ({...res, [key.toUpperCase()]: val}), {});
            delete urlParts.search;
            urlParts.query = {
                ...urlParams,
                SERVICE: 'WFS',
                VERSION: options.version,
                REQUEST: 'DescribeFeatureType',
                [typeName]: options.name
            };
            axios.get(url.format(urlParts)).then(response => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.data, "text/xml");
                const elements = [].slice.call(doc.getElementsByTagName("element"));
                const fields = elements.reduce((res, element) => {
                    if (
                        element.attributes.name &&
                        element.attributes.name.value !== "id" &&
                        ["int", "decimal"].includes(element.attributes.type?.value)
                    ) {
                        return [...res, element.attributes.name.value];
                    }
                    return res;
                }, []);
                resolve(fields);
            }).catch((e) => {
                reject([]);
            });
        });
    },
    createFeatureSource: (layer, options, projection) => {
        const bounds = CoordinatesUtils.reprojectBbox(options.bbox.bounds, options.bbox.crs, projection);
        const crs = CoordinateSystem.fromSrid(projection);
        const maxextent = new Extent(crs, bounds[0], bounds[2], bounds[1], bounds[3]);
        return new StreamableFeatureSource({
            queryBuilder: wfsBuilder(
                options.url, options.name
            ),
            sourceCoordinateSystem: crs,
            extent: maxextent,
            loadingStrategy: tiledLoadingStrategy({tileSize: 5000})
        });
    }
};
