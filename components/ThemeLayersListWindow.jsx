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

import {LayerRole, addLayer} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import {setThemeLayersList} from '../actions/theme';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeUtils from '../utils/ThemeUtils';
import Icon from './Icon';
import ResizeableWindow from './ResizeableWindow';

import './style/ThemeLayersListWindow.css';

class ThemeLayersListWindow extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setThemeLayersList: PropTypes.func,
        theme: PropTypes.object,
        themes: PropTypes.object,
        windowSize: PropTypes.object
    };
    state = {
        selectedLayers: []
    };
    componentDidUpdate(prevProps) {
        if (this.props.theme !== prevProps.theme) {
            this.setState({selectedLayers: []});
        }
    }
    renderLayer(layer) {
        const checkboxstate = this.state.selectedLayers.includes(layer) ? 'checked' : 'unchecked';
        const addLayerTitle = LocaleUtils.tr("themelayerslist.addlayer");
        return (
            <div className="layerlist-item" key={layer.name}>
                <Icon className="layerlist-item-checkbox" icon={checkboxstate} onClick={() => this.itemSelectionToggled(layer)} />
                <span className="layerlist-item-title" title={layer.title}>{layer.title}</span>
                <Icon className="layerlist-item-add" icon="plus" onClick={ev => this.addLayer(ev, layer)} title={addLayerTitle} />
            </div>
        );
    }
    renderLayers(layer) {
        const addLayerTitle = LocaleUtils.tr("themelayerslist.addlayer");
        return layer.sublayers.map((sublayer) => {
            if (sublayer.sublayers) {
                const checkboxstate = this.state.selectedLayers.includes(sublayer) ? 'checked' : 'unchecked';
                return (
                    <div className="layerlist-group" key={sublayer.name}>
                        <div className="layerlist-item" key={sublayer.name}>
                            <Icon className="layerlist-item-checkbox" icon={checkboxstate} onClick={() => this.itemSelectionToggled(sublayer)} />
                            <span className="layerlist-item-title" title={sublayer.title}>{sublayer.title}</span>
                            <Icon className="layerlist-item-add" icon="plus" onClick={ev => this.addLayer(ev, sublayer)} title={addLayerTitle} />
                        </div>
                        <div className="layerlist-group-items">
                            {this.renderLayers(sublayer)}
                        </div>
                    </div>
                );
            } else {
                return this.renderLayer(sublayer);
            }
        });
    }
    render() {
        if (!this.props.theme) {
            return null;
        }
        const layerslist = this.renderLayers(this.props.theme);
        return (
            <ResizeableWindow icon="layers" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width}
                onClose={this.onClose} title={LocaleUtils.trmsg("themelayerslist.addlayerstotheme")} >
                <div className="theme-list-window-body" role="body">
                    <h4 className="theme-list-window-title">{this.props.theme.title}</h4>
                    <div className="theme-list-window-frame">
                        {layerslist}
                    </div>
                    <button className="button" disabled={!this.state.selectedLayers.length} onClick={this.addSelectedLayers}>{LocaleUtils.tr("themelayerslist.addselectedlayers")}</button>
                </div>
            </ResizeableWindow>
        );
    }
    addLayer = (ev, layer) => {
        const subLayers = [];
        subLayers.push(layer);
        ev.stopPropagation();
        this.props.addLayer(ThemeUtils.createThemeLayer(this.props.theme, this.props.themes, LayerRole.USERLAYER, subLayers));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    };
    addSelectedLayers = () => {
        const sublayers = this.state.selectedLayers.map(layer => ({...layer, visibility: true}));
        this.props.addLayer(ThemeUtils.createThemeLayer(this.props.theme, this.props.themes, LayerRole.USERLAYER, sublayers));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    };
    itemSelectionToggled = (layer) => {
        // If item is already in array, this means it is selected so it is removed from the array. Else it is added
        if (this.state.selectedLayers.includes(layer)) {
            const index = this.state.selectedLayers.indexOf(layer);
            this.setState(state => {
                const selectedLayers = state.selectedLayers.filter((item, j) => index !== j);
                return { selectedLayers };
            });
        } else {
            this.setState(state => {
                const selectedLayers = state.selectedLayers.concat(layer);
                return {
                    selectedLayers
                };
            });
        }
    };
    onClose = () => {
        this.props.setThemeLayersList(null);
    };
}

const selector = state => ({
    theme: state.theme.themelist,
    themes: state.theme.themes
});

export default connect(selector, {
    setThemeLayersList: setThemeLayersList,
    setCurrentTask: setCurrentTask,
    addLayer: addLayer
})(ThemeLayersListWindow);
