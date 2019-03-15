/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const Message = require('../components/I18N/Message');
const MapUtils = require('../utils/MapUtils');
const {setActiveLayerInfo} = require('../actions/layerinfo');
const ResizeableWindow = require("../components/ResizeableWindow");
const MiscUtils = require('../utils/MiscUtils');
require('./style/LayerInfoWindow.css');

class LayerInfoWindow extends React.Component {
    static propTypes = {
        layer: PropTypes.object,
        sublayer: PropTypes.object,
        setActiveLayerInfo: PropTypes.func,
        windowSize: PropTypes.object,
        map: PropTypes.object,
        bboxDependentLegend: PropTypes.bool,
        setActiveLayerInfo: PropTypes.func
    }
    renderLink(text, url) {
        return url ? (<a href={url} target="_blank">{text}</a>) : text ? text : null;
    }
    renderRow = (title, content, html=false) => {
        if(content) {
            return (
                <tr>
                    <td><Message msgId={title} />:</td>
                    {html ? (
                        <td dangerouslySetInnerHTML={{__html: MiscUtils.addLinkAnchors(content)}}></td>
                    ) : (<td>{content}</td>)}
                </tr>
            );
        }
        return null;
    }
    render() {
        if(!this.props.layer || !this.props.sublayer) {
            return null;
        }
        let legend = null;
        if(this.props.layer.legendUrl) {
            let requestParams = "SERVICE=WMS" +
                                "&REQUEST=GetLegendGraphic" +
                                "&VERSION=" + (this.props.layer.version || "1.3.0") +
                                "&FORMAT=image/png" +
                                "&LAYER=" + this.props.sublayer.name +
                                "&CRS=" + this.props.map.projection +
                                "&SCALE=" + Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom)) +
                                "&WIDTH=" + this.props.map.size.width +
                                "&HEIGHT=" + this.props.map.size.height;
            if(this.props.bboxDependentLegend) {
                requestParams += "&BBOX=" + this.props.map.bbox.bounds.join(",");
            }
            let request = this.props.layer.legendUrl + (this.props.layer.legendUrl.indexOf('?') === -1 ? '?' : '&') + requestParams;
            legend = (<img className="layer-info-window-legend" src={request} />);
        } else if(this.props.layer.color) {
            legend = (<span className="layer-info-window-coloricon" style={{backgroundColor: this.props.layer.color}} />);
        }
        return (
            <ResizeableWindow title="layerinfo.title" icon="info-sign" onClose={this.onClose}
                initialWidth={this.props.windowSize.width} initialHeight={this.props.windowSize.height}>
                <div role="body" className="layer-info-window-body">
                    <h4 className="layer-info-window-title">{this.props.sublayer.title}</h4>
                    <div className="layer-info-window-frame">
                        <table className="layer-info-window-table">
                            <tbody>
                            {this.renderRow("layerinfo.abstract", this.props.sublayer.abstract, true)}
                            {this.props.sublayer.attribution ? this.renderRow("layerinfo.attribution", this.renderLink(this.props.sublayer.attribution.Title, this.props.sublayer.attribution.OnlineResource)) : null}
                            {this.renderRow("layerinfo.keywords", this.props.sublayer.keywords)}
                            {this.renderRow("layerinfo.dataUrl", this.renderLink(this.props.sublayer.dataUrl, this.props.sublayer.dataUrl))}
                            {this.renderRow("layerinfo.metadataUrl", this.renderLink(this.props.sublayer.metadataUrl, this.props.sublayer.metadataUrl))}
                            {this.renderRow("layerinfo.legend", legend)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.props.setActiveLayerInfo(null, null);
    }
};

const selector = state => ({
    map: state.map,
    layer: state.layerinfo.layer || null,
    sublayer: state.layerinfo.sublayer || null
});

module.exports = connect(selector, {
    setActiveLayerInfo: setActiveLayerInfo
})(LayerInfoWindow);
