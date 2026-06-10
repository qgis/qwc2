/**
 * Copyright 2026 Stadtwerke München GmbH
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from "prop-types";

import {refreshVisibilityPresets} from '../actions/bookmark';
import {setThemeLayersVisibilityPreset} from '../actions/layers';
import BookmarkPanel from '../components/BookmarkPanel';
import SideBar from "../components/SideBar";
import LocaleUtils from '../utils/LocaleUtils';
import {
    storeVisibilityPreset,
    updateVisibilityPreset,
    renameVisibilityPreset,
    removeVisibilityPreset,
    resolveVisibilityPreset
} from '../utils/PermaLinkUtils';


/**
 *  Allows managing custom user visibility presets, which are storing the currently selected layers without location or
 *  zoom level.
 *
 *  Visibility presets are only allowed for authenticated users.
 *
 *  Requires `permalinkServiceUrl` to point to a `qwc-permalink-service` with tables setup for visibility presets
 *  (see `qwc-permalink-service` documentation for details).
 **/

class VisibilityPreset extends React.Component {
    static availableIn3D = true;
    static propTypes = {
        /** Whether to directly open the bookmark on click / middle click, instead of showing dedicated open buttons. */
        openOnClick: PropTypes.bool,
        refreshVisibilityPresets: PropTypes.func,
        setThemeLayersVisibilityPreset: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object,
        visibilityPresets: PropTypes.array

    };
    static defaultProps = {
        side: 'right'
    };
    translations =  {
        add: LocaleUtils.tr("visibilitypreset.add"),
        addfailed: LocaleUtils.tr("visibilitypreset.addfailed"),
        manage: LocaleUtils.tr("visibilitypreset.manage"),
        newbookmark: LocaleUtils.tr("visibilitypreset.newpreset"),
        nobookmarks: LocaleUtils.tr("visibilitypreset.nopresets"),
        notloggedin: LocaleUtils.tr("visibilitypreset.notloggedin"),
        open: LocaleUtils.tr("visibilitypreset.open"),
        update: LocaleUtils.tr("visibilitypreset.update"),
        removefailed: LocaleUtils.tr("visibilitypreset.removefailed"),
        savefailed: LocaleUtils.tr("visibilitypreset.savefailed")
    };
    render() {
        return (
            <SideBar icon="eye" id="VisibilityPresets"
                side={this.props.side}
                title={LocaleUtils.tr("appmenu.items.VisibilityPresets")} width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    filterByActiveTheme = (visibilityPresets, themeId) => {
        if (themeId == null) return [];
        return (visibilityPresets || []).filter((vp) =>
            vp.theme_id != null && String(vp.theme_id) === String(themeId)
        );
    };
    renderBody = () => {
        const presets = this.filterByActiveTheme(this.props.visibilityPresets, this.props.theme?.id);
        return (
            <BookmarkPanel
                bookmarks={presets}
                onAdd={storeVisibilityPreset}
                onOpen={this.onOpen}
                onRefresh={this.props.refreshVisibilityPresets}
                onRemove={removeVisibilityPreset}
                onRename={renameVisibilityPreset}
                onUpdate={updateVisibilityPreset}
                openOnClick={this.props.openOnClick}
                showOpenTab={false}
                translations={this.translations}
            />
        );
    };

    onOpen = (key, newtab = false) => {
        resolveVisibilityPreset(key, (preset) => {
            if (preset) {
                this.props.setThemeLayersVisibilityPreset(preset);
            }
        });
    };

}
const selector = state => ({
    theme: state.theme.current,
    visibilityPresets: state.bookmark?.visibilityPresets ?? []
});
export default connect(selector, {
    refreshVisibilityPresets: refreshVisibilityPresets,
    setThemeLayersVisibilityPreset: setThemeLayersVisibilityPreset
})(VisibilityPreset);
