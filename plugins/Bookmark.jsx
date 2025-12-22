import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {refreshUserBookmarks} from '../actions/bookmark';
import {zoomToExtent, zoomToPoint} from "../actions/map";
import BookmarkPanel from '../components/BookmarkPanel';
import SideBar from '../components/SideBar';
import LocaleUtils from "../utils/LocaleUtils";
import MapUtils from "../utils/MapUtils";
import {createBookmark, openBookmark, removeBookmark, resolveBookmark, updateBookmark} from '../utils/PermaLinkUtils';


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
        refreshUserBookmarks: PropTypes.func,
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
        description: LocaleUtils.tr("bookmark.description"),
        lastUpdate: LocaleUtils.tr("bookmark.lastUpdate"),
        manage: LocaleUtils.tr("bookmark.manage"),
        nobookmarks: LocaleUtils.tr("bookmark.nobookmarks"),
        notloggedin: LocaleUtils.tr("bookmark.notloggedin"),
        open: LocaleUtils.tr("bookmark.open"),
        openTab: LocaleUtils.tr("bookmark.openTab"),
        remove: LocaleUtils.tr("bookmark.remove"),
        update: LocaleUtils.tr("bookmark.update"),
        zoomToExtent: LocaleUtils.tr("bookmark.zoomToExtent")
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
        const bookmarks = (this.props.bookmarks || []).filter(b => b.data.query.c && b.data.query.s);
        return (
            <BookmarkPanel
                bookmarks={bookmarks}
                onAdd={this.onAdd}
                onOpen={this.onOpen}
                onRemove={this.onRemove}
                onUpdate={this.onUpdate}
                onZoomToExtent={this.props.mapCrs && this.props.mapScales ? this.zoomToBookmarkExtent : null}
                translations={this.translations}
            />
        );
    };
    onOpen = (bookmark, newtab) => {
        openBookmark(bookmark, newtab);
    };
    onAdd = (description) => {
        createBookmark(description, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.addfailed"));
            }
            this.props.refreshUserBookmarks();
        });
    };
    onRemove = (bookmarkKey) => {
        removeBookmark(bookmarkKey, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.removefailed"));
            }
            this.props.refreshUserBookmarks();
        });
    };
    onUpdate = (bookmarkKey, description) => {
        updateBookmark(bookmarkKey, description, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.savefailed"));
            }
            this.props.refreshUserBookmarks();
        });
    };
    zoomToBookmarkExtent = (bookmarkkey) => {
        if (this.props.mapCrs && this.props.mapScales) {
            resolveBookmark(bookmarkkey, (params) => {
                if ('c' in params && 's' in params) {
                    const scale = parseFloat(params.s);
                    const zoom = MapUtils.computeZoom(this.props.mapScales, scale);
                    const center = params.c.split(/[;,]/g).map(x => parseFloat(x));
                    this.props.zoomToPoint(center, zoom, params.crs ?? this.props.mapCrs);
                } else if ('e' in params) {
                    const bounds = (params.e).split(',').map(n => parseFloat(n));
                    this.props.zoomToExtent(bounds, params.crs ?? this.props.mapCrs);
                }
            });
        }
    };
}
const selector = state => ({
    bookmarks: state.bookmark?.bookmarks,
    mapCrs: state.map?.projection,
    mapScales: state.map?.scales
});
export default connect(selector, {
    refreshUserBookmarks: refreshUserBookmarks,
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(Bookmark);
