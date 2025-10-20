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

import Shape from '@giro3d/giro3d/entities/Shape.js';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler
} from 'chart.js';
import FileSaver from 'file-saver';
import PropTypes from 'prop-types';
import {Vector3} from 'three';

import LocaleUtils from '../../utils/LocaleUtils';
import MeasureUtils from '../../utils/MeasureUtils';
import MiscUtils from '../../utils/MiscUtils';
import ResizeableWindow from '../ResizeableWindow';

import '../../plugins/style/HeightProfile.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler
);

class HeightProfilePrintDialog extends React.PureComponent {
    static propTypes = {
        children: PropTypes.func,
        onClose: PropTypes.func,
        sceneContext: PropTypes.object,
        templatePath: PropTypes.string
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
        // Inherit API
        this.externalWindow.qwc2 = window.qwc2;
        this.externalWindow.addEventListener('load', this.setWindowContent, false);
        this.externalWindow.addEventListener('resize', this.windowResized, false);
        window.addEventListener('beforeunload', this.closePrintWindow);
        this.props.sceneContext.scene.view.controls.addEventListener('change', this.scheduleRefreshImage);
    }
    componentDidUpdate(prevProps, prevState) {
        if ((this.state.initialized && !prevState.initialized)) {
            this.refreshImage();
        }
    }
    componentWillUnmount() {
        this.closePrintWindow();
        window.removeEventListener('beforeunload', this.closePrintWindow);
        this.props.sceneContext.scene.view.controls.removeEventListener('change', this.scheduleRefreshImage);
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
    scheduleRefreshImage = () => {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = setTimeout(this.refreshImage, 500);
    };
    refreshImage = () => {
        const src = this.props.sceneContext.scene.renderer.domElement.toDataURL('image/png');
        const width = this.props.sceneContext.scene.renderer.domElement.offsetWidth;
        this.imageEl.innerHTML = `<img src="${src}" style="width: 100%; max-width: ${width}px" />`;
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


export default class HeightProfile extends React.Component {
    static propTypes = {
        data: PropTypes.array,
        /** The height of the height profile widget in pixels. */
        height: PropTypes.number,
        /** The precision of displayed and exported values (0: no decimals, 1: 1 decimal position, etc). */
        heightProfilePrecision: PropTypes.number,
        sceneContext: PropTypes.object,
        /** Template location for the height profile print functionality */
        templatePath: PropTypes.string
    };
    static defaultProps = {
        heightProfilePrecision: 0,
        height: 150,
        templatePath: ":/templates/heightprofileprint.html"
    };
    state = {
        printdialog: false,
        visible: true
    };
    constructor(props) {
        super(props);
        this.chart = null;
        this.profilePrintWindow = null;
    }
    componentDidMount() {
        this.marker = new Shape({
            showVertexLabels: true,
            showLine: false,
            showVertices: true,
            vertexLabelFormatter: ({position}) => MeasureUtils.formatMeasurement(position.z, false, 'm')
        });
        this.marker.visible = false;
        this.props.sceneContext.scene.add(this.marker);
    }
    componentWillUnmount() {
        this.props.sceneContext.scene.remove(this.marker);
    }
    componentDidUpdate(prevProps) {
        if (this.props.data !== prevProps.data) {
            this.setState({visible: true});
        }
    }
    onClose = () => {
        this.setState({visible: false, printdialog: false});
        this.marker.visible = false;
    };
    render() {
        if (!this.state.visible) {
            return null;
        }
        const extraControls = [
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
                {this.renderHeightProfile((el) => { this.chart = el; }, true)}
            </ResizeableWindow>
        ),
        this.state.printdialog ? (
            <HeightProfilePrintDialog key="ProfilePrintDialog" onClose={() => this.setState({printdialog: false})} sceneContext={this.props.sceneContext} templatePath={this.props.templatePath}>
                {this.renderHeightProfile}
            </HeightProfilePrintDialog>
        ) : null];
    }
    renderHeightProfile = (saveRef, interactive) => {
        const distanceStr = LocaleUtils.tr("heightprofile.distance");
        const heightStr = LocaleUtils.tr("heightprofile.height");
        const aslStr = LocaleUtils.tr("heightprofile.asl");

        const data = {
            labels: this.props.data.map(entry => entry[3]),
            datasets: [
                {
                    data: this.props.data.map(entry => entry[2]),
                    fill: true,
                    backgroundColor: "rgba(255,0,0,0.5)",
                    borderColor: "rgb(255,0,0)",
                    borderWidth: 2,
                    pointRadius: 0,
                    order: 1
                }
            ]
        };
        // Approx 10 ticks
        const totLength = this.props.data[this.props.data.length - 1][3];
        const maxHeight = Math.max(...this.props.data.map(x => x[2]));
        const stepSizeFact = Math.pow(10, Math.ceil(Math.log10(totLength / 10)));
        const stepSize = Math.round(totLength / (stepSizeFact)) * stepSizeFact / 10;
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
                        label: (ctx) => (heightStr + ": " + MeasureUtils.formatMeasurement(ctx.parsed.y, false, 'm') + " " + aslStr)
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
                    max: Math.ceil(totLength)
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
                    max: Math.ceil(maxHeight)
                }
            },
            onHover: interactive ? (evt, activeEls, chart) => {
                const chartArea = chart.chartArea;
                const chartX = Math.min(Math.max(evt.x - chartArea.left), chartArea.width);
                this.updateMarker(chartX / chartArea.width * totLength);
            } : undefined
        };

        return (
            <div className="height-profile-chart-container" onMouseLeave={this.hideMarker} role="body" style={{position: 'relative'}}>
                <Line data={data} options={options} ref={saveRef} />
            </div>
        );
    };
    resizeChart = () => {
        if (this.chart) {
            this.chart.resize();
        }
    };
    updateMarker = (dist) => {
        const data = this.props.data;
        const i = data.findIndex(x => x[3] >= dist);
        if (i === 0) {
            this.marker.setPoints([new Vector3(...data[0])]);
        } else {
            const lambda = (dist - data[i - 1][3]) / (data[i][3] - data[i - 1][3]);
            const p = new Vector3(
                data[i - 1][0] + lambda * (data[i][0] - data[i][0]),
                data[i - 1][1] + lambda * (data[i][1] - data[i][1]),
                data[i - 1][2] + lambda * (data[i][2] - data[i][2])
            );
            this.marker.setPoints([p]);
        }
        this.marker.visible = true;
    };
    hideMarker = () => {
        this.marker.visible = false;
    };
    exportProfile = () => {
        let csv = "";
        csv += "index" + "\t" + "distance" + "\t" + "elevation" + "\n";
        this.props.data.forEach((entry, idx) => {
            const sample = {x: entry[3], y: entry[2]};
            const prec = this.props.heightProfilePrecision;
            const distance = Math.round(sample.x * Math.pow(10, prec)) / Math.pow(10, prec);
            const height = Math.round(sample.y * Math.pow(10, prec)) / Math.pow(10, prec);
            csv += String(idx).replace('"', '""') + "\t"
                + String(distance) + "\t"
                + String(height) + "\n";
        });
        FileSaver.saveAs(new Blob([csv], {type: "text/plain;charset=utf-8"}), "heightprofile.csv");
    };
}
