/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const Icon = require('./Icon');
const {connect} = require('react-redux');
const Message = require('../components/I18N/Message');
const {LayerRole, addLayer} = require('../actions/layers');
const {setThemeLayersList} = require('../actions/theme');
const {setCurrentTask} = require("../actions/task");
const ResizeableWindow = require("../components/ResizeableWindow");
const LocaleUtils = require("../utils/LocaleUtils");
const ThemeUtils = require('../utils/ThemeUtils');
require('./style/ThemeLayersListWindow.css');

class ThemeLayersListWindow extends React.Component {
    static propTypes = {
        themes: PropTypes.object,
        theme: PropTypes.object,
        setThemeLayersList: PropTypes.func,
        addLayer: PropTypes.func,
        windowSize: PropTypes.object
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    state = {
        selectedLayers: []
    }
    renderLayer(layer) {
        let checkboxstate = this.state.selectedLayers.includes(layer) ? 'checked' : 'unchecked';
        let addLayerTitle = LocaleUtils.getMessageById(this.context.messages, "themelayerslist.addlayer");
        return (
            <div className="layerlist-item" key={layer.name}>
                <Icon className="layerlist-item-checkbox" icon={checkboxstate} onClick={() => this.itemSelectionToggled(layer)} />
                <span className="layerlist-item-title" title={layer.title}>{layer.title}</span>
                <Icon className="layerlist-item-add" icon="plus" title={addLayerTitle} onClick={ev => this.addLayer(ev, layer)} />
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
            <ResizeableWindow title="themelayerslist.addlayerstotheme" icon="layers" onClose={this.onClose}
                initialWidth={this.props.windowSize.width} initialHeight={this.props.windowSize.height}>
                <div role="body" className="theme-list-window-body">
                    <h4 className="theme-list-window-title">{this.props.theme.title}</h4>
                    <div className="theme-list-window-frame">
                        {layerslist}
                    </div>
                    <button className="button" disabled={!this.state.selectedLayers.length} onClick={this.addSelectedLayers}><Message msgId="themelayerslist.addselectedlayers" /></button>
                </div>
            </ResizeableWindow>
        );
    }
    addLayer = (ev, layer) => {
        let subLayers = [];
        subLayers.push(layer);
        ev.stopPropagation();
        this.props.addLayer(ThemeUtils.createThemeLayer(this.props.theme, this.props.themes, LayerRole.USERLAYER, subLayers));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    }
    addSelectedLayers = () => {
        this.props.addLayer(ThemeUtils.createThemeLayer(this.props.theme, this.props.themes, LayerRole.USERLAYER, this.state.selectedLayers));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    }
    itemSelectionToggled = (layer) => {
        // If item is already in array, this means it is selected so it is removed from the array. Else it is added
        if (this.state.selectedLayers.includes(layer)) {
            let index = this.state.selectedLayers.indexOf(layer);
            this.setState(state => {
                const selectedLayers = state.selectedLayers.filter((item, j) => index !== j);
                return {
                  selectedLayers
                };
            });
        } else {
            this.setState(state => {
                const selectedLayers = state.selectedLayers.concat(layer);
                return {
                    selectedLayers
                };
            });
        }
    }    
    onClose = () => {
        this.props.setThemeLayersList(null);
    }
};

const selector = state => ({
    theme: state.theme.themelist,
    themes: state.layers
});

module.exports = connect(selector, {
    setThemeLayersList: setThemeLayersList,
    setCurrentTask: setCurrentTask,
    addLayer: addLayer
})(ThemeLayersListWindow);
