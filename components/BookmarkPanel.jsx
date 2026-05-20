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

/**
 * Allows managing user bookmarks.
 * or user visibility presets if `visibilityPresetsMode` is true.
 *
 * Bookmarks are only allowed for authenticated users.
 *
 * Requires `permalinkServiceUrl` to point to a `qwc-permalink-service`.
 */
class BookmarkPanel extends React.Component {
    static availableIn3D = true;

    static propTypes = {
        bookmarks: PropTypes.array,
        onAdd: PropTypes.func,
        onOpen: PropTypes.func,
        onRefresh: PropTypes.func,
        onRemove: PropTypes.func,
        onRename: PropTypes.func,
        onUpdate: PropTypes.func,
        onZoomToExtent: PropTypes.func,
        /** Whether to directly open the bookmark on click / middle click, instead of showing dedicated open buttons. */
        openOnClick: PropTypes.bool,
        showOpenTab: PropTypes.bool,
        showZoomToExtent: PropTypes.bool,
        translations: PropTypes.objectOf(PropTypes.string)
    };
    static defaultProps = {
        showOpenTab: true,
        showZoomToExtent: false
    };
    state = {
        renameBookmark: null,
        currentBookmark: null,
        busy: false
    };
    componentDidUpdate(prevProps) {
        // Check exact identity of bookmarks array to reset busy state in all cases
        if (prevProps.bookmarks !== this.props.bookmarks) {
            this.setState({renameBookmark: null, busy: false});
            // Select a recently added bookmark
            const addedBookmark = this.props.bookmarks.find(bookmark =>
                !prevProps.bookmarks.some(prevBookmark => prevBookmark.key === bookmark.key)
            );
            if (addedBookmark) {
                this.setState({
                    renameBookmark: addedBookmark.key,
                    currentBookmark: null
                });
            }
        }
    }
    render() {

        const username = ConfigUtils.getConfigProp("username");
        const currentBookmark = this.state.currentBookmark;
        const buttonsDisabled = !currentBookmark || this.state.busy;

        return !username ? (
            <div className="bookmark-body" role="body"> {this.props.translations?.notloggedin}</div>
        ) : (
            <div className="bookmark-body" role="body">
                <h4 className="bookmark-header">
                    <span>{this.props.translations?.manage}</span>
                    <button className="button" onClick={this.addBookmark} title={this.props.translations?.add}><Icon icon="plus" /></button>
                </h4>
                {!this.props.openOnClick ? (
                    <div className="bookmark-actions controlgroup">
                        <button className="button" disabled={buttonsDisabled} onClick={() => this.props.onOpen(currentBookmark, false)} title={this.props.translations?.open}>
                            <Icon icon="folder-open" />
                        </button>
                        {this.props.showOpenTab ? (
                            <button className="button" disabled={buttonsDisabled} onClick={() => this.props.onOpen(currentBookmark, true)} title={this.props.translations?.openTab}>
                                <Icon icon="open_link" />
                            </button>
                        ) : null}
                        {this.props.showZoomToExtent ? (
                            <button className="button" disabled={buttonsDisabled} onClick={() => this.props.onZoomToExtent(currentBookmark)} title={this.props.translations?.zoomToExtent}>
                                <Icon icon="zoom" />
                            </button>
                        ) : null}
                        <button className="button" disabled={buttonsDisabled} onClick={() => this.updateBookmark(currentBookmark)} title={this.props.translations?.update}>
                            <Icon icon="save" />
                        </button>
                    </div>
                ) : null}
                <div className="bookmark-list">
                    {this.props.bookmarks.map((bookmark) => {
                        const itemclasses = classnames({
                            "bookmark-list-item": true,
                            "bookmark-list-item-active": currentBookmark === bookmark.key
                        });
                        return (
                            <div className={itemclasses} key={bookmark.key}
                                onAuxClick={(ev) => this.bookmarkClicked(ev, bookmark)}
                                onClick={(ev) => this.bookmarkClicked(ev, bookmark)}
                                onDoubleClick={(ev) => this.bookmarkDoubleClicked(ev, bookmark)}
                                title={this.props.translations?.lastUpdate + ": " + bookmark.date}
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
                                    <Icon disabled={this.state.busy} icon="trash" onClick={(ev) => {this.removeBookmark(bookmark.key); MiscUtils.killEvent(ev);}} title={LocaleUtils.tr("common.delete")} />
                                ) : null}
                            </div>
                        );
                    })}
                    {isEmpty(this.props.bookmarks) ? (
                        <div className="bookmark-list-item-empty">{this.props.translations?.nobookmarks}</div>
                    ) : null}
                </div>
            </div>
        );
    }
    bookmarkClicked = (ev, bookmark) => {
        if (this.state.renameBookmark) {
            // pass
        } else if (this.props.openOnClick) {
            this.props.onOpen(bookmark.key, ev.button === 1);
        } else if (this.state.currentBookmark === bookmark.key) {
            this.setState({currentBookmark: null, description: ""});
        } else {
            this.setState({currentBookmark: bookmark.key, description: bookmark.description});
        }
    };
    bookmarkDoubleClicked = (ev, bookmark) => {
        if (!this.state.renameBookmark) {
            this.open(bookmark.key, false);
        }
    };
    updateBookmarkName = (text) => {
        this.setState({busy: true});

        this.props.onRename(this.state.renameBookmark, text, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(this.props.translations?.savefailed);
            }
            this.props.onRefresh();
        });
    };
    addBookmark = () => {
        this.setState({busy: true});

        this.props.onAdd(this.props.translations?.newbookmark, (success, key) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(this.props.translations?.addfailed);
            }
            this.props.onRefresh();
        });
        this.setState({description: "", currentBookmark: null});
    };
    updateBookmark = (key) => {
        this.setState({busy: true});
        const description = this.props.bookmarks.find(bk => bk.key === key).description;

        this.props.onUpdate(key, description, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(this.props.translations?.savefailed);
            }
            this.props.onRefresh();
        });
    };
    removeBookmark = (key) => {
        this.setState({busy: true});

        this.props.onRemove(key, (success) => {
            if (!success) {
                /* eslint-disable-next-line */
                alert(this.props.translations?.removefailed);
            }
            this.props.onRefresh();
        });
    };
}

export default BookmarkPanel;
