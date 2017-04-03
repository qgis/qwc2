/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const ResizeableWindow = require("../components/ResizeableWindow");
const LayerUtils = require('../utils/LayerUtils');
require('./style/LayerInfoWindow.css');

const LayerInfoWindow = React.createClass({
    propTypes: {
        layer: React.PropTypes.object,
        sublayer: React.PropTypes.object,
        onClose: React.PropTypes.func,
        windowSize: React.PropTypes.object
    },
    renderLink(text, url) {
        return url ? (<a href={url}>{text}</a>) : text ? text : null;
    },
    renderRow(title, content) {
        if(content) {
            return (
                <tr>
                    <td><Message msgId={title} />:</td>
                    <td>{content}</td>
                </tr>
            );
        }
        return null;
    },
    render() {
        let legend = LayerUtils.getLegendGraphicURL(this.props.layer, this.props.sublayer.name);
        if(legend) {
            legend = (<img className="layer-info-window-legend" src={legend} />);
        }
        return (
            <ResizeableWindow title="layerinfo.title" glyphicon="info-sign" onClose={this.props.onClose} initialWidth={this.props.windowSize.width} initialHeight={this.props.windowSize.height}>
                <div role="body" className="layer-info-window-body">
                    <h4 className="layer-info-window-title">{this.props.sublayer.title}</h4>
                    <div className="layer-info-window-frame">
                        <table className="layer-info-window-table">
                            <tbody>
                            {this.renderRow("layerinfo.abstract", this.props.sublayer.abstract)}
                            {this.renderRow("layerinfo.attribution", this.renderLink(this.props.sublayer.attribution, this.props.sublayer.attributionUrl))}
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
});

module.exports = LayerInfoWindow;
