/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import url from 'url';
import axios from 'axios';
import {LayerRole} from '../actions/layers';
import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';

export const UrlParams = {
    updateParams(dict) {
        if (ConfigUtils.getConfigProp("omitUrlParameterUpdates") === true) {
            return;
        }
        // Timeout: avoid wierd issue where Firefox triggers a full reload when invoking history-replaceState directly
        setTimeout(() => {
            const urlObj = url.parse(window.location.href, true);
            urlObj.query = Object.assign(urlObj.query, dict);
            const propNames = Object.getOwnPropertyNames(urlObj.query);

            for (const propName of propNames) {
                if (urlObj.query[propName] === undefined) {
                    delete urlObj.query[propName];
                }
            }
            delete urlObj.search;
            history.replaceState({id: urlObj.host}, '', url.format(urlObj));
        }, 0);
    },
    getParam(key) {
        const urlObj = url.parse(window.location.href, true);
        return urlObj.query[key];
    },
    getParams() {
        return url.parse(window.location.href, true).query;
    },
    clear() {
        this.updateParams({k: undefined, t: undefined, l: undefined, bl: undefined, c: undefined, s: undefined, e: undefined, crs: undefined, st: undefined, sp: undefined});
    }
};

export function generatePermaLink(state, callback, user = false) {
    if (!ConfigUtils.getConfigProp("permalinkServiceUrl")) {
        callback(window.location.href);
        return;
    }
    const permalinkState = {};
    if (ConfigUtils.getConfigProp("storeAllLayersInPermalink")) {
        permalinkState.layers = state.layers.flat.filter(layer => layer.role !== LayerRole.BACKGROUND);
    } else {
        // Only store redlining layers
        const exploded = LayerUtils.explodeLayers(state.layers.flat.filter(layer => layer.role !== LayerRole.BACKGROUND));
        const redliningLayers = exploded.map((entry, idx) => ({...entry, pos: idx}))
            .filter(entry => entry.layer.role === LayerRole.USERLAYER && entry.layer.type === 'vector')
            .map(entry => ({...entry.layer, pos: entry.pos}));
        permalinkState.layers = redliningLayers;
    }
    const route = user ? "userpermalink" : "createpermalink";
    axios.post(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/" + route + "?url=" + encodeURIComponent(window.location.href), permalinkState)
        .then(response => callback(response.data.permalink || window.location.href))
        .catch(() => callback(window.location.href));
}

export function resolvePermaLink(initialParams, callback) {
    const key = UrlParams.getParam('k');
    const bkey = UrlParams.getParam('bk');
    if (key) {
        axios.get(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/resolvepermalink?key=" + key)
            .then(response => {
                callback({...initialParams, ...(response.data.query || {})}, response.data.state || {});
            })
            .catch(() => {
                callback(initialParams, {});
            });
    } else if (bkey) {
        axios.get(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" + bkey)
            .then(response => {
                callback({...initialParams, ...(response.data.query || {})}, response.data.state || {});
            })
            .catch(() => {
                callback(initialParams, {});
            });
    } else {
        callback(initialParams, {});
    }
}

export function getUserBookmarks(user, callback) {
    if (user) {
        axios.get(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/")
            .then(response => {
                callback(response.data || []);
            })
            .catch(() => {
                callback([]);
            });
    }
}

export function removeBookmark(bkey, callback) {
    if (bkey) {
        axios.delete(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" + bkey)
            .then(() => {
                callback(true);
            }).catch(err => callback(false));
    }
}

export function createBookmark(state, description, callback) {
    if (!ConfigUtils.getConfigProp("permalinkServiceUrl")) {
        callback(false);
        return;
    }
    // Only store redlining layers
    const exploded = LayerUtils.explodeLayers(state.layers.flat.filter(layer => layer.role !== LayerRole.BACKGROUND));
    const bookmarkState = {};
    if (ConfigUtils.getConfigProp("storeAllLayersInPermalink")) {
        bookmarkState.layers = state.layers.flat.filter(layer => layer.role !== LayerRole.BACKGROUND);
    } else {
        const redliningLayers = exploded.map((entry, idx) => ({...entry, pos: idx}))
            .filter(entry => entry.layer.role === LayerRole.USERLAYER && entry.layer.type === 'vector')
            .map(entry => ({...entry.layer, pos: entry.pos}));
        bookmarkState.layers = redliningLayers;
    }
    axios.post(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" +
        "?url=" + encodeURIComponent(window.location.href) + "&description=" + description, bookmarkState)
        .then(() => callback(true))
        .catch(() => callback(false));
}

export function updateBookmark(state, bkey, description, callback) {
    if (!ConfigUtils.getConfigProp("permalinkServiceUrl")) {
        callback(false);
        return;
    }
    // Only store redlining layers
    const exploded = LayerUtils.explodeLayers(state.layers.flat.filter(layer => layer.role !== LayerRole.BACKGROUND));
    const bookmarkState = {};
    if (ConfigUtils.getConfigProp("storeAllLayersInPermalink")) {
        bookmarkState.layers = state.layers.flat.filter(layer => layer.role !== LayerRole.BACKGROUND);
    } else {
        const redliningLayers = exploded.map((entry, idx) => ({...entry, pos: idx}))
            .filter(entry => entry.layer.role === LayerRole.USERLAYER && entry.layer.type === 'vector')
            .map(entry => ({...entry.layer, pos: entry.pos}));
        bookmarkState.layers = redliningLayers;
    }
    bookmarkState.url = UrlParams.getFullUrl();
    axios.put(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" + bkey +
        "?url=" + encodeURIComponent(window.location.href) + "&description=" + description, bookmarkState)
        .then(() => callback(true))
        .catch(() => callback(false));
}
