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
        const clearKeys = ['k', 't', 'l', 'bl', 'bk', 'c', 'hc', 'ic', 'if', 's', 'e', 'crs', 'st', 'sp', 'f', 'v', 'vp', 'v3d', 'bl3d', 'task'];
        this.updateParams(clearKeys.reduce((res, key) => ({...res, [key]: undefined}), {}), true);
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

async function executePermalinkDataStoreHooks(permalinkState, query) {
    for await (const [key, storeFn] of Object.entries(PermalinkDataHooks)) {
        const result = await storeFn();
        if (result.state) {
            permalinkState[key] = result.state;
        }
        if (result.query) {
            Object.assign(query, result.query);
        }
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
    const urlObj = url.parse(UrlParams.getFullUrl(), true);
    const queryParams = {};
    await executePermalinkDataStoreHooks(permalinkState, queryParams);
    Object.assign(urlObj.query, queryParams);
    delete urlObj.search;
    permalinkState.url = url.format(urlObj);
    const params = {
        permitted_group: permittedGroup || null
    };
    const route = user ? "userpermalink" : "createpermalink";
    axios.post(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/" + route, permalinkState, {params})
        .then(response => callback(response.data.permalink || fullUrl, response.data.expires || null))
        .catch(() => callback(fullUrl));
}

export function resolvePermaLink(initialParams, callback) {
    const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
    const key = initialParams.k;
    const bkey = initialParams.bk;
    const vpKey = initialParams.vp;
    if (!permalinkServiceUrl || (!key && !bkey && !vpKey)) {
        callback(initialParams, {}, true);
        return;
    }

    if (vpKey) {
        // eslint-disable-next-line no-use-before-define
        VisibilityPresetsInterface.resolve(vpKey, (preset, themeId) => {
            if (preset && themeId) {
                callback(
                    {...initialParams, t: themeId},
                    {visibilityPreset: preset},
                    true
                );
            } else {
                callback(initialParams, {}, false);
            }
        });
        return;
    }

    const path = key ? "/resolvepermalink?key=" + key : "/bookmarks/" + bkey;
    axios.get(permalinkServiceUrl + path)
        .then(response => {
            const data = response.data;
            callback({...initialParams, ...data.query}, data.state || {}, !!data.query);
        })
        .catch(() => {
            callback(initialParams, {}, false);
        });

}

// Bookmarks
export const BookmarksInterface = {
    resolve(bkey, callback) {
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.get(permalinkServiceUrl + "/bookmarks/" + bkey)
            .then(response => {
                const data = response.data;
                callback(data.query || {}, data.state || {}, !!data.query);
            })
            .catch(() => callback({}, {}, false));
    },
    getList(callback) {
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.get(permalinkServiceUrl + "/bookmarks/")
            .then(response => callback(response.data || []))
            .catch(() => callback([]));
    },
    async _getState() {
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
        const urlObj = url.parse(UrlParams.getFullUrl(), true);
        const queryParams = {};
        await executePermalinkDataStoreHooks(bookmarkState, queryParams);
        Object.assign(urlObj.query, queryParams);
        delete urlObj.search;
        bookmarkState.url = url.format(urlObj);
        return bookmarkState;
    },
    async create(description, callback) {
        const bookmarkState = await(BookmarksInterface._getState());
        const themeId = StandardApp.store.getState().theme?.current?.id ?? null;
        const params = {description, theme_id: themeId};
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.post(permalinkServiceUrl + "/bookmarks/", bookmarkState, {params})
            .then((response) => callback(response.data?.success, response.data?.key))
            .catch(() => callback(false, null));
    },
    async update(bkey, params, updateData, callback) {
        const bookmarkState = updateData ? await(BookmarksInterface._getState()) : null;
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.put(permalinkServiceUrl + "/bookmarks/" + bkey, bookmarkState, {params})
            .then((response) => callback(response.data?.success))
            .catch(() => callback(false));
    },
    delete(bkey, callback) {
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.delete(permalinkServiceUrl + "/bookmarks/" + bkey)
            .then((response) => callback(response.data?.success))
            .catch(() => callback(false));
    }
};

export const VisibilityPresetsInterface = {
    resolve(vpkey, callback) {
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.get(permalinkServiceUrl + "/visibility_presets/" + vpkey)
            .then(response => callback(response.data?.visibility_preset, response.data?.theme_id))
            .catch(() => callback(null, null));
    },
    getList(callback) {
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.get(permalinkServiceUrl + "/visibility_presets/")
            .then(response => callback(response.data || []))
            .catch(() => callback([]));
    },
    create(description, callback) {
        const state = StandardApp.store.getState();
        const preset = LayerUtils.computeVisibilityPreset(state.layers.flat);
        const themeId = state.theme?.current?.id ?? null;
        const params = {description, theme_id: themeId};
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.post(permalinkServiceUrl + "/visibility_presets/", preset, {params})
            .then((response) => callback(response.data?.success, response.data?.key))
            .catch(() => callback(false));
    },
    update(vpkey, params_, updateData, callback) {
        const state = StandardApp.store.getState();
        const preset = updateData ? LayerUtils.computeVisibilityPreset(state.layers.flat) : null;
        const themeId = state.theme?.current?.id ?? null;
        const params = {...params_, theme_id: themeId};
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.put(permalinkServiceUrl + "/visibility_presets/" + vpkey, preset, {params})
            .then((response) => callback(response.data?.success))
            .catch(() => callback(false));
    },
    delete(vpkey, callback) {
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl")?.replace?.(/\/$/, '');
        axios.delete(permalinkServiceUrl + "/visibility_presets/" + vpkey)
            .then((response) => callback(response.data?.success))
            .catch(() => callback(false));
    }

};
