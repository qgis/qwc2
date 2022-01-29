/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {setVisibleLegendWindow} from '../actions/legendwindow';
import ResizeableWindow from '../components/ResizeableWindow';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import './style/LayerInfoWindow.css';

class LegendWindow extends React.Component {
    static propTypes = {
        layers: PropTypes.object,
        bboxDependentLegend: PropTypes.bool,
        windowSize: PropTypes.object,
        map: PropTypes.object,
        setVisibleLegendWindow: PropTypes.func,
        visible: PropTypes.bool
    }
    renderLink(text, url) {
        if (url) {
            return (<a href={url} rel="noreferrer" target="_blank">{text}</a>);
        } else if (text) {
            return text;
        }
        return null;
    }
    renderRow = (title, content, html = false) => {
        if (content) {
            return (
                <tr>
                    <td>{LocaleUtils.tr(title)}:</td>
                    {html ? (
                        <td dangerouslySetInnerHTML={{__html: MiscUtils.addLinkAnchors(content)}} />
                    ) : (<td>{content}</td>)}
                </tr>
            );
        }
        return null;
    }
    render() {
        if (!this.props.visible) {
            return null;
        }
        let legend = [];
        let legendUrl = null;
        const scale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
        this.props.layers.map(layer => {
            if (layer.sublayers) {
                layer.sublayers.map(sublayer => {
                    legendUrl = LayerUtils.getLegendUrl(layer, sublayer, scale, this.props.map.projection, this.props.bboxDependentLegend ? this.props.map : null);
                    if (legendUrl) {
                        legend.push(<img className="layer-info-window-legend" src={legendUrl} />);
                        legend.push(<br />);
                    } else if (layer.color) {
                        legend.push(<span className="layer-info-window-coloricon" style={{backgroundColor: layer.color}} />);
                        legend.push(<br />);
                    }

                });
            }
        });
        let legendTitle = LocaleUtils.tr(LocaleUtils.trmsg("layerinfo.legend"));
        return (
            <ResizeableWindow icon="info-sign" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width} onClose={this.onClose}
                title={LocaleUtils.trmsg("layerinfo.title")} zIndex={9}>
                <div className="layer-info-window-body" role="body">
                    <h4 className="layer-info-window-title">{legendTitle}</h4>
                    <div className="layer-info-window-frame">
                        <table className="layer-info-window-table">
                            <tbody>
                                {this.renderRow(LocaleUtils.trmsg("layerinfo.legend"), legend)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </ResizeableWindow>
        );
    }
    renderScale = (scale) => {
        if (scale === 0) {
            return "0";
        } else if (scale >= 1) {
            return "1:" + Math.round(scale);
        } else {
            return Math.round(1 / scale) + ":1";
        }
    }
    onClose = () => {
        this.props.setVisibleLegendWindow(null, false);
    }
}

const selector = state => ({
    map: state.map,
    visible: state.legendwindow.visible
});

export default connect(selector, {
    setVisibleLegendWindow: setVisibleLegendWindow
})(LegendWindow);
