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
const Message = require('../../MapStore2Components/components/I18N/Message');
const {getFeature} = require('../actions/mapInfo');
const {changeSelectionState} = require('../../MapStore2Components/actions/selection');
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');
const {TaskBar} = require('../components/TaskBar');

class IdentifyRegion extends React.Component {
    static propTypes = {
        selection: PropTypes.object,
        changeSelectionState: PropTypes.func,
        mapcrs: PropTypes.string,
        theme: PropTypes.object,
        themelayer: PropTypes.object,
        postRequest: PropTypes.func
    }
    componentWillReceiveProps(newProps) {
        if(newProps.visible && newProps.visible !== this.props.visible) {
            this.props.changeSelectionState({geomType: 'Polygon'});
        } else if(!newProps.visible && newProps.visible !== this.props.visible) {
            this.props.changeSelectionState({geomType: undefined});
        } else if(newProps.visible && newProps.selection.polygon && newProps.selection !== this.props.selection) {
            this.getFeatures(newProps.selection.polygon);
        }
    }
    render() {
        return (
            <TaskBar task="IdentifyRegion">
                <span role="body">
                    <Message msgId="identifyregion.info" />
                </span>
            </MessageBar>
        );
    }
    getFeatures = (poly) => {
        if(
            poly.length < 1 || !this.props.theme ||
            !this.props.themelayer || this.props.themelayer.queryLayers.length === 0
        ) {
            return;
        }
        let querylayers = this.props.themelayer.queryLayers.join(",");
        let lMetaData = {
            title: this.props.themelayer.title
        };
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
            srsName: this.props.mapcrs
        };
        let wgs84poly = poly.map(coo => {
            let wgscoo = CoordinatesUtils.reproject(coo, this.props.mapcrs, "EPSG:4326");
            return [wgscoo.x, wgscoo.y];
        });
        this.props.setCurrentTask(null);
        this.props.getFeature(this.props.theme.url, requestParams, lMetaData, wgs84poly);
    }
};

const selector = (state) => {
    let layers = state.layers && state.layers.flat ? state.layers.flat : [];
    let themelayerid = state.theme ? state.theme.currentlayer : null;
    let themelayers = layers.filter(layer => layer.id == themelayerid);
    return {
        selection: state.selection,
        mapcrs: state.map && state.map.present ? state.map.present.projection : "EPSG:3857",
        theme: state.theme ? state.theme.current : null,
        themelayer: themelayers.length > 0 ? themelayers[0] : null
    };
};

module.exports = {
    IdentifyRegionPlugin: connect(selector, {
        changeSelectionState: changeSelectionState,
        getFeature: getFeature
    })(IdentifyRegion),
    reducers: {
        selection: require('../../MapStore2Components/reducers/selection'),
        mapInfo: require('../../MapStore2Components/reducers/mapInfo')
    }
}
