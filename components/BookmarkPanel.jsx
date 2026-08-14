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
import PropTypes from 'prop-types';

import Icon from '../components/Icon';
import InputContainer from '../components/widgets/InputContainer';
import TextInput from '../components/widgets/TextInput';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/BookmarkPanel.css';

class BookmarkPanel extends React.Component {
    static availableIn3D = true;

    static propTypes = {
        bookmarkIface: PropTypes.object,
        bookmarks: PropTypes.array,
        onOpen: PropTypes.func,
        onZoomToExtent: PropTypes.func,
        openOnClick: PropTypes.bool,
        setList: PropTypes.func,
        translations: PropTypes.objectOf(PropTypes.string)
    };
    state = {
        currentBookmark: null,
        rename: false,
        busy: false
    };
    render() {
        const username = ConfigUtils.getConfigProp("username");
        const hasPublicBookmarksCap = ConfigUtils.getConfigProp("capabilities", null, []).includes("public_bookmarks");
        const currentBookmark = this.state.currentBookmark;
        const buttonsDisabled = !currentBookmark || this.state.busy;
        const updatable = currentBookmark?.own && !this.state.rename;

        return (
            <div className="bookmark-body" role="body">
                <h4 className="bookmark-header">
                    <span>{this.props.translations.title}</span>
                    {username ? (<button className="button" onClick={this.addBookmark} title={this.props.translations.new}><Icon icon="plus" /></button>) : null}
                </h4>
                {!this.props.openOnClick ? (
                    <div className="bookmark-actions controlgroup">
                        <button className="button" disabled={buttonsDisabled} onClick={() => this.props.onOpen(currentBookmark.key, false)} title={this.props.translations.open}>
                            <Icon icon="folder-open" />
                        </button>
                        <button className="button" disabled={buttonsDisabled} onClick={() => this.props.onOpen(currentBookmark.key, true)} title={this.props.translations.openTab}>
                            <Icon icon="open_link" />
                        </button>
                        {this.props.onZoomToExtent ? (
                            <button className="button" disabled={buttonsDisabled} onClick={() => this.props.onZoomToExtent(currentBookmark.key)} title={this.props.translations.zoomToExtent}>
                                <Icon icon="zoom" />
                            </button>
                        ) : null}
                        <button className="button" disabled={!updatable} onClick={() => this.updateBookmark(currentBookmark, {}, true)} title={this.props.translations.update}>
                            <Icon icon="save" />
                        </button>
                    </div>
                ) : null}
                <div className="bookmark-list">
                    {this.props.bookmarks.map((bookmark) => {
                        const itemclasses = classnames({
                            "bookmark-list-item": true,
                            "bookmark-list-item-active": currentBookmark?.key === bookmark.key
                        });
                        const renaming = currentBookmark?.key === bookmark.key && this.state.rename;
                        let publicIcon = null;
                        if (bookmark.own && hasPublicBookmarksCap) {
                            publicIcon = (
                                <Icon disabled={this.state.busy} icon="public" inactive={!bookmark.public} onClick={(ev) => {this.updateBookmark(bookmark, {public: !bookmark.public}); MiscUtils.killEvent(ev);}} title={this.props.translations.togglePublic} />
                            );
                        } else if (bookmark.public) {
                            publicIcon = (
                                <Icon icon="public" title={this.props.translations.public} />
                            );
                        }
                        return (
                            <div className={itemclasses} key={bookmark.key}
                                onAuxClick={(ev) => this.bookmarkClicked(ev, bookmark)}
                                onClick={(ev) => this.bookmarkClicked(ev, bookmark)}
                                onDoubleClick={(ev) => this.bookmarkDoubleClicked(ev, bookmark)}
                                title={this.props.translations.lastUpdate + ": " + bookmark.date}
                            >
                                {renaming ? (
                                    <InputContainer>
                                        <TextInput focusOnRef onChange={(text) => this.updateBookmark(bookmark, {description: text})} onNoChange={() => this.setState({rename: false})} role="input" showClear={false} value={bookmark.description} />
                                        <Icon icon="ok" onClick={MiscUtils.killEvent} role="suffix" />
                                    </InputContainer>
                                ) : (
                                    <span>{bookmark.description}</span>
                                )}
                                {!renaming ? publicIcon : null}
                                {bookmark.own && !renaming ? [(
                                    <Icon disabled={this.state.busy} icon="draw" key="draw" onClick={(ev) => {this.setState({currentBookmark: bookmark, rename: true}); MiscUtils.killEvent(ev);}} title={LocaleUtils.tr("common.rename")} />
                                ), (
                                    <Icon disabled={this.state.busy} icon="trash" key="trash" onClick={(ev) => {this.removeBookmark(bookmark); MiscUtils.killEvent(ev);}} title={LocaleUtils.tr("common.delete")} />
                                )] : null}
                            </div>
                        );
                    })}
                    {isEmpty(this.props.bookmarks) ? (
                        <div className="bookmark-list-item-empty">{this.props.translations.noitems}</div>
                    ) : null}
                </div>
            </div>
        );
    }
    bookmarkClicked = (ev, bookmark) => {
        if (this.state.rename) {
            // pass
        } else if (this.props.openOnClick) {
            this.props.onOpen(bookmark.key, ev.button === 1);
        } else if (this.state.currentBookmark === bookmark) {
            this.setState({currentBookmark: null, description: ""});
        } else {
            this.setState({currentBookmark: bookmark, description: bookmark.description});
        }
    };
    bookmarkDoubleClicked = (ev, bookmark) => {
        if (!this.state.rename) {
            this.props.onOpen(bookmark.key, false);
        }
    };
    addBookmark = () => {
        this.setState({busy: true});
        this.props.bookmarkIface.create(this.props.translations.new, (success, key) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(this.props.translations.addfailed);
                this.setState({busy: false});
            } else {
                this.props.bookmarkIface.getList((bookmarks) => {
                    this.props.setList(bookmarks);
                    this.setState({rename: true, currentBookmark: bookmarks.find(bk => bk.key === key), busy: false});
                });
            }
        });
    };
    updateBookmark = (bookmark, params, updateData = false) => {
        // eslint-disable-next-line no-alert
        if (updateData && !confirm(this.props.translations.confirmOverwrite)) {
            return;
        }
        this.setState({busy: true});
        this.props.bookmarkIface.update(bookmark.key, params, updateData, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(this.props.translations.savefailed);
                this.setState({busy: false, rename: false});
            } else {
                this.props.bookmarkIface.getList((bookmarks) => {
                    this.props.setList(bookmarks);
                    this.setState({rename: false, currentBookmark: bookmarks.find(bk => bk.key === bookmark.key), busy: false});
                });
            }
        });
    };
    removeBookmark = (bookmark) => {
        // eslint-disable-next-line no-alert
        if (!confirm(this.props.translations.confirmDelete)) {
            return;
        }
        this.setState({busy: true});

        this.props.bookmarkIface.delete(bookmark.key, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(this.props.translations.removefailed);
                this.setState({busy: false});
            }
            this.props.bookmarkIface.getList((bookmarks) => {
                this.props.setList(bookmarks);
                this.setState({rename: false, currentBookmark: null, busy: false});
            });
        });
    };
}

export default BookmarkPanel;
