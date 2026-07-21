import React from 'react';
import {connect} from 'react-redux';

import {remove as removeDiacritics} from 'diacritics';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {addLayer, removeLayer, replacePlaceholderLayer, LayerRole} from '../../actions/layers';
import {openExternalUrl, NotificationType, showNotification, closeWindow} from '../../actions/windows';
import LayerUtils from '../../utils/LayerUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import ServiceLayerUtils from '../../utils/ServiceLayerUtils';
import Icon from '../Icon';
import InputContainer from './InputContainer';

import './style/LayerCatalogWidget.css';


class LayerCatalogWidget extends React.PureComponent {
    static propTypes = {
        addLayer: PropTypes.func,
        catalog: PropTypes.array,
        closeWindow: PropTypes.func,
        layers: PropTypes.array,
        levelBasedIndentSize: PropTypes.bool,
        mapCrs: PropTypes.string,
        openExternalUrl: PropTypes.func,
        pendingRequests: PropTypes.number,
        removeLayer: PropTypes.func,
        replacePlaceholderLayer: PropTypes.func,
        showNotification: PropTypes.func,
        toggleGroupOnClick: PropTypes.bool
    };
    state = {
        catalog: [],
        filteredCatalog: null,
        filter: ""
    };
    constructor(props) {
        super(props);
        this.state.catalog = props.catalog || [];
    }
    componentDidUpdate(prevProps) {
        if (this.props.catalog !== prevProps.catalog) {
            this.setState({catalog: this.props.catalog || []});
        }
    }
    componentWillUnmount() {
        this.props.closeWindow("existinglayers");
    }
    renderCatalogEntry(entry, path, level = 0, idx) {
        const hasSublayers = !isEmpty(entry.sublayers);
        const sublayers = hasSublayers ? entry.sublayers.map((sublayer, i) => this.renderCatalogEntry(sublayer, [...path, i], level + 1, i)) : [];
        const type = entry.resource ? entry.resource.slice(0, entry.resource.indexOf(":")) : entry.type;
        const key = (entry.resource || (entry.type + ":" + entry.name)) + ":" + idx;
        const indentSize = !this.props.levelBasedIndentSize && level > 0 ? 1.5 : level;
        return (
            <div key={key} style={{paddingLeft: (0.5 * indentSize) + 'em'}}>
                <div className="layer-catalog-widget-entry">
                    {hasSublayers ? (
                        <Icon icon={entry.expanded ? 'tree_minus' : 'tree_plus'} onClick={() => this.toggleLayerListEntry(path)} />
                    ) : (
                        <span className="layer-catalog-widget-entry-iconspacer" />
                    )}
                    <span
                        className="layer-catalog-widget-entry-contents" onClick={() => this.entryClicked(entry, path)}
                        onKeyDown={MiscUtils.checkKeyActivate}
                        tabIndex={0}
                    >
                        {type ? (<span className="layer-catalog-widget-entry-service">{type}</span>) : null}
                        {entry.title}
                    </span>
                    {((hasSublayers && !entry.asGroup) || entry.asGroup === "option") && (entry.resource ?? entry.type ?? "").startsWith("wms") ? (
                        <Icon icon="group" onClick={() => hasSublayers && entry.resource ? this.checkAddGroup(entry) : this.checkAddServiceLayer(entry, true)} title={LocaleUtils.tr("importlayer.asgroup")} />
                    ) : null}
                    {entry.link ? <Icon className="layer-catalog-widget-entry-link" icon="info-sign"  onClick={ev => this.openUrl(ev, entry.link, entry.target)} title={LocaleUtils.tr("layercatalog.openlink")} /> : null}
                </div>
                {entry.expanded ? sublayers : null}
            </div>
        );
    }
    entryClicked = (entry, path) => {
        if (entry.type || entry.resource) {
            if (entry.asGroup === true && (entry.resource ?? entry.type).startsWith("wms")) {
                if (!isEmpty(entry.sublayers) && entry.resource) {
                    this.checkAddGroup(entry);
                } else {
                    this.checkAddServiceLayer(entry, true);
                }
            } else {
                if (this.props.toggleGroupOnClick && !isEmpty(entry.sublayers)) {
                    this.toggleLayerListEntry(path);
                } else {
                    this.checkAddServiceLayer(entry, false);
                }
            }
        } else {
            this.toggleLayerListEntry(path);
        }
    };
    toggleLayerListEntry = (path) => {
        this.setState((state) => {
            const catalogKey = this.state.filteredCatalog ? "filteredCatalog" : "catalog";
            const newCatalog = [...state[catalogKey]];
            newCatalog[path[0]] = {...newCatalog[path[0]]};
            let cur = newCatalog[path[0]];
            for (const idx of path.slice(1)) {
                cur.sublayers[idx] = {...cur.sublayers[idx]};
                cur = cur.sublayers[idx];
            }
            cur.expanded = !cur.expanded;
            return {[catalogKey]: newCatalog};
        });
    };
    render() {
        let emptyEntry = null;
        if (isEmpty(this.state.catalog) && this.props.pendingRequests === 0) {
            emptyEntry = (
                <div className="layer-catalog-placeholder">{LocaleUtils.tr("importlayer.noresults")}</div>
            );
        } else if (isEmpty(this.state.catalog)) {
            emptyEntry = (
                <div className="layer-catalog-placeholder">{LocaleUtils.tr("common.loading")}</div>
            );
        }
        const filterplaceholder = LocaleUtils.tr("importlayer.filter");
        const catalog = this.state.filteredCatalog ?? this.state.catalog;
        return (
            <div className="layer-catalog-widget">
                <InputContainer className="layer-catalog-widget-filter">
                    <input
                        onChange={ev => this.setFilter(ev.target.value)} placeholder={filterplaceholder}
                        role="input" type="text" value={this.state.filter} />
                    <Icon icon="clear" onClick={() => this.setState({filter: "", filteredCatalog: null})} role="suffix" />
                </InputContainer>
                <div className="layer-catalog-widget-body">
                    {catalog.map((entry, idx) => this.renderCatalogEntry(entry, [idx], 0, idx))}
                    {emptyEntry}
                </div>
            </div>
        );
    }
    setFilter = (text) => {
        this.setState(state => {
            if (!text) {
                return {filter: text, filteredCatalog: null};
            }
            const filter = new RegExp(removeDiacritics(text).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i");
            const filterCatalogEntry = (res, entry) => {
                const titleMatches = removeDiacritics(entry.title).match(filter);
                if (entry.sublayers) {
                    const matchedSublayers = entry.sublayers.reduce(filterCatalogEntry, []);
                    if (!isEmpty(matchedSublayers)) {
                        return [...res, {...entry, sublayers: matchedSublayers, expanded: true}];
                    } else if (titleMatches) {
                        return [...res, {...entry, expanded: false}];
                    } else {
                        return res;
                    }
                } else if (titleMatches) {
                    return [...res, entry];
                } else {
                    return res;
                }
            };
            const filteredCatalog = state.catalog.reduce(filterCatalogEntry, []);
            return {filter: text, filteredCatalog: filteredCatalog};
        });
    };
    checkAddServiceLayer = (entry, asGroup = false) => {
        const resource = entry.resource ? LayerUtils.splitLayerUrlParam(entry.resource) : null;
        const stripQuery = (url) => (url ?? "").split("?")[0];
        const existingSublayers = this.props.layers.reduce((res, layer) => {
            if (layer.type === (entry.type ?? resource?.type) && stripQuery(layer.url) === stripQuery(entry.url ?? resource?.url)) {
                return [...res, ...LayerUtils.getSublayerNames(layer), layer.name];
            }
            return res;
        }, []);
        if (existingSublayers.includes(entry.name ?? resource?.name)) {
            const text = LocaleUtils.tr("themelayerslist.existinglayers") + ": " + (entry.title ?? entry.name);
            const actions = [{
                name: LocaleUtils.tr("themelayerslist.addanyway"),
                onClick: () => {
                    this.addServiceLayer(entry, resource, asGroup);
                    return true;
                }
            }];
            this.props.showNotification("existinglayers", text, NotificationType.INFO, false, actions);
        } else {
            this.addServiceLayer(entry, resource, asGroup);
        }
    };
    checkAddGroup = (group) => {
        // Collect sublayers
        const sublayers = {};
        const stripQuery = (url) => (url ?? "").split("?")[0];
        const resource = LayerUtils.splitLayerUrlParam(group.resource);
        const groupUrl = stripQuery(resource.url);
        const collectSublayers = (entry) => {
            const entryParams = LayerUtils.splitLayerUrlParam(entry.resource ?? "");
            if (isEmpty(entry.sublayers) && stripQuery(entryParams.url) === groupUrl) {
                sublayers[entryParams.name] = entryParams;
            }
            (entry.sublayers || []).forEach(collectSublayers);
        };
        collectSublayers(group);
        // Check if one or more sublayers are already in the map
        const existingSublayers = this.props.layers.reduce((res, layer) => {
            if (layer.type === "wms" && stripQuery(layer.url) === stripQuery(groupUrl)) {
                return [...res, ...LayerUtils.getSublayerNames(layer), layer.name];
            }
            return res;
        }, []);
        const overlappingSublayers = Object.keys(sublayers).filter(name => existingSublayers.includes(name));
        if (!isEmpty(overlappingSublayers)) {
            const text = LocaleUtils.tr("themelayerslist.existinglayers") + ": " + overlappingSublayers.join(", ");
            const actions = [{
                name: LocaleUtils.tr("themelayerslist.addanyway"),
                onClick: () => {
                    this.addServiceLayer(group, resource, true, sublayers);
                    return true;
                }
            }];
            this.props.showNotification("existinglayers", text, NotificationType.INFO, false, actions);
        } else {
            this.addServiceLayer(group, resource, true, sublayers);
        }


    };
    addServiceLayer = (entry, resource, asGroup = false, sublayerSubset = null) => {
        this.props.closeWindow("existinglayers");
        if (resource) {
            // Create placeholder layer
            this.props.addLayer({
                id: resource.id,
                type: "placeholder",
                name: resource.name,
                title: entry.title ?? resource.name,
                role: LayerRole.USERLAYER,
                loading: true
            });
            ServiceLayerUtils.findLayers(resource.type, resource.url, [resource], this.props.mapCrs, (id, layer) => {
                if (layer) {
                    if (!asGroup) {
                        layer.sublayers = null;
                    } else if (sublayerSubset) {
                        const filterSublayers = (sublayers) => {
                            return sublayers.map(sublayer => {
                                if (sublayer.name in sublayerSubset) {
                                    return {
                                        ...sublayer,
                                        ...sublayerSubset[sublayer.name]
                                    };
                                } else if (sublayer.sublayers) {
                                    return {
                                        ...sublayer,
                                        sublayers: filterSublayers(sublayer.sublayers)
                                    };
                                } else {
                                    return null;
                                }
                            }).filter(Boolean);
                        };
                        layer.sublayers = filterSublayers(layer.sublayers);
                    }
                    LayerUtils.propagateLayerProperty(layer, "opacity", resource.opacity);
                    this.props.replacePlaceholderLayer(resource.id, layer);
                } else {
                    // eslint-disable-next-line
                    alert(LocaleUtils.tr("importlayer.addfailed"));
                    this.props.removeLayer(resource.id);
                }
            });
        } else if (entry.type === "wms" || entry.type === "wfs" || entry.type === "wmts") {
            if (asGroup) {
                this.props.addLayer(entry);
            } else {
                this.props.addLayer({...entry, sublayers: null});
            }
        }
    };
    openUrl = (ev, url, target, title) => {
        MiscUtils.killEvent(ev);
        if (target === "iframe") {
            target = ":iframedialog:externallinkiframe";
        }
        this.props.openExternalUrl(url, target, {title: title});
    };
}

export default connect(state => ({
    layers: state.layers.flat
}), {
    addLayer: addLayer,
    closeWindow: closeWindow,
    openExternalUrl: openExternalUrl,
    removeLayer: removeLayer,
    replacePlaceholderLayer: replacePlaceholderLayer,
    showNotification: showNotification
})(LayerCatalogWidget);
