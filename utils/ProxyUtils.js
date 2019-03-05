/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ConfigUtils = require('./ConfigUtils');

var ProxyUtils = {
    addProxyIfNeeded: function(uri, extraQueryParams = "") {
        var needed = false;
        var sameOrigin = !(uri.indexOf("http") === 0);
        var urlParts = !sameOrigin && uri.match(/([^:]*:)\/\/([^:]*:?[^@]*@)?([^:\/\?]*):?([^\/\?]*)/);
        if (urlParts) {
            let location = window.location;
            sameOrigin =
                urlParts[1] === location.protocol &&
                urlParts[3] === location.hostname;
            let uPort = urlParts[4];
            let lPort = location.port;
            if (uPort !== 80 && uPort !== "" || lPort !== "80" && lPort !== "") {
                sameOrigin = sameOrigin && uPort === lPort;
            }
        }
        if (!sameOrigin) {
            let proxyUrl = ConfigUtils.getProxyUrl();
            if (proxyUrl) {
                let useCORS = [];
                if (proxyUrl instanceof Object) {
                    useCORS = proxyUrl.useCORS || [];
                    proxyUrl = proxyUrl.url;
                }
                const isCORS = useCORS.reduce((found, current) => found || uri.indexOf(current) === 0, false);
                if (!isCORS) {
                    needed = true;
                }
                if(needed) {
                    return proxyUrl + "?url=" + encodeURIComponent(uri) + extraQueryParams;
                }
            } else {
                console.warn("Proxy required for cross-origin request, but no proxy is configured.");
            }
        }
        return uri;
    }
};
module.exports = ProxyUtils;
