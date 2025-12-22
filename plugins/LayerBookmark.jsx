import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {refreshUserBookmarks} from '../actions/bookmark';
import BookmarkPanel from '../components/BookmarkPanel';
import SideBar from '../components/SideBar';
import LocaleUtils from "../utils/LocaleUtils";
import {createBookmark, openBookmark, removeBookmark, updateBookmark} from '../utils/PermaLinkUtils';


/**
 * Allows managing layer bookmarks which are storing the currently visible layers without the location and zoom level.
 *
 * Bookmarks are only allowed for authenticated users.
 *
 * Requires `permalinkServiceUrl` to point to a `qwc-permalink-service`.
 */
class LayerBookmark extends React.Component {
    static availableIn3D = true;
    static propTypes = {
        bookmarks: PropTypes.array,
        mapCenter: PropTypes.string,
        mapScales: PropTypes.array,
        mapZoom: PropTypes.number,
        refreshUserBookmarks: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string
    };
    static defaultProps = {
        side: 'right'
    };
    translations = {
        add: LocaleUtils.tr("layerbookmark.add"),
        description: LocaleUtils.tr("layerbookmark.description"),
        lastUpdate: LocaleUtils.tr("layerbookmark.lastUpdate"),
        manage: LocaleUtils.tr("layerbookmark.manage"),
        nobookmarks: LocaleUtils.tr("layerbookmark.nobookmarks"),
        notloggedin: LocaleUtils.tr("layerbookmark.notloggedin"),
        open: LocaleUtils.tr("layerbookmark.open"),
        openTab: LocaleUtils.tr("layerbookmark.openTab"),
        remove: LocaleUtils.tr("layerbookmark.remove"),
        update: LocaleUtils.tr("layerbookmark.update")
    };
    render() {
        return (
            <SideBar icon="eye" id="LayerBookmark"
                side={this.props.side}
                title={LocaleUtils.tr("appmenu.items.LayerBookmark")} width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
        const bookmarks = (this.props.bookmarks || []).filter(b => !b.data.query.c && !b.data.query.s);
        return (
            <BookmarkPanel
                bookmarks={bookmarks}
                onAdd={this.onAdd}
                onOpen={this.onOpen}
                onRemove={this.onRemove}
                onUpdate={this.onUpdate}
                translations={this.translations}
            />
        );
    };
    onOpen = (bookmark, newtab) => {
        openBookmark(bookmark, newtab, this.props.mapCenter, this.props.mapScales, this.props.mapZoom);
    };
    onAdd = (description) => {
        // creates a bookmark without saving the current map position
        createBookmark(description, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("layerbookmark.addfailed"));
            }
            this.props.refreshUserBookmarks();
        }, true);
    };
    onRemove = (bookmarkKey) => {
        removeBookmark(bookmarkKey, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("layerbookmark.removefailed"));
            }
            this.props.refreshUserBookmarks();
        });
    };
    onUpdate = (bookmarkKey, description) => {
        // updates a bookmark without saving the current map position
        updateBookmark(bookmarkKey, description, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("layerbookmark.savefailed"));
            }
            this.props.refreshUserBookmarks();
        }, true);
    };
}
const selector = state => ({
    bookmarks: state.bookmark?.bookmarks,
    mapCenter: state.map?.center,
    mapScales: state.map?.scales,
    mapZoom: state.map?.zoom
});
export default connect(selector, {
    refreshUserBookmarks: refreshUserBookmarks
})(LayerBookmark);
