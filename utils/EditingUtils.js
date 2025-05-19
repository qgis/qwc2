/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import nearley from 'nearley';

import ConfigUtils from './ConfigUtils';
import LocaleUtils from './LocaleUtils';
import grammar from './expr_grammar/grammar';


export class ExpressionFeatureCache {
    static store = {};
    static requests = new Set();
    static get = (editIface, dataset, mapCrs, attr, value, promises) => {
        const key = dataset + ":" + attr + ":" + value;
        if (key in this.store) {
            return this.store[key];
        } else if (!this.requests.has(key)) {
            this.requests.add(key);
            promises.push(new Promise((accept) => {
                editIface.getFeatures(dataset, mapCrs, (result) => {
                    if (this.requests.has(key)) {
                        if ((result?.features || []).length === 1) {
                            this.store[key] = result.features[0];
                        } else {
                            this.store[key] = null;
                        }
                        this.requests.delete(key);
                    }
                    accept();
                }, null, [[attr, '=', value]]);
            }));
        }
        return null;
    };
    static clear = () => {
        this.store = {};
        this.requests = new Set();
    };
}

export function parseExpression(expr, feature, dataset, editIface, mapPrefix, mapCrs, reevaluateCallback, asFilter = false, reevaluate = false) {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    const promises = [];

    window.qwc2ExpressionParserContext = {
        feature: feature,
        getFeature: (layerName, attr, value) => ExpressionFeatureCache.get(editIface, mapPrefix + layerName, mapCrs, attr, value, promises),
        asFilter: asFilter,
        username: ConfigUtils.getConfigProp("username"),
        layer: dataset.startsWith(mapPrefix) ? dataset.substr(mapPrefix.length) : dataset,
        projection: mapCrs,
        mapPrefix: mapPrefix,
        lang: LocaleUtils.lang()
    };
    let result = null;
    try {
        parser.feed(expr.replace(/\n/, ' '));
        result = parser.results[0];
    } catch (e) {
        /* eslint-disable-next-line */
        console.warn("Failed to evaluate expression " + expr.replace(/\n/, ' '));
    }
    delete window.qwc2ExpressionParserContext;
    if (promises.length > 0) {
        // Expression evaluation is incomplete due to pending feature requests, reevaluate when promises are resolved
        Promise.all(promises).then(() => parseExpression(expr, feature, dataset, editIface, mapPrefix, mapCrs, reevaluateCallback, asFilter, true));
        return null;
    } else {
        if (reevaluate) {
            reevaluateCallback();
        }
        if (asFilter) {
            result = [result];
        }
        return result;
    }
}

export function parseExpressionsAsync(expressions, feature, dataset, editIface, mapPrefix, mapCrs, asFilter) {
    const promises = [];
    return new Promise((resolve) => {
        window.qwc2ExpressionParserContext = {
            feature: feature,
            getFeature: (layerName, attr, value) => ExpressionFeatureCache.get(editIface, mapPrefix + layerName, mapCrs, attr, value, promises),
            asFilter: asFilter,
            username: ConfigUtils.getConfigProp("username"),
            layer: dataset.startsWith(mapPrefix) ? dataset.substr(mapPrefix.length) : dataset,
            projection: mapCrs,
            mapPrefix: mapPrefix,
            lang: LocaleUtils.lang()
        };
        const results = Object.entries(expressions).reduce((res, [key, expr]) => {
            const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
            try {
                parser.feed(expr.replace(/\n/, ' '));
                return {...res, [key]: parser.results[0]};
            } catch (e) {
                /* eslint-disable-next-line */
                console.warn("Failed to evaluate expression " + expr.replace(/\n/, ' '));
                return res;
            }
        }, {});
        delete window.qwc2ExpressionParserContext;
        if (promises.length > 0) {
            // Expression evaluation is incomplete due to pending feature requests, reevaluate when promises are resolved
            Promise.all(promises).then(parseExpressionsAsync(expressions, feature, dataset, editIface, mapPrefix, mapCrs, asFilter).then(resolve(results)));
        } else {
            resolve(results);
        }
    });
}


const FeatureTemplateFactories = {};

export function setFeatureTemplateFactory(dataset, factory) {
    FeatureTemplateFactories[dataset] = factory;
}

export function getFeatureTemplate(editConfig, feature, editIface, mapPrefix, mapCrs, callback) {
    if (editConfig.editDataset in FeatureTemplateFactories) {
        feature = FeatureTemplateFactories[editConfig.editDataset](feature);
    }
    // Apply default values
    const defaultFieldExpressions = editConfig.fields.reduce((res, field) => {
        if (field.defaultValue) {
            return {...res, [field.id]: field.defaultValue.replace(/^expr:/, '')};
        }
        return res;
    }, {});
    ExpressionFeatureCache.clear();
    parseExpressionsAsync(defaultFieldExpressions, feature, editConfig.editDataset, editIface, mapPrefix, mapCrs).then(result => {
        // Adjust values based on field type
        editConfig.fields.forEach(field => {
            if (field.id in result && field.type === "date") {
                result[field.id] = result[field.id].split("T")[0];
            }
        });
        callback({...feature, properties: {...feature.properties, ...result}});
    });
}
