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
        task: PropTypes.string,
        state: PropTypes.object
    }
    state = {
        bookmarks: [],
        description: null,
        change: true
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.change) {
            getUserBookmarks(ConfigUtils.getConfigProp("username"), (bookmarks) => {
                this.setState({bookmarks: bookmarks, change: false});
            });
        }
    }
    renderData() {
        const openTabTitle = LocaleUtils.tr("bookmark.openintab");
        const updateTitle = LocaleUtils.tr("bookmark.update");
        const removeTitle = LocaleUtils.tr("bookmark.remove");
        return this.state.bookmarks.map((bookmark, index) => {
            return (
                <tr key={bookmark.key}>
                    <td>{bookmark.description}</td>
                    <td><Icon icon="open_link" title={openTabTitle} onClick={ev => this.openInTab(ev, bookmark.key)} /></td>
                    <td><Icon icon="save" title={updateTitle} 
                            onClick={() => updateBookmark(this.props.state, bookmark.key, bookmark.description, (result => this.setState({change: result})))} />
                    </td>
                    <td><Icon className="bookmark-item-remove" icon="trash" title={removeTitle} 
                            onClick={() => removeBookmark(bookmark.key, (result => this.setState({change: result})))} />
                    </td>
                </tr>
            )
        })
    }
    render() {
        const username = ConfigUtils.getConfigProp("username");
        const placeholder = LocaleUtils.tr("bookmark.description");
        const addBookmarkTitle = LocaleUtils.tr("bookmark.add");
        if (this.props.task !== "Bookmark" || !username) {
            return null;
        }
        return (
            <SideBar icon="bookmark" id="Bookmark"
                title="appmenu.items.Bookmark" width="20em">
                <div className="bookmark-body" role="body">
                    <h4>{LocaleUtils.tr("bookmark.manage")}</h4>
                    <div className="bookmark-create">
                        <input name="bookmark-description" type="text" placeholder={placeholder} onChange={ev => this.setState({description: ev.target.value})} />
                        <button className="bookmark-add-button" disabled={!this.state.description} 
                            onClick={this.state.description ? () => createBookmark(this.props.state, this.state.description, (result => this.setState({change: result}))) : null}>                            
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
            </SideBar>
        );
    }
    openInTab = (ev, bookmarkkey) => {
        ev.stopPropagation();
        const url = location.href.split("?")[0] + '?bk=' + bookmarkkey;
        window.open(url, '_blank');
    }
    addBookmark = (ev) => {
        ev.stopPropagation();
        createBookmark(this.props.state, this.state.description, (result => this.setState({change: result})));
    }
}

const selector = state => ({
    task: state.task.id,
    state
});
 
export default connect(selector)(Bookmark);