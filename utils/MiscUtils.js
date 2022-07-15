/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const MiscUtils = {
    addLinkAnchors(text) {
        // If text already contains tags, do nothing
        const tagRegEx = /(<.[^(><.)]+>)/;
        if (tagRegEx.exec(text)) {
            return text;
        }
        const urlRegEx = /(\s|^)((http(s)?|(s)?ftp):\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g;

        let value = text;
        let match = null;
        while ((match = urlRegEx.exec(value))) {
            // If URL is part of a HTML attribute, don't add anchor
            if (value.substring(match.index - 2, match.index).match(/^=['"]$/) === null) {
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
                const anchor = "<a href=\"" + MiscUtils.htmlEncode(protoUrl) + "\" target=\"_blank\">" + MiscUtils.htmlEncode(url) + "</a>";
                value = value.substring(0, pos) + anchor + value.substring(pos + url.length);
                urlRegEx.lastIndex = pos + anchor.length;
            }
        }
        // Reset
        urlRegEx.lastIndex = 0;
        return value;
    },
    htmlEncode(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },
    getCsrfToken() {
        const csrfTag = Array.from(document.getElementsByTagName('meta')).find(tag => tag.getAttribute('name') === "csrf-token");
        return csrfTag ? csrfTag.getAttribute('content') : "";
    },
    setupKillTouchEvents(el) {
        if (el) {
            // To stop touchmove propagating to parent which can trigger a swipe
            el.addEventListener('touchmove', (ev) => { ev.stopPropagation(); }, {passive: false});
        }
    },
    killEvent(ev) {
        if (ev.cancelable) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    },
    blendColors(color1, color2, ratio) {
        color1 = [parseInt(color1[1] + color1[2], 16), parseInt(color1[3] + color1[4], 16), parseInt(color1[5] + color1[6], 16)];
        color2 = [parseInt(color2[1] + color2[2], 16), parseInt(color2[3] + color2[4], 16), parseInt(color2[5] + color2[6], 16)];
        const color3 = [
            (1 - ratio) * color1[0] + ratio * color2[0],
            (1 - ratio) * color1[1] + ratio * color2[1],
            (1 - ratio) * color1[2] + ratio * color2[2]
        ];
        const toHex = (num) => ("0" + Math.round(num).toString(16)).slice(-2);
        return '#' + toHex(color3[0]) + toHex(color3[1]) + toHex(color3[2]);
    },
    ensureArray(el) {
        if (el === undefined) {
            return [];
        } else if (Array.isArray(el)) {
            return el;
        }
        return [el];
    }
};

export default MiscUtils;
