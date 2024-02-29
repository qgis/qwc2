/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setActiveLayerInfo} from '../actions/layerinfo';
import ResizeableWindow from '../components/ResizeableWindow';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import {Image} from './widgets/Primitives';

import './style/LayerInfoWindow.css';

class LayerInfoWindow extends React.Component {
    static propTypes = {
        bboxDependentLegend: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        layer: PropTypes.object,
        layerInfoGeometry: PropTypes.object,
        map: PropTypes.object,
        scaleDependentLegend: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        setActiveLayerInfo: PropTypes.func,
        sublayer: PropTypes.object
    };
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
    };
    renderMetadata = (metadata) => {
        return metadata.map(entry => this.renderRow(entry.label, entry.content, true));
    };
    render() {
        if (!this.props.layer || !this.props.sublayer) {
            return null;
        }
        let legend = null;
        const scale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
        const legendUrl = LayerUtils.getLegendUrl(this.props.layer, this.props.sublayer, scale, this.props.map, this.props.bboxDependentLegend, this.props.scaleDependentLegend);
        if (legendUrl) {
            legend = (<Image className="layer-info-window-legend" src={legendUrl} />);
        } else if (this.props.layer.color) {
            legend = (<span className="layer-info-window-coloricon" style={{backgroundColor: this.props.layer.color}} />);
        }
        return (
            <ResizeableWindow icon="info-sign" initialHeight={this.props.layerInfoGeometry.initialHeight} initialWidth={this.props.layerInfoGeometry.initialWidth}
                initialX={this.props.layerInfoGeometry.initialX} initialY={this.props.layerInfoGeometry.initialY} initiallyDocked={this.props.layerInfoGeometry.initiallyDocked} onClose={this.onClose}
                title={LocaleUtils.trmsg("layerinfo.title")}
            >
                <div className="layer-info-window-body" role="body">
                    <h4 className="layer-info-window-title">{this.props.sublayer.title}</h4>
                    <div className="layer-info-window-frame">
                        <table className="layer-info-window-table">
                            <tbody>
                                {this.renderRow(LocaleUtils.trmsg("layerinfo.abstract"), this.props.sublayer.abstract, true)}
                                {this.props.sublayer.attribution ? this.renderRow(LocaleUtils.trmsg("layerinfo.attribution"), this.renderLink(this.props.sublayer.attribution.Title, this.props.sublayer.attribution.OnlineResource)) : null}
                                {this.renderRow(LocaleUtils.trmsg("layerinfo.keywords"), this.props.sublayer.keywords)}
                                {this.renderRow(LocaleUtils.trmsg("layerinfo.dataUrl"), this.renderLink(this.props.sublayer.dataUrl, this.props.sublayer.dataUrl))}
                                {this.renderRow(LocaleUtils.trmsg("layerinfo.metadataUrl"), this.renderLink(this.props.sublayer.metadataUrl, this.props.sublayer.metadataUrl))}
                                {this.props.sublayer.minScale !== undefined ? this.renderRow(LocaleUtils.trmsg("layerinfo.maxscale"), this.renderScale(this.props.sublayer.minScale)) : null}
                                {this.props.sublayer.maxScale !== undefined ? this.renderRow(LocaleUtils.trmsg("layerinfo.minscale"), this.renderScale(this.props.sublayer.maxScale)) : null}
                                {this.renderRow(LocaleUtils.trmsg("layerinfo.legend"), legend)}
                                {this.props.sublayer.metadata !== undefined ? this.renderMetadata(this.props.sublayer.metadata) : null}
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
    };
    onClose = () => {
        this.props.setActiveLayerInfo(null, null);
    };
}

const selector = state => ({
    map: state.map,
    layer: state.layerinfo.layer,
    sublayer: state.layerinfo.sublayer
});

export default connect(selector, {
    setActiveLayerInfo: setActiveLayerInfo
})(LayerInfoWindow);
