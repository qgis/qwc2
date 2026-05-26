import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {refreshBookmarks} from '../actions/bookmark';
import {zoomToExtent, zoomToPoint} from "../actions/map";
import BookmarkPanel from '../components/BookmarkPanel';
import SideBar from '../components/SideBar';
import LocaleUtils from "../utils/LocaleUtils";
import MapUtils from "../utils/MapUtils";
import {createBookmark, removeBookmark, renameBookmark, resolveBookmark, updateBookmark} from '../utils/PermaLinkUtils';


/**
 * Allows managing user bookmarks which are storing the current view, including the location and zoom level.
 *
 * Bookmarks are only allowed for authenticated users.
 *
 * Requires `permalinkServiceUrl` to point to a `qwc-permalink-service`.
 */
class Bookmark extends React.Component {
    static availableIn3D = true;
    static propTypes = {
        bookmarks: PropTypes.array,
        mapCrs: PropTypes.string,
        mapScales: PropTypes.array,
        /** Whether to directly open the bookmark on click / middle click, instead of showing dedicated open buttons. */
        openOnClick: PropTypes.bool,
        refreshBookmarks: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        zoomToExtent: PropTypes.func,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        side: 'right'
    };
    translations = {
        add: LocaleUtils.tr("bookmark.add"),
        addfailed: LocaleUtils.tr("bookmark.addfailed"),
        lastUpdate: LocaleUtils.tr("bookmark.lastUpdate"),
        manage: LocaleUtils.tr("bookmark.manage"),
        newbookmark: LocaleUtils.tr("bookmark.newbookmark"),
        nobookmarks: LocaleUtils.tr("bookmark.nobookmarks"),
        notloggedin: LocaleUtils.tr("bookmark.notloggedin"),
        open: LocaleUtils.tr("bookmark.open"),
        openTab: LocaleUtils.tr("bookmark.openTab"),
        update: LocaleUtils.tr("bookmark.update"),
        zoomToExtent: LocaleUtils.tr("bookmark.zoomToExtent"),
        removefailed: LocaleUtils.tr("bookmark.removefailed"),
        savefailed: LocaleUtils.tr("bookmark.savefailed")
    };
    render() {
        return (
            <SideBar icon="bookmark" id="Bookmark"
                side={this.props.side}
                title={LocaleUtils.tr("appmenu.items.Bookmark")} width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
        return (
            <BookmarkPanel
                bookmarks={this.props.bookmarks}
                onAdd={createBookmark}
                onOpen={this.onOpen}
                onRefresh={this.props.refreshBookmarks}
                onRemove={removeBookmark}
                onRename={renameBookmark}
                onUpdate={updateBookmark}
                onZoomToExtent={this.zoomToBookmarkExtent}
                openOnClick={this.props.openOnClick}
                showZoomToExtent={this.props.mapCrs && this.props.mapScales}
                translations={this.translations}
            />
        );
    };

    onOpen = (key, newtab) => {
        const url = location.href.split("?")[0] + '?bk=' + key;
        if (newtab) {
            window.open(url, '_blank');
        } else {
            location.href = url;
        }
    };

    zoomToBookmarkExtent = (key) => {
        resolveBookmark(key, (params) => {
            if ('c' in params && 's' in params) {
                const scale = parseFloat(params.s);
                const zoom = MapUtils.computeZoom(this.props.mapScales, scale);
                const center = params.c.split(/[;,]/g).map(x => parseFloat(x));
                this.props.zoomToPoint(center, zoom, params.crs ?? this.props.mapCrs);
            } else if ('e' in params) {
                const bounds = params.e.split(',').map(n => parseFloat(n));
                this.props.zoomToExtent(bounds, params.crs ?? this.props.mapCrs);
            }
        });
    };
}
const selector = state => ({
    bookmarks: state.bookmark?.bookmarks,
    mapCrs: state.map?.projection,
    mapScales: state.map?.scales
});
export default connect(selector, {
    refreshBookmarks: refreshBookmarks,
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(Bookmark);
