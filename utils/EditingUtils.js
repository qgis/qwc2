/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import nearley from 'nearley';
import toposort from 'toposort';
import {v5 as uuidv5} from 'uuid';

import ConfigUtils from './ConfigUtils';
import LocaleUtils from './LocaleUtils';
import MiscUtils from './MiscUtils';
import grammar from './expr_grammar/grammar';

const UUID_NS = '5ae5531d-8e21-4456-b45d-77e9840a5bb7';

export class FeatureCache {
    static store = {};
    static requestPromises = {};
    static get = (editIface, layerName, editConfig, mapCrs, filterExpr) => {
        const key = layerName +  uuidv5(JSON.stringify(filterExpr ?? null), UUID_NS);
        if (key in this.store) {
            return new Promise(resolve => resolve(this.store[key]));
        } else if (key in this.requestPromises) {
            return this.requestPromises[key];
        } else {
            this.requestPromises[key] = new Promise(resolve => {
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
    static getSync = (editIface, layerName, editConfig, mapCrs, filterExpr, promises = []) => {
        const key = layerName +  uuidv5(JSON.stringify(filterExpr ?? null), UUID_NS);
        if (key in this.store) {
            return this.store[key];
        } else {
            promises.push(this.get(editIface, layerName, editConfig, mapCrs, filterExpr));
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


function representValue(attr, editConfig, editIface, promises) {
    // Resolve kvrel
    const field = (editConfig.fields || []).find(f => f.id === attr);
    const value = window.qwc2ExpressionParserContext.feature?.properties?.[attr];
    const keyvalrel = field?.constraints?.keyvalrel;
    if (!keyvalrel) {
        return value;
    }
    const keyvals = KeyValCache.getSync(editIface, keyvalrel, null, promises).reduce((res, entry) => (
        {...res, [entry.value]: entry.label}
    ), {});
    if (field.constraints.allowMulti) {
        return '{' + [...new Set(JSON.parse('[' + value.slice(1, -1) + ']'))].map(x => keyvals[x] ?? x).join(", ") + '}';
    } else {
        return keyvals[value] ?? value;
    }
}

export function parseExpression(expr, feature, editConfig, editConfigs, editIface, mapPrefix, mapCrs, reevaluateCallback, asFilter = false, reevaluate = false) {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    const promises = [];

    window.qwc2ExpressionParserContext = {
        feature: feature,
        getFeature: (layerName, attr, value) => FeatureCache.getSync(editIface, layerName, editConfigs[layerName] ?? {}, mapCrs, [[attr, '=', value]], promises),
        representValue: (attr) => representValue(attr, editConfig, editIface, promises),
        formatDate: MiscUtils.formatDate,
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

export function parseExpressionsAsync(fieldExpressions, feature, editConfig, editConfigs, editIface, mapPrefix, mapCrs, asFilter) {
    const promises = [];
    return new Promise((resolve) => {
        const newfeature = {...feature, properties: {...feature.properties}};
        window.qwc2ExpressionParserContext = {
            feature: newfeature,
            getFeature: (layerName, attr, value) => FeatureCache.getSync(editIface, layerName, editConfigs[layerName] ?? {}, mapCrs, [[attr, '=', value]], promises),
            representValue: (attr) => representValue(attr, editConfig, editIface, promises),
            asFilter: asFilter,
            username: ConfigUtils.getConfigProp("username"),
            layer: editConfig.layerName,
            projection: mapCrs,
            mapPrefix: mapPrefix,
            lang: LocaleUtils.lang()
        };
        const results = fieldExpressions.reduce((res, {field, expression}) => {
            const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
            try {
                parser.feed(expression.replace(/\n/, ' '));
                // NOTE: include intermediate results in next context feature
                newfeature.properties[field] = parser.results[0];
                return {...res, [field]: parser.results[0]};
            } catch (e) {
                /* eslint-disable-next-line */
                console.warn("Failed to evaluate expression " + expression.replace(/\n/, ' '));
                return res;
            }
        }, {});
        delete window.qwc2ExpressionParserContext;
        if (promises.length > 0) {
            // Expression evaluation is incomplete due to pending feature requests, reevaluate when promises are resolved
            Promise.all(promises).then(() => {
                parseExpressionsAsync(fieldExpressions, newfeature, editConfig, editIface, mapPrefix, mapCrs, asFilter).then(results2 => resolve(results2));
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
        if (field.defaultValue && !(field.id in feature.properties)) {
            return [...res, {field: field.id, expression: field.defaultValue.replace(/^expr:/, '')}];
        }
        return res;
    }, []);
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
    // Collect field expressions and dependencies
    const dependencies = {};
    let fieldExpressions = editConfig.fields.reduce((res, field) => {
        if (field.expression) {
            const matches = [...field.expression.matchAll(/"([^"]+)"/g)].map(m => m[1]);
            dependencies[field.id] = [...new Set(matches)];
            return {...res, [field.id]: field.expression};
        }
        return res;
    }, {});
    // Topologically sort expressions so that fields depending on other fields are evaluated later
    const edges = [];
    const roots = [];
    Object.entries(dependencies).forEach(([parent, children]) => {
        if (children.length > 0) {
            children.forEach(child => edges.push([child, parent]));
        } else {
            roots.push(parent);
        }
    });
    try {
        const sortededges = toposort(edges);
        fieldExpressions = roots.concat(sortededges).reduce((res, field) => {
            if (field in fieldExpressions) {
                return [...res, {field, expression: fieldExpressions[field]}];
            } else {
                return res;
            }
        }, []);
    } catch (e) {
        /* eslint-disable-next-line */
        console.warn("Failed to sort expressions, they probably contain cyclic dependencies");
        fieldExpressions = Object.entries(fieldExpressions).map(([field, expression]) => (
            {field, expression}
        ), {});
    }
    // Evaluate expressions
    FeatureCache.clear();
    const mapPrefix = (editConfig.editDataset.match(/^[^.]+\./) || [""])[0];
    parseExpressionsAsync(fieldExpressions, feature, editConfig, editIface, mapPrefix, mapCrs).then(result => {
        // Adjust values based on field type
        editConfig.fields.forEach(field => {
            if (field.constraints?.hidden) {
                // Remove hidden fields from result
                delete result[field.id];
            } else if (field.id in result && field.type === "date") {
                result[field.id] = result[field.id].split("T")[0];
            }
        });
        callback({...feature, properties: {...feature.properties, ...result}});
    });
}
