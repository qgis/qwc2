/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import Icon from './Icon';
import {connect} from 'react-redux';
import ResizeableWindow from './ResizeableWindow';
import LocaleUtils from '../utils/LocaleUtils';
import ConfigUtils from '../utils/ConfigUtils';
import {createBookmark, getUserBookmarks, removeBookmark, updateBookmark} from '../utils/PermaLinkUtils';
import './style/BookmarkWindow.css';
import { setCurrentTask } from '../actions/task';

class BookmarkWindow extends React.Component {
    static propTypes = {
        windowSize: PropTypes.object,
        state: PropTypes.object,
        task: PropTypes.string,
        setCurrentTask: PropTypes.func,
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
                    <td><Icon icon="plus" title={updateTitle} 
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
        return ( 
            <ResizeableWindow icon="plus" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width}
                onClose={this.onClose} title={LocaleUtils.trmsg("bookmark.title")} >
                <div className="bookmark-body" role="body">
                    <h5>{LocaleUtils.tr("bookmark.manage")}</h5>
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
            </ResizeableWindow>
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
    onClose = () => {
        this.setState({description: null});
        this.props.setCurrentTask(null);
    }    
}

export default connect(state => ({state}), {
    setCurrentTask: setCurrentTask
})
(BookmarkWindow);