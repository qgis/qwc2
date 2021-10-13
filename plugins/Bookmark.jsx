/**
 * Copyright 2021 Oslandia SAS <infos+qwc2@oslandia.com>
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import LocaleUtils from '../utils/LocaleUtils';
import ConfigUtils from '../utils/ConfigUtils';
import Icon from '../components/Icon';
import SideBar from '../components/SideBar';
import Spinner from '../components/Spinner';
import {createBookmark, getUserBookmarks, removeBookmark, updateBookmark} from '../utils/PermaLinkUtils';
import './style/Bookmark.css';

export const BookmarkState = {
    UNCHANGED: 0,
    CHANGED: 1,
    UPDATING: 2
};

class Bookmark extends React.Component {
    static propTypes = {
        side: PropTypes.string,
        state: PropTypes.object,
        task: PropTypes.string
    }
    static defaultProps = {
        side: 'right'
    }
    state = {
        bookmarks: [],
        description: null
    }
    componentDidMount() {
        this.refresh();
    }
    renderData() {
        const openTitle = LocaleUtils.tr("bookmark.open");
        const openTabTitle = LocaleUtils.tr("bookmark.openintab");
        const updateTitle = LocaleUtils.tr("bookmark.update");
        const removeTitle = LocaleUtils.tr("bookmark.remove");
        return this.state.bookmarks.map((bookmark) => {
            return (
                <tr key={bookmark.key}>
                    <td title={openTitle}>
                        <input onBlur={() => this.updateBookmark(bookmark)} onChange={(ev) => this.renameBookmark(ev, bookmark.key)} type="text" value={bookmark.description} />
                    </td>
                    <td>
                        <Icon icon="open_link" onClick={() => this.openInTab(bookmark.key)} title={openTabTitle} />
                    </td>
                    <td>
                        {bookmark.state === BookmarkState.UPDATING ? (
                            <Spinner />
                        ) : (
                            <Icon className={bookmark.state === BookmarkState.CHANGED ? 'bookmark-save-changed' : ''} icon="save" onClick={() => this.updateBookmark(bookmark, true)} title={updateTitle} />
                        )}
                    </td>
                    <td>
                        <Icon icon="trash" onClick={() => removeBookmark(bookmark.key, this.refresh)} title={removeTitle} />
                    </td>
                </tr>
            );
        });
    }
    render() {
        const username = ConfigUtils.getConfigProp("username");
        const placeholder = LocaleUtils.tr("bookmark.description");
        const addBookmarkTitle = LocaleUtils.tr("bookmark.add");
        return (
            <SideBar icon="bookmark" id="Bookmark"
                side={this.props.side}
                title="appmenu.items.Bookmark" width="20em">
                {!username ? (
                    <div className="bookmark-body" role="body">{LocaleUtils.tr("bookmark.notloggedin")}</div>
                ) : (
                    <div className="bookmark-body" role="body">
                        <h4>{LocaleUtils.tr("bookmark.manage")}</h4>
                        <div className="bookmark-create">
                            <input onChange={ev => this.setState({description: ev.target.value})} placeholder={placeholder} type="text" />
                            <button disabled={!this.state.description}
                                onClick={this.state.description ? () => createBookmark(this.props.state, this.state.description, this.refresh) : null}>
                                <Icon className="bookmark-add-icon" icon="plus" title={addBookmarkTitle}
                                />
                            </button>
                        </div>
                        <table className="bookmark-table">
                            <tbody className="bookmark-table-body">
                                {this.renderData()}
                            </tbody>
                        </table>
                    </div>
                )}
            </SideBar>
        );
    }
    open = (bookmarkkey) => {
        const url = location.href.split("?")[0] + '?bk=' + bookmarkkey;
        location.href = url;
    }
    openInTab = (bookmarkkey) => {
        const url = location.href.split("?")[0] + '?bk=' + bookmarkkey;
        window.open(url, '_blank');
    }
    renameBookmark = (ev, key) => {
        const newBookmarks = this.state.bookmarks.map(bookmark => {
            if (bookmark.key === key) {
                return {...bookmark, description: ev.target.value, state: BookmarkState.CHANGED};
            }
            return bookmark;
        });
        this.setState({bookmarks: newBookmarks});
    }
    updateBookmark = (bookmark, force = false) => {
        if (bookmark.state === BookmarkState.CHANGED || force) {
            updateBookmark(this.props.state, bookmark.key, bookmark.description, this.refresh);
        }
    }
    refresh = () => {
        getUserBookmarks(ConfigUtils.getConfigProp("username"), (bookmarks) => {
            this.setState({bookmarks: bookmarks});
        });
    }
}

const selector = state => ({
    task: state.task.id,
    state
});

export default connect(selector)(Bookmark);
