/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');

const { createDevTools } = require('redux-devtools');
const LogMonitor = require('redux-devtools-log-monitor').default;
const DockMonitor = require('redux-devtools-dock-monitor').default;

module.exports = createDevTools(
    <DockMonitor changePositionKey="ctrl-q" toggleVisibilityKey="ctrl-h">
        <LogMonitor theme="tomorrow" />
    </DockMonitor>
);
