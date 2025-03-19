/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';
import url from 'url';

import {LayerRole} from '../actions/layers';
import StandardApp from '../components/StandardApp';
import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';

let UrlQuery = {};
let historyUpdateTimeout = null;
let pendingParams = {};

export const UrlParams = {
    updateParams(dict, forceLocationUrl = false) {
        if (ConfigUtils.getConfigProp("omitUrlParameterUpdates") === true) {
            UrlQuery = Object.assign(UrlQuery, dict);
            const propNames = Object.getOwnPropertyNames(UrlQuery);

            for (const propName of propNames) {
                if (UrlQuery[propName] === undefined) {
                    delete UrlQuery[propName];
                }
            }
            if (!forceLocationUrl) {
                return;
            }
        }
        // Delay URL updates to avoid "Too many calls to Location or History APIs within a short timeframe."
        if (historyUpdateTimeout !== null) {
            clearTimeout(historyUpdateTimeout);
        }
        pendingParams = {...pendingParams, ...dict};
        historyUpdateTimeout = setTimeout(() => {
            const urlObj = url.parse(window.location.href, true);
            urlObj.query = Object.assign(urlObj.query, pendingParams);
            const propNames = Object.getOwnPropertyNames(urlObj.query);

            for (const propName of propNames) {
                if (urlObj.query[propName] === undefined) {
                    delete urlObj.query[propName];
                }
            }
            delete urlObj.search;
            history.replaceState({id: urlObj.host}, '', url.format(urlObj));
            historyUpdateTimeout = null;
            pendingParams = {};
        }, 250);
    },
    getParam(key) {
        const urlObj = url.parse(window.location.href, true);
        if (ConfigUtils.getConfigProp("omitUrlParameterUpdates") === true) {
            return urlObj.query[key] ?? UrlQuery[key];
        } else {
            return urlObj.query[key];
        }
    },
    getParams() {
        const query = url.parse(window.location.href, true).query;
        if (ConfigUtils.getConfigProp("omitUrlParameterUpdates") === true) {
            return {...UrlQuery, ...query};
        } else {
            return query;
        }
    },
    clear() {
        this.updateParams({k: undefined, t: undefined, l: undefined, bl: undefined, bk: undefined, c: undefined, s: undefined, e: undefined, crs: undefined, st: undefined, sp: undefined, f: undefined}, true);
    },
    getFullUrl() {
        if (ConfigUtils.getConfigProp("omitUrlParameterUpdates") === true) {
            const urlObj = url.parse(window.location.href, true);
            urlObj.query = UrlQuery;
            delete urlObj.search;
            return url.format(urlObj);
        } else {
            return window.location.href;
        }
    }
};

const PermalinkDataHooks = {};

export function registerPermalinkDataStoreHook(key, storeFn) {
    PermalinkDataHooks[key] = storeFn;
}

export function unregisterPermalinkDataStoreHook(key) {
    delete PermalinkDataHooks[key];
}

async function executePermalinkDataStoreHooks(permalinkState) {
    for await (const [key, storeFn] of Object.entries(PermalinkDataHooks)) {
        permalinkState[key] = await storeFn();
    }
}

export async function generatePermaLink(callback, user = false, permittedGroup = "") {
    const state = StandardApp.store.getState();
    const fullUrl = UrlParams.getFullUrl();
    if (!ConfigUtils.getConfigProp("permalinkServiceUrl")) {
        callback(fullUrl);
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
    permalinkState.permalinkParams = state.localConfig.permalinkParams;
    permalinkState.url = fullUrl;
    const params = {
        permitted_group: permittedGroup || null
    };
    await executePermalinkDataStoreHooks(permalinkState);
    const route = user ? "userpermalink" : "createpermalink";
    axios.post(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/" + route, permalinkState, {params})
        .then(response => callback(response.data.permalink || fullUrl, response.data.expires || null))
        .catch(() => callback(fullUrl));
}

export function resolvePermaLink(initialParams, callback) {
    const key = UrlParams.getParam('k');
    const bkey = UrlParams.getParam('bk');
    if (key) {
        axios.get(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/resolvepermalink?key=" + key)
            .then(response => {
                const data = response.data;
                callback({...initialParams, ...(data.query || {}), ...(data.state.permalinkParams || {})}, data.state || {}, !!data.query);
            })
            .catch(() => {
                callback(initialParams, {}, false);
            });
    } else if (bkey) {
        axios.get(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" + bkey)
            .then(response => {
                const data = response.data;
                callback({...initialParams, ...(data.query || {}), ...(data.state.permalinkParams || {})}, (data.state || {}), !!data.query);
            })
            .catch(() => {
                callback(initialParams, {}, false);
            });
    } else {
        callback(initialParams, {}, true);
    }
}

export function resolveBookmark(bookmarkKey, callback) {
    axios.get(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" + bookmarkKey)
        .then(response => {
            const data = response.data;
            callback({...(data.query || {})}, (data.state || {}), !!data.query);
        })
        .catch(() => {
            callback(bookmarkKey, {}, false);
        });
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

export async function createBookmark(description, callback) {
    if (!ConfigUtils.getConfigProp("permalinkServiceUrl")) {
        callback(false);
        return;
    }
    const state = StandardApp.store.getState();
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
    bookmarkState.permalinkParams = state.localConfig.permalinkParams;
    bookmarkState.url = UrlParams.getFullUrl();
    await executePermalinkDataStoreHooks(bookmarkState);
    axios.post(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" +
        "?description=" + description, bookmarkState)
        .then(() => callback(true))
        .catch(() => callback(false));
}

export async function updateBookmark(bkey, description, callback) {
    if (!ConfigUtils.getConfigProp("permalinkServiceUrl")) {
        callback(false);
        return;
    }
    const state = StandardApp.store.getState();
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
    bookmarkState.permalinkParams = state.localConfig.permalinkParams;
    bookmarkState.url = UrlParams.getFullUrl();
    await executePermalinkDataStoreHooks(bookmarkState);
    axios.put(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" + bkey +
        "?description=" + description, bookmarkState)
        .then(() => callback(true))
        .catch(() => callback(false));
}

export function removeBookmark(bkey, callback) {
    if (bkey) {
        axios.delete(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/bookmarks/" + bkey)
            .then(() => {
                callback(true);
            }).catch(() => callback(false));
    }
}
