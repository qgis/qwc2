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


/**
 * Set current edit context.
 * 
 * The `contextId` is set in the store as the `currentContext` and the
 * `editContext` is saved into the context identified
 * by the `contextId` in the store's `contexts` members.
 * 
 * @param {string} contextId - the ID of this context.
 * @param {object} editContext - the context.
 * @memberof Redux Store.Actions
 */
export function setEditContext(contextId, editContext) {
    return {
        type: SET_EDIT_CONTEXT,
        contextId: contextId,
        editContext: editContext
    };
}


/**
 * Clear current edit context.
 * 
 * The context identified by the `contextId` is removed from the store's
 * `contexts` members and the `newActiveContextId` is set as the new
 * `currentContext` (but only if `contextId` is currently `currentContext`).
 * 
 * @param {string} contextId - the ID of this context.
 * @param {object} newActiveContextId - the context.
 * @memberof Redux Store.Actions
 */
export function clearEditContext(contextId, newActiveContextId = null) {
    return {
        type: CLEAR_EDIT_CONTEXT,
        contextId: contextId,
        newActiveContextId: newActiveContextId
    };
}


// This is where we keep the feature template factories
// for each dataset. It maps dataset names to functions
// that transform a feature in `getFeatureTemplate()`.
const FeatureTemplateFactories = {};

/**
 * @callback FeatureTemplate
 * 
 * The factory function takes a feature as input and
 * returns a feature as output. The feature is then
 * used as the template for the feature form.
 * 
 * @param {object} feature - the input feature
 * @returns {object} the output feature
 */


/**
 * Set the feature template factory for a dataset.
 * 
 * The factory function takes a feature as input and
 * returns a feature as output. The feature is then
 * used as the template for the feature form.
 * 
 * @param {string} dataset - the dataset name.
 * @param {FeatureTemplate} factory - the factory function.
 */
export function setFeatureTemplateFactory(dataset, factory) {
    FeatureTemplateFactories[dataset] = factory;
}

/**
 * Compute a defaukt value for a field.
 * 
 * The default value is evaluated as follows:
 * - if it starts with `expr:` then the rest of the
 *   string is evaluated as follows:
 *   - `expr:now()` returns the current date/time
 *   - `expr:true` returns `true`
 *   - `expr:false` returns `false`
 *   - otherwise it returns an empty string.
 * - otherwise the string is used as is.
 * 
 * @param {object} field - the field to evaluate
 * 
 * @returns {any} the default value
 * @private
 */
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


/**
 * Get a feature template for a dataset.
 * 
 * The feature template is computed as follows:
 * - if the dataset has a feature template factory
 *   registered, then the factory is called with the
 *   feature as input and the result is then used in next step;
 * - each field of the feature is checked for a
 *   `defaultValue` property and if it exists, the
 *   default value is evaluated and assigned to the
 *   feature's `properties` attribute under the `id` of the field.
 * 
 * @param {object} editConfig - the edit configuration
 * @param {object} feature - the input feature
 * 
 * @returns {object} the output feature
 */
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
