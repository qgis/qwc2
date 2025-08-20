/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import {BackgroundSwitcher} from '../BackgroundSwitcher';


/**
 * Map button for switching the background layer of the 3D map.
 */
export default class BackgroundSwitcher3D extends React.Component {
    static availableIn3D = true;

    static propTypes = {
        sceneContext: PropTypes.object
    };
    render() {
        return (
            <BackgroundSwitcher changeLayerVisibility={this.props.sceneContext.setBaseLayer} layers={this.props.sceneContext.baseLayers} />
        );
    }
}
