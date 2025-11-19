/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, addLayer} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import {setThemeLayersList} from '../actions/theme';
import {showNotification, closeWindow, NotificationType} from '../actions/windows';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeUtils from '../utils/ThemeUtils';
import Icon from './Icon';
import ResizeableWindow from './ResizeableWindow';

import './style/ThemeLayersListWindow.css';


class ThemeLayersListWindow extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        closeWindow: PropTypes.func,
        layers: PropTypes.array,
        setCurrentTask: PropTypes.func,
        setThemeLayersList: PropTypes.func,
        showNotification: PropTypes.func,
        theme: PropTypes.object,
        themes: PropTypes.object,
        windowSize: PropTypes.object
    };
    state = {
        selectedLayers: []
    };
    componentDidUpdate(prevProps) {
        if (this.props.theme !== prevProps.theme) {
            this.props.closeWindow("existinglayers");
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
                <Icon className="layerlist-item-add" icon="plus" onClick={() => this.addLayers([layer])} title={addLayerTitle} />
            </div>
        );
    }
    renderLayerGroup(layer) {
        return layer.sublayers.map((sublayer) => {
            if (sublayer.sublayers) {
                return (
                    <div className="layerlist-group" key={sublayer.name}>
                        {this.renderLayer(sublayer)}
                        <div className="layerlist-group-items">
                            {this.renderLayerGroup(sublayer)}
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
        return (
            <ResizeableWindow icon="layers" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width}
                onClose={this.onClose} title={LocaleUtils.tr("themelayerslist.addlayerstotheme")} >
                <div className="theme-list-window-body" role="body">
                    <h4 className="theme-list-window-title">{this.props.theme.title}</h4>
                    <div className="theme-list-window-frame">
                        {this.renderLayerGroup(this.props.theme)}
                    </div>
                    <button className="button" disabled={!this.state.selectedLayers.length} onClick={this.addSelectedLayers}>{LocaleUtils.tr("themelayerslist.addselectedlayers")}</button>
                </div>
            </ResizeableWindow>
        );
    }
    addSelectedLayers = () => {
        this.addLayers(this.state.selectedLayers.map(layer => ({...layer, visibility: true})));
    };
    addLayers = (sublayers) => {
        this.props.closeWindow("existinglayers");
        const existingLayer = this.props.layers.find(l => l.type === 'wms' && l.url === this.props.theme.url);
        if (existingLayer) {
            const existingSublayers = [...LayerUtils.getSublayerNames(existingLayer), existingLayer.name];
            const filteredSublayers = [];
            sublayers = sublayers.filter(sublayer => {
                if (existingSublayers.includes(sublayer.name)) {
                    filteredSublayers.push(sublayer);
                    return false;
                }
                return true;
            });
            if (!isEmpty(filteredSublayers)) {
                const text = LocaleUtils.tr("themelayerslist.existinglayers") + ": " + filteredSublayers.map(l => l.title).join(", ");
                const actions = [{
                    name: LocaleUtils.tr("themelayerslist.addanyway"),
                    onClick: () => {
                        this.props.addLayer(ThemeUtils.createThemeLayer(this.props.theme, this.props.themes, LayerRole.USERLAYER, filteredSublayers));
                        return true;
                    }
                }];
                this.props.showNotification("existinglayers", text, NotificationType.INFO, false, actions);
            }
        }
        if (!isEmpty(sublayers)) {
            this.props.addLayer(ThemeUtils.createThemeLayer(this.props.theme, this.props.themes, LayerRole.USERLAYER, sublayers));
        }
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
        this.props.closeWindow("existinglayers");
        this.props.setThemeLayersList(null);
    };
}

const selector = state => ({
    layers: state.layers.flat,
    theme: state.theme.themelist,
    themes: state.theme.themes
});

export default connect(selector, {
    closeWindow: closeWindow,
    setThemeLayersList: setThemeLayersList,
    setCurrentTask: setCurrentTask,
    addLayer: addLayer,
    showNotification: showNotification
})(ThemeLayersListWindow);
