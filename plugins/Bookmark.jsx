/**
 * Copyright 2021 Oslandia SAS <infos+qwc2@oslandia.com>
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import { zoomToExtent, zoomToPoint } from '../actions/map';
import Icon from '../components/Icon';
import SideBar from '../components/SideBar';
import Spinner from '../components/Spinner';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import {createBookmark, getUserBookmarks, removeBookmark, resolveBookmark, updateBookmark} from '../utils/PermaLinkUtils';

import './style/Bookmark.css';

/**
 * Allows managing user bookmarks.
 *
 * Bookmarks are only allowed for authenticated users.
 *
 * Requires `permalinkServiceUrl` to point to a `qwc-permalink-service`.
 */
class Bookmark extends React.Component {
    static propTypes = {
        mapCrs: PropTypes.string,
        mapScales: PropTypes.array,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        state: PropTypes.object,
        task: PropTypes.string,
        zoomToExtent: PropTypes.func,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        side: 'right'
    };
    state = {
        bookmarks: [],
        currentBookmark: null,
        description: "",
        saving: false
    };
    componentDidMount() {
        this.refresh();
    }
    render() {
        const openTitle = LocaleUtils.tr("bookmark.open");
        const openTabTitle = LocaleUtils.tr("bookmark.openTab");
        const zoomTitle = LocaleUtils.tr("bookmark.zoomToExtent");
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
                                <button className="button" disabled={!currentBookmark} onClick={() => this.open(currentBookmark.key, false)} title={openTitle}>
                                    <Icon icon="folder-open" />
                                </button>
                                <button className="button" disabled={!currentBookmark} onClick={() => this.open(currentBookmark.key, true)} title={openTabTitle}>
                                    <Icon icon="open_link" />
                                </button>
                                <button className="button" disabled={!currentBookmark} onClick={() => this.zoomToBookmarkExtent(currentBookmark.key)} title={zoomTitle}>
                                    <Icon icon="zoom" />
                                </button>
                            </span>
                            <span className="bookmark-actions-spacer" />
                            <span className="bookmark-actions-buttonbox">
                                <button className="button" disabled={!this.state.description} onClick={this.addBookmark} title={addBookmarkTitle}>
                                    <Icon icon="plus" />
                                </button>
                                <button className="button" disabled={!currentBookmark || !this.state.description} onClick={() => this.updateBookmark(currentBookmark)} title={updateTitle}>
                                    {this.state.saving ? (<Spinner />) : (<Icon icon="save" />)}
                                </button>
                                <button className="button" disabled={!currentBookmark} onClick={() => this.removeBookmark(currentBookmark)} title={removeTitle}>
                                    <Icon icon="trash" />
                                </button>
                            </span>
                        </div>
                        <div className="bookmark-list">
                            {this.state.bookmarks.map((bookmark) => {
                                const itemclasses = classnames({
                                    "bookmark-list-item": true,
                                    "bookmark-list-item-active": this.state.currentBookmark === bookmark.key
                                });
                                return (
                                    <div className={itemclasses} key={bookmark.key} onClick={() => this.toggleCurrentBookmark(bookmark)} title={lastUpdateTitle + ": " + bookmark.date}>{bookmark.description}</div>
                                );
                            })}
                            {isEmpty(this.state.bookmarks) ? (
                                <div className="bookmark-list-item-empty">{LocaleUtils.tr("bookmark.nobookmarks")}</div>
                            ) : null}
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
    };
    zoomToBookmarkExtent = (bookmarkkey) => {
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
    };
    toggleCurrentBookmark = (bookmark) => {
        if (this.state.currentBookmark === bookmark.key) {
            this.setState({currentBookmark: null, description: ""});
        } else {
            this.setState({currentBookmark: bookmark.key, description: bookmark.description});
        }
    };
    addBookmark = () => {
        createBookmark(this.props.state, this.state.description, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.addfailed"));
            }
            this.refresh();
        });
        this.setState({description: "", currentBookmark: null});
    };
    updateBookmark = (bookmark) => {
        this.setState({saving: true});
        updateBookmark(this.props.state, bookmark.key, this.state.description, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.savefailed"));
            }
            this.setState({saving: false});
            this.refresh();
        });
    };
    removeBookmark = (bookmark) => {
        removeBookmark(bookmark.key, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.removefailed"));
            }
            this.refresh();
        });
    };
    refresh = () => {
        getUserBookmarks(ConfigUtils.getConfigProp("username"), (bookmarks) => {
            this.setState({bookmarks: bookmarks});
        });
    };
}

const selector = state => ({
    mapCrs: state.map.projection,
    mapScales: state.map.scales,
    task: state.task.id,
    state
});

export default connect(selector, {
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(Bookmark);
