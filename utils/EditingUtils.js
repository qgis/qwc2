/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import nearley from 'nearley';
import {v5 as uuidv5} from 'uuid';

import StandardApp from '../components/StandardApp';
import ConfigUtils from './ConfigUtils';
import LocaleUtils from './LocaleUtils';
import grammar from './expr_grammar/grammar';

const UUID_NS = '5ae5531d-8e21-4456-b45d-77e9840a5bb7';

export class FeatureCache {
    static store = {};
    static requestPromises = {};
    static get = (editIface, layerName, mapCrs, filterExpr) => {
        const key = layerName +  uuidv5(JSON.stringify(filterExpr ?? null), UUID_NS);
        if (key in this.store) {
            return new Promise(resolve => resolve(this.store[key]));
        } else if (key in this.requestPromises) {
            return this.requestPromises[key];
        } else {
            this.requestPromises[key] = new Promise(resolve => {
                const editConfig = StandardApp.store.getState().theme.current.editConfig?.[layerName] ?? {};
                editIface.getFeatures(editConfig, mapCrs, (result) => {
                    if (key in this.requestPromises) {
                        if ((result?.features || []).length === 1) {
                            this.store[key] = result.features[0];
                        } else {
                            this.store[key] = null;
                        }
                        if (key in this.requestPromises) {
                            resolve(this.store[key]);
                            delete this.requestPromises[key];
                        }
                    } else {
                        resolve(null);
                    }
                }, null, filterExpr);
            });
            return this.requestPromises[key];
        }
    };
    static getSync = (editIface, layerName, mapCrs, filterExpr, promises = []) => {
        const key = layerName +  uuidv5(JSON.stringify(filterExpr ?? null), UUID_NS);
        if (key in this.store) {
            return this.store[key];
        } else {
            promises.push(this.get(editIface, layerName, mapCrs, filterExpr));
            return null;
        }
    };
    static clear = () => {
        this.store = {};
        this.requests = new Set();
    };
}

export class KeyValCache {
    static store = {};
    static requestPromises = {};
    static get = (editIface, keyvalrel, filterExpr) => {
        const key = keyvalrel +  uuidv5(JSON.stringify(filterExpr ?? null), UUID_NS);
        if (key in this.store) {
            return new Promise(resolve => resolve(this.store[key]));
        } else if (key in this.requestPromises) {
            return this.requestPromises[key];
        } else {
            this.requestPromises[key] = new Promise(resolve => {
                editIface.getKeyValues(keyvalrel, (result) => {
                    if (key in this.requestPromises) {
                        const dataSet = keyvalrel.split(":")[0];
                        if (result.keyvalues && result.keyvalues[dataSet]) {
                            const values = result.keyvalues[dataSet].map(entry => ({
                                value: entry.key, label: entry.value
                            }));
                            this.store[key] = values;
                        } else {
                            this.store[key] = [];
                        }
                        resolve(this.store[key]);
                        delete this.requestPromises[key];
                    } else {
                        resolve([]);
                    }
                }, filterExpr ? [filterExpr] : null);
            });
            return this.requestPromises[key];
        }
    };
    static getSync = (editIface, keyvalrel, filterExpr, promises = []) => {
        const key = keyvalrel +  uuidv5(JSON.stringify(filterExpr ?? null), UUID_NS);
        if (key in this.store) {
            return this.store[key];
        } else {
            promises.push(this.get(editIface, keyvalrel, filterExpr));
            return [];
        }
    };
    static clear = () => {
        this.store = {};
        this.requestPromises = {};
    };
}


export function parseExpression(expr, feature, editConfig, editIface, mapPrefix, mapCrs, reevaluateCallback, asFilter = false, reevaluate = false) {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    const promises = [];

    window.qwc2ExpressionParserContext = {
        feature: feature,
        getFeature: (layerName, attr, value) => FeatureCache.getSync(editIface, layerName, mapCrs, [[attr, '=', value]], promises),
        asFilter: asFilter,
        username: ConfigUtils.getConfigProp("username"),
        layer: editConfig.layerName,
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
        Promise.all(promises).then(() => parseExpression(expr, feature, editConfig, editIface, mapPrefix, mapCrs, reevaluateCallback, asFilter, true));
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

export function parseExpressionsAsync(expressions, feature, editConfig, editIface, mapPrefix, mapCrs, asFilter) {
    const promises = [];
    return new Promise((resolve) => {
        window.qwc2ExpressionParserContext = {
            feature: feature,
            getFeature: (layerName, attr, value) => FeatureCache.getSync(editIface, layerName, mapCrs, [[attr, '=', value]], promises),
            asFilter: asFilter,
            username: ConfigUtils.getConfigProp("username"),
            layer: editConfig.layerName,
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
            Promise.all(promises).then(() => {
                parseExpressionsAsync(expressions, feature, editConfig, editIface, mapPrefix, mapCrs, asFilter).then(results2 => resolve(results2));
            });
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
    FeatureCache.clear();
    parseExpressionsAsync(defaultFieldExpressions, feature, editConfig, editIface, mapPrefix, mapCrs).then(result => {
        // Adjust values based on field type
        editConfig.fields.forEach(field => {
            if (field.id in result && field.type === "date") {
                result[field.id] = result[field.id].split("T")[0];
            }
        });
        callback({...feature, properties: {...feature.properties, ...result}});
    });
}

export function computeExpressionFields(editConfig, feature, editIface, mapCrs, callback) {
    // Apply default values
    const fieldExpressions = editConfig.fields.reduce((res, field) => {
        if (field.expression) {
            return {...res, [field.id]: field.expression};
        }
        return res;
    }, {});
    FeatureCache.clear();
    const mapPrefix = (editConfig.editDataset.match(/^[^.]+\./) || [""])[0];
    parseExpressionsAsync(fieldExpressions, feature, editConfig, editIface, mapPrefix, mapCrs).then(result => {
        // Adjust values based on field type
        editConfig.fields.forEach(field => {
            if (field.id in result && field.type === "date") {
                result[field.id] = result[field.id].split("T")[0];
            }
        });
        callback({...feature, properties: {...feature.properties, ...result}});
    });
}
