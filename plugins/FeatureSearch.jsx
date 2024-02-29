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

import IdentifyViewer from '../components/IdentifyViewer';
import SideBar from '../components/SideBar';
import Spinner from '../components/Spinner';
import IdentifyUtils from '../utils/IdentifyUtils';
import LocaleUtils from '../utils/LocaleUtils';

import "./style/FeatureSearch.css";


/**
 * Displays a dialog with a search form for configured QGIS feature searches with one or more input fields.
 */
class FeatureSearch extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object
    };
    static defaultProps = {
        side: 'right'
    };
    state = {
        busy: false,
        searchProviders: {},
        providerGroups: {},
        selectedProvider: '',
        searchResults: null
    };
    componentDidUpdate(prevProps) {
        if (this.props.theme !== prevProps.theme) {
            let defaultProvider = '';
            const providerGroups = {};
            const searchProviders = (this.props.theme?.searchProviders || []).reduce((res, entry) => {
                if (entry.provider === "qgis" && entry.params) {
                    const providerDef = {...entry};
                    if (!providerDef.params.fields) {
                        providerDef.params = {...providerDef.params};
                        providerDef.params.fields = {
                            TEXT: {label: LocaleUtils.tr("featuresearch.query"), type: "text"}
                        };
                    }
                    if (providerDef.params.titlemsgid) {
                        providerDef.params.title = LocaleUtils.tr(providerDef.params.titlemsgid);
                    }
                    const providerId = uuidv1();
                    res[providerId] = providerDef;
                    if (providerDef.params.default) {
                        defaultProvider = providerId;
                    }
                    const group = providerDef.params.group || '';
                    providerGroups[group] = [
                        ...(providerGroups[group] || []),
                        providerId
                    ];
                }
                return res;
            }, {});
            const sortedProviderGroups = Object.keys(providerGroups).sort().reduce((res, group) => {
                res[group] = providerGroups[group].sort((a, b) => searchProviders[a].params.title.localeCompare(searchProviders[b].params.title));
                return res;
            }, {});
            this.setState({searchProviders: searchProviders, selectedProvider: defaultProvider, providerGroups: sortedProviderGroups});
        }
    }
    onHide = () => {
        this.setState({searchResults: null});
    };
    render() {
        return (
            <SideBar icon="search" id="FeatureSearch" onHide={this.onHide} side={this.props.side}
                title={LocaleUtils.trmsg("featuresearch.title")} width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
        return (
            <div className="feature-search-body">
                <div className="feature-search-selection">
                    <select onChange={this.selectProvider} value={this.state.selectedProvider}>
                        <option disabled value="">{LocaleUtils.tr("featuresearch.select")}</option>
                        {Object.entries(this.state.providerGroups).map(([group, entries]) => {
                            return [
                                group !== '' ? (<option disabled key={group} value={group}>{group}</option>) : null,
                                entries.map(providerId => (
                                    <option key={providerId} value={providerId}>
                                        {this.state.searchProviders[providerId].params.title}
                                    </option>
                                ))
                            ];
                        })}
                    </select>
                </div>
                {this.renderSearchForm()}
                {this.renderSearchResults()}
            </div>
        );
    };
    renderSearchForm = () => {
        const provider = this.state.searchProviders[this.state.selectedProvider];
        if (!provider) {
            return null;
        }
        return (
            <form className="feature-search-form" disabled={this.state.busy} onChange={() => this.setState({searchResults: null})} onSubmit={this.search}>
                <fieldset disabled={this.state.busy}>
                    {provider.params.description ? (<div className="feature-search-form-descr">{provider.params.description}</div>) : null}
                    <table><tbody>
                        {Object.entries(provider.params.fields).map(([key, value]) => (
                            <tr key={key}>
                                <td>{value.label || LocaleUtils.tr(value.labelmsgid)}:</td>
                                <td>{this.renderField(key, value)}</td>
                            </tr>
                        ))}
                    </tbody></table>
                </fieldset>
                <div className="feature-search-bar">
                    <button className="button" disabled={this.state.busy} type="submit">
                        {this.state.busy ? (<Spinner />) : null}
                        {LocaleUtils.tr("search.search")}
                    </button>
                </div>
            </form>
        );
    };
    renderField = (fieldname, fieldcfg) => {
        if (fieldcfg.type === "select") {
            return (
                <select name={fieldname}>
                    {fieldcfg.options.map(entry => (
                        <option key={entry.value ?? entry} value={entry.value ?? entry}>{entry.label ?? entry}</option>
                    ))}
                </select>
            );
        } else {
            return (<input name={fieldname} type={fieldcfg.type || "text"} {...fieldcfg.options} />);
        }
    };
    renderSearchResults = () => {
        if (!this.state.searchResults) {
            return null;
        }
        const provider = this.state.searchProviders[this.state.selectedProvider];
        return (
            <div className="feature-search-results">
                {isEmpty(this.state.searchResults) ? (
                    <div className="feature-search-noresults">{LocaleUtils.tr("featuresearch.noresults")}</div>
                ) : (
                    <IdentifyViewer collapsible displayResultTree={false} enableExport identifyResults={this.state.searchResults} showLayerTitles={!provider.params.resultTitle} />
                )}
            </div>
        );
    };
    selectProvider = (ev) => {
        this.setState({selectedProvider: ev.target.value, searchResults: null});
    };
    search = (ev) => {
        ev.preventDefault();
        const provider = this.state.searchProviders[this.state.selectedProvider];
        if (!provider) {
            return;
        }
        const form = ev.target;
        const filter = {...provider.params.expression};
        const values = {};
        Object.keys(provider.params.fields).forEach(fieldname => {
            values[fieldname] = form.elements[fieldname].value;
        });
        const params = {
            SERVICE: 'WMS',
            VERSION: this.props.theme.version,
            REQUEST: 'GetFeatureInfo',
            CRS: this.props.theme.mapCrs,
            WIDTH: 100,
            HEIGHT: 100,
            LAYERS: [],
            FILTER: [],
            WITH_GEOMETRY: true,
            WITH_MAPTIP: false,
            feature_count: provider.params.featureCount || 100,
            info_format: 'text/xml'
        };
        Object.keys(filter).forEach(layer => {
            Object.entries(values).forEach(([key, value]) => {
                filter[layer] = filter[layer].replace(`$${key}$`, value.replace("'", "\\'"));
            });
            params.LAYERS.push(layer);
            params.FILTER.push(layer + ":" + filter[layer]);
        });
        params.QUERY_LAYERS = params.LAYERS = params.LAYERS.join(",");
        params.FILTER = params.FILTER.join(";");
        this.setState({busy: true, searchResults: null});
        axios.get(this.props.theme.featureInfoUrl, {params}).then(response => {
            const results = IdentifyUtils.parseResponse(response.data, this.props.theme, 'text/xml', null, this.props.map.projection);
            if (provider.params.resultTitle) {
                Object.entries(results).forEach(([layername, features]) => {
                    features.forEach(feature => {
                        const formatValues = {
                            ...feature.properties,
                            id: feature.id,
                            layername: layername
                        };
                        feature.displayname = provider.params.resultTitle.replace(/{([^}]+)}/g, match => formatValues[match.slice(1, -1)]);
                    });
                });
            }
            this.setState({busy: false, searchResults: results});
        }).catch(() => {
            this.setState({busy: false, searchResults: {}});
        });
    };
}

export default connect((state) => ({
    map: state.map,
    theme: state.theme.current
}), {})(FeatureSearch);
