/**
 * Copyright 2021 Oslandia SAS <infos+qwc2@oslandia.com>
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';

import ConfigUtils from '../utils/ConfigUtils';
import Icon from './Icon';
import Spinner from './widgets/Spinner';

import '../plugins/style/Bookmark.css';


/**
 * Reusable panel component for managing bookmarks.
 *
 * Used in both Bookmark and LayerBookmark plugins.
 */
export default class BookmarkPanel extends React.Component {
    static propTypes = {
        bookmarks: PropTypes.array,
        onAdd: PropTypes.func,
        onOpen: PropTypes.func,
        onRemove: PropTypes.func,
        onUpdate: PropTypes.func,
        onZoomToExtent: PropTypes.func,
        translations: PropTypes.objectOf(PropTypes.string)
    };
    state = {
        currentBookmark: null,
        description: "",
        adding: false,
        saving: false,
        trashing: false
    };
    componentDidUpdate(prevProps) {
        if (prevProps.bookmarks !== this.props.bookmarks) {
            this.setState({adding: false, saving: false, trashing: false});
            // Select a recently added bookmark
            const addedBookmark = this.props.bookmarks.find(bookmark =>
                !prevProps.bookmarks.some(prevBookmark => prevBookmark.key === bookmark.key)
            );
            if (addedBookmark) {
                this.setState({
                    currentBookmark: addedBookmark.key,
                    description: addedBookmark.description
                });
            }
        }
    }
    render() {
        const username = ConfigUtils.getConfigProp("username");
        const currentBookmark = this.props.bookmarks.find(bookmark => bookmark.key === this.state.currentBookmark);

        return (
            <div className="bookmark-body" role="body">
                {!username ? (
                    this.props.translations?.notloggedin
                ) : (
                    <>
                        <h4>{this.props.translations?.manage}</h4>
                        <div className="bookmark-create">
                            <input onChange={ev => this.setState({description: ev.target.value})}
                                onKeyDown={ev => {if (ev.key === "Enter" && this.state.description !== "") { this.addBookmark(); }}}
                                placeholder={this.props.translations?.description} type="text"  value={this.state.description} />
                        </div>
                        <div className="bookmark-actions controlgroup">
                            <button className="button" disabled={!currentBookmark} onClick={() => this.props.onOpen(currentBookmark.key, false)} title={this.props.translations?.open}>
                                <Icon icon="folder-open" />
                            </button>
                            <button className="button" disabled={!currentBookmark} onClick={() => this.props.onOpen(currentBookmark.key, true)} title={this.props.translations?.openTab}>
                                <Icon icon="open_link" />
                            </button>
                            {this.props.onZoomToExtent ? (
                                <button className="button" disabled={!currentBookmark} onClick={() => this.props.onZoomToExtent(currentBookmark.key)} title={this.props.translations?.zoomToExtent}>
                                    <Icon icon="zoom" />
                                </button>
                            ) : null}
                            <span className="bookmark-actions-spacer" />
                            <button className="button" disabled={!this.state.description} onClick={this.addBookmark} title={this.props.translations?.add}>
                                {this.state.adding ? (<Spinner />) : (<Icon icon="plus" />)}
                            </button>
                            <button className="button" disabled={!currentBookmark || !this.state.description} onClick={() => this.updateBookmark(currentBookmark)} title={this.props.translations?.update}>
                                {this.state.saving ? (<Spinner />) : (<Icon icon="save" />)}
                            </button>
                            <button className="button" disabled={!currentBookmark} onClick={() => this.removeBookmark(currentBookmark)} title={this.props.translations?.remove}>
                                {this.state.trashing ? (<Spinner />) : (<Icon icon="trash" />)}
                            </button>
                        </div>
                        <div className="bookmark-list">
                            {this.props.bookmarks.map((bookmark) => {
                                const itemclasses = classnames({
                                    "bookmark-list-item": true,
                                    "bookmark-list-item-active": this.state.currentBookmark === bookmark.key
                                });
                                return (
                                    <div className={itemclasses} key={bookmark.key}
                                        onClick={() => this.toggleCurrentBookmark(bookmark)}
                                        onDoubleClick={() => this.props.onOpen(bookmark.key, false)}
                                        title={this.props.translations?.lastUpdate + ": " + bookmark.date}
                                    >
                                        {bookmark.description}
                                    </div>
                                );
                            })}
                            {isEmpty(this.props.bookmarks) ? (
                                <div className="bookmark-list-item-empty">{this.props.translations?.nobookmarks}</div>
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        );
    }
    toggleCurrentBookmark = (bookmark) => {
        if (this.state.currentBookmark === bookmark.key) {
            this.setState({currentBookmark: null, description: ""});
        } else {
            this.setState({currentBookmark: bookmark.key, description: bookmark.description});
        }
    };
    addBookmark = () => {
        this.setState({adding: true, description: "", currentBookmark: null});
        this.props.onAdd(this.state.description);
    };
    updateBookmark = (bookmark) => {
        this.setState({saving: true});
        this.props.onUpdate(bookmark.key, this.state.description);
    };
    removeBookmark = (bookmark) => {
        this.setState({trashing: true, description: "", currentBookmark: null});
        this.props.onRemove(bookmark.key);
    };
}
