/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from "react";
import {connect} from 'react-redux';

import isEmpty from "lodash.isempty";
import PropTypes from 'prop-types';

import ConfigUtils from "../utils/ConfigUtils";
import LayerUtils from "../utils/LayerUtils";
import LocaleUtils from "../utils/LocaleUtils";
import MiscUtils from "../utils/MiscUtils";
import Request from '../utils/Request';
import ResizeableWindow from "./ResizeableWindow";


class LegendPrintWindow extends React.Component {
    static propTypes = {
        addGroupTitles: PropTypes.bool,
        addLayerTitles: PropTypes.bool,
        bboxDependentLegend: PropTypes.bool,
        excludeLayers: PropTypes.array,
        extraLegendParameters: PropTypes.string,
        layers: PropTypes.array,
        map: PropTypes.object,
        onClose: PropTypes.func,
        scaleDependentLegend: PropTypes.bool,
        visibleOnly: PropTypes.bool
    };
    static defaultProps = {
        excludeLayers: []
    };
    state = {
        template: null,
        srcdoc: null
    };
    componentDidMount() {
        const templatePath = MiscUtils.resolveAssetsPath(ConfigUtils.getPluginConfig("LayerTree").cfg.templatePath);
        Request.get(templatePath).then(response => {
            this.setState({template: response.data}, this.rebuild);
        }).catch(() => {
            this.setState({srcdoc: '<html><body>Failed to load template.</body></html>'});
        });
    }
    componentDidUpdate(prevProps) {
        if (Object.keys(LegendPrintWindow.propTypes).find(prop => this.props[prop] !== prevProps[prop])) {
            this.rebuild();
        }
    }
    rebuild = () => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.state.template, "text/html");
        const container = doc.getElementById("legendcontainer");
        if (container) {
            let body = '<p id="legendcontainerbody">';
            body += this.props.layers.map(layer => {
                if (this.props.visibleOnly && !layer.visibility) {
                    return "";
                } else if (layer.legendUrl) {
                    return this.printLayerLegend(layer, layer);
                } else if (layer.color) {
                    return '<div class="legend-entry"><span style="display: inline-block; width: 1em; height: 1em; box-shadow: inset 0 0 0 1000px ' + layer.color + '; margin: 0.25em; border: 1px solid black;">&nbsp;</span>' + (layer.title || layer.name) + '</div>';
                } else {
                    return "";
                }
            }).join("");
            body += "</p>";
            container.innerHTML = body;
            this.setState({srcdoc: new XMLSerializer().serializeToString(doc)});
        } else {
            this.setState({srcdoc: '<html><body>Broken template. An element with id=legendcontainer must exist.</body></html>'});
        }
    };
    printLayerLegend = (layer, sublayer) => {
        const mapScale = this.props.map.scale;
        const isCategorized = (sublayer.sublayers || []).find(entry => entry.category_sublayer === true);
        if (this.props.excludeLayers.includes(sublayer.name)) {
            return '';
        } else if (sublayer.sublayers && !isCategorized && (!this.props.visibleOnly || sublayer.visibility)) {
            if (this.props.addGroupTitles) {
                const children = sublayer.sublayers.map(subsublayer => this.printLayerLegend(layer, subsublayer)).filter(x => x);
                if (isEmpty(children)) {
                    return '';
                } else {
                    return (
                        '<div class="legend-group">' +
                        `<h3 class="legend-group-title">${sublayer.title || sublayer.name}</h3>` +
                        '<div className="map-legend-group-entries">' +
                        sublayer.sublayers.map(subsublayer => this.printLayerLegend(layer, subsublayer)).join("\n") +
                        '</div>' +
                        '</div>'
                    );
                }
            } else {
                return sublayer.sublayers.map(subsublayer => this.printLayerLegend(layer, subsublayer)).join("\n");
            }
        } else {
            if (this.props.visibleOnly && !sublayer.visibility) {
                return '';
            }
            if ((this.props.visibleOnly || this.props.scaleDependentLegend) && !LayerUtils.layerScaleInRange(sublayer, mapScale)) {
                return '';
            }
            const request = LayerUtils.getLegendUrl(layer, sublayer, this.props.map, this.props.bboxDependentLegend, this.props.scaleDependentLegend, this.props.extraLegendParameters);
            return request ? (
                '<div class="legend-entry">' +
                (this.props.addLayerTitles && !sublayer.category_sublayer ? `<h3 class="legend-layer-title">${sublayer.title || sublayer.name}</h3>` : "") +
                `<img src="${request}" style="max-width: 100%"/>` +
                '</div>'
            ) : '';
        }
    };
    render() {
        const printLegend = (ev) => {
            ev.target.parentElement.parentElement.getElementsByTagName('iframe')[0].contentWindow.print();
        };
        return (
            <ResizeableWindow icon="print" initialHeight={0.75 * window.innerHeight}
                initialWidth={0.5 * window.innerWidth}
                onClose={this.props.onClose}
                title={LocaleUtils.tr("layertree.printlegend")}
            >
                {this.state.srcdoc ? (
                    <div className="layertree-legend-print-body">
                        <iframe srcDoc={this.state.srcdoc} />
                        <div className="layertree-legend-print-body-buttonbar">
                            <button onClick={printLegend}>{LocaleUtils.tr("layertree.printlegend")}</button>
                        </div>
                    </div>
                ) : null}
            </ResizeableWindow>
        );
    }
}

export default connect(state => ({
    layers: state.layers.flat,
    map: state.map
}), {
})(LegendPrintWindow);
