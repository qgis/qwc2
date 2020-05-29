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
const {setThemeLayersList} = require('../actions/theme');
const ResizeableWindow = require("../components/ResizeableWindow");
const MiscUtils = require('../utils/MiscUtils');
const LayerUtils = require('../utils/LayerUtils');
require('./style/LayerInfoWindow.css');

class ThemeLayersListWindow extends React.Component {
    static propTypes = {
        theme: PropTypes.object,
        layer: PropTypes.object,
        sublayer: PropTypes.object,
        setThemeLayersList: PropTypes.func,
        windowSize: PropTypes.object,
        map: PropTypes.object,
        bboxDependentLegend: PropTypes.bool
    }
    renderLayer(layer) {
        return (
            <div key={layer.name}>
                <span className="layertree-item-title" title={layer.title}>{layer.title}</span>
            </div>
        );
    }
    renderLayers(layer) {
        return layer.sublayers.map((sublayer) => {
            if(sublayer.sublayers) {
                return this.renderLayers(sublayer);
            }
            else {
                return this.renderLayer(sublayer);
            }
        });
    }
    render() {
        if(!this.props.theme) {
            return null;
        }
        let layerslist = this.renderLayers(this.props.theme);
        return (
            <ResizeableWindow title="themeswitcher.addlayerstotheme" icon="info-sign" onClose={this.onClose}
                initialWidth={this.props.windowSize.width} initialHeight={this.props.windowSize.height}>
                <div role="body" className="layer-info-window-body">
                    <h4 className="layer-info-window-title">{this.props.theme.title}</h4>
                    <div className="layer-info-window-frame">
                        {layerslist}
                    </div>
                </div>
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.props.setThemeLayersList(null);
    }
};

const selector = state => ({
    map: state.map,
    theme: state.theme.themelist,
    layer: state.layerinfo.layer || null,
    sublayer: state.layerinfo.sublayer || null
});

module.exports = connect(selector, {
    setThemeLayersList: setThemeLayersList
})(ThemeLayersListWindow);
