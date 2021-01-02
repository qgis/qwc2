/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import Chartist from 'chartist';
import ChartistComponent from 'react-chartist';
import ChartistAxisTitle from 'chartist-plugin-axistitle';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import {addMarker, removeMarker} from '../actions/layers';
import Spinner from '../components/Spinner';
import Message from '../components/I18N/Message';

import './style/HeightProfile.css';

class HeightProfile extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        heighProfilePrecision: PropTypes.number,
        height: PropTypes.number,
        measurement: PropTypes.object,
        mobile: PropTypes.bool,
        projection: PropTypes.string,
        removeMarker: PropTypes.func,
        samples: PropTypes.number
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
        data: [],
        isloading: false
    }
    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }
    handleResize = () => {
        this.setState({width: window.innerWidth});
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.measurement.coordinates !== prevProps.measurement.coordinates) {
            if (this.props.measurement.drawing === false && this.props.measurement.geomType === "LineString" && !isEmpty(this.props.measurement.coordinates) ) {
                this.queryElevations(this.props.measurement.coordinates, this.props.measurement.length, this.props.projection);
            } else if (!isEmpty(this.state.data)) {
                this.setState({data: []});
            }
        }
    }
    queryElevations(coordinates, distances, projection) {
        const serviceUrl = (ConfigUtils.getConfigProp("elevationServiceUrl") || "").replace(/\/$/, '');
        if (serviceUrl) {
            this.setState({ isloading: true });
            axios.post(serviceUrl + '/getheightprofile', {coordinates, distances, projection, samples: this.props.samples}).then(response => {
                this.setState({ isloading: false });
                this.setState({data: response.data.elevations});
            }).catch(e => {
                this.setState({ isloading: false });
                console.log("Query failed: " + e);
            });
        }
    }
    render() {
        if (isEmpty(this.state.data)) {
            if (this.state.isloading) {
                return (
                    <div id="HeightProfile">
                        <div className="height-profile-loading-indicator">
                            <Spinner className="spinner" />
                            <Message msgId="heightprofile.loading" />
                        </div>
                    </div>
                );
            } else {
                return null;
            }
        }
        const distanceStr = LocaleUtils.getMessageById(this.context.messages, "heightprofile.distance");
        const heightStr = LocaleUtils.getMessageById(this.context.messages, "heightprofile.height");
        const aslStr = LocaleUtils.getMessageById(this.context.messages, "heightprofile.asl");
        const totLength = (this.props.measurement.length || []).reduce((tot, num) => tot + num, 0);

        // Compute tick positions (so that there are approx 10 ticks on desktop and 5 ticks on mobile on the x-axis)
        const base = Math.pow(10, Math.floor(Math.log10(totLength / 10))); // 10E<num_digits_totLength - 1>
        const inc = Math.round((totLength / (this.props.mobile ? 5 : 10)) / base) * base;
        const ticks = [];
        for (let i = 0; i < totLength; i += inc) {
            ticks.push(i);
        }

        const data = {
            labels: new Array(this.props.samples).fill(0), // Just a dummy array of the right length, value is computed in labelInterpolationFnc
            series: [this.state.data.map((entry, index) => ({
                x: index * totLength / this.props.samples,
                y: entry
            }))]
        };
        const minHeight = Math.min(...this.state.data);
        const maxHeight = Math.max(...this.state.data);
        const options = {
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
        const listeners = {
            draw: ev => {
                if (ev.type === "area") {
                    ev.element._node.addEventListener("mousemove", ev2 => {
                        const rect = ev.element._node.getBoundingClientRect();
                        const idx = Math.min(this.props.samples - 1, Math.round((ev2.clientX - rect.left) / rect.width * this.props.samples));
                        this.updateMapMarker(idx / this.props.samples * totLength);
                        if (this.tooltip) {
                            const sample = data.series[0][idx];
                            const heighProfilePrecision = this.props.heighProfilePrecision;
                            const distance = Math.round(sample.x * Math.pow(10, heighProfilePrecision)) / Math.pow(10, heighProfilePrecision);
                            const height = Math.round(sample.y * Math.pow(10, heighProfilePrecision)) / Math.pow(10, heighProfilePrecision);
                            this.marker.style.visibility = this.tooltip.style.visibility = 'visible';
                            this.marker.style.left = this.tooltip.style.left = ev2.clientX + 'px';
                            this.marker.style.bottom = '30px';
                            this.marker.style.height = (this.props.height - 30) + 'px';
                            this.tooltip.style.bottom = this.props.height + 'px';
                            this.tooltip.innerHTML = "<b>" + distanceStr + ":</b> " + distance + " m<br />" +
                                                     "<b>" + heightStr + ":</b> " + height + " m " + aslStr;
                        }
                    });
                    ev.element._node.addEventListener("mouseout", () => {
                        this.props.removeMarker('heightprofile');
                        if (this.tooltip) {
                            this.marker.style.visibility = this.tooltip.style.visibility = 'hidden';
                        }
                    });
                }
            }
        };
        const height = 'calc(' + this.props.height + 'px + 0.5em)';
        return (
            <div id="HeightProfile" style={{height: height}}>
                <ChartistComponent data={data} listener={listeners} options={options} type="Line" />
                <span className="height-profile-tooltip" ref={el => { this.tooltip = el; }} />
                <span className="height-profile-marker" ref={el => { this.marker = el; }} />
            </div>
        );
    }
    updateMapMarker = (x) => {
        const segmentLengths = this.props.measurement.length;
        const coo = this.props.measurement.coordinates;
        if (isEmpty(segmentLengths) || isEmpty(coo)) {
            return;
        }
        let i = 0;
        let runl = 0;
        while (i < segmentLengths.length - 1 && x > runl + segmentLengths[i]) {
            runl += segmentLengths[i++];
        }
        const lambda = (x - runl) / segmentLengths[i];
        const p = [
            coo[i][0] + lambda * (coo[i + 1][0] - coo[i][0]),
            coo[i][1] + lambda * (coo[i + 1][1] - coo[i][1])
        ];
        this.props.addMarker('heightprofile', p, '', this.props.projection, 1000001); // 1000001: one higher than the zIndex in MeasurementSupport...
    }
}

export default connect((state) => ({
    measurement: state.measurement,
    projection: state.map.projection,
    mobile: state.browser.mobile
}), {
    addMarker: addMarker,
    removeMarker: removeMarker
})(HeightProfile);
