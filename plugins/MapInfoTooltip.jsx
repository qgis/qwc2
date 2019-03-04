/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const CopyToClipboard = require('react-copy-to-clipboard');
const proj4js = require('proj4').default;
const axios = require('axios');
const ConfigUtils = require("../utils/ConfigUtils");
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const LocaleUtils = require("../utils/LocaleUtils");
const MapUtils = require('../utils/MapUtils');
const CopyButton = require('../components/widgets/CopyButton');
const Icon = require('../components/Icon');
const displayCrsSelector = require('../selectors/displaycrs');
require('./style/MapInfoTooltip.css');

class MapInfoTooltip extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        displaycrs: PropTypes.string,
        elevationPrecision: PropTypes.number,
        includeWGS84: PropTypes.bool,
        enabled: PropTypes.bool
    }
    static defaultProps = {
        elevationPrecision: 0,
        includeWGS84: true
    }
    state = {
        coordinate: null, elevation: null, extraInfo: null
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    componentWillReceiveProps(newProps) {
        if(!newProps.enabled) {
            this.clear();
            return;
        }
        let newPoint = newProps.map.clickPoint;
        if(!newPoint || newPoint.button !== 2) {
            this.clear()
        } else {
            let oldPoint = this.props.map.clickPoint;
            if(!oldPoint || oldPoint.pixel[0] !== newPoint.pixel[0] || oldPoint.pixel[1] !== newPoint.pixel[1]) {
                this.setState({coordinate: newPoint.coordinate, elevation: null});
                let serviceParams = {pos: newPoint.coordinate.join(","), crs: newProps.map.projection};
                let elevationService = (ConfigUtils.getConfigProp("elevationServiceUrl") || "").replace(/\/$/, '');
                let elevationPrecision = this.props.elevationPrecision;
                if(elevationService) {
                    axios.get(elevationService + '/getelevation', {params: serviceParams}).then(response => {
                        this.setState({elevation: Math.round(response.data.elevation * Math.pow(10, elevationPrecision))/Math.pow(10, elevationPrecision)});
                    }).catch(e => {});
                }
                let mapInfoService = ConfigUtils.getConfigProp("mapInfoService");
                if(mapInfoService) {
                    axios.get(mapInfoService, {params: serviceParams}).then(response => {
                        this.setState({extraInfo: response.data.results});
                    }).catch(e => {});
                }
            }
        }
    }
    clear = () => {
        this.setState({coordinate: null, height: null, extraInfo: null});
    }
    render() {
        if(!this.state.coordinate) {
            return null;
        }

        let info = [];

        let projections = [this.props.displaycrs];
        if(!projections.includes(this.props.map.projection)) {
            projections.push(this.props.map.projection);
        }
        if(this.props.includeWGS84 && !projections.includes("EPSG:4326")) {
            projections.push("EPSG:4326");
        }
        projections.map(crs => {
            let coo = CoordinatesUtils.reproject(this.state.coordinate, this.props.map.projection, crs);
            let digits = proj4js.defs(crs).units === 'degrees'? 4 : 0;
            info.push([
                CoordinatesUtils.getCrsLabels()[crs] || crs,
                coo.map(x => LocaleUtils.toLocaleFixed(x, digits)).join(", ")
            ]);
        });

        if(this.state.elevation) {
            info.push([
                LocaleUtils.getMessageById(this.context.messages, "mapinfotooltip.elevation"),
                this.state.elevation + " m"
            ]);
        }

        if(this.state.extraInfo) {
            info.push(...this.state.extraInfo);
        }
        let title = LocaleUtils.getMessageById(this.context.messages, "mapinfotooltip.title");
        let pixel = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK)(this.state.coordinate);
        let style = {
            left: pixel[0] + "px",
            top: pixel[1] + "px"
        };
        let text = info.map(entry => entry.join(": ")).join("\n");
        return (
            <div id="MapInfoTooltip" style={style}>
                <div className="mapinfotooltip-window">
                    <div className="mapinfotooltip-titlebar">
                        <span className="mapinfotooltip-title">{title}</span>
                        <CopyButton text={text} buttonClass="mapinfotooltip-button" />
                        <span className="mapinfotooltip-button" onClick={this.clear}>
                            <Icon icon="remove"/>
                        </span>
                    </div>
                    <div className="mapinfotooltip-body">
                        <table>
                            <tbody>
                                {info.map((entry,index) => (
                                    <tr key={"row" + index}>
                                        <td><b>{entry[0]}:</b></td>
                                        <td>{entry[1]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
        return null;
    }
};

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    enabled: state.identify.enabled,
    map: state.map ? state.map : null,
    displaycrs: displaycrs
}));

module.exports = {
    MapInfoTooltipPlugin: connect(selector, {

    })(MapInfoTooltip),
    reducers: {
        mousePosition: require('../reducers/mousePosition')
    }
}
