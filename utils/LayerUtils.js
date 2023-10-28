/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import { v4 as uuidv4 } from 'uuid';
import url from 'url';
import ConfigUtils from './ConfigUtils';
import CoordinatesUtils from './CoordinatesUtils';
import MapUtils from './MapUtils';
import { LayerRole } from '../actions/layers';

/** @typedef {import("qwc2/typings/layers").ExternalLayerKey} ExternalLayerKey */
/** @typedef {import("qwc2/typings/layers").ExternalLayer} ExternalLayer */
/** @typedef {import("qwc2/typings/layers").LayerConfig} LayerConfig */
/** @typedef {import("qwc2/typings/layers").LayerData} LayerData */
/** @typedef {import("qwc2/typings/layers").ExternalLayerList} ExternalLayerList */
/** @typedef {import("qwc2/typings/map").MapState} MapState */

/**
 * A structure that contains a leaf layer and the path to it
 * from the top level layer.
 * @typedef ExplodedLayer
 * @property {LayerData} layer - the top level layer
 * @property {number[]} path - the 0-based index of each sub-layer in parent, up
 *  until the leaf (last one in this list is the index of the leaf)
 * @property {LayerData} sublayer - the leaf layer
 */


/**
 * Utility functions for working with layers.
 * 
 * @namespace
 */
