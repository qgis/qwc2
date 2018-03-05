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
const Message = require('../../MapStore2Components/components/I18N/Message');
const {sendIdentifyRegionRequest, sendIdentifyRequest} = require('../actions/identify');
const {changeSelectionState} = require('../../MapStore2Components/actions/selection');
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');
const {setCurrentTask} = require("../actions/task");
const {TaskBar} = require('../components/TaskBar');
const IdentifyUtils = require('../utils/IdentifyUtils');

class IdentifyRegion extends React.Component {
    static propTypes = {
        selection: PropTypes.object,
        changeSelectionState: PropTypes.func,
        map: PropTypes.object,
        theme: PropTypes.object,
        themelayer: PropTypes.object,
        setCurrentTask: PropTypes.func,
        sendRequest: PropTypes.func,
        sendWFSRequest: PropTypes.func,
        useWfs: PropTypes.bool
    }
    static defaultProps = {
        useWfs: false
    }
    componentWillReceiveProps(newProps) {
        if(newProps.selection.polygon && newProps.selection !== this.props.selection) {
            this.getFeatures(newProps.selection.polygon);
        }
    }
    onShow = () => {
        this.props.changeSelectionState({geomType: 'Polygon'});
    }
    onHide = () => {
        this.props.changeSelectionState({geomType: undefined});
    }
    render() {
        return (
            <TaskBar task="IdentifyRegion" onShow={this.onShow} onHide={this.onHide}>
                <span role="body">
                    <Message msgId="identifyregion.info" />
                </span>
            </TaskBar>
        );
    }
    getFeatures = (poly) => {
        if(
            poly.length < 1 || !this.props.theme ||
            !this.props.themelayer || this.props.themelayer.queryLayers.length === 0
        ) {
            return;
        }
        this.props.setCurrentTask(null);
        if(this.props.useWfs) {
            let querylayers = this.props.themelayer.queryLayers.join(",");
            let bbox = [poly[0][0], poly[0][1], poly[0][0], poly[0][1]];
            for(let i = 1; i < poly.length; ++i) {
                bbox[0] = Math.min(bbox[0], poly[i][0]);
                bbox[1] = Math.min(bbox[1], poly[i][1]);
                bbox[2] = Math.max(bbox[2], poly[i][0]);
                bbox[3] = Math.max(bbox[3], poly[i][1]);
            }
            let bboxstr = bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3];
            let requestParams = {
                bbox: bboxstr,
                outputformat: "GeoJSON",
                typename: querylayers,
                srsName: this.props.map.projection
            };
            let wgs84poly = poly.map(coo => {
                return CoordinatesUtils.reproject(coo, this.props.map.projection, "EPSG:4326");
            });
            this.props.sendWFSRequest(this.props.theme.url, requestParams, wgs84poly);
        } else {
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
            this.props.sendRequest(IdentifyUtils.buildFilterRequest(this.props.themelayer, filter, this.props.map, {}));
        }
    }
};

const selector = (state) => {
    let layers = state.layers && state.layers.flat ? state.layers.flat : [];
    let themelayerid = state.theme ? state.theme.currentlayer : null;
    let themelayers = layers.filter(layer => layer.id == themelayerid);
    return {
        selection: state.selection,
        map: state.map,
        theme: state.theme ? state.theme.current : null,
        themelayer: themelayers.length > 0 ? themelayers[0] : null
    };
};

module.exports = {
    IdentifyRegionPlugin: connect(selector, {
        changeSelectionState: changeSelectionState,
        setCurrentTask: setCurrentTask,
        sendRequest: sendIdentifyRequest,
        sendWFSRequest: sendIdentifyRegionRequest
    })(IdentifyRegion),
    reducers: {
        selection: require('../../MapStore2Components/reducers/selection')
    }
}
