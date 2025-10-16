/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ConfigUtils from './ConfigUtils';

const MiscUtils = {
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
                // eslint-disable-next-line
                "(\\s|^)((http(s)?|(s)?ftp):\\\/\\\/.)?(www\\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_+.~#?&\/\/=\\u00C0-\\u00FF\\u0370-\\u03FF]*)"
            ),
            "g"
        );

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
    hslToRgb(h, s, l) {
        // Takes h, s, l in [0, 1] range and returns [r, g, b] in [0, 1] range
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        h *= 360;

        let r = 0;
        let g = 0;
        let b = 0;

        if (h >= 0 && h < 60) {
            r = c; g = x; b = 0;
        } else if (h >= 60 && h < 120) {
            r = x; g = c; b = 0;
        } else if (h >= 120 && h < 180) {
            r = 0; g = c; b = x;
        } else if (h >= 180 && h < 240) {
            r = 0; g = x; b = c;
        } else if (h >= 240 && h < 300) {
            r = x; g = 0; b = c;
        } else if (h >= 300 && h < 360) {
            r = c; g = 0; b = x;
        }

        return [r + m, g + m, b + m];
    },
    ensureArray(el) {
        if (el === undefined) {
            return [];
        } else if (Array.isArray(el)) {
            return el;
        }
        return [el];
    },
    capitalizeFirst(text) {
        return text.slice(0, 1).toUpperCase() + text.slice(1);
    },
    isBrightColor(hex) {
        const color = +("0x" + hex.slice(1).replace(hex.length < 5 && /./g, '$&$&'));
        const r = color >> 16;
        const g = color >> 8 & 255;
        const b = color & 255;

        const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
        return hsp > 127.5;
    },
    adjustProtocol(url) {
        if (location.protocol === 'https:' && url.startsWith('http:')) {
            return 'https:' + url.substr(5);
        }
        return url;
    },
    convertEmToPx(emsize) {
        const defaultfontsize = getComputedStyle(document.documentElement).fontSize;
        return emsize * parseFloat(defaultfontsize);
    },
    getFaviconFromIcon(icon, size) {
        let glyph = null;
        for (const sheet of document.styleSheets) {
            for (const rule of sheet.cssRules) {
                if (rule.selectorText === `.icon-${icon}::before`) {
                    glyph = rule.style.content.replace(/["']/g, '');
                    break;
                }
            }
        }
        if (glyph === null) {
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        ctx.font = `${size - 5}px qwc2-icons`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFF'; // You can change this color if needed
        ctx.fillText(glyph, size / 2, size / 2);

        return canvas.toDataURL('image/png');
    },
    resolveAssetsPath(path) {
        return path && path.startsWith(":/") ? ConfigUtils.getAssetsPath() + path.substr(1) : path;
    }
};

export class ToggleSet {
    constructor(set = new Set()) {
        this._set = set;
    }
    has = (key) => {
        return this._set.has(key);
    };
    toggle = (key) => {
        const newset = new Set(this._set);
        if (newset.has(key)) {
            newset.delete(key);
        } else {
            newset.add(key);
        }
        return new ToggleSet(newset);
    };
    delete = (key) => {
        if (this._set.has(key)) {
            const newset = new Set(this._set);
            newset.delete(key);
            return new ToggleSet(newset);
        } else {
            return this;
        }
    };
    add = (key) => {
        if (!this._set.has(key)) {
            const newset = new Set(this._set);
            newset.add(key);
            return new ToggleSet(newset);
        } else {
            return this;
        }
    };
    size = () => {
        return this._set.size;
    };
    entries = () => {
        return [...this._set];
    };
}

export default MiscUtils;
