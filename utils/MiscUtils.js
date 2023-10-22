/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ConfigUtils from './ConfigUtils';


/**
 * Various other utility functions.
 * 
 * @namespace
 */
const MiscUtils = {
    /**
     * Add anchor tags to URLs in text.
     * 
     * @param {string} text - the text to process.
     * 
     * @return {string} The processed text.
     */
    addLinkAnchors(text) {
        // If text already contains tags, do nothing
        const tagRegEx = /(<.[^(><.)]+>)/;
        if (tagRegEx.exec(text)) {
            return text;
        }
        const urlRegEx = new RegExp(
            ConfigUtils.getConfigProp(
                "urlRegEx",
                null,
                // Original String: (\s|^)((http(s)?|(s)?ftp):\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=\u00C0-\u00FF\u0370-\u03FF]*)
                // Escaped with https://www.freeformatter.com/json-escape.html
                "(\\s|^)((http(s)?|(s)?ftp):\\\/\\\/.)?(www\\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_+.~#?&\/\/=\\u00C0-\\u00FF\\u0370-\\u03FF]*)"
            ),
            "g"
        );

        let value = text;
        let match = null;
        while ((match = urlRegEx.exec(value))) {
            // If URL is part of a HTML attribute, don't add anchor
            if (
                value.substring(
                    match.index - 2, match.index
                ).match(/^=['"]$/) === null
            ) {
                const url = match[0].substr(match[1].length);
                let protoUrl = url;
                if (match[2] === undefined) {
                    if (match[0].indexOf('@') !== -1) {
                        protoUrl = "mailto:" + url;
                    } else {
                        protoUrl = "http://" + url;
                    }
                }
                const pos = match.index + match[1].length;
                const anchor = (
                    "<a href=\"" + 
                    MiscUtils.htmlEncode(protoUrl) + 
                    "\" target=\"_blank\">" + 
                    MiscUtils.htmlEncode(url) + 
                    "</a>"
                );
                value = (
                    value.substring(0, pos) + 
                    anchor + 
                    value.substring(pos + url.length)
                );
                urlRegEx.lastIndex = pos + anchor.length;
            }
        }
        // Reset
        urlRegEx.lastIndex = 0;
        return value;
    },

    /**
     * Encode HTML special characters in text.
     * 
     * @param {string} text - the text to process.
     * 
     * @return {string} The processed text.
     */
    htmlEncode(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    /**
     * Retrieve the CSRF token from the page.
     * 
     * The function looks for a `meta` tag with name `csrf-token`
     * and returns its `content` attribute.
     * 
     * @return {string} The CSRF token if it exists or an
     *  empty string otherwise.
     */
    getCsrfToken() {
        const csrfTag = Array.from(
            document.getElementsByTagName('meta')
        ).find(
            tag => tag.getAttribute('name') === "csrf-token"
        );
        return csrfTag ? csrfTag.getAttribute('content') : "";
    },

    /**
     * Install a `touchmove` event handler on the given element
     * to stop the event from propagating to the parent.
     * 
     * We need to do this to stop touchmove propagating to
     * parent which can trigger a swipe.
     * 
     * @param {Element} el - the element to install the handler on.
     */
    setupKillTouchEvents(el) {
        if (el) {
            el.addEventListener(
                'touchmove', (ev) => {
                    ev.stopPropagation();
                }, {
                passive: false
            });
        }
    },

    /**
     * Stop the given event from propagating and prevent its default action.
     */
    killEvent(ev) {
        if (ev.cancelable) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    },

    /**
     * Average two colors.
     * 
     * @param {string} color1 - the first color as a #RRGGBB string.
     * @param {string} color2 - the second color as a #RRGGBB string.
     * @param {number} ratio - the ratio of the first color
     *  relative to the second.
     * 
     * @return {string} The average color as a #RRGGBB string.
     */
    blendColors(color1, color2, ratio) {
        color1 = [
            parseInt(color1[1] + color1[2], 16),
            parseInt(color1[3] + color1[4], 16),
            parseInt(color1[5] + color1[6], 16)
        ];
        color2 = [
            parseInt(color2[1] + color2[2], 16),
            parseInt(color2[3] + color2[4], 16),
            parseInt(color2[5] + color2[6], 16)
        ];
        const color3 = [
            (1 - ratio) * color1[0] + ratio * color2[0],
            (1 - ratio) * color1[1] + ratio * color2[1],
            (1 - ratio) * color1[2] + ratio * color2[2]
        ];
        const toHex = (num) => ("0" + Math.round(num).toString(16)).slice(-2);
        return '#' + toHex(color3[0]) + toHex(color3[1]) + toHex(color3[2]);
    },

    /**
     * Ensure that the given element is an array.
     * 
     * @param {*} el - the element to ensure.
     * 
     * @return {Array} an array containing the element or
     * an empty array if the element is undefined.
     */
    ensureArray(el) {
        if (el === undefined) {
            return [];
        } else if (Array.isArray(el)) {
            return el;
        }
        return [el];
    },

    /**
     * Capitalize the first letter of the given text.
     * 
     * @param {string} text - the text to process.
     * 
     * @return {string} The processed text.
     */
    capitalizeFirst(text) {
        return (
            text.slice(0, 1).toUpperCase() +
            text.slice(1).toLowerCase()
        );
    },

    /**
     * Check if the given color is bright.
     */
    isBrightColor(hex) {
        const color = +(
            "0x" + hex.slice(1).replace(hex.length < 5 && /./g, '$&$&')
        );
        const r = color >> 16;
        const g = color >> 8 & 255;
        const b = color & 255;
        const hsp = Math.sqrt(
            0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)
        );
        return hsp > 127.5;
    },

    /**
     * Adjust the protocol of the given URL to the current protocol.
     * 
     * @param {string} url - the URL to adjust.
     * 
     * @return {string} The adjusted URL.
     */
    adjustProtocol(url) {
        if (location.protocol === 'https:' && url.startsWith('http:')) {
            return 'https:' + url.substr(5);
        }
        return url;
    }
};

export default MiscUtils;
