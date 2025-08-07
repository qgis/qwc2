/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {Line} from "react-chartjs-2";
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    BubbleController
} from 'chart.js';
import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {addMarker, removeMarker} from '../actions/layers';
import {changeMeasurementState} from '../actions/measurement';
import ResizeableWindow from '../components/ResizeableWindow';
import Spinner from '../components/widgets/Spinner';
import {getElevationInterface} from '../utils/ElevationInterface';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MeasureUtils from '../utils/MeasureUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/HeightProfile.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    BubbleController
);

class HeightProfilePrintDialog_ extends React.PureComponent {
    static propTypes = {
        children: PropTypes.func,
        layers: PropTypes.array,
        map: PropTypes.object,
        measurement: PropTypes.object,
        onClose: PropTypes.func,
        templatePath: PropTypes.string,
        theme: PropTypes.object
    };
    constructor(props) {
        super(props);
        this.externalWindow = null;
        this.chart = null;
        this.portalEl = null;
        this.imageEl = null;
    }
    state = {
        initialized: false,
        imageUrl: ''
    };
    componentDidMount() {
        const templatePath = MiscUtils.resolveAssetsPath(this.props.templatePath);
        this.externalWindow = window.open(templatePath, LocaleUtils.tr("heightprofile.title"), "toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes");
        this.externalWindow.addEventListener('load', this.setWindowContent, false);
        this.externalWindow.addEventListener('resize', this.windowResized, false);
        window.addEventListener('beforeunload', this.closePrintWindow);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.layers !== prevProps.layers || this.props.map.bbox !== prevProps.map.bbox || (this.state.initialized && !prevState.initialized)) {
            this.refreshImage();
        }
    }
    componentWillUnmount() {
        this.closePrintWindow();
        window.removeEventListener('beforeunload', this.closePrintWindow);
    }
    closePrintWindow = () => {
        this.externalWindow.close();
    };
    setWindowContent = () => {
        this.externalWindow.addEventListener('beforeunload', this.props.onClose, false);
        const container = this.externalWindow.document.getElementById("heightprofilecontainer");
        if (container) {
            const printBtn = this.externalWindow.document.createElement('div');
            printBtn.id = "print";
            printBtn.style.marginBottom = "1em";
            printBtn.innerHTML = '<style type="text/css">@media print{ #print { display: none; }}</style>' +
                '<button onClick="(function(){window.print();})()">' + LocaleUtils.tr("heightprofile.print") + '</button>';
            container.appendChild(printBtn);

            this.imageEl = this.externalWindow.document.createElement('div');
            this.imageEl.id = 'map';
            this.imageEl.innerHTML = LocaleUtils.tr("heightprofile.loadingimage");
            container.appendChild(this.imageEl);

            this.portalEl = this.externalWindow.document.createElement('div');
            this.portalEl.id = 'profile';
            container.appendChild(this.portalEl);

            this.setState({initialized: true});
            this.externalWindow.document.body.style.overflowX = 'hidden';
        } else {
            this.externalWindow.document.body.innerHTML = "Broken template. An element with id=heightprofilecontainer must exist.";
        }
    };
    refreshImage = () => {
        const measurement = this.props.measurement;
        const layer = {
            type: 'vector',
            opacity: 255,
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        coordinates: measurement.coordinates,
                        type: 'LineString'
                    },
                    styleOptions: {
                        strokeColor: [255, 0, 0, 1],
                        strokeWidth: 4
                    },
                    properties: {
                        segment_labels: measurement.segment_lengths.map(length => MeasureUtils.formatMeasurement(length, false, measurement.lenUnit))
                    }
                }
            ]
        };
        const mapCrs = this.props.map.projection;
        const scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
        const exportParams = LayerUtils.collectPrintParams(this.props.layers, this.props.theme, scale, mapCrs, true, false);
        const highlightParams = VectorLayerUtils.createPrintHighlighParams([layer], mapCrs);
        const imageParams = {
            SERVICE: 'WMS',
            VERSION: '1.3.0',
            REQUEST: 'GetMap',
            TRANSPARENT: 'true',
            TILED: 'false',
            CRS: this.props.map.projection,
            BBOX: this.props.map.bbox.bounds,
            WIDTH: this.props.map.size.width,
            HEIGHT: this.props.map.size.height,
            HIGHLIGHT_GEOM: highlightParams.geoms.join(";"),
            HIGHLIGHT_SYMBOL: highlightParams.styles.join(";"),
            HIGHLIGHT_LABELSTRING: highlightParams.labels.join(";"),
            HIGHLIGHT_LABELCOLOR: highlightParams.labelFillColors.join(";"),
            HIGHLIGHT_LABELBUFFERCOLOR: highlightParams.labelOutlineColors.join(";"),
            HIGHLIGHT_LABELBUFFERSIZE: highlightParams.labelOutlineSizes.join(";"),
            HIGHLIGHT_LABELSIZE: highlightParams.labelSizes.join(";"),
            HIGHLIGHT_LABEL_DISTANCE: highlightParams.labelDist.join(";"),
            HIGHLIGHT_LABEL_ROTATION: highlightParams.labelRotations.join(";"),
            csrf_token: MiscUtils.getCsrfToken(),
            ...exportParams
        };
        const baseUrl = this.props.theme.url.split("?")[0];
        const query = Object.entries(imageParams).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        const src = baseUrl + "?" + query;
        if (src === this.state.imageUrl) {
            return;
        }
        this.setState({imageUrl: src});
        const options = {
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            responseType: "blob"
        };
        axios.post(baseUrl, query, options).then(response => {
            const reader = new FileReader();
            reader.readAsDataURL(response.data);
            reader.onload = () => {
                this.imageEl.innerHTML = `<img src="${reader.result}" style="width: 100%" />`;
            };
        }).catch(() => {
            // Fall back to GET
            this.imageEl.innerHTML = `<img src="${src}" style="width: 100%" />`;
        });
    };
    windowResized = () => {
        if (this.chart) {
            this.chart.resize();
        }
    };
    render() {
        if (!this.state.initialized) {
            return null;
        }
        return ReactDOM.createPortal(this.props.children(el => {this.chart = el;}, false), this.portalEl);
    }
}

