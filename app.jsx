/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {createRoot} from 'react-dom/client';

import appConfig from './appConfig';
import StandardApp from './components/StandardApp';

import './icons/build/qwc2-icons.css';

const container = document.getElementById('container');
const root = createRoot(container);
root.render(<StandardApp appConfig={appConfig}/>);
