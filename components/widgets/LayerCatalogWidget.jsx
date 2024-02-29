import React from 'react';
import {connect} from 'react-redux';

import {remove as removeDiacritics} from 'diacritics';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {addLayer} from '../../actions/layers';
import LayerUtils from '../../utils/LayerUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import ServiceLayerUtils from '../../utils/ServiceLayerUtils';
import Icon from '../Icon';
import InputContainer from '../InputContainer';

import './style/LayerCatalogWidget.css';

class LayerCatalogWidget extends React.PureComponent {
    static propTypes = {
        addLayer: PropTypes.func,
        catalog: PropTypes.array,
        levelBasedIndentSize: PropTypes.bool,
        mapCrs: PropTypes.string,
        pendingRequests: PropTypes.number
    };
    state = {
        catalog: [],
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
    renderCatalogEntry(entry, filter, path, level = 0, idx) {
        const hasSublayers = !isEmpty(entry.sublayers);
        const sublayers = hasSublayers ? entry.sublayers.map((sublayer, i) => this.renderCatalogEntry(sublayer, filter, [...path, i], level + 1, i)) : [];
        if (sublayers.filter(item => item).length === 0 && filter && !removeDiacritics(entry.title).match(filter)) {
            return null;
        }
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
                    <span className="layer-catalog-widget-entry-contents" onClick={() => type ? this.addServiceLayer(entry) : this.toggleLayerListEntry(path)}>
                        {type ? (<span className="layer-catalog-widget-entry-service">{type}</span>) : null}
                        {entry.title}
                    </span>
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
        const filter = new RegExp(removeDiacritics(this.state.filter).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i");
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
        return (
            <div className="layer-catalog-widget">
                <InputContainer className="layer-catalog-widget-filter">
                    <input
                        onChange={ev => this.setState({filter: ev.target.value})} placeholder={filterplaceholder}
                        role="input" type="text" value={this.state.filter} />
                    <Icon icon="clear" onClick={() => this.setState({filter: ""})} role="suffix" />
                </InputContainer>
                <div className="layer-catalog-widget-body">
                    {this.state.catalog.map((entry, idx) => this.renderCatalogEntry(entry, filter, [idx], 0, idx))}
                    {emptyEntry}
                </div>
            </div>
        );
    }
    addServiceLayer = (entry) => {
        if (entry.resource) {
            const params = LayerUtils.splitLayerUrlParam(entry.resource);
            ServiceLayerUtils.findLayers(params.type, params.url, [params], this.props.mapCrs, (id, layer) => {
                if (layer) {
                    if (entry.sublayers === false) {
                        layer.sublayers = null;
                    }
                    this.props.addLayer(layer);
                } else {
                    // eslint-disable-next-line
                    alert(LocaleUtils.tr("importlayer.addfailed"));
                }
            });
        } else if (entry.type === "wms" || entry.type === "wfs" || entry.type === "wmts") {
            this.props.addLayer({...entry, sublayers: null});
        }
    };
}

export default connect(() => ({
}), {
    addLayer: addLayer
})(LayerCatalogWidget);
