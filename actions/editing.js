/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import editingReducer from '../reducers/editing';
import ReducerIndex from '../reducers/index';
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

function evaluateDefaultValue(field) {
    if (field.defaultValue.startsWith("expr:")) {
        const expr = field.defaultValue.slice(5);
        if (expr === "now()") {
            if (field.type === "date") {
                return (new Date()).toISOString().split("T")[0];
            } else {
                return (new Date()).toISOString();
            }
        } else if (expr === "true") {
            return true;
        } else if (expr === "false") {
            return false;
        }
        return "";
    } else {
        return field.defaultValue;
    }
}

export function getFeatureTemplate(editConfig, feature) {
    if (editConfig.editDataset in FeatureTemplateFactories) {
        feature = FeatureTemplateFactories[editConfig.editDataset](feature);
    }
    // Apply default values
    editConfig.fields.forEach(field => {
        if (field.defaultValue) {
            feature.properties = {
                ...feature.properties,
                [field.id]: evaluateDefaultValue(field)
            };
        }
    });

    return feature;
}
