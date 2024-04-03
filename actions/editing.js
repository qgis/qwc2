/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import editingReducer from '../reducers/editing';
import ReducerIndex from '../reducers/index';
import {ExpressionFeatureCache, parseExpressionsAsync} from '../utils/ExpressionParser';
ReducerIndex.register("editing", editingReducer);

export const SET_EDIT_CONTEXT = 'SET_EDIT_CONTEXT';
export const CLEAR_EDIT_CONTEXT = 'CLEAR_EDIT_CONTEXT';

export function setEditContext(contextId, editContext) {
    return {
        type: SET_EDIT_CONTEXT,
        contextId: contextId,
        editContext: editContext
    };
}

export function clearEditContext(contextId, newActiveContextId = null) {
    return {
        type: CLEAR_EDIT_CONTEXT,
        contextId: contextId,
        newActiveContextId: newActiveContextId
    };
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
    parseExpressionsAsync(defaultFieldExpressions, feature, editIface, mapPrefix, mapCrs).then(result => {
        // Adjust values based on field type
        editConfig.fields.forEach(field => {
            if (field.id in result && field.type === "date") {
                result[field.id] = result[field.id].split("T")[0];
            }
        });
        callback({...feature, properties: {...feature.properties, ...result}});
    });
}