const LayerUtils = {
    
    /**
     * Restores the parameters of a theme layer and external layers.
     * 
     * @param {LayerData} themeLayer - the theme layer to restore
     * @param {LayerConfig[]} layerConfigs - an array of layer configurations
     * @param {LayerData[]} permalinkLayers - an array of permalink layers
     * @param {ExternalLayerList} externalLayers - the list of external layers
     * 
     * @returns {LayerData[]} - the restored layers
     */
    restoreLayerParams(
        themeLayer, layerConfigs, permalinkLayers, externalLayers
    ) {
        let exploded = LayerUtils.explodeLayers([themeLayer]);
        // Restore theme layer configuration
        for (const entry of exploded) {
            const layerConfig = layerConfigs.find(
                cfg => (
                    cfg.type === 'theme' &&
                    cfg.name === entry.sublayer.name
                )
            );
            if (layerConfig) {
                entry.sublayer.opacity = layerConfig.opacity;
                entry.sublayer.visibility = (
                    layerConfig.visibility || layerConfig.tristate
                );
                entry.sublayer.tristate = layerConfig.tristate;
            } else {
                entry.sublayer.visibility = false;
            }
        }
        // Create placeholders for external layers to be added in front
        let external = [];
        for (const layerConfig of layerConfigs) {
            if (layerConfig.type === 'separator') {
                // No point restoring separators
            } else if (layerConfig.type !== 'theme') {
                external = external.concat(
                    LayerUtils.createExternalLayerPlaceholder(
                        layerConfig, externalLayers, layerConfig.id
                    )
                );
            }
        }
        exploded = [...external, ...exploded];
        LayerUtils.insertPermalinkLayers(exploded, permalinkLayers);
        const layers = LayerUtils.implodeLayers(exploded);
        LayerUtils.setGroupVisibilities(layers);
        return layers;
    },


    restoreOrderedLayerParams(
        themeLayer, layerConfigs, permalinkLayers, externalLayers
    ) {
        const exploded = LayerUtils.explodeLayers([themeLayer]);
        let reordered = [];
        // Iterate over layer configs and reorder items accordingly, create
        // external layer placeholders as necessary
        for (const layerConfig of layerConfigs) {
            if (layerConfig.type === 'theme') {
                const entry = exploded.find(
                    e => e.sublayer.name === layerConfig.name
                );
                if (entry) {
                    entry.sublayer.opacity = layerConfig.opacity;
                    entry.sublayer.visibility = (
                        layerConfig.visibility || layerConfig.tristate
                    );
                    entry.sublayer.tristate = layerConfig.tristate;
                    reordered.push(entry);
                }
            } else if (layerConfig.type === 'separator') {
                reordered = reordered.concat(
                    LayerUtils.createSeparatorLayer(layerConfig.name)
                );
            } else {
                reordered = reordered.concat(
                    LayerUtils.createExternalLayerPlaceholder(
                        layerConfig, externalLayers, layerConfig.id
                    )
                );
            }
        }
        LayerUtils.insertPermalinkLayers(reordered, permalinkLayers);
        const layers = LayerUtils.implodeLayers(reordered);
        LayerUtils.setGroupVisibilities(layers);
        return layers;
    },


    /**
     * Determines and sets the visibility of a tree of layers based on
     * the visibilities of each layer members.
     * 
     * For each layer in the list (either the one the user provided or
     * the list of sub-layers for group layers) the function determines a
     * layer to be visible if:
     * - any of its sub-layers are visible and
     * - none of its sub-layers are in tri-state.
     * 
     * While walking the tree of layers the function will remove the
     * `tristate` property from all layers and - for group layers -
     * the `visibility` property will be set to the result of
     * running this function over its sub-layers.
     *
     * @param {LayerData[]} layers - the tree of layers
     * 
     * @returns {boolean} 
     */
    setGroupVisibilities(layers) {
        let parentVisible = false;
        let parentInvisible = false;
        for (const layer of layers) {
            if (!isEmpty(layer.sublayers)) {
                layer.visibility = LayerUtils.setGroupVisibilities(
                    layer.sublayers
                );
            }
            parentInvisible = parentInvisible || layer.tristate;
            delete layer.tristate;
            parentVisible = parentVisible || layer.visibility;
        }
        return parentVisible && !parentInvisible;
    },


    /**
     * Creates a new *exploded* layer to act as a separator.
     * 
     * @param {string} title - the title to assign to this layer
     * 
     * @returns {ExplodedLayer[]} the array that contains a single
     * structure suitable to be merged with other exploded layers
     * and reconstructed into a tree via {@link LayerUtils.implodeLayers}.
     * @see {@link LayerUtils.explodeLayers}
     */
    createSeparatorLayer(title) {
        return LayerUtils.explodeLayers([{
            type: "separator",
            title: title,
            role: LayerRole.USERLAYER,
            uuid: uuidv4(),
            id: uuidv4()
        }]);
    },


    /**
     * Creates a layer from external layer configuration.
     * 
     * @param {LayerConfig} layerConfig - the configuration of the
     *  external layer
     * @param {ExternalLayerList} externalLayers - the list of external layers
     * @param {LayerId} id - unique identifier for the layer
     * 
     * @returns {ExplodedLayer[]} the array that contains a single
     * structure suitable to be merged with other exploded layers
     * and reconstructed into a tree via {@link LayerUtils.implodeLayers}.
     * @see {@link LayerUtils.explodeLayers}
     */
    createExternalLayerPlaceholder(layerConfig, externalLayers, id) {
        const key = layerConfig.type + ":" + layerConfig.url;
        (externalLayers[key] = externalLayers[key] || []).push({
            id: id,
            name: layerConfig.name,
            opacity: layerConfig.opacity,
            visibility: layerConfig.visibility,
            params: layerConfig.params
        });
        return LayerUtils.explodeLayers([{
            id: id,
            type: "placeholder",
            name: layerConfig.name,
            title: layerConfig.name,
            role: LayerRole.USERLAYER,
            loading: true,
            uuid: uuidv4()
        }]);
    },


    /**
     * Inserts permalink layers into the exploded layer array.
     *
     * @param {ExplodedLayer[]} exploded - the exploded layer array
     * @param {LayerData[]} layers - the permalink layers to insert
     */
    insertPermalinkLayers(exploded, layers) {
        for (const layer of layers || []) {
            const insLayer = LayerUtils.explodeLayers([layer])[0];
            if (
                insLayer.layer.role !== LayerRole.USERLAYER ||
                insLayer.layer.type !== 'vector'
            ) {
                continue;
            }
            delete insLayer.layer.pos;
            exploded.splice(layer.pos, 0, insLayer);
        }
    },


    /**
     * Collects parameters for WMS sub-layers recursively.
     *
     * @param {LayerData} sublayer - the sublayer object to collect
     *  parameters for
     * @param {string[]} layerNames - the array to push the layer names to
     * @param {number[]} opacities - the array to push the layer opacities to
     * @param {string[]} styles - the array to push the layer styles to
     * @param {string[]} queryable - the array to push the queryable layer
     *  names to
     * @param {number[]} visibilities - the array to push the layer
     *  visibilities to; if you set this argument to a *falsy value*,
     *  only layers that are either implicitly (`undefined`)
     *  or explicitly (`true`) visible will be considered
     * @param {boolean} parentVisibility - the visibility of the parent layer
     *
     * @see {@link LayerUtils.buildWMSLayerParams}, 
     *  {@link LayerUtils.buildWMSLayerUrlParam}, 
     */
    collectWMSSublayerParams(
        sublayer, layerNames, opacities, styles, queryable,
        visibilities, parentVisibility
    ) {
        const layerVisibility = (
            sublayer.visibility === undefined ? true : sublayer.visibility
        );
        const visibility = layerVisibility && parentVisibility;
        if (visibility || visibilities) {
            if (!isEmpty(sublayer.sublayers)) {
                // Is group
                sublayer.sublayers.map(subLayer => {
                    LayerUtils.collectWMSSublayerParams(
                        subLayer, layerNames, opacities, styles,
                        queryable, visibilities, visibility
                    );
                });
            } else {
                layerNames.push(sublayer.name);
                opacities.push(
                    Number.isInteger(sublayer.opacity) ? sublayer.opacity : 255
                );
                styles.push(sublayer.style || "");
                if (sublayer.queryable) {
                    queryable.push(sublayer.name);
                }
                if (visibilities) {
                    visibilities.push(
                        layerVisibility ? (parentVisibility ? 1 : 0.5) : 0
                    );
                }
            }
        }
    },


    /**
     * Build WMS layer parameters.
     * 
     * @param {LayerData} layer - the layer to build parameters for
     * 
     * @return {{ 
     *   params: {
     *     LAYERS: string,
     *     OPACITIES: string,
     *     STYLES: string
     *   }, 
     *   queryLayers: string[] 
     * }} the parameters and the list of queryable layer names
     */
    buildWMSLayerParams(layer) {
        const params = layer.params || {};
        let newParams = {};
        let queryLayers = [];

        if (!Array.isArray(layer.sublayers)) {
            const layers = (
                params.LAYERS || layer.name
            ).split(",").filter(Boolean);
            const opacities = (
                params.OPACITIES || ""
            ).split(",").filter(Boolean);
            const opacityFactor = (layer.opacity ?? 255) / 255;
            newParams = {
                LAYERS: layers.join(","),
                OPACITIES: layers.map(
                    (x, i) => ((opacities[i] ?? "255") * opacityFactor)
                ).join(","),
                STYLES: params.STYLES ?? "",
                ...layer.dimensionValues
            };
            queryLayers = layer.queryable ? [layer.name] : [];
        } else {
            let layerNames = [];
            let opacities = [];
            let styles = [];
            layer.sublayers.map(sublayer => {
                LayerUtils.collectWMSSublayerParams(
                    sublayer, layerNames, opacities, styles,
                    queryLayers, null, layer.visibility
                );
            });
            layerNames.reverse();
            opacities.reverse();
            styles.reverse();
            if (layer.drawingOrder && layer.drawingOrder.length > 0) {
                const indices = layer.drawingOrder.map(
                    lyr => layerNames.indexOf(lyr)
                ).filter(idx => idx >= 0);

                layerNames = indices.map(idx => layerNames[idx]);
                opacities = indices.map(idx => opacities[idx]);
                styles = indices.map(idx => styles[idx]);
            }
            newParams = {
                LAYERS: layerNames.join(","),
                OPACITIES: opacities.join(","),
                STYLES: styles.join(","),
                ...layer.dimensionValues
            };
        }
        return {
            params: newParams,
            queryLayers
        };
    },


    /**
     * Add UUIDs to layers that don't have one and to all of their sublayers.
     * 
     * Note that this function will create a deep clone of the `sublayers`
     * property. 
     * 
     * @param {LayerData} group - the layer that will be equipped with an uuid
     * @param {Set<string>} usedUUIDs - a set of UUIDs to avoid; new UUIDs
     *  will be added to this set, if provided
     */
    addUUIDs(group, usedUUIDs = new Set()) {
        group.uuid = (
            !group.uuid || usedUUIDs.has(group.uuid)
                ? uuidv4()
                : group.uuid
        );
        usedUUIDs.add(group.uuid);
        if (!isEmpty(group.sublayers)) {
            Object.assign(group, { sublayers: group.sublayers.slice(0) });
            for (let i = 0; i < group.sublayers.length; ++i) {
                group.sublayers[i] = { ...group.sublayers[i] };
                LayerUtils.addUUIDs(group.sublayers[i], usedUUIDs);
            }
        }
    },


    /**
     * Builds a comma-separated string of layer names and parameters
     * for a list of layers.
     * 
     * @param {LayerData[]} layers - an array of layer objects
     * 
     * @returns {string} A comma-separated string of layer names and parameters
     */
    buildWMSLayerUrlParam(layers) {
        const layerNames = [];
        const opacities = [];
        const styles = [];
        const visibilities = [];
        const queryable = [];
        for (const layer of layers) {
            if (layer.role === LayerRole.THEME) {
                LayerUtils.collectWMSSublayerParams(
                    layer, layerNames, opacities, styles,
                    queryable, visibilities, layer.visibility
                );
            } else if (
                layer.role === LayerRole.USERLAYER &&
                layer.type === "wms"
            ) {
                const subLayerNames = [];
                LayerUtils.collectWMSSublayerParams(
                    layer, subLayerNames, opacities, styles, queryable,
                    visibilities, layer.visibility
                );
                let layerUrl = layer.url;
                if (layer.extwmsparams) {
                    layerUrl += (
                        (layerUrl.includes('?') ? '&' : '?') +
                        Object.entries(layer.extwmsparams || {}).map(
                            ([key, value]) => 'extwms.' + key + "=" + value
                        ).join('&')
                    );
                }
                layerNames.push(
                    ...subLayerNames.map(
                        name => "wms:" + layerUrl + "#" + name
                    )
                );
            } else if (
                layer.role === LayerRole.USERLAYER &&
                (layer.type === "wfs" || layer.type === "wmts")
            ) {
                layerNames.push(
                    layer.type + ':' +
                    (layer.capabilitiesUrl || layer.url) + "#" +
                    layer.name
                );
                opacities.push(layer.opacity);
                styles.push(layer.style);
                visibilities.push(
                    layer.visibility === undefined ? 1 : (
                        layer.visibility ? 1 : 0
                    )
                );
            } else if (
                layer.role === LayerRole.USERLAYER &&
                layer.type === "separator"
            ) {
                layerNames.push("sep:" + layer.title);
                opacities.push(255);
                styles.push('');
                visibilities.push(true);
            }
        }
        // TODO: styles are not used.
        const result = layerNames.map((layerName, idx) => {
            let param = layerName;
            if (opacities[idx] < 255) {
                param += "[" + (
                    100 - Math.round(opacities[idx] / 255 * 100)
                ) + "]";
            }
            if (visibilities[idx] === 0) {
                param += '!';
            } else if (visibilities[idx] === 0.5) {
                param += '~';
            }
            return param;
        });
        if (ConfigUtils.getConfigProp("urlReverseLayerOrder")) {
            result.reverse();
        }
        return result.join(",");
    },


    /**
     * Splits a layer URL parameter into its components.
     *
     * Parameters consist of: 
     * - an optional prefix that indicate the type of the
     * layer and the url (e.g. `foo:bar` indicates layer of type `foo` with
     * URL `bar`),
     * - a layer name, an optional opacity (e.g. `foo[50]` indicates a foo
     * layer with 50% opacity) and 
     * - an optional visibility indicator (e.g. `foo!` indicates
     * a foo layer that is not visible, `foo~` indicates a group
     * layer with some sub-layers visible and some invisible).
     * 
     * @param {string} entry - the layer URL parameter to split
     * 
     * @returns {Object} An object containing the ID, type, URL, name,
     * opacity, visibility, and tristate of the layer.
     */
    splitLayerUrlParam(entry) {
        const nameOpacityPattern = /([^[]+)\[(\d+)]/;
        const id = uuidv4();
        let type = 'theme';
        let layerUrl = null;
        let opacity = 255;
        let visibility = true;
        let tristate = false;
        if (entry.endsWith('!')) {
            visibility = false;
            entry = entry.slice(0, -1);
        } else if (entry.endsWith('~')) {
            visibility = false;
            tristate = true;
            entry = entry.slice(0, -1);
        }
        let name = entry;
        let match = nameOpacityPattern.exec(entry);
        if (match) {
            name = match[1];
            opacity = Math.round(255 - parseFloat(match[2]) / 100 * 255);
        }
        if ((match = name.match(/^(\w+):(.*)#([^#]+)$/))) {
            type = match[1];
            layerUrl = match[2];
            name = match[3];
        } else if (name.startsWith('sep:')) {
            type = 'separator';
            name = name.slice(4);
        }
        return { id, type, url: layerUrl, name, opacity, visibility, tristate };
    },


    /**
     * Checks if the parent array is a prefix for the child array. 
     * 
     * @param {number[]} parent - the shorter path
     * @param {number[]} child - the longer path
     * 
     * @returns {boolean} - true if the parent is a prefix for the child
     */
    pathEqualOrBelow(parent, child) {
        return isEqual(child.slice(0, parent.length), parent);
    },


    /**
     * Removes a foreground layer from the list of layers.
     * 
     * To remove a top level layer call this function with `layer` being the
     * layer to remove and `subLayerPath` being an empty array.
     * 
     * To remove a sub-layer call this function with `layer` being the
     * top level layer and `subLayerPath` being the path to the sub-layer.
     * 
     * The function silently ignores layers that are not found in the list.
     * 
     * @param {LayerData[]} layers - the array of layers to remove the
     *  layer from
     * @param {LayerData} layer - the top layer
     * @param {number[]} subLayerPath - the path to the sub-layer to be removed
     *  relative to the top level layer or an empty array if the top level
     *  layer itself is to be removed
     * 
     * @returns {LayerData[]} - the new array of layers with the
     *  layer removed
     */
    removeLayer(layers, layer, subLayerPath) {
        // Extract foreground layers
        const fgLayers = layers.filter(
            lyr => lyr.role !== LayerRole.BACKGROUND
        );
        // Explode layers (one entry for every single sublayer)
        let exploded = LayerUtils.explodeLayers(fgLayers);
        // Remove matching entries
        exploded = exploded.filter(
            entry => (
                entry.layer.uuid !== layer.uuid ||
                !LayerUtils.pathEqualOrBelow(subLayerPath, entry.path)
            )
        );
        // Re-assemble layers
        const newLayers = LayerUtils.implodeLayers(exploded);
        for (const lyr of newLayers) {
            if (lyr.type === "wms") {
                Object.assign(lyr, LayerUtils.buildWMSLayerParams(lyr));
            }
        }
        // Ensure theme layer is never removed
        if (!newLayers.find(lyr => lyr.role === LayerRole.THEME)) {
            const oldThemeLayer = layers.find(
                lyr => lyr.role === LayerRole.THEME
            );
            if (oldThemeLayer) {
                const newThemeLayer = { ...oldThemeLayer, sublayers: [] };
                Object.assign(
                    newThemeLayer,
                    LayerUtils.buildWMSLayerParams(newThemeLayer)
                );
                newLayers.push(newThemeLayer);
            }
        }
        // Re-add background layers
        return [
            ...newLayers,
            ...layers.filter(lyr => lyr.role === LayerRole.BACKGROUND)
        ];
    },


    /**
     * Inserts a separator layer with the given title before another layer.
     * 
     * @param {LayerData[]} layers - the array of layers to insert
     *  the separator into
     * @param {string} title - the title of the separator layer to insert
     * @param {string} beforeLayerId - The ID of the top level layer used
     *  with `beforeSubLayerPath` for locating the layer to insert
     *  the separator before.
     * @param {Array} beforeSubLayerPath - the path of the sublayer to insert
     *  the separator before relative to the top level layer specified
     *  by `beforeLayerId`
     * 
     * @returns {LayerData[]} - the new array of layers with the
     *  separator layer inserted
     * @throws {Error} - if the layer specified by `beforeLayerId` and
     *  `beforeSubLayerPath` is not found in the `layers` array
     */
    insertSeparator(layers, title, beforeLayerId, beforeSubLayerPath) {
        // Extract foreground layers
        const fgLayers = layers.filter(
            layer => layer.role !== LayerRole.BACKGROUND
        );

        // Explode layers (one entry for every single sublayer)
        const exploded = LayerUtils.explodeLayers(fgLayers);

        // Remove matching entries
        const pos = exploded.findIndex(
            entry => (
                entry.layer.id === beforeLayerId &&
                isEqual(beforeSubLayerPath, entry.path)
            )
        );
        if (pos !== -1) {
            // Add separator
            exploded.splice(pos, 0, LayerUtils.createSeparatorLayer(title)[0]);
        } else {
            throw new Error(
                "Failed to find 'before' layer item with " +
                `ID '${beforeLayerId}' and path ${beforeSubLayerPath}`
            );
        }

        // Re-assemble layers
        const newLayers = LayerUtils.implodeLayers(exploded);
        for (const layer of newLayers) {
            if (layer.type === "wms") {
                Object.assign(layer, LayerUtils.buildWMSLayerParams(layer));
            }
        }

        // Re-add background layers
        return [
            ...newLayers,
            ...layers.filter(layer => layer.role === LayerRole.BACKGROUND)
        ];
    },


    /**
     * Reorders the given layers by moving the specified layer by the
     * given delta.
     * 
     * @param {LayerData[]} layers - the array of layers to reorder
     * @param {LayerData} moveLayer - the top layer
     * @param {number[]} subLayerPath - the path of the sublayer to move
     *  relative to the top level layer or an empty array if the top level
     *  layer itself is to be moved
     * @param {number} delta - the amount to move the layer by
     * @param {boolean} preventSplittingGroups - whether to prevent
     *  splitting sibling groups when reordering
     * 
     * @returns {LayerData[]} - the reordered array of layers
     */
    reorderLayer(
        layers, moveLayer, subLayerPath, delta, preventSplittingGroups
    ) {
        // Extract foreground layers
        const fgLayers = layers.filter(
            layer => layer.role !== LayerRole.BACKGROUND
        );
        // Explode layers (one entry for every single sublayer)
        const exploded = LayerUtils.explodeLayers(fgLayers);
        // Find entry to move
        if (moveLayer) {
            const indices = exploded.reduce((result, entry, index) => {
                if (
                    entry.layer.uuid === moveLayer.uuid &&
                    LayerUtils.pathEqualOrBelow(subLayerPath, entry.path)
                ) {
                    return [...result, index];
                }
                return result;
            }, []);
            if (isEmpty(indices)) {
                return layers;
            }
            indices.sort((a, b) => a - b);
            if (
                (delta < 0 && indices[0] <= 0) ||
                (
                    delta > 0 &&
                    indices[indices.length - 1] >= exploded.length - 1
                )
            ) {
                return layers;
            }
            if (preventSplittingGroups) {
                // Prevent moving an entry out of a containing group
                const idx = delta < 0
                    ? indices[0]
                    : indices[indices.length - 1];
                const level = subLayerPath.length;
                if (
                    level > exploded[idx + delta].path.length ||
                    !isEqual(
                        exploded[idx + delta].path.slice(0, level - 1),
                        subLayerPath.slice(0, -1)
                    )
                ) {
                    return layers;
                }
                // Avoid splitting sibling groups when reordering
                if (
                    exploded[idx + delta].path.length > level ||
                    !isEqual(
                        exploded[idx + delta].path.slice(0, -1),
                        subLayerPath.slice(0, -1)
                    )
                ) {
                    // Find next slot
                    const siblingGroupPath = (
                        exploded[idx + delta].path.slice(0, level)
                    );
                    siblingGroupPath[siblingGroupPath.length - 1] += delta;
                    while (
                        idx + delta >= 0 &&
                        idx + delta < exploded.length &&
                        (
                            exploded[idx + delta].path.length > level ||
                            !isEqual(
                                exploded[idx + delta].path.slice(0, level),
                                siblingGroupPath
                            )
                        )
                    ) {
                        delta += delta > 0 ? 1 : -1;
                    }
                    // The above logic adds the number of items to skip to
                    // the delta which is already -1 or +1, so we need
                    // to decrease delta by one accordingly
                    if (Math.abs(delta) > 1) {
                        delta += delta > 0 ? -1 : 1;
                    }
                    if (idx + delta < 0 || idx + delta >= exploded.length) {
                        return layers;
                    }
                }
            }
            // Reorder layer
            if (delta < 0) {
                for (const idx of indices) {
                    exploded.splice(idx + delta, 0, exploded.splice(idx, 1)[0]);
                }
            } else {
                for (const idx of indices.reverse()) {
                    exploded.splice(idx + delta, 0, exploded.splice(idx, 1)[0]);
                }
            }
        }
        // Re-assemble layers
        const newLayers = LayerUtils.implodeLayers(exploded);
        // Re-add background layers
        return [
            ...newLayers,
            ...layers.filter(layer => layer.role === LayerRole.BACKGROUND)
        ];
    },


    /**
     * Return array with one entry for every single leaf sublayer.
     * 
     * The result is a list of records, each of which contains a copy of the top
     * level layer, the path to the leaf layer as indices inside parent
     * and a copy of the leaf layer.
     * 
     * @param {LayerData[]} layers - the list of top level layers
     * 
     * @returns {ExplodedLayer[]} - an array that includes only
     *  leaf layers, with their paths and the root layer where they belong
     * @see {LayerUtils.explodeSublayers}
     */
    explodeLayers(layers) {
        const exploded = [];
        for (const layer of layers) {
            if (!isEmpty(layer.sublayers)) {
                this.explodeSublayers(layer, layer, exploded);
            } else {
                const newLayer = { ...layer };
                // This check is true only if layer.sublayers = []
                if (newLayer.sublayers) {
                    newLayer.sublayers = [...newLayer.sublayers];
                }
                exploded.push({
                    layer: newLayer,
                    path: [],
                    sublayer: newLayer
                });
            }
        }
        return exploded;
    },


    /**
     * Go through all sublayers and create an array with one entry for every
     * single leaf sublayer.
     * 
     * This method calls itself recursively to create the list with `layer`
     * unchanged and `parent` being the current layer that is being explored.
     * 
     * @param {LayerData} layer - the top level layer
     * @param {LayerData} parent - the current layer
     * @param {ExplodedLayer[]} exploded - an array that includes only
     *  leaf layers, with their paths and the root layer where they belong
     * @param {number[]} parentPath - the list of parent layers expresses as
     *  the 0-based index of that layer inside its parent
     * 
     * @see {LayerUtils.explodeLayers}
     */
    explodeSublayers(layer, parent, exploded, parentPath = []) {
        // We go through teach sublayer in parent.
        for (let idx = 0; idx < parent.sublayers.length; ++idx) {
            // The path for this item is the path of the parent
            // and its own index.
            const path = [...parentPath, idx];

            // Get the sub-layer at his index.
            const subitem = parent.sublayers[idx];

            // See if this layer has its own sublayers.
            if (subitem.sublayers) {
                // If it does simply go through those.
                LayerUtils.explodeSublayers(
                    layer, subitem, exploded, path
                );
            } else {
                // This is a leaf layer (has no sublayers).
                // Reduced layer with one single sublayer per level, up to leaf

                // Make a copy of the top level layer.
                const redLayer = { ...layer };

                // Start from the top level and create a clone of this
                // branch. Each node in the branch has a single sublayer
                // except the last one (the leaf) which nas none.
                let group = redLayer;
                for (const jdx of path) {
                    group.sublayers = [{ ...group.sublayers[jdx] }];
                    group = group.sublayers[0];
                }
                exploded.push({
                    layer: redLayer,
                    path: path,
                    sublayer: group
                });
            }
        }
    },


    /**
     * Creates a tree structure from an array of layers.
     * 
     * @param {ExplodedLayer[]} exploded - the flat list of layers
     * 
     * @returns {LayerData[]} the reconstructed layer tree
     */
    implodeLayers(exploded) {
        const newLayers = [];
        const usedLayerUUids = new Set();

        // Merge all possible items of an exploded layer array
        for (const entry of exploded) {
            // Get the top level layer.
            const layer = entry.layer;

            // Attempt to merge with previous if possible
            let target = newLayers.length > 0
                ? newLayers[newLayers.length - 1]
                : null;
            let source = layer;
            if (target && target.sublayers && target.id === layer.id) {
                let innerTarget = target.sublayers[target.sublayers.length - 1];

                // Exploded entries have only one entry per sublayer level
                let innerSource = source.sublayers[0];

                while (
                    innerTarget &&
                    innerTarget.sublayers &&
                    innerTarget.id === innerSource.id
                ) {
                    target = innerTarget;
                    source = innerSource;

                    innerTarget = target.sublayers[target.sublayers.length - 1];
                    // Exploded entries have only one entry per sublayer level
                    innerSource = source.sublayers[0];
                }

                target.sublayers.push(source.sublayers[0]);
                LayerUtils.addUUIDs(source.sublayers[0], usedLayerUUids);
            } else {
                newLayers.push(layer);
                LayerUtils.addUUIDs(layer, usedLayerUUids);
            }
        }
        // Ensure mutually exclusive groups have exactly one visible layer
        for (const layer of newLayers) {
            LayerUtils.ensureMutuallyExclusive(layer);
        }
        for (const layer of newLayers) {
            if (layer.type === "wms") {
                Object.assign(layer, LayerUtils.buildWMSLayerParams(layer));
            }
        }
        return newLayers;
    },


    /**
     * Inserts a layer into a tree.
     * 
     * The function creates a linear representation of the tree of layers
     * through {@link LayerUtils.explodeLayers}, inserts the layer
     * then it recreates the tree through {@link LayerUtils.implodeLayers}.
     * 
     * To determine the position of the insertion the function compares the
     * value of the `beforeAttr` property of each leaf layer with the
     * `beforeVal` argument.
     * 
     * @param {LayerData[]} layers - the list of layers to change
     * @param {LayerData} newLayer - the layer to insert
     * @param {string} beforeAttr - the attribute to examine (e.g. 
     *  `name` or `id`)
     * @param {*} beforeVal - the value to examine
     * 
     * @throws {Error} if the reference leaf layer is not found
     * @returns {LayerData[]} a new list that includes the `newLayer`
     */
    insertLayer(layers, newLayer, beforeAttr, beforeVal) {
        const exploded = LayerUtils.explodeLayers(layers);
        const explodedAdd = LayerUtils.explodeLayers([newLayer]);
        const index = exploded.findIndex(
            entry => entry.sublayer[beforeAttr] === beforeVal
        );
        if (index !== -1) {
            exploded.splice(index, 0, ...explodedAdd);
        } else {
            throw new Error(
                "Failed to find 'before' layer item with " +
                `'${beforeAttr}'=${beforeVal}`
            );
        }
        return LayerUtils.implodeLayers(exploded);
    },


    /**
     * Changes the visibility attribute of all sub-layers in the entire tree
     * for layers that represents mutually-exclusive groups.
     * 
     * At each level the function will set exactly one visible sub-layer
     * in a mutually-exclusive group based on following rules:
     * - the first tri-state sub-layer or
     * - the first visible sub-layer or
     * - the first sub-layer in the group.
     * 
     * @param {LayerData} group - the group to edit
     */
    ensureMutuallyExclusive(group) {
        if (!isEmpty(group.sublayers)) {
            if (group.mutuallyExclusive) {
                const tristateSublayer = group.sublayers.find(
                    sublayer => sublayer.tristate === true
                );
                const visibleSublayer = (
                    tristateSublayer ||
                    group.sublayers.find(
                        sublayer => sublayer.visibility === true
                    ) ||
                    group.sublayers[0]
                );
                for (const sublayer of group.sublayers) {
                    sublayer.visibility = sublayer === visibleSublayer;
                }
            }
            for (const sublayer of group.sublayers) {
                LayerUtils.ensureMutuallyExclusive(sublayer);
            }
        }
    },


    getSublayerNames(layer) {
        return [layer.name].concat(
            (layer.sublayers || []).reduce((list, sublayer) => {
                return list.concat([...this.getSublayerNames(sublayer)]);
            }, [])
        ).filter(x => x);
    },


    mergeSubLayers(baseLayer, addLayer) {
        addLayer = { ...baseLayer, sublayers: addLayer.sublayers };
        addLayer.externalLayerMap = addLayer.externalLayerMap || {};
        LayerUtils.extractExternalLayersFromSublayers(addLayer, addLayer);
        LayerUtils.addUUIDs(addLayer);
        if (isEmpty(addLayer.sublayers)) {
            return { ...baseLayer };
        }
        if (isEmpty(baseLayer.sublayers)) {
            return addLayer;
        }
        const explodedBase = LayerUtils.explodeLayers([baseLayer]);
        const existing = explodedBase.map(entry => entry.sublayer.name);
        let explodedAdd = LayerUtils.explodeLayers([addLayer]);
        explodedAdd = explodedAdd.filter(
            entry => !existing.includes(entry.sublayer.name)
        );
        return LayerUtils.implodeLayers(explodedAdd.concat(explodedBase))[0];
    },


    /**
     * 
     */
    searchSubLayer(layer, attr, value, path = []) {
        if (layer.sublayers) {
            let idx = 0;
            for (const sublayer of layer.sublayers) {
                const match = (
                    sublayer[attr] === value
                        ? sublayer
                        : LayerUtils.searchSubLayer(sublayer, attr, value, path)
                );
                if (match) {
                    path.unshift(idx);
                    return match;
                }
                idx += 1;
            }
        } else {
            if (layer[attr] === value) {
                return layer;
            }
        }
        return null;
    },


    searchLayer(
        layers, key, value, roles = [LayerRole.THEME, LayerRole.USERLAYER]
    ) {
        for (const layer of layers) {
            if (roles.includes(layer.role)) {
                const matchSubLayer = LayerUtils.searchSubLayer(
                    layer, key, value
                );
                if (matchSubLayer) {
                    return { layer: layer, sublayer: matchSubLayer };
                }
            }
        }
        return null;
    },


    /**
     * Check if a sub-layer and all of its parents are visible.
     * 
     * @param {LayerData} layer - the layer to query
     * @param {number[]} subLayerPath - path to the sub-layer as a list of
     * 0-based indices; each number is the index of a child in its parent's
     * list of `sublayers`
     * 
     * @returns {boolean} true if sub-layer and all of its parents are visible
     * (either explicitly or implicitly).
     */
    sublayerVisible(layer, subLayerPath) {
        let visible = layer.visibility !== false;
        let sublayer = layer;
        for (const index of subLayerPath) {
            sublayer = sublayer.sublayers[index];
            visible &= sublayer.visibility !== false;
            if (!visible) {
                return false;
            }
        }
        return true;
    },


    /**
     * Computes the visibility of the layer based on the visibility of
     * sub-layers.
     * 
     * Layers that have no `visibility` attribute are assumed to be visible.
     * 
     * @param {LayerData} layer - the layer to query
     * 
     * @returns {number} - the visibility of this layer in the `[0..1]` interval.
     */
    computeLayerVisibility(layer) {
        if (isEmpty(layer.sublayers) || layer.visibility === false) {
            return layer.visibility ? 1 : 0;
        }
        let visible = 0;
        layer.sublayers.map(sublayer => {
            const subLayerVisibility = sublayer.visibility === undefined
                ? true
                : sublayer.visibility;
            if (sublayer.sublayers && subLayerVisibility) {
                visible += LayerUtils.computeLayerVisibility(sublayer);
            } else {
                visible += subLayerVisibility ? 1 : 0;
            }
        });
        return visible / layer.sublayers.length;
    },


    /**
     * Create a layer duplicate.
     * 
     * @param {LayerData} layer - the layer to clone
     * @param {number[]} subLayerPath - the path to the sub-layer to clone
     * as a list of 0-based indices; each number is the index of a child in
     * its parent's list of `sublayers`
     * 
     * @returns {{newlayer: LayerData, newsublayer: LayerData}} the
     * cloned top level layer and the cloned leaf sub-layer; the top layer
     * will have all the sub-layers leading down to the lead sub-layer
     * cloned as well but other layers sill be simply copied.
     */
    cloneLayer(layer, subLayerPath) {
        const newLayer = { ...layer };
        let cur = newLayer;
        for (let i = 0; i < subLayerPath.length; ++i) {
            const idx = subLayerPath[i];
            cur.sublayers = [
                ...cur.sublayers.slice(0, idx),
                { ...cur.sublayers[idx] },
                ...cur.sublayers.slice(idx + 1)
            ];
            cur = cur.sublayers[idx];
        }
        return { newlayer: newLayer, newsublayer: cur };
    },


    /**
     * Creates a map of group names to the list of layer names that
     * belong to that group.
     * 
     * The layers that contain sub-layers are groups.
     * Usually you call the function with an empty `parentGroups` array.
     * If the `layer` has no sub-layers, the function will return the
     * `groupLayers` unchanged.
     * If the layer does have sub-layers, the function will call itself
     * recursively for each sub-layer, passing the `parentGroups` array
     * with the name of the current layer added to it, thus each leaf
     * layer will have a list of all the group names that it belongs to,
     * all the way tot the top level layer.
     * 
     * When the function encounters a leaf layer, it will add the layer
     * name to the `groupLayers` map for each group name in the
     * `parentGroups` array, so each leaf layers will show up once for
     * each group it belongs to at every depth level.
     * 
     * @param {LayerData} layer - the layer to start the query from
     * @param {string[]} parentGroups - the initial list of group names;
     *  the function 
     * @param {Object} groupLayers - the map of group names to the list of
     * layer names that belong to that group
     * 
     * @todo this function assumes that the names of the groups are unique
     * across the tree of layers, no matter the depth level. Is this true?
     * If not true a group can eat up layers from different parts of the
     * tree.
     */
    collectGroupLayers(layer, parentGroups, groupLayers) {
        if (!isEmpty(layer.sublayers)) {
            for (const sublayer of layer.sublayers) {
                LayerUtils.collectGroupLayers(
                    sublayer, parentGroups.concat(layer.name), groupLayers
                );
            }
        } else {
            for (const group of parentGroups) {
                groupLayers[group] = (
                    groupLayers[group] || []
                ).concat(layer.name);
            }
        }
    },


    /**
     * Replaces the configuration for groups with one configuration for
     * each leaf layer in the group.
     * 
     * A shallow copy of each configuration is made and the `name` property
     * is replaced with the name of the leaf layer in the group.
     * 
     * @param {LayerConfig[]} layerConfigs - the list of layer configurations
     * @param {LayerData} layer - the layer from which to extract the groups
     * 
     * @returns {LayerConfig[]} the list of layer configurations with
     * the group configurations replaced with configurations for each
     * leaf layer in the group.
     * 
     * @todo for a leaf layer at depth level 2 (has a parent and a grand-parent) 
     * there will be two copies of the configuration with same name.
     */
    replaceLayerGroups(layerConfigs, layer) {
        // We accumulate here the list of all group names that
        // contain sub-layers associated with all their leaf layers.
        const groupLayers = {};
        LayerUtils.collectGroupLayers(layer, [], groupLayers);

        const newLayerConfigs = [];
        for (const layerConfig of layerConfigs) {
            // TODO: this assumes that the group names are unique across the
            // tree of layers.
            if (layerConfig.name in groupLayers) {
                // We have now determined that this layer config belongs
                // to a group.

                // Here we expand the single layer config into multiple layer
                // configs, one for each leaf layer in the group.
                newLayerConfigs.push(
                    ...groupLayers[layerConfig.name].map(
                        name => ({ ...layerConfig, name })
                    )
                );
            } else {
                // If this is not a group, we simply copy the layer config.
                newLayerConfigs.push(layerConfig);
            }
        }
        return newLayerConfigs;
    },


    /**
     * Create a new list of sublayers with external layer information
     * stripped from them.
     * 
     * The information about the external layers is collected in the
     * `externalLayerMap` property of the top level layer.
     * 
     * @param {LayerData} topLayer - the top level layer
     * @param {LayerData} layer - the current layer
     */
    extractExternalLayersFromSublayers(topLayer, layer) {
        if (layer.sublayers) {
            // Create a new list of sublayers that does not contain
            // the external layers.
            layer.sublayers = layer.sublayers.map(sublayer => {
                if (sublayer.externalLayer) {
                    // Take the data from sublayer, enhance it and save it
                    // in the externalLayerMap of the top level layer under the
                    // name of this layer. The enhance part will make sure
                    // that the external layer has a title, an uuid and
                    // wms properties.
                    const externalLayer = { ...sublayer.externalLayer };
                    LayerUtils.completeExternalLayer(externalLayer, sublayer);
                    topLayer.externalLayerMap[sublayer.name] = externalLayer;

                    // Remove the external data from the sublayer.
                    sublayer = { ...sublayer };
                    delete sublayer.externalLayer;
                }
                if (sublayer.sublayers) {
                    LayerUtils.extractExternalLayersFromSublayers(
                        topLayer, sublayer
                    );
                }
                return sublayer;
            });
        }
    },


    /**
     * Ensure that the layer has an uuid, a title and WMS properties.
     * 
     * The title is taken from the layer itself, or from the sublayer
     * or from the `name` of the external layer.
     * The `uuid` is always generated with `uuidv4`.
     * 
     * For WMS layers the `version` defaults to `1.3.0` if not set,
     * the `featureInfoUrl` and `legendUrl` default to `url` if not set,
     * the `queryLayers` are extracted from `LAYER` parameter if not set.
     * If the `externalLayerFeatureInfoFormats` configuration is set,
     * the `infoFormats` are set based on the it and the `featureInfoUrl`
     * content.
     * 
     * @param {ExternalLayer} externalLayer - the external layer data to enhance
     * @param {LayerData} sublayer - the sublayer that contains the
     *  external layer data
     */
    completeExternalLayer(externalLayer, sublayer) {
        externalLayer.title = (
            externalLayer.title ||
            (sublayer || {}).title ||
            externalLayer.name
        );
        externalLayer.uuid = uuidv4();
        if (externalLayer.type === "wms" || externalLayer.params) {
            externalLayer.version = externalLayer.version || "1.3.0";
            externalLayer.featureInfoUrl = (
                externalLayer.featureInfoUrl || externalLayer.url
            );
            externalLayer.legendUrl = (
                externalLayer.legendUrl || externalLayer.url
            );
            externalLayer.queryLayers = (
                externalLayer.queryLayers ||
                externalLayer.params.LAYERS.split(",")
            );

            const externalLayerFeatureInfoFormats = ConfigUtils.getConfigProp(
                "externalLayerFeatureInfoFormats"
            ) || {};
            const featureInfoUrl = externalLayer.featureInfoUrl.toLowerCase();
            for (const entry of Object.keys(externalLayerFeatureInfoFormats)) {
                // TODO: this is a very simplistic check, we should
                // probably parse the url and check the query parameters.
                if (featureInfoUrl.includes(entry.toLowerCase())) {
                    externalLayer.infoFormats = [
                        externalLayerFeatureInfoFormats[entry]
                    ];
                    break;
                }
            }
        }
    },


    getLegendUrl(
        layer, sublayer, scale, map, bboxDependentLegend,
        scaleDependentLegend, extraLegendParameters
    ) {
        if (layer.type !== "wms") {
            return layer.legendUrl || "";
        }
        const requestParams = {
            SERVICE: "WMS",
            REQUEST: "GetLegendGraphic",
            FORMAT: "image/png",
            CRS: map.projection,
            SLD_VERSION: "1.1.0"
        };
        if (extraLegendParameters) {
            Object.assign(
                requestParams,
                Object.fromEntries(
                    extraLegendParameters.split("&").map(
                        entry => entry.split("=")
                    )
                )
            );
        }
        if (
            scaleDependentLegend === true ||
            (
                scaleDependentLegend === "theme" &&
                layer.role === LayerRole.THEME
            )
        ) {
            requestParams.SCALE = Math.round(scale);
        }
        if (
            bboxDependentLegend === true ||
            (
                bboxDependentLegend === "theme" &&
                layer.role === LayerRole.THEME
            )
        ) {
            requestParams.WIDTH = map.size.width;
            requestParams.HEIGHT = map.size.height;
            const bounds = map.bbox.bounds;
            if (
                CoordinatesUtils.getAxisOrder(
                    map.projection
                ).substr(0, 2) === 'ne' &&
                layer.version === '1.3.0'
            ) {
                requestParams.BBOX = [
                    bounds[1], bounds[0], bounds[3], bounds[2]
                ].join(",");
            } else {
                requestParams.BBOX = bounds.join(",");
            }
        }
        if (layer.externalLayerMap && layer.externalLayerMap[sublayer.name]) {
            const externalLayer = layer.externalLayerMap[sublayer.name];
            if (externalLayer.type !== "wms") {
                return externalLayer.legendUrl || "";
            }
            const urlParts = url.parse(externalLayer.legendUrl, true);
            urlParts.query = {
                VERSION: layer.version,
                ...urlParts.query,
                ...requestParams,
                LAYER: externalLayer.params.LAYERS
            };
            delete urlParts.search;
            return url.format(urlParts);
        } else {
            const layerName = layer === sublayer
                ? layer.name.replace(/.*\//, '')
                : sublayer.name;
            const urlParts = url.parse(layer.legendUrl, true);
            urlParts.query = {
                VERSION: layer.version,
                ...urlParts.query,
                ...requestParams,
                LAYER: layerName
            };
            delete urlParts.search;
            return url.format(urlParts);
        }
    },


    /**
     * Checks if the the layer should be visible given a map scale.
     * 
     * @param {LayerData} layer - the layer to investigate
     * @param {number} mapScale - current scale of the map
     * 
     * @returns {boolean} true if the layer should be visible
     * @todo throw an error in degenerate cases (`minScale` >= `maxScale`)
     */
    layerScaleInRange(layer, mapScale) {
        return (
            (
                layer.minScale === undefined ||
                mapScale >= layer.minScale
            ) && (
                layer.maxScale === undefined ||
                mapScale < layer.maxScale
            )
        );
    },


    addExternalLayerPrintParams(layer, params, printCrs, counterRef) {
        const qgisServerVersion = (
            ConfigUtils.getConfigProp("qgisServerVersion") || 3
        );
        if (qgisServerVersion >= 3) {
            if (layer.type === "wms") {
                const names = layer.params.LAYERS.split(",");
                const opacities = layer.params.OPACITIES.split(",");
                for (let idx = 0; idx < names.length; ++idx) {
                    const identifier = String.fromCharCode(
                        65 + (counterRef[0]++)
                    );
                    params.LAYERS.push("EXTERNAL_WMS:" + identifier);
                    params.OPACITIES.push(opacities[idx]);
                    params.COLORS.push("");
                    let layerUrl = layer.url;
                    const urlParts = url.parse(layerUrl, true);
                    // Resolve relative urls
                    if (!urlParts.host) {
                        const locationParts = url.parse(window.location.href);
                        urlParts.protocol = locationParts.protocol;
                        urlParts.host = locationParts.host;
                        delete urlParts.search;
                        layerUrl = url.format(urlParts);
                    }
                    params[identifier + ":url"] = layerUrl;
                    params[identifier + ":layers"] = names[idx];
                    params[identifier + ":format"] = "image/png";
                    params[identifier + ":crs"] = printCrs;
                    params[identifier + ":styles"] = "";
                    params[identifier + ":dpiMode"] = "7";
                    params[identifier + ":contextualWMSLegend"] = "0";
                    if (layer.url.includes("?")) {
                        params[identifier + ":IgnoreGetMapUrl"] = "1";
                    }
                    Object.entries(
                        layer.extwmsparams || {}
                    ).forEach(([key, value]) => {
                        params[identifier + ":" + key] = value;
                    });
                }
            }
        } else if (qgisServerVersion === 2) {
            if (layer.type === "wms") {
                const names = layer.params.LAYERS.split(",");
                const opacities = layer.params.OPACITIES.split(",");
                for (let idx = 0; idx < names.length; ++idx) {
                    // Handled by qwc-print-service
                    params.LAYERS.push(`wms:${layer.url}#${names[idx]}`);
                    params.OPACITIES.push(opacities[idx]);
                    params.COLORS.push("");
                }
            } else if (layer.type === "wfs") {
                // Handled by qwc-print-service
                params.LAYERS.push(`wfs:${layer.url}#${layer.name}`);
                params.OPACITIES.push(layer.opacity);
                params.COLORS.push(layer.color);
            }
        }
    },


    
    /**
     * Collects print parameters for the given layers, theme, print
     * scale, print CRS, and print external layers.
     * 
     * @param {Array} layers - the layers to collect print parameters for.
     * @param {Object} theme - the theme to use for printing.
     * @param {number} printScale - the print scale.
     * @param {string} printCrs - the print CRS.
     * @param {boolean} printExternalLayers - whether to print
     *  external layers.
     * 
     * @return {{ 
    *     LAYERS: string,
    *     OPACITIES: string,
    *     STYLES: string
    * }} the parameters
     */
    collectPrintParams(
        layers, theme, printScale, printCrs, printExternalLayers
    ) {
        const params = {
            LAYERS: [],
            OPACITIES: [],
            COLORS: []
        };
        const counterRef = [0];

        for (const layer of layers) {
            if (layer.role === LayerRole.THEME && layer.params.LAYERS) {
                params.LAYERS.push(layer.params.LAYERS);
                params.OPACITIES.push(layer.params.OPACITIES);
                params.COLORS.push(
                    layer.params.LAYERS.split(",").map(() => "").join(",")
                );
            } else if (
                printExternalLayers &&
                layer.role === LayerRole.USERLAYER &&
                layer.visibility !== false &&
                LayerUtils.layerScaleInRange(layer, printScale)
            ) {
                LayerUtils.addExternalLayerPrintParams(
                    layer, params, printCrs, counterRef
                );
            }
        }

        const backgroundLayer = layers.find(
            layer => (
                layer.role === LayerRole.BACKGROUND &&
                layer.visibility === true
            )
        );
        if (backgroundLayer) {
            const backgroundLayerName = backgroundLayer.name;
            const themeBackgroundLayer = theme.backgroundLayers.find(
                entry => entry.name === backgroundLayerName
            );
            const printBackgroundLayer = themeBackgroundLayer
                ? themeBackgroundLayer.printLayer
                : null;
            if (printBackgroundLayer) {
                // Use printLayer defined in qgis project
                let printBgLayerName = printBackgroundLayer;
                if (Array.isArray(printBackgroundLayer)) {
                    printBgLayerName = null;
                    for (let i = 0; i < printBackgroundLayer.length; ++i) {
                        printBgLayerName = printBackgroundLayer[i].name;
                        if (printScale <= printBackgroundLayer[i].maxScale) {
                            break;
                        }
                    }
                }
                if (printBgLayerName) {
                    let match = null;
                    if (
                        (match = printBgLayerName.match(/^(\w+):(.*)#([^#]+)$/)) &&
                        match[1] === "wms"
                    ) {
                        const layer = {
                            type: 'wms',
                            params: { LAYERS: match[3], OPACITIES: '255' },
                            url: match[2]
                        };
                        LayerUtils.addExternalLayerPrintParams(
                            layer, params, printCrs, counterRef
                        );
                    } else {
                        params.LAYERS.push(printBgLayerName);
                        params.OPACITIES.push("255");
                        params.COLORS.push("");
                    }
                }
            } else if (printExternalLayers) {
                // Inject client-side wms as external layer for print
                const items = backgroundLayer.type === "group"
                    ? backgroundLayer.items
                    : [backgroundLayer];
                items.slice(0).reverse().forEach(layer => {
                    if (LayerUtils.layerScaleInRange(layer, printScale)) {
                        LayerUtils.addExternalLayerPrintParams(
                            layer, params, printCrs, counterRef
                        );
                    }
                });
            }
        }
        params.LAYERS = params.LAYERS.reverse().join(",");
        params.OPACITIES = params.OPACITIES.reverse().join(",");
        params.COLORS = params.COLORS.reverse().join(",");
        return params;
    },


    getTimeDimensionValues(layer) {
        const result = {
            names: new Set(),
            values: new Set(),
            attributes: {}
        };
        if (layer.visibility) {
            (layer.dimensions || []).forEach(dimension => {
                if (dimension.units === "ISO8601" && dimension.value) {
                    result.names.add(dimension.name);
                    dimension.value
                        .split(/,\s+/)
                        .filter(x => x)
                        .forEach(x => result.values.add(x));
                    result.attributes[layer.name] = [
                        dimension.fieldName, dimension.endFieldName
                    ];
                }
            });
        }
        (layer.sublayers || []).forEach(sublayer => {
            const sublayerResult = LayerUtils.getTimeDimensionValues(sublayer);
            sublayerResult.names.forEach(x => result.names.add(x));
            sublayerResult.values.forEach(x => result.values.add(x));
            result.attributes = {
                ...result.attributes,
                ...sublayerResult.attributes
            };
        });
        return result;
    },


    /**
     * Retrieve the attribution for a layer.
     * 
     * The layer data is the one kept in the state.
     * 
     * @param {LayerData} layer - the layer to get the attribution for
     * @param {MapState} map - the map state
     * @param {boolean} showThemeAttributionOnly - whether to show only the
     *  attribution for theme layers (the function will return an empty
     *  object for other types of layers)
     * @param {*} transformedMapBBoxes 
     * @returns 
     */
    getAttribution(
        layer, map,
        showThemeAttributionOnly = false,
        transformedMapBBoxes = {}
    ) {
        if (
            layer.visibility === false || (
                showThemeAttributionOnly &&
                layer.role !== LayerRole.THEME
            )
        ) {
            return {};
        }

        const mapScale = MapUtils.computeForZoom(map.scales, map.zoom);
        if (!LayerUtils.layerScaleInRange(layer, mapScale)) {
            return {};
        }

        if (layer.bbox && layer.bbox.bounds) {
            const layerCrs = layer.bbox.crs || map.projection;
            if (!transformedMapBBoxes[layerCrs]) {
                transformedMapBBoxes[layerCrs] = CoordinatesUtils.reprojectBbox(
                    map.bbox.bounds, map.projection, layerCrs
                );
            }
            const mapBbox = transformedMapBBoxes[layerCrs];
            const layBbox = layer.bbox.bounds;
            if (
                mapBbox[0] > layBbox[2] || mapBbox[2] < layBbox[0] ||
                mapBbox[1] > layBbox[3] || mapBbox[3] < layBbox[1]
            ) {
                // Extents don't overlap
                return {};
            }
        }

        const copyrights = {};

        if (layer.sublayers) {
            Object.assign(
                copyrights,
                layer.sublayers.reduce((res, sublayer) => ({
                    ...res,
                    ...LayerUtils.getAttribution(
                        sublayer, map, false, transformedMapBBoxes
                    )
                }), {})
            );
        } else if (layer.type === "group" && layer.items) {
            Object.assign(
                copyrights,
                layer.items.reduce((res, sublayer) => ({
                    ...res,
                    ...LayerUtils.getAttribution(
                        sublayer, map, false, transformedMapBBoxes
                    )
                }), {})
            );
        }
        if (layer.attribution && layer.attribution.Title) {
            const key = (
                layer.attribution.OnlineResource ||
                layer.attribution.Title
            );
            copyrights[key] = {
                title: layer.attribution.OnlineResource
                    ? layer.attribution.Title
                    : null,
                layers: [...((copyrights[key] || {}).layers || []), layer]
            };
        }
        return copyrights;
    }
};

export default LayerUtils;
