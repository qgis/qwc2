/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole} from '../../actions/layers';
import {SearchResultType} from '../../actions/search';
import LayerUtils from '../../utils/LayerUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import MapUtils from '../../utils/MapUtils';
import MiscUtils from '../../utils/MiscUtils';
import VectorLayerUtils from '../../utils/VectorLayerUtils';
import Icon from '../Icon';
import Spinner from './Spinner';

import './style/SearchWidget.css';


class SearchWidget extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        layers: PropTypes.array,
        map: PropTypes.object,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        placeholder: PropTypes.string,
        queryGeometries: PropTypes.bool,
        resultSelected: PropTypes.func.isRequired,
        resultTypeFilter: PropTypes.array,
        searchParams: PropTypes.object,
        searchProviders: PropTypes.array,
        theme: PropTypes.object,
        value: PropTypes.string
    };
    static defaultProps = {
        onBlur: () => {},
        onFocus: () => {},
        resultTypeFilter: [SearchResultType.PLACE],
        searchParams: {},
        searchProviders: []
    };
    state = {
        text: '',
        reqId: null,
        results: [],
        pending: 0,
        active: false,
        activeLayers: [],
        searchTerms: []
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
        // Collect active layers/search terms
        if (this.props.layers !== prevProps.layers) {
            let searchTerms = [];
            const activeLayers = [];
            const mapScale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
            for (const entry of LayerUtils.explodeLayers(this.props.layers)) {
                if (entry.layer.role === LayerRole.THEME && entry.sublayer.visibility === true && LayerUtils.layerScaleInRange(entry.sublayer, mapScale)) {
                    searchTerms = searchTerms.concat(entry.sublayer.searchterms || []);
                    activeLayers.push(entry.sublayer.name);
                }
            }
            this.setState({activeLayers: activeLayers, searchTerms: [...new Set(searchTerms)]});
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
                {this.state.pending > 0 ? (<Spinner />) : (<Icon icon="remove" onClick={this.clear} />)}
                {(!isEmpty(this.state.results) || this.state.pending > 0) && this.state.active ? this.renderResults() : null}
            </div>
        );
    }
    renderResults = () => {
        return (
            <div className="search-widget-results" onMouseDown={this.setPreventBlur}>
                {this.state.results.filter(group => this.props.resultTypeFilter.includes(group.type ?? SearchResultType.PLACE)).map(group => (
                    <div className="search-widget-results-group" key={group.id} onMouseDown={MiscUtils.killEvent}>
                        <div className="search-widget-results-group-title"><span>{group.title ?? LocaleUtils.tr(group.titlemsgid)}</span></div>
                        {group.items.map(item => {
                            item.text = (item.label !== undefined ? item.label : item.text || '').replace(/<\/?\w+\s*\/?>/g, '');
                            return (
                                <div className="search-widget-results-group-item" key={item.id} onClick={() => this.resultSelected(group, item)} title={item.text}>{item.text}</div>
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
            this.setState({active: false});
        }
    };
    onFocus = (ev) => {
        ev.target.select();
        this.props.onFocus();
        this.setState({active: true});
    };
    onKeyDown = (ev) => {
        if (ev.key === 'Enter') {
            this.startSearch();
        } else if (ev.key === 'Escape') {
            ev.target.blur();
        }
    };
    startSearch = () => {
        clearTimeout(this.searchTimeout);
        const reqId = uuidv1();
        this.setState({reqId: reqId, results: [], pending: this.props.searchProviders.length});

        this.props.searchProviders.forEach(provider => {
            const searchParams = {
                lang: LocaleUtils.lang(),
                activeLayers: this.state.activeLayers,
                searchTerms: this.state.searchTerms,
                theme: this.props.theme,
                cfgParams: provider.params || {},
                ...this.props.searchParams
            };
            provider.onSearch(this.state.text, searchParams, (response) => {
                this.setState((state) => {
                    if (state.reqId !== reqId) {
                        return {};
                    }
                    return {
                        results: [...state.results, ...response.results.map(group => ({...group, provider}))],
                        pending: state.pending - 1
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
                    feature: response ? VectorLayerUtils.reprojectFeature(response.feature, response.crs, item.crs) : null
                });
            });
        } else {
            this.props.resultSelected({
                ...item,
                feature: item.geomety ? {type: "Feature", geometry: item.geometry} : null
            });
        }
        if (this.input) {
            this.input.blur();
        }
    };
    clear = () => {
        this.setState({results: [], text: ""});
        this.props.resultSelected(null);
    };
}

export default connect((state) => ({
    layers: state.layers.flat,
    map: state.map,
    theme: state.theme.current
}))(SearchWidget);
