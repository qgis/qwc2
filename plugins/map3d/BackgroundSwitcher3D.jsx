/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import {BackgroundSwitcher} from '../BackgroundSwitcher';


/**
 * Map button for switching the background layer of the 3D map.
 */
export default class BackgroundSwitcher3D extends React.Component {
    static availableIn3D = true;

    static propTypes = {
        /** The button click action, either `select` or `cycle`. */
        buttonClickAction: PropTypes.string,
        /** The button display mode, either `button` or `thumbnail`. */
        buttonDisplayMode: PropTypes.string,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        sceneContext: PropTypes.object,
        /** Whether to show the thumbnails of the group children when hovering a group item. */
        showGroupThumbnails: PropTypes.bool
    };
    static defaultProps = {
        buttonClickAction: 'select',
        buttonDisplayMode: 'button',
        position: 0
    };
    render() {
        return (
            <BackgroundSwitcher
                backgroundLayers={this.props.sceneContext.baseLayers}
                buttonClickAction={this.props.buttonClickAction} buttonDisplayMode={this.props.buttonDisplayMode}
                changeLayerVisibility={this.props.sceneContext.setBaseLayer}
                nobgMsgId={LocaleUtils.trmsg("map3d.noterrain")} position={this.props.position}
                showGroupThumbnails={this.props.showGroupThumbnails}
            />
        );
    }
}
