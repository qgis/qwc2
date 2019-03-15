/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const axios = require('axios');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const isEmpty = require('lodash.isempty');
const Chartist = require('chartist');
const ChartistComponent = require('react-chartist').default;
const ChartistAxisTitle = require('chartist-plugin-axistitle');
const ConfigUtils = require('../utils/ConfigUtils');
const LocaleUtils = require('../utils/LocaleUtils');
const {addMarker, removeMarker} = require('../actions/layers');

require('./style/HeightProfile.css');

class HeightProfile extends React.Component {
    static propTypes = {
        measurement: PropTypes.object,
        projection: PropTypes.string,
        samples: PropTypes.number,
        mobile: PropTypes.bool,
        addMarker: PropTypes.func,
        removeMarker: PropTypes.func,
        heighProfilePrecision: PropTypes.number,
        height: PropTypes.number
    }
    static defaultProps = {
        samples: 500,
        heighProfilePrecision: 0,
        height: 100
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    constructor(props) {
        super(props);
        this.tooltip = null;
        this.marker = null;
    }
    state = {
        width: window.innerWidth,
        data: []
    }
    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }
    handleResize = (ev) => {
        this.setState({width: window.innerWidth});
    }
    componentWillReceiveProps(newProps) {
        if(newProps.measurement.coordinates !== this.props.measurement.coordinates) {
            if(newProps.measurement.drawing === false && newProps.measurement.geomType === "LineString" && !isEmpty(newProps.measurement.coordinates) ) {
                this.queryElevations(newProps.measurement.coordinates, newProps.measurement.length, newProps.projection);
            } else {
                this.setState({data: []});
            }
        }
    }
    queryElevations(coordinates, distances, projection) {
        let serviceUrl = (ConfigUtils.getConfigProp("elevationServiceUrl") || "").replace(/\/$/, '');
        if(serviceUrl) {
            axios.post(serviceUrl + '/getheightprofile', {coordinates, distances, projection, samples: this.props.samples}).then(response => {
                this.setState({data: response.data.elevations});
            }).catch(e => {
                console.log("Query failed: " + e);
            });
        }
    }
    render() {
        if(isEmpty(this.state.data)) {
            return null;
        }
        let distanceStr = LocaleUtils.getMessageById(this.context.messages, "heightprofile.distance");
        let heightStr = LocaleUtils.getMessageById(this.context.messages, "heightprofile.height");
        let aslStr = LocaleUtils.getMessageById(this.context.messages, "heightprofile.asl");
        let totLength = (this.props.measurement.length || []).reduce((tot, num) => tot + num, 0);

        // Compute tick positions (so that there are approx 10 ticks on desktop and 5 ticks on mobile on the x-axis)
        let base = Math.pow(10, Math.floor(Math.log10(totLength/10))); // 10E<num_digits_totLength - 1>
        let inc = Math.round((totLength / (this.props.mobile ? 5. : 10.)) / base) * base;
        let ticks = [];
        for(let i = 0; i < totLength; i += inc) {
            ticks.push(i);
        }

        let data = {
            labels: new Array(this.props.samples).fill(0), // Just a dummy array of the right length, value is computed in labelInterpolationFnc
            series:  [this.state.data.map((entry, index) => ({
                x: index * totLength / this.props.samples,
                y: entry
            }))]
        };
        let minHeight = Math.min(...this.state.data);
        let maxHeight = Math.max(...this.state.data);
        let options = {
            width: this.state.width,
            height: this.props.height,
            chartPadding: {left: 5, bottom: 1, top: 0},
            showArea: true,
            axisX: {
                type: Chartist.FixedScaleAxis,
                ticks: ticks
            },
            axisY: {
                low: minHeight - (maxHeight - minHeight) / 10
            },
            plugins: [
                ChartistAxisTitle({
                    axisX: {
                       axisTitle: distanceStr + " [m]",
                       axisClass: 'ct-axis-title',
                       offset: {x: 0, y: 30},
                       textAnchor: 'middle'
                   },
                   axisY: {
                       axisTitle: heightStr + " [m " + aslStr + "]",
                       axisClass: 'ct-axis-title',
                       offset: {x: -10, y: 10},
                       flipTitle: true
                   }
               })
            ]
        };
        let listeners = {
            draw: ev => {
                if(ev.type === "area") {
                    ev.element._node.addEventListener("mousemove", ev2 => {
                        let rect = ev.element._node.getBoundingClientRect();
                        let idx = Math.min(this.props.samples - 1, Math.round((ev2.clientX - rect.left) / rect.width * this.props.samples));
                        this.updateMapMarker(idx / this.props.samples * totLength);
                        if(this.tooltip) {
                            let sample = data.series[0][idx];
                            let heighProfilePrecision = this.props.heighProfilePrecision;
                            let distance = Math.round(sample.x * Math.pow(10, heighProfilePrecision))/Math.pow(10, heighProfilePrecision);
                            let height = Math.round(sample.y * Math.pow(10, heighProfilePrecision))/Math.pow(10, heighProfilePrecision);
                            this.marker.style.visibility = this.tooltip.style.visibility = 'visible';
                            this.marker.style.left = this.tooltip.style.left = ev2.clientX + 'px';
                            this.marker.style.bottom = '30px';
                            this.marker.style.height = (this.props.height - 30) + 'px';
                            this.tooltip.style.bottom = this.props.height + 'px';
                            this.tooltip.innerHTML = "<b>" + distanceStr + ":</b> " + distance + " m<br />" +
                                                     "<b>" + heightStr + ":</b> " + height + " m " + aslStr;
                        }
                    });
                    ev.element._node.addEventListener("mouseout", ev2 => {
                        this.props.removeMarker('heightprofile');
                        if(this.tooltip) {
                            this.marker.style.visibility = this.tooltip.style.visibility = 'hidden';
                        }
                    });
                }
            }
        }
        let height = 'calc(' + height + 'px + 0.5em)';
        return (
            <div id="HeightProfile" style={{height: height}}>
                <ChartistComponent type="Line" data={data} options={options} listener={listeners} />
                <span ref={el => this.tooltip = el} className="height-profile-tooltip"></span>
                <span ref={el => this.marker = el} className="height-profile-marker"></span>
            </div>
        )
    }
    updateMapMarker = (x) => {
        let segmentLengths = this.props.measurement.length;
        let coo = this.props.measurement.coordinates;
        if(isEmpty(segmentLengths) || isEmpty(coo)) {
            return;
        }
        let i = 0;
        let runl = 0;
        while(i < segmentLengths.length - 1 && x > runl + segmentLengths[i]) {
            runl += segmentLengths[i++];
        }
        let lambda = (x - runl) / segmentLengths[i];
        let p = [
            coo[i][0] + lambda * (coo[i+1][0] - coo[i][0]),
            coo[i][1] + lambda * (coo[i+1][1] - coo[i][1])
        ];
        this.props.addMarker('heightprofile', p, '', this.props.projection, 1000001); // 1000001: one higher than the zIndex in MeasurementSupport...
    }
};

module.exports = {
    HeightProfilePlugin: connect((state) => ({
        measurement: state.measurement,
        projection: state.map.projection,
        mobile: state.browser ? state.browser.mobile : false
    }), {
        addMarker: addMarker,
        removeMarker: removeMarker
    })(HeightProfile)
};
