/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import editingReducer from '../reducers/editing';
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

export function getFeatureTemplate(editConfig, feature) {
    if (editConfig.editDataset in FeatureTemplateFactories) {
        feature = FeatureTemplateFactories[editConfig.editDataset](feature);
    }
    // Apply default values
    editConfig.fields.forEach(field => {
        if (field.defaultValue) {
            feature.properties = {
                ...feature.properties,
                [field.id]: field.defaultValue
            };
        }
    });

    return feature;
}
