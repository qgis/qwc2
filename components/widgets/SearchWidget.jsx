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
import {v4 as uuidv4} from 'uuid';

import LocaleUtils from '../../utils/LocaleUtils';
import {SearchResultType} from '../../utils/SearchProviders';
import VectorLayerUtils from '../../utils/VectorLayerUtils';
import Icon from '../Icon';
import InputContainer from './InputContainer';
import PopupMenu from './PopupMenu';
import Spinner from './Spinner';

import './style/SearchWidget.css';


export default class SearchWidget extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        placeholder: PropTypes.string,
        queryGeometries: PropTypes.bool,
        resultSelected: PropTypes.func.isRequired,
        resultTypeFilter: PropTypes.array,
        searchParams: PropTypes.shape({
            mapcrs: PropTypes.string.isRequired,
            displaycrs: PropTypes.string.isRequired
        }),
        searchProviders: PropTypes.array,
        value: PropTypes.string
    };
    static defaultProps = {
        resultTypeFilter: [SearchResultType.PLACE],
        searchParams: {},
        searchProviders: []
    };
    state = {
        text: '',
        reqId: null,
        results: [],
        pending: 0,
        resultsVisible: false
    };
    constructor(props) {
        super(props);
        this.searchTimeout = null;
        this.preventBlur = false;
        this.state.text = props.value;
        this.input = null;
    }
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        if (this.props.value !== prevProps.value) {
            this.setState({text: this.props.value});
        }
    }
    render() {
        return (
            <div className="search-widget-container">
                <InputContainer>
                    <input
                        onChange={this.textChanged}
                        onClick={() => this.setState({resultsVisible: true})}
                        onFocus={this.onFocus}
                        onKeyDown={this.onKeyDown}
                        placeholder={this.props.placeholder ?? LocaleUtils.tr("search.search")}
                        ref={el => {this.input = el;}}
                        role="input"
                        type="text"
                        value={this.state.text} />
                    {this.state.pending > 0 ? (<Spinner role="suffix" />) : (<Icon icon="clear" onClick={this.clear} role="suffix" />)}
                </InputContainer>
                {(!isEmpty(this.state.results) || this.state.pending > 0) && this.state.resultsVisible ? this.renderResults() : null}
            </div>
        );
    }
    renderResults = () => {
        return (
            <PopupMenu anchor={this.input} className="search-widget-results" onClose={() => this.setState({resultsVisible: false})} setMaxWidth spaceKeyActivation={false}>
                {this.state.results.filter(group => this.props.resultTypeFilter.includes(group.type ?? SearchResultType.PLACE)).map(group => {
                    return [(
                        <div className="search-widget-results-group-title" disabled key={group.id}>
                            <span>{group.title ?? LocaleUtils.tr(group.titlemsgid)}</span>
                        </div>
                    ),
                    group.items.map(item => {
                        item.text = (item.label !== undefined ? item.label : item.text || '').replace(/<\/?\w+\s*\/?>/g, '');
                        return (
                            <div className="search-widget-results-item" key={group.id + ":" + item.id} onClick={() => this.resultSelected(group, item)} title={item.text}>{item.text}</div>
                        );
                    })];
                }).flat()}
            </PopupMenu>
        );
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
    onFocus = (ev) => {
        if (this.input && !this.state.resultsVisible) {
            ev.target.select();
        }
    };
    onKeyDown = (ev) => {
        if (ev.key === 'Enter') {
            this.startSearch();
        } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            this.setState({resultsVisible: true});
        }
    };
    startSearch = () => {
        clearTimeout(this.searchTimeout);
        const reqId = uuidv4();
        this.setState({reqId: reqId, results: [], pending: this.props.searchProviders.length});

        this.props.searchProviders.forEach(provider => {
            const searchParams = {
                lang: LocaleUtils.lang(),
                cfgParams: provider.cfgParams,
                ...provider.params,
                ...this.props.searchParams
            };
            provider.onSearch(this.state.text, searchParams, (response) => {
                this.setState((state) => {
                    if (state.reqId !== reqId) {
                        return {};
                    }
                    return {
                        results: [...state.results, ...response.results.map(group => ({...group, provider}))],
                        pending: state.pending - 1,
                        resultsVisible: true
                    };
                });
            }, axios);
        });
    };
    resultSelected = (group, item) => {
        if (!item.geometry && group.provider.getResultGeometry) {
            group.provider.getResultGeometry(item, (response) => {
                this.props.resultSelected({
                    ...item,
                    feature: response ? VectorLayerUtils.reprojectFeature(response.feature, response.crs, item.crs) : null,
                    x: item.x ?? (response?.center?.[0]),
                    y: item.y ?? (response?.center?.[1]),
                    crs: item.crs ?? response?.crs
                });
            });
        } else {
            this.props.resultSelected({
                ...item,
                feature: item.geometry ? {type: "Feature", geometry: item.geometry} : null
            });
        }
        if (this.input) {
            this.input.blur();
        }
    };
    clear = () => {
        this.setState({results: [], text: "", resultsVisible: false});
        this.props.resultSelected(null);
    };
}
