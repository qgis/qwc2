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

import {zoomToExtent, zoomToPoint} from '../actions/map';
import Icon from '../components/Icon';
import SideBar from '../components/SideBar';
import InputContainer from '../components/widgets/InputContainer';
import TextInput from '../components/widgets/TextInput';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import {createBookmark, getBookmarks, removeBookmark, renameBookmark, resolveBookmark, updateBookmark} from '../utils/PermaLinkUtils';

import './style/Bookmark.css';

/**
 * Allows managing user bookmarks.
 *
 * Bookmarks are only allowed for authenticated users.
 *
 * Requires `permalinkServiceUrl` to point to a `qwc-permalink-service`.
 */
class Bookmark extends React.Component {
    static availableIn3D = true;

    static propTypes = {
        mapCrs: PropTypes.string,
        mapScales: PropTypes.array,
        /** Whether to directly open the bookmark on click / middle click, instead of showing dedicated open buttons. */
        openOnClick: PropTypes.bool,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object,
        zoomToExtent: PropTypes.func,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        side: 'right'
    };
    state = {
        bookmarks: [],
        renameBookmark: null,
        currentBookmark: null,
        description: "",
        busy: false
    };
    componentDidMount() {
        this.refresh();
    }
    render() {
        const openTitle = LocaleUtils.tr("bookmark.open");
        const openTabTitle = LocaleUtils.tr("bookmark.openTab");
        const zoomTitle = LocaleUtils.tr("bookmark.zoomToExtent");
        const username = ConfigUtils.getConfigProp("username");
        const updateTitle = LocaleUtils.tr("bookmark.update");
        const lastUpdateTitle = LocaleUtils.tr("bookmark.lastUpdate");

        const currentBookmark = this.state.currentBookmark;
        const buttonsDisabled = !currentBookmark || this.state.busy;
        return (
            <SideBar icon="bookmark" id="Bookmark"
                onShow={this.refresh}
                side={this.props.side}
                title={LocaleUtils.tr("appmenu.items.Bookmark")} width="20em">
                {!username ? (
                    <div className="bookmark-body" role="body">{LocaleUtils.tr("bookmark.notloggedin")}</div>
                ) : (
                    <div className="bookmark-body" role="body">
                        <h4 className="bookmark-header">
                            <span>{LocaleUtils.tr("bookmark.manage")}</span>
                            <button className="button" onClick={this.addBookmark} title={LocaleUtils.tr("bookmark.add")}><Icon icon="plus" /></button>
                        </h4>
                        {!this.props.openOnClick ? (
                            <div className="bookmark-actions controlgroup">
                                <button className="button" disabled={buttonsDisabled} onClick={() => this.open(currentBookmark, false)} title={openTitle}>
                                    <Icon icon="folder-open" />
                                </button>
                                <button className="button" disabled={buttonsDisabled} onClick={() => this.open(currentBookmark, true)} title={openTabTitle}>
                                    <Icon icon="open_link" />
                                </button>
                                {this.props.mapCrs && this.props.mapScales ? (
                                    <button className="button" disabled={buttonsDisabled} onClick={() => this.zoomToBookmarkExtent(currentBookmark)} title={zoomTitle}>
                                        <Icon icon="zoom" />
                                    </button>
                                ) : null}
                                <button className="button" disabled={buttonsDisabled} onClick={() => this.updateBookmark(currentBookmark)} title={updateTitle}>
                                    <Icon icon="save" />
                                </button>
                            </div>
                        ) : null}
                        <div className="bookmark-list">
                            {this.state.bookmarks.map((bookmark) => {
                                const itemclasses = classnames({
                                    "bookmark-list-item": true,
                                    "bookmark-list-item-active": currentBookmark === bookmark.key
                                });
                                return (
                                    <div className={itemclasses} key={bookmark.key}
                                        onAuxClick={(ev) => this.bookmarkClicked(ev, bookmark)}
                                        onClick={(ev) => this.bookmarkClicked(ev, bookmark)}
                                        onDoubleClick={() => this.open(bookmark.key, false)}
                                        title={lastUpdateTitle + ": " + bookmark.date}
                                    >
                                        {this.state.renameBookmark === bookmark.key ? (
                                            <InputContainer>
                                                <TextInput focusOnRef onChange={this.updateBookmarkName} onNoChange={() => this.setState({renameBookmark: null})} role="input" showClear={false} value={bookmark.description} />
                                                <Icon icon="ok" onClick={MiscUtils.killEvent} role="suffix" />
                                            </InputContainer>
                                        ) : (
                                            <span>{bookmark.description}</span>
                                        )}
                                        {this.state.renameBookmark !== bookmark.key ? (
                                            <Icon icon="draw" onClick={(ev) => {this.setState({renameBookmark: bookmark.key, currentBookmark: null}); MiscUtils.killEvent(ev);}} title={LocaleUtils.tr("common.rename")} />
                                        ) : null}
                                        {this.state.renameBookmark !== bookmark.key ? (
                                            <Icon disabled={this.state.busy} icon="trash" onClick={() => this.removeBookmark(bookmark.key)} title={LocaleUtils.tr("common.delete")} />
                                        ) : null}
                                    </div>
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
    bookmarkClicked = (ev, bookmark) => {
        if (this.state.renameBookmark) {
            // pass
        } else if (this.props.openOnClick) {
            this.open(bookmark.key, ev.button === 1);
        } else if (this.state.currentBookmark === bookmark.key) {
            this.setState({currentBookmark: null, description: ""});
        } else {
            this.setState({currentBookmark: bookmark.key, description: bookmark.description});
        }
    };
    updateBookmarkName = (text) => {
        this.setState({busy: true});
        renameBookmark(this.state.renameBookmark, text, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.savefailed"));
            }
            this.refresh(() => this.setState({renameBookmark: null, busy: false}));
        });
    };
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
    addBookmark = () => {
        this.setState({busy: true});
        createBookmark(LocaleUtils.tr("bookmark.newbookmark"), (success, key) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.addfailed"));
            } else {
                this.refresh(() => this.setState({renameBookmark: key, busy: false}));
            }
        });
        this.setState({description: "", currentBookmark: null});
    };
    updateBookmark = (key) => {
        this.setState({busy: true});
        const description = this.state.bookmarks.find(bk => bk.key === key).description;
        updateBookmark(key, description, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.savefailed"));
            }
            this.refresh(() => this.setState({busy: false, currentBookmark: null}));
        });
    };
    removeBookmark = (key) => {
        this.setState({busy: true});
        removeBookmark(key, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("bookmark.removefailed"));
            }
            this.refresh(() => this.setState({busy: false}));
        });
    };
    refresh = (callback = null) => {
        if (ConfigUtils.getConfigProp("username")) {
            getBookmarks((bookmarks) => {
                this.setState({bookmarks: bookmarks});
                callback?.(bookmarks);
            });
        }
    };
}


export default connect(state => ({
    mapCrs: state.map?.projection,
    mapScales: state.map?.scales,
    theme: state.theme.current
}), {
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(Bookmark);
