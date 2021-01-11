/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import {stringify} from 'wellknown';
import {LayerRole} from '../actions/layers';
import {sendIdentifyRequest} from '../actions/identify';
import {changeSelectionState} from '../actions/selection';
import {setCurrentTask} from '../actions/task';
import TaskBar from '../components/TaskBar';
import IdentifyUtils from '../utils/IdentifyUtils';
import LocaleUtils from '../utils/LocaleUtils';

class IdentifyRegion extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        changeSelectionState: PropTypes.func,
        layers: PropTypes.array,
        map: PropTypes.object,
        selection: PropTypes.object,
        sendRequest: PropTypes.func,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.active && this.props.selection.polygon && this.props.selection !== prevProps.selection) {
            this.getFeatures(this.props.selection.polygon);
        }
    }
    onShow = () => {
        this.props.changeSelectionState({geomType: 'Polygon'});
    }
    onHide = () => {
        this.props.changeSelectionState({geomType: undefined});
    }
    renderBody = () => {
        return (
            <span role="body">
                {LocaleUtils.tr("identifyregion.info")}
            </span>
        );
    }
    render() {
        return (
            <TaskBar onHide={this.onHide} onShow={this.onShow} task="IdentifyRegion">
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
    getFeatures = (poly) => {
        const queryLayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(layer.queryLayers) : accum;
        }, []).join(",");
        if (poly.length < 1 || !queryLayers) {
            return;
        }
        this.props.changeSelectionState({reset: true});
        const layer = this.props.layers.find(l => l.role === LayerRole.THEME);
        const center = [0, 0];
        for (let i = 0; i < poly.length; ++i) {
            center[0] += poly[i][0];
            center[1] += poly[i][1];
        }
        center[0] /= poly.length;
        center[1] /= poly.length;
        const geometry = {
            type: "Polygon",
            coordinates: [poly]
        };
        const filter = stringify(geometry);
        this.props.sendRequest(IdentifyUtils.buildFilterRequest(layer, queryLayers, filter, this.props.map, {}));
    }
}

const selector = (state) => ({
    active: state.task.id === "IdentifyRegion",
    selection: state.selection,
    map: state.map,
    theme: state.theme.current,
    layers: state.layers.flat
});

export default connect(selector, {
    changeSelectionState: changeSelectionState,
    setCurrentTask: setCurrentTask,
    sendRequest: sendIdentifyRequest
})(IdentifyRegion);
