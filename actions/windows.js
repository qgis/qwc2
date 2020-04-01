/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const SHOW_IFRAME_DIALOG = 'SHOW_IFRAME_DIALOG';
const CLOSE_WINDOW = 'CLOSE_WINDOW';


function showIframeDialog(name, url)
{
    return {
        type: SHOW_IFRAME_DIALOG,
        name: name,
        url: url
    };
}

function closeWindow(name)
{
    return {
        type: CLOSE_WINDOW,
        name: name
    };
}

module.exports = {
    SHOW_IFRAME_DIALOG,
    CLOSE_WINDOW,
    showIframeDialog,
    closeWindow
}
