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
import {createBookmark, getUserBookmarks, removeBookmark, updateBookmark} from '../utils/PermaLinkUtils';
import './style/Bookmark.css';


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
        currentBookmark: null,
        description: ""
    }
    componentDidMount() {
        this.refresh();
    }
    render() {
        const openTitle = LocaleUtils.tr("bookmark.open");
        const openTabTitle = LocaleUtils.tr("bookmark.openTab");
        const username = ConfigUtils.getConfigProp("username");
        const placeholder = LocaleUtils.tr("bookmark.description");
        const addBookmarkTitle = LocaleUtils.tr("bookmark.add");
        const updateTitle = LocaleUtils.tr("bookmark.update");
        const removeTitle = LocaleUtils.tr("bookmark.remove");
        const lastUpdateTitle = LocaleUtils.tr("bookmark.lastUpdate");

        const currentBookmark = this.state.bookmarks.find(bookmark => bookmark.key === this.state.currentBookmark);
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
                            <input onChange={ev => this.setState({description: ev.target.value})} placeholder={placeholder} type="text" value={this.state.description} />
                        </div>
                        <div className="bookmark-actions">
                            <span className="bookmark-actions-buttonbox">
                                <button disabled={!currentBookmark} onClick={() => this.open(currentBookmark.key, false)} title={openTitle}>
                                    <Icon icon="folder-open" />
                                </button>
                                <button disabled={!currentBookmark} onClick={() => this.open(currentBookmark.key, true)} title={openTabTitle}>
                                    <Icon icon="open_link" />
                                </button>
                            </span>
                            <span className="bookmark-actions-spacer" />
                            <span className="bookmark-actions-buttonbox">
                                <button disabled={!this.state.description} onClick={this.addBookmark} title={addBookmarkTitle}>
                                    <Icon icon="plus" />
                                </button>
                                <button disabled={!currentBookmark || !this.state.description} onClick={() => this.updateBookmark(currentBookmark)} title={updateTitle}>
                                    <Icon icon="save" />
                                </button>
                                <button disabled={!currentBookmark} onClick={() => removeBookmark(currentBookmark.key, this.refresh)} title={removeTitle}>
                                    <Icon icon="trash" />
                                </button>
                            </span>
                        </div>
                        <div className="bookmark-list">
                            {this.state.bookmarks.map((bookmark) => (
                                <div className={this.state.currentBookmark === bookmark.key ? "bookmark-list-active" : ""} key={bookmark.key} onClick={() => this.toggleCurrentBookmark(bookmark)} title={lastUpdateTitle + ": " + bookmark.date}>{bookmark.description}</div>
                            ))}
                        </div>
                    </div>
                )}
            </SideBar>
        );
    }
    open = (bookmarkkey, newtab) => {
        const url = location.href.split("?")[0] + '?bk=' + bookmarkkey;
        if (newtab) {
            window.open(url, '_blank');
        } else {
            location.href = url;
        }
    }
    toggleCurrentBookmark = (bookmark) => {
        if (this.state.currentBookmark === bookmark.key) {
            this.setState({currentBookmark: null, description: ""});
        } else {
            this.setState({currentBookmark: bookmark.key, description: bookmark.description});
        }
    }
    addBookmark = () => {
        createBookmark(this.props.state, this.state.description, this.refresh);
        this.setState({description: ""});
    }
    updateBookmark = (bookmark) => {
        updateBookmark(this.props.state, bookmark.key, bookmark.description, this.refresh);
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
