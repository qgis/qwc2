/**
 * Copyright 2017-2021 Sourcepole AG
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
import chartistAxisTitle from 'chartist-plugin-axistitle';
import FileSaver from 'file-saver';
import {addMarker, removeMarker} from '../actions/layers';
import {changeMeasurementState} from '../actions/measurement';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';

import './style/HeightProfile.css';
import MeasureUtils from '../utils/MeasureUtils';


/**
 * Displays a height profile along a measured line.
 *
 * Triggered automatically when a line is measured via the `Measure` plugin.
 *
 * Requires `elevationServiceUrl` in `config.json` to point to a `qwc-elevation-service`.
 */
class HeightProfile extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        changeMeasurementState: PropTypes.func,
        /** The precision of displayed and exported values (0: no decimals, 0.1: 1 decimal position, etc). */
        heighProfilePrecision: PropTypes.number,
        /** The height of the height profile widget in pixels. */
        height: PropTypes.number,
        measurement: PropTypes.object,
        mobile: PropTypes.bool,
        projection: PropTypes.string,
        removeMarker: PropTypes.func,
        /** The number of elevation samples to query. */
        samples: PropTypes.number
    };
    static defaultProps = {
        samples: 500,
        heighProfilePrecision: 0,
        height: 100
    };
    constructor(props) {
        super(props);
        this.tooltip = null;
        this.marker = null;
        this.plot = null;
    }
    state = {
        width: window.innerWidth,
        data: [],
        isloading: false
    };
    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }
    exportProfile(data) {
        let csv = "";
        let idx = 0;
        csv += "index" + "\t" + "distance" + "\t" + "elevation" + "\n";
        this.state.data.map(() => {
            const sample = data.series[0][idx];
            const heighProfilePrecision = this.props.heighProfilePrecision;
            const distance = Math.round(sample.x * Math.pow(10, heighProfilePrecision)) / Math.pow(10, heighProfilePrecision);
            const height = Math.round(sample.y * Math.pow(10, heighProfilePrecision)) / Math.pow(10, heighProfilePrecision);
            csv += String(idx).replace('"', '""') + "\t"
                + parseFloat(distance).toLocaleString() + "\t"
                + parseFloat(height).toLocaleString() + "\n";
            idx += 1;
        });
        FileSaver.saveAs(new Blob([csv], {type: "text/plain;charset=utf-8"}), "heightprofile.csv");
    }
    handleResize = () => {
        this.setState({width: window.innerWidth});
    };
    componentDidUpdate(prevProps) {
        if (this.props.measurement.coordinates !== prevProps.measurement.coordinates) {
            if (this.props.measurement.drawing === false && this.props.measurement.geomType === "LineString" && !isEmpty(this.props.measurement.coordinates) ) {
                this.queryElevations(this.props.measurement.coordinates, this.props.measurement.segment_lengths, this.props.projection);
            } else if (!isEmpty(this.state.data)) {
                this.setState({data: [], pickPositionCallback: null});
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
                this.props.changeMeasurementState({...this.props.measurement, pickPositionCallback: this.pickPositionCallback});
            }).catch(e => {
                this.setState({ isloading: false });
                // eslint-disable-next-line
                console.log("Query failed: " + e);
            });
        }
    }
    render() {
        if (!this.props.measurement.length) {
            return null;
        }
        if (isEmpty(this.state.data)) {
            if (this.state.isloading) {
                return (
                    <div id="HeightProfile">
                        <div className="height-profile-loading-indicator">
                            <Spinner className="spinner" />
                            {LocaleUtils.tr("heightprofile.loading")}
                        </div>
                    </div>
                );
            } else {
                return null;
            }
        }
        const distanceStr = LocaleUtils.tr("heightprofile.distance");
        const heightStr = LocaleUtils.tr("heightprofile.height");
        const aslStr = LocaleUtils.tr("heightprofile.asl");
        const totLength = this.props.measurement.length;

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
            width: this.state.width - 20 + 'px',
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
                chartistAxisTitle({
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
                        const x = idx / this.props.samples * totLength;
                        this.updateMarker(x);
                        this.updateTooltip(x, this.state.data[idx], ev2.clientX);
                    });
                    ev.element._node.addEventListener("mouseout", () => {
                        this.clearMarkerAndTooltip();
                    });
                }
            }
        };
        const height = 'calc(' + this.props.height + 'px + 0.5em)';
        return (
            <div id="HeightProfile" style={{height: height}}>
                <ChartistComponent data={data} listener={listeners} options={options} ref={el => {this.plot = el; }} type="Line" />
                <span className="height-profile-tooltip" ref={el => { this.tooltip = el; }} />
                <span className="height-profile-marker" ref={el => { this.marker = el; }} />
                <Icon className="export-profile-button" icon="export" onClick={() => this.exportProfile(data)}
                    title={LocaleUtils.tr("heightprofile.export")} />
            </div>
        );
    }
    updateMarker = (x) => {
        const segmentLengths = this.props.measurement.segment_lengths;
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
    };
    updateTooltip = (x, y, plotPos) => {
        if (!this.tooltip) {
            return;
        }
        const distanceStr = LocaleUtils.tr("heightprofile.distance");
        const heightStr = LocaleUtils.tr("heightprofile.height");
        const aslStr = LocaleUtils.tr("heightprofile.asl");
        const heighProfilePrecision = this.props.heighProfilePrecision;
        const distance = Math.round(x * Math.pow(10, heighProfilePrecision)) / Math.pow(10, heighProfilePrecision);
        const height = Math.round(y * Math.pow(10, heighProfilePrecision)) / Math.pow(10, heighProfilePrecision);
        this.marker.style.visibility = this.tooltip.style.visibility = 'visible';
        this.marker.style.left = this.tooltip.style.left = plotPos + 'px';
        this.marker.style.bottom = '30px';
        this.marker.style.height = (this.props.height - 30) + 'px';
        this.tooltip.style.bottom = this.props.height + 'px';
        this.tooltip.innerHTML = "<b>" + distanceStr + ":</b> " + distance + " m<br />" +
                                 "<b>" + heightStr + ":</b> " + height + " m " + aslStr;
    };
    clearMarkerAndTooltip = () => {
        this.props.removeMarker('heightprofile');
        if (this.tooltip) {
            this.marker.style.visibility = this.tooltip.style.visibility = 'hidden';
        }
    };
    pickPositionCallback = (pos) => {
        if (!pos) {
            this.clearMarkerAndTooltip();
            return;
        }
        // Find ct-area path
        if (!this.plot || !this.plot.chart) {
            return;
        }
        const paths = this.plot.chart.getElementsByTagName("path");
        let path = null;
        for (let i = 0; i < paths.length; ++i) {
            if (paths[i].className.baseVal === "ct-area") {
                path = paths[i];
                break;
            }
        }
        if (!path) {
            return;
        }

        // Find sample index
        const segmentLengths = this.props.measurement.segment_lengths;
        const coo = this.props.measurement.coordinates;
        let x = 0;
        for (let iSegment = 0; iSegment < coo.length - 1; ++iSegment) {
            if (this.pointOnSegment(pos, coo[iSegment], coo[iSegment + 1])) {
                const len = MeasureUtils.computeSegmentLengths([pos, coo[iSegment]], this.props.projection, this.props.measurement.geodesic)[0];
                x += len;
                break;
            } else {
                x += segmentLengths[iSegment];
            }
        }
        const totLength = this.props.measurement.length;
        const k = Math.min(1, x / totLength);
        const idx = Math.min(this.state.data.length - 1, Math.floor(k * this.props.samples));
        this.updateTooltip(x, this.state.data[idx], path.getBoundingClientRect().left + k * path.getBoundingClientRect().width);
    };
    pointOnSegment = (q, p1, p2) => {
        const tol = 1E-3;
        // Determine whether points lie on same line: cross-product (P2-P1) x (Q - P1) zero?
        const cross = (p2[0] - p1[0]) * (q[1] - p1[1]) - (q[0] - p1[0]) * (p2[1] - p1[1]);
        if (Math.abs(cross) > tol) {
            return false;
        }
        // Determine if coordinates lie within segment coordinates
        if ((Math.abs(p1[0] - p2[0]) > tol)) {
            return (p1[0] <= q[0] && q[0] <= p2[0]) || (p2[0] <= q[0] && q[0] <= p1[0]);
        } else {
            return (p1[1] <= q[1] && q[1] <= p2[1]) || (p2[1] <= q[1] && q[1] <= p1[1]);
        }
    };
}

export default connect((state) => ({
    measurement: state.measurement,
    projection: state.map.projection,
    mobile: state.browser.mobile
}), {
    addMarker: addMarker,
    changeMeasurementState: changeMeasurementState,
    removeMarker: removeMarker
})(HeightProfile);
