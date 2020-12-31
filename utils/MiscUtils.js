/**
* Copyright 2018, Sourcepole AG.
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
    }
};

export default MiscUtils;