const HeightProfilePrintDialog = connect((state) => ({
    layers: state.layers.flat,
    map: state.map,
    theme: state.theme.current
}), {
})(HeightProfilePrintDialog_);

/**
 * Displays a height profile along a measured line.
 *
 * Triggered automatically when a line is measured via the `Measure` plugin.
 *
 * Requires `elevationServiceUrl` in `config.json` to point to a `qwc-elevation-service`,
 * or a custom elevation interface to be exposed in `window.QWC2ElevationInterface`, see
 * [ElevationInterface.js](https://github.com/qgis/qwc2/blob/master/utils/ElevationInterface.js).
 *
 * The print height profile functionality requires a template located by default at `assets/templates/heightprofileprint.html`
 * with containing a container element with `id=heightprofilecontainer`.
 */
class HeightProfile extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        changeMeasurementState: PropTypes.func,
        /** The height of the height profile widget in pixels. */
        height: PropTypes.number,
        /** The precision of displayed and exported values (0: no decimals, 1: 1 decimal position, etc). */
        heightProfilePrecision: PropTypes.number,
        measurement: PropTypes.object,
        projection: PropTypes.string,
        removeMarker: PropTypes.func,
        /** The number of elevation samples to query. */
        samples: PropTypes.number,
        /** Template location for the height profile print functionality */
        templatePath: PropTypes.string
    };
    static defaultProps = {
        samples: 500,
        heightProfilePrecision: 0,
        height: 150,
        templatePath: ":/templates/heightprofileprint.html"
    };
    state = {
        data: {},
        selectedDatasetIndices: [0],
        reqId: null,
        drawnodes: true,
        printdialog: false
    };
    constructor(props) {
        super(props);
        this.chart = null;
        this.profilePrintWindow = null;
    }
    componentDidUpdate(prevProps) {
        if (this.props.measurement.coordinates !== prevProps.measurement.coordinates) {
            if (this.props.measurement.drawing === false && this.props.measurement.geomType === "LineString" && !isEmpty(this.props.measurement.coordinates) ) {
                this.queryElevations(this.props.measurement.coordinates, this.props.measurement.segment_lengths, this.props.projection);
            } else if (!isEmpty(this.state.data)) {
                this.setState({data: {}});
                this.props.changeMeasurementState({...this.props.measurement, pickPositionCallback: null});
            }
        }
    }
    queryElevations(coordinates, distances, projection) {
        const reqId = uuidv1();
        this.setState({reqId: reqId});
        const totLength = this.props.measurement.length;
        getElevationInterface().getProfile(coordinates, distances, projection, this.props.samples).then(response => {
            // Request changed
            if (this.state.reqId !== reqId) {
                return;
            }

            let elevationsList = response.list;
            if (!elevationsList) {
                elevationsList = [{elevations: response, dataset: null}];
            }

            const data = elevationsList.map((entry, index) => {
                const elevations = entry.elevations;

                // Compute x-axis distances and get node points
                const nodes = [];
                let cumDist = distances[0];
                let distIdx = 0;
                const y = elevations;
                const x = y.map((value, idx, a) => {
                    const dist = (idx / (a.length - 1) * totLength).toFixed(0);
                    if (dist >= cumDist) {
                        nodes.push({x: dist, y: y[idx]});
                        cumDist += distances[++distIdx];
                    }
                    return dist;
                });
                // First and last node
                nodes.unshift({x: x[0], y: y[0]});
                nodes.push({x: x[x.length - 1], y: y[y.length - 1]});

                if (!elevations.every(val => val === 0)) {
                    return {
                        dataset: entry.dataset || `Dataset ${index + 1}`,
                        x: x,
                        y: elevations,
                        maxY: Math.max(...elevations),
                        minY: Math.min(...elevations.filter(elev => elev !== 0)),
                        totLength: totLength,
                        nodes: nodes
                    };
                }
                return null;
            }).filter(entry => entry !== null );

            this.setState((prevState) => ({
                reqId: null, data: data,
                selectedDatasetIndices: prevState.selectedDatasetIndices.every(i => i < data.length) ? prevState.selectedDatasetIndices : [0]
            }));
            this.props.changeMeasurementState({...this.props.measurement, pickPositionCallback: this.pickPositionCallback});
        }).catch((error) => {
            this.setState({reqId: null, data: error ? {error} : {}});
        });
    }
    onClose = () => {
        this.setState({data: {}, isloading: false});
        this.props.changeMeasurementState({...this.props.measurement, pickPositionCallback: null});
    };
    render() {
        if (isEmpty(this.state.data) && !this.state.isloading) {
            return null;
        }
        const extraControls = [
            {icon: 'circle', active: this.state.drawnodes, callback: () => this.setState(state => ({drawnodes: !state.drawnodes})), title: LocaleUtils.tr("heightprofile.drawnodes")},
            {icon: 'export', callback: this.exportProfile, title: LocaleUtils.tr("heightprofile.export")},
            {icon: 'print', active: this.state.printdialog, callback: () => this.setState(state => ({printdialog: !state.printdialog})), title: LocaleUtils.tr("heightprofile.print")}
        ];
        return [(
            <ResizeableWindow
                dockable="bottom" extraControls={extraControls} icon="line"
                initialHeight={this.props.height} initialWidth={600} initiallyDocked
                key="ProfileDialog" onClose={this.onClose} onExternalWindowResized={this.resizeChart}
                splitScreenWhenDocked
                title={LocaleUtils.tr("heightprofile.title")} usePortal={false}
            >
                {this.state.isloading ? (
                    <div className="height-profile-loading-indicator" role="body">
                        <Spinner className="spinner" /> {LocaleUtils.tr("heightprofile.loading")}
                    </div>
                ) : this.renderHeightProfile((el) => { this.chart = el; }, true)}
            </ResizeableWindow>
        ),
        this.state.printdialog ? (
            <HeightProfilePrintDialog key="ProfilePrintDialog" measurement={this.props.measurement} onClose={() => this.setState({printdialog: false})} templatePath={this.props.templatePath}>
                {this.renderHeightProfile}
            </HeightProfilePrintDialog>
        ) : null];
    }
    renderHeightProfile = (saveRef, interactive) => {
        if (this.props.measurement.drawing ) {
            return null;
        }
        if (this.state.data.error) {
            return (
                <div className="height-profile-error" role="body">
                    {LocaleUtils.tr("heightprofile.error") + ": " + this.state.data.error}
                </div>
            );
        }
        const distanceStr = LocaleUtils.tr("heightprofile.distance");
        const heightStr = LocaleUtils.tr("heightprofile.height");
        const aslStr = LocaleUtils.tr("heightprofile.asl");

        const { selectedDatasetIndices = [] } = this.state;
        const datasets = selectedDatasetIndices.flatMap((idx) => {
            return [
                {
                    label: this.state.data[idx].dataset,
                    data: this.state.data[idx].y.map((y, i) => ({ x: this.state.data[idx].x[i], y })),
                    fill: true,
                    backgroundColor: "rgba(255,0,0,0.5)",
                    borderColor: "rgb(255,0,0)",
                    borderWidth: 2,
                    pointRadius: 0,
                    order: 1
                },
                {
                    type: 'bubble',
                    data: this.state.data[idx].nodes,
                    backgroundColor: 'rgb(255, 255, 255)',
                    borderColor: 'rgb(255, 0, 0)',
                    borderWidth: 2,
                    radius: 5,
                    hoverRadius: 0,
                    hoverBorderWidth: 2,
                    order: 0,
                    hidden: !this.state.drawnodes
                }];
        });

        const data = {
            labels: this.state.data[0].x, // X-axis labels are all the same
            datasets: datasets
        };
        const sampleDataset = this.state.data[this.state.selectedDatasetIndices[0] ?? 0]; // first selected dataset for chart scale etc.

        // Approx 10 ticks
        const stepSizeFact = Math.pow(10, Math.ceil(Math.log10(sampleDataset.totLength / 10)));
        const stepSize = Math.round(sampleDataset.totLength / (stepSizeFact)) * stepSizeFact / 10;
        const prec = this.props.heightProfilePrecision;
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: interactive,
                    intersect: false,
                    displayColors: false,
                    bodyFont: {weight: 'bold'},
                    callbacks: {
                        title: (ctx) => (distanceStr + ": " + MeasureUtils.formatMeasurement(ctx[0].parsed.x, false, 'metric')),
                        label: (ctx) => (
                            this.state.data.length > 1
                                ? `${heightStr} (${ctx.dataset.label}): ${ctx.parsed.y.toFixed(prec)} m ${aslStr}`
                                : `${heightStr}: ${ctx.parsed.y.toFixed(prec)} m ${aslStr}`)
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    ticks: {
                        stepSize: stepSize,
                        font: {size: 10},
                        callback: (value) => value
                    },
                    title: {
                        display: true,
                        text: distanceStr + " [m]",
                        padding: 0
                    },
                    max: Math.ceil(sampleDataset.totLength)
                },
                y: {
                    ticks: {
                        font: {size: 10},
                        callback: (value) => value.toFixed(prec)
                    },
                    title: {
                        display: true,
                        text: heightStr + " [m " + aslStr + "]"
                    },
                    max: Math.ceil(Math.max(...selectedDatasetIndices.map(idx => this.state.data[idx]?.maxY ?? 0))),
                    min: Math.floor(Math.min(...selectedDatasetIndices.map(idx => this.state.data[idx]?.minY ?? 0)))
                }
            },
            onHover: interactive ? (evt, activeEls, chart) => {
                const chartArea = chart.chartArea;
                const chartX = Math.min(Math.max(evt.x - chartArea.left), chartArea.width);
                this.updateMarker(chartX / chartArea.width * sampleDataset.totLength);
            } : undefined
        };

        let datasetSelector = null;
        if (this.state.data.length > 1) {
            datasetSelector = (
                <div className="height-profile-dataset-select">
                    {this.state.data.map((dataset, idx) => {
                        const isSelected = this.state.selectedDatasetIndices?.includes(idx);
                        return (
                            <div key={dataset.id} >
                                <span
                                    className={`icon icon_clickable ${ isSelected ? 'icon-checked' : 'icon-unchecked' } `} onClick={() => {
                                        const selected = new Set(this.state.selectedDatasetIndices || []);
                                        if (isSelected) {
                                            selected.delete(idx);
                                        } else {
                                            selected.add(idx);
                                        }
                                        this.setState({ selectedDatasetIndices: Array.from(selected) });
                                    }}
                                />
                                <span>{dataset.dataset || "<unnamed>"}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        return (
            <div className="height-profile-chart-container" role="body" style={{position: 'relative'}}>
                {datasetSelector}
                <Line data={data} options={options} ref={saveRef}/>
            </div>
        );
    };
    resizeChart = () => {
        if (this.chart) {
            this.chart.resize();
        }
    };
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
    showTooltip = (idx) => {
        if (!this.chart) {
            return;
        }
        const chartArea = this.chart.chartArea;
        const activeElements = this.chart.data.datasets
            .map((ds, i) => ({ ds, i }))
            .filter(({ ds }) => ds.type !== 'bubble')
            .map(({ i }) => ({
                datasetIndex: i,
                index: idx
            }));
        this.chart.tooltip.setActiveElements(
            activeElements,
            {
                x: (chartArea.left + chartArea.right) / 2,
                y: (chartArea.top + chartArea.bottom) / 2
            });
        this.chart.update();
    };
    clearMarkerAndTooltip = () => {
        this.props.removeMarker('heightprofile');
        if (this.chart) {
            this.chart.tooltip.setActiveElements([], {x: 0, y: 0});
        }
    };
    pickPositionCallback = (pos) => {
        if (!pos || isEmpty(this.state.data)) {
            this.clearMarkerAndTooltip();
            return;
        }
        const data = this.state.data[this.state.selectedDatasetIndices[0]];

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
        const k = Math.min(1, x / data.totLength);
        const idx = Math.min(data.y.length - 1, Math.floor(k * this.props.samples));
        this.showTooltip(idx);
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
    exportProfile = () => {
        // const data = this.state.data[this.state.selectedDatasetIndex];

        this.state.selectedDatasetIndices.forEach(index => {
            const data = this.state.data[index];
            if (!data.x) {
                return;
            }
            let csv = "";
            csv += "index" + "\t" + "distance" + "\t" + "elevation" + "\n";
            data.x.forEach((x, idx) => {
                const sample = {x: x, y: data.y[idx]};
                const prec = this.props.heightProfilePrecision;
                const distance = Math.round(sample.x * Math.pow(10, prec)) / Math.pow(10, prec);
                const height = Math.round(sample.y * Math.pow(10, prec)) / Math.pow(10, prec);
                csv += String(idx).replace('"', '""') + "\t"
                    + String(distance) + "\t"
                    + String(height) + "\n";
            });
            FileSaver.saveAs(new Blob([csv], {type: "text/plain;charset=utf-8"}),
                this.state.data.length > 1 ? `heightprofile-${data.dataset}.csv`
                    : `heightprofile.csv`);
        });
    };
}

export default connect((state) => ({
    measurement: state.measurement,
    projection: state.map.projection
}), {
    addMarker: addMarker,
    changeMeasurementState: changeMeasurementState,
    removeMarker: removeMarker
})(HeightProfile);
