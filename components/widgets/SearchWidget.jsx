/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


import React from 'react';

import axios from 'axios';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import Spinner from '../Spinner';

import './style/SearchWidget.css';

export default class SearchWidget extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        placeholder: PropTypes.string,
        resultSelected: PropTypes.func,
        searchParams: PropTypes.object,
        searchProviders: PropTypes.array,
        value: PropTypes.string
    };
    state = {
        text: '',
        reqId: null,
        results: [],
        pending: 0,
        active: false
    };
    constructor(props) {
        super(props);
        this.searchTimeout = null;
        this.preventBlur = false;
        this.state.text = props.value;
        this.input = null;
    }
    componentDidUpdate(prevProps) {
        if (this.props.value !== prevProps.value) {
            this.setState({text: this.props.value});
        }
    }
    render() {
        return (
            <div className={"search-widget-container " + (this.props.className || "")}>
                <input
                    className="search-widget-input"
                    onBlur={this.onBlur}
                    onChange={this.textChanged}
                    onFocus={this.onFocus}
                    onKeyDown={this.onKeyDown}
                    placeholder={this.props.placeholder ?? LocaleUtils.tr("search.search")}
                    ref={el => {this.input = el;}}
                    type="text"
                    value={this.state.text} />
                {this.state.pending > 0 ? (<Spinner />) : null}
                {(!isEmpty(this.state.results) || this.state.pending > 0) && this.state.active ? this.renderResults() : null}
            </div>
        );
    }
    renderResults = () => {
        return (
            <div className="search-widget-results" onMouseDown={this.setPreventBlur}>
                {this.state.results.map(group => (
                    <div className="search-widget-results-group" key={group.id} onMouseDown={MiscUtils.killEvent}>
                        <div className="search-widget-results-group-title">{group.titlemsgid ? LocaleUtils.tr(group.titlemsgid) : (<span>{group.title}</span>)}</div>
                        {group.items.map(item => {
                            item.text = (item.label !== undefined ? item.label : item.text || '').replace(/<\/?\w+\s*\/?>/g, '');
                            return (
                                <div className="search-widget-results-group-item" key={item.id} onClick={() => this.resultSelected(item)} title={item.text}>{item.text}</div>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };
    setPreventBlur = () => {
        this.preventBlur = true;
        setTimeout(() => {this.preventBlur = false; return false;}, 100);
    };
    textChanged = (ev) => {
        this.setState({text: ev.target.value, reqId: null, results: [], pending: 0});
        clearTimeout(this.searchTimeout);
        if (!ev.target.value) {
            this.props.resultSelected(null);
        } else {
            this.searchTimeout = setTimeout(this.startSearch, 250);
        }
    };
    onBlur = () => {
        if (!this.preventBlur) {
            clearTimeout(this.searchTimeout);
            this.props.onBlur();
            this.setState({active: false, text: this.props.value, reqId: null, results: [], pending: 0});
        }
    };
    onFocus = (ev) => {
        ev.target.select();
        this.props.onFocus();
        this.setState({active: true});
    };
    onKeyDown = (ev) => {
        if (ev.keyCode === 13) {
            this.startSearch();
        } else if (ev.keyCode === 27) {
            ev.target.blur();
        }
    };
    startSearch = () => {
        clearTimeout(this.searchTimeout);
        const reqId = uuidv1();
        this.setState({reqId: reqId, results: [], pending: this.props.searchProviders.length});

        this.props.searchProviders.forEach(provider => {
            provider.onSearch(this.state.text, this.props.searchParams, (response) => {
                this.setState((state) => {
                    if (state.reqId !== reqId) {
                        return {};
                    }
                    return {
                        results: [...state.results, ...response.results],
                        pending: state.pending - 1
                    };
                });
            }, axios);
        });
    };
    resultSelected = (item) => {
        this.props.resultSelected(item);
        if (this.input) {
            this.input.blur();
        }
    };
}
