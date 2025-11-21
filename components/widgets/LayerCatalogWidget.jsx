import React from 'react';
import {connect} from 'react-redux';

import {remove as removeDiacritics} from 'diacritics';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {addLayer, removeLayer, replacePlaceholderLayer} from '../../actions/layers';
import LayerUtils from '../../utils/LayerUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import ServiceLayerUtils from '../../utils/ServiceLayerUtils';
import Icon from '../Icon';
import InputContainer from './InputContainer';

import './style/LayerCatalogWidget.css';


class LayerCatalogWidget extends React.PureComponent {
    static propTypes = {
        addLayer: PropTypes.func,
        catalog: PropTypes.array,
        levelBasedIndentSize: PropTypes.bool,
        mapCrs: PropTypes.string,
        pendingRequests: PropTypes.number,
        removeLayer: PropTypes.func,
        replacePlaceholderLayer: PropTypes.func
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
    renderCatalogEntry(entry, path, level = 0, idx) {
        const hasSublayers = !isEmpty(entry.sublayers);
        const sublayers = hasSublayers ? entry.sublayers.map((sublayer, i) => this.renderCatalogEntry(sublayer, [...path, i], level + 1, i)) : [];
        const type = entry.resource ? entry.resource.slice(0, entry.resource.indexOf(":")) : entry.type;
        const key = (entry.resource || (entry.type + ":" + entry.name)) + ":" + idx;
        const indentSize = !this.props.levelBasedIndentSize && level > 0 ? 1.5 : level;
        return (
            <div key={key} style={{paddingLeft: indentSize + 'em'}}>
                <div className="layer-catalog-widget-entry">
                    {hasSublayers ? (
                        <Icon icon={entry.expanded ? 'tree_minus' : 'tree_plus'} onClick={() => this.toggleLayerListEntry(path)} />
                    ) : (
                        <span className="layer-catalog-widget-entry-iconspacer" />
                    )}
                    <span className="layer-catalog-widget-entry-contents" onClick={() => type ? this.addServiceLayer(entry, !hasSublayers) : this.toggleLayerListEntry(path)}>
                        {type ? (<span className="layer-catalog-widget-entry-service">{type}</span>) : null}
                        {entry.title}
                    </span>
                    {hasSublayers && type === "wms" ? (
                        <Icon icon="group" onClick={() => this.addServiceLayer(entry, true)} title={LocaleUtils.tr("importlayer.asgroup")} />
                    ) : null}
                </div>
                {entry.expanded ? sublayers : null}
            </div>
        );
    }
    toggleLayerListEntry = (path) => {
        this.setState((state) => {
            const newCatalog = [...state.catalog];
            newCatalog[path[0]] = {...newCatalog[path[0]]};
            let cur = newCatalog[path[0]];
            for (const idx of path.slice(1)) {
                cur.sublayers[idx] = {...cur.sublayers[idx]};
                cur = cur.sublayers[idx];
            }
            cur.expanded = !cur.expanded;
            return {catalog: newCatalog};
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
                <div className="layer-catalog-placeholder">{LocaleUtils.tr("importlayer.loading")}</div>
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
                    <Icon icon="clear" onClick={() => this.setState({filter: ""})} role="suffix" />
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
                if (entry.sublayers) {
                    const newEntry = {...entry, sublayers: entry.sublayers.reduce(filterCatalogEntry, []), expanded: true};
                    return newEntry.sublayers.length > 0 ? [...res, newEntry] : res;
                } else if (removeDiacritics(entry.title).match(filter)) {
                    return [...res, entry];
                } else {
                    return res;
                }
            };
            const filteredCatalog = state.catalog.reduce(filterCatalogEntry, []);
            return {filter: text, filteredCatalog: filteredCatalog};
        });
    };
    addServiceLayer = (entry, asGroup = false) => {
        if (entry.resource) {
            const params = LayerUtils.splitLayerUrlParam(entry.resource);
            // Create placeholder layer
            this.props.addLayer({
                id: params.id,
                type: "placeholder",
                name: params.name,
                title: entry.title ?? params.name,
                role: params.USERLAYER,
                loading: true
            });
            ServiceLayerUtils.findLayers(params.type, params.url, [params], this.props.mapCrs, (id, layer) => {
                if (layer) {
                    if (entry.sublayers === false || !asGroup) {
                        layer.sublayers = null;
                    }
                    LayerUtils.propagateLayerProperty(layer, "opacity", params.opacity);
                    this.props.replacePlaceholderLayer(params.id, layer);
                } else {
                    // eslint-disable-next-line
                    alert(LocaleUtils.tr("importlayer.addfailed"));
                    this.props.removeLayer(params.id);
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
}

export default connect(state => ({
    layers: state.layers.flat
}), {
    addLayer: addLayer,
    closeWindow: closeWindow,
    removeLayer: removeLayer,
    replacePlaceholderLayer: replacePlaceholderLayer,
    showNotification: showNotification
})(LayerCatalogWidget);
