/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {stringify} = require('wellknown');
const Message = require('../components/I18N/Message');
const {LayerRole} = require('../actions/layers');
const {sendIdentifyRequest} = require('../actions/identify');
const {changeSelectionState} = require('../actions/selection');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const {setCurrentTask} = require("../actions/task");
const {TaskBar} = require('../components/TaskBar');
const IdentifyUtils = require('../utils/IdentifyUtils');

class IdentifyRegion extends React.Component {
    static propTypes = {
        selection: PropTypes.object,
        changeSelectionState: PropTypes.func,
        map: PropTypes.object,
        theme: PropTypes.object,
        layers: PropTypes.array,
        setCurrentTask: PropTypes.func,
        sendRequest: PropTypes.func
    }
    componentDidUpdate(prevProps, prevState) {
        if(this.props.selection.polygon && this.props.selection !== prevProps.selection) {
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
                <Message msgId="identifyregion.info" />
            </span>
        );
    }
    render() {
        return (
            <TaskBar task="IdentifyRegion" onShow={this.onShow} onHide={this.onHide}>
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
    getFeatures = (poly) => {
        let queryLayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(layer.queryLayers) : accum;
        }, []).join(",");
        if(poly.length < 1 || !queryLayers) {
            return;
        }
        this.props.changeSelectionState({reset: true});
        let layer = this.props.layers.find(layer => layer.role === LayerRole.THEME);
        let center = [0, 0];
        for(let i = 0; i < poly.length; ++i) {
            center[0] += poly[i][0];
            center[1] += poly[i][1];
        }
        center[0] /= poly.length;
        center[1] /= poly.length;
        let geometry = {
            "type": "Polygon",
            "coordinates": [poly]
        };
        let filter = stringify(geometry);
        this.props.sendRequest(IdentifyUtils.buildFilterRequest(layer, queryLayers, filter, this.props.map, {}));
    }
};

const selector = (state) => ({
    selection: state.selection,
    map: state.map,
    theme: state.theme ? state.theme.current : null,
    layers: state.layers && state.layers.flat || []
});

module.exports = {
    IdentifyRegionPlugin: connect(selector, {
        changeSelectionState: changeSelectionState,
        setCurrentTask: setCurrentTask,
        sendRequest: sendIdentifyRequest
    })(IdentifyRegion),
    reducers: {
        selection: require('../reducers/selection')
    }
}
