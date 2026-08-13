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

import {setVisibilityPresets} from '../actions/bookmark';
import {setThemeLayersVisibilityPreset} from '../actions/layers';
import BookmarkPanel from '../components/BookmarkPanel';
import SideBar from "../components/SideBar";
import LocaleUtils from '../utils/LocaleUtils';
import {VisibilityPresetsInterface} from '../utils/PermaLinkUtils';


/**
 * Allows managing custom user visibility presets, which are storing the currently selected layers without location or
 * zoom level.
 *
 * Visibility presets are only allowed for authenticated users.
 *
 * Requires `permalinkServiceUrl` to point to a `qwc-permalink-service` with tables setup for visibility presets
 * (see `qwc-permalink-service` documentation for details).
 **/

class VisibilityPreset extends React.Component {
    static availableIn3D = true;
    static propTypes = {
        /** Whether to directly open the bookmark on click / middle click, instead of showing dedicated open buttons. */
        openOnClick: PropTypes.bool,
        setThemeLayersVisibilityPreset: PropTypes.func,
        setVisibilityPresets: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object,
        visibilityPresets: PropTypes.array

    };
    static defaultProps = {
        side: 'right'
    };
    translations =  {
        addfailed: LocaleUtils.tr("visibilitypreset.addfailed"),
        title: LocaleUtils.tr("appmenu.items.VisibilityPresets"),
        new: LocaleUtils.tr("visibilitypreset.newpreset"),
        noitems: LocaleUtils.tr("visibilitypreset.nopresets"),
        open: LocaleUtils.tr("visibilitypreset.open"),
        update: LocaleUtils.tr("visibilitypreset.update"),
        removefailed: LocaleUtils.tr("visibilitypreset.removefailed"),
        savefailed: LocaleUtils.tr("visibilitypreset.savefailed"),
        togglePublic: LocaleUtils.tr("visibilitypreset.togglePublic"),
        public: LocaleUtils.tr("visibilitypreset.public"),
        confirmOverwrite: LocaleUtils.tr("visibilitypreset.confirmOverwrite"),
        confirmDelete: LocaleUtils.tr("visibilitypreset.confirmDelete")
    };
    componentDidMount() {
        VisibilityPresetsInterface.getList((presets) => {
            this.props.setVisibilityPresets(presets);
        });
    }
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
        if (themeId === null) return [];
        return (visibilityPresets || []).filter((vp) =>
            vp.theme_id !== null && String(vp.theme_id) === String(themeId)
        );
    };
    renderBody = () => {
        const presets = this.filterByActiveTheme(this.props.visibilityPresets, this.props.theme?.id);
        return (
            <BookmarkPanel
                bookmarkIface={VisibilityPresetsInterface}
                bookmarks={presets}
                onOpen={this.onOpen}
                openOnClick={this.props.openOnClick}
                setList={this.props.setVisibilityPresets}
                translations={this.translations}
            />
        );
    };

    onOpen = (key, newtab = false) => {
        if (newtab) {
            const url = location.href.split("?")[0] + '?vp=' + key;
            window.open(url, '_blank');
        } else {
            VisibilityPresetsInterface.resolve(key, (preset) => {
                if (preset) {
                    this.props.setThemeLayersVisibilityPreset(preset);
                }
            });
        }
    };

}
const selector = state => ({
    theme: state.theme.current,
    visibilityPresets: state.bookmark?.visibilityPresets ?? []
});
export default connect(selector, {
    setVisibilityPresets: setVisibilityPresets,
    setThemeLayersVisibilityPreset: setThemeLayersVisibilityPreset
})(VisibilityPreset);
