/**
 * Copyright 2020-2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {Line} from 'react-chartjs-2';
import {connect} from 'react-redux';

import axios from 'axios';
import {Buffer} from 'buffer';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Legend,
    Tooltip,
    TimeScale
} from 'chart.js';
import { getRelativePosition } from 'chart.js/helpers';
import annotationPlugin from 'chartjs-plugin-annotation';
import dayjs from 'dayjs';
import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';

import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import MapSelection from '../components/MapSelection';
import ResizeableWindow from '../components/ResizeableWindow';
import Input from '../components/widgets/Input';
import NumberInput from '../components/widgets/NumberInput';
import Spinner from '../components/widgets/Spinner';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import 'chartjs-adapter-dayjs-4';
import './style/SensorThingsTool.css';


ChartJS.register(
    LinearScale,
    PointElement,
    LineElement,
    Legend,
    Tooltip,
    TimeScale,
    annotationPlugin
);

/**
 * Query and display sensor data from a SensorThings API.
 *
 * Allows picking Locations in the map and displaying their Datastreams as a chart.
 *
 * **`config.json` sample configuration:**
 *
 * Add tool to `TopBar` `menuItems` and/or `toolbarItems`:
 * ```
 * {"key": "SensorThingsTool", "icon": "report"}
 * ```
 *
 * Sample plugin configuration for Fraunhofer SensorThings API with air quality data:
 * ```
 * {
 *   "name": "SensorThingsTool",
 *   "cfg": {
 *     "sensorThingsApiUrls": [
 *       {
 *         "url": "https://airquality-frost.k8s.ilt-dmz.iosb.fraunhofer.de/v1.1"
 *       }
 *     ],
 *     "timeFormats": {
 *       "tooltip": "DD.MM.YYYY HH:mm:ss",
 *       "millisecond": "HH:mm:ss.SSS",
 *       "second": "HH:mm:ss",
 *       "minute": "HH:mm",
 *       "hour": "DD.MM.YY HH:mm",
 *       "day": "DD.MM.YY",
 *       "week": "ll",
 *       "month": "MM.YYYY",
 *       "quarter": "[Q]Q - YYYY",
 *       "year": "YYYY"
 *     }
 *   }
 * }
 * ```
 */
class SensorThingsTool extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        currentTask: PropTypes.string,
        map: PropTypes.object,
        /** Map picking tolerance in pixels */
        queryTolerance: PropTypes.number,
        removeLayer: PropTypes.func,
        /** List of configurations for SensorThings API URLs.
         * The optional `locationsFilter` is applied to Locations queries.
         */
        sensorThingsApiUrls: PropTypes.arrayOf(
            PropTypes.shape({
                url: PropTypes.string,
                locationsFilter: PropTypes.string
            })
        ),
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object,
        /** Formatting patterns for displaying time values */
        timeFormats: PropTypes.object,
        /** Default size of the SensorThings Query window */
        windowSize: PropTypes.object,
        /** Zoom factor for chart zoom buttons */
        zoomFactor: PropTypes.number,
        zoomRectMinSize: PropTypes.object
    };
    static defaultProps = {
        queryTolerance: 16,
        sensorThingsApiUrls: [],
        timeFormats: {
            tooltip: 'YYYY-MM-DD HH:mm:ss',
            millisecond: 'HH:mm:ss.SSS',
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MM-DD',
            week: 'YYYY-MM-DD',
            month: 'YYYY-MM',
            quarter: '[Q]Q - YYYY',
            year: 'YYYY'
        },
        windowSize: {width: 800, height: 600},
        zoomFactor: 1.5,
        zoomRectMinSize: {width: 8, height: 8}
    };
    state = {
        showWindow: false,
        locationPickingActive: true,
        pickGeom: null,
        /**
         *  Locations at query point
         *
         *  locationsAtPoint = [
         *    {
         *      id: <Location ID>,
         *      name: <Location name>,
         *      description: <Location description>,
         *      link: <Location @iot.selfLink>,
         *      geom: <Location location>
         *    }
         *  ]
         */
        locationsAtPoint: [],
        /**
         * Location highlights in locations popup
         *
         *  highlightedLocation = {
         *    id: <Location ID>,
         *    name: <Location name>,
         *    description: <Location description>,
         *    link: <Location @iot.selfLink>,
         *    geom: <Location location>
         *  }
         */
        highlightedLocation: null,
        /**
         *  lookup for selected Locations, by ID
         *
         *  selectedLocations = {
         *    <Location ID>: {
         *      id: <Location ID>,
         *      name: <Location name>,
         *      description: <Location description>,
         *      link: <Location @iot.selfLink>,
         *      geom: <Location location>
         *    }
         *  }
         */
        selectedLocations: {},
        /**
         * sorted list of selected Datastreams for dropdown
         *
         *  selectedLocationsOptions = [
         *    {
         *      id: <Location ID>,
         *      name: <Location name>,
         *      description: <Location description>
         *    }
         *  ]
         */
        selectedLocationsOptions: [],
        // currently selected Location ID
        currentLocationId: null,
        /**
         * currently selected Location
         *
         *  currentSensorLocation = {
         *      id: <Location ID>,
         *      name: <Location name>,
         *      description: <Location description>,
         *      geom: <Location location>,
         *      datastreams: [
         *          <Datastream ID>
         *      ],
         *      filterOptions: {
         *          things: [
         *              id: <Thing ID>,
         *              name: <Thing name>,
         *              description: <Thing description>,
         *              optionText: <text shown in dropdown>,
         *              properties: <Thing custom properties>
         *          ],
         *          sensors: [
         *              id: <Sensor ID>,
         *              name: <Sensor name>,
         *              description: <Sensor description>,
         *              optionText: <text shown in dropdown>
         *          ],
         *          observedProperties: [
         *              id: <ObservedProperty ID>,
         *              name: <ObservedProperty name>,
         *              description: <ObservedProperty description>,
         *              optionText: <text shown in dropdown>
         *          ]
         *      }
         *      filteredDatastreams: [
         *          <Datastream ID matching current filter>
         *      ]
         *  }
         */
        currentSensorLocation: null,
        // show currently selected Location info window if true
        showLocationInfoWindow: false,
        // currently selected Datastreams filter options
        currentDatastreamsFilter: {
            thingId: -1,
            sensorId: -1,
            observedPropertyId: -1
        },
        // show Datastreams filter window for currently selected Location if true
        showDatastreamsFilterWindow: false,
        // currently selected Datastream ID
        currentDatastreamId: null,
        /**
         *  lookup for datastreams by ID
         *
         *  datastreams = {
         *      <Datastream ID>: {
         *          locationId: <Location ID>,
         *          thingId: <Thing ID>,
         *          sensorId: <Sensor ID>,
         *          observedPropertyId: <ObservedProperty ID>,
         *          id: <Datastream ID>,
         *          name: <Datastream name>,
         *          description:<Datastream description>,
         *          unitOfMeasurement: {
         *              name: <unit name>,
         *              symbol: <unit symbol>,
         *              definition: <unit definition>
         *          },
         *          phenomenonTime: <Datastream phenomenonTime time period>,
         *          period: {
         *              start: <period start as Unix timestamp>,
         *              end: <period end as Unix timestamp>
         *          }
         *          link: <Datastream @iot.selfLink>,
         *          properties: <Datastream custom properties>
         *      }
         *  }
         */
        datastreams: {},
        // predefined colors for graph datasets
        graphColors: [
            [31, 120, 180],
            [227, 26, 28],
            [128, 230, 25],
            [255, 127, 0],
            [127, 25, 230],
            [51, 160, 44],
            [166, 206, 227],
            [251, 154, 153],
            [179, 255, 102],
            [253, 191, 111],
            [178, 117, 240],
            [178, 223, 138]
        ],
        /**
         *  graph config and observations of selected datastreams
         *
         *  graph = {
         *      x: {                                                // x-axis config
         *          min: <graph period start as Unix timestamp>,    // null if none
         *          max: <graph period end as Unix timestamp>,      // null if none
         *          thresholds: [                                   // list of threshold values for this axis
         *              {
         *                  label: <threshold line label>,
         *                  value: <threshold value>,
         *                  color: [<r>, <g>, <b>] (0-255)          // threshold line color
         *              }
         *          ],
         *          positionAtTop: <whether to position the x-axis at the top or bottom>
         *      },
         *      y: {                                                // y-axis config
         *          min: <graph min value>,                         // null if auto
         *          max: <graph max value>,                         // null if auto
         *          thresholds: [                                   // list of threshold values for this axis
         *              {
         *                  label: <threshold line label>,
         *                  value: <threshold value>,
         *                  color: [<r>, <g>, <b>] (0-255)          // threshold line color
         *              }
         *          ],
         *          reverse: <whether to reverse direction of y-axis>
         *      },
         *      y2: {                                               // second y-axis config
         *          enabled: <whether second y-axis is shown>,
         *          min: <graph min value>,                         // null if auto
         *          max: <graph max value>,                         // null if auto
         *          thresholds: [                                   // list of threshold values for this axis
         *              {
         *                  label: <threshold line label>,
         *                  value: <threshold value>,
         *                  color: [<r>, <g>, <b>] (0-255)          // threshold line color
         *              }
         *          ],
         *          reverse: <whether to reverse direction of second y-axis>,
         *          showGrid: <whether grid lines for second y-axis are shown>
         *      },
         *      datastreams: [
         *          {
         *              id: <selected Datastream ID>,   // "" if none
         *              observations: [                 // null if none
         *                  {
         *                      x: <Observation time as Unix timestamp>,
         *                      y: <Observation value>
         *                  }
         *              ],
         *              loading: <whether Observations are still loading>,
         *              colorIdx: <index of predefined color>, // null if using random color
         *              color: [<r>, <g>, <b>] (0-255)  // line color of this dataset in the graph
         *              statistics: {
         *                  arithmeticMean: <arithmetic mean>,   // null if none
         *                  percentiles: [
         *                      {
         *                          percentile: <selected percentile>
         *                          value: <value for percentile>
         *                      }
         *                  ]
         *              }
         *          }
         *      ]
         *  }
         */
        graph: {
            x: {
                min: null, // Unix timestamp
                max: null, // Unix timestamp
                thresholds: [],
                positionAtTop: false
            },
            y: {
                min: null,
                max: null,
                thresholds: [],
                reverse: false
            },
            y2: {
                enabled: false,
                min: null,
                max: null,
                thresholds: [],
                reverse: false,
                showGrid: true
            },
            datastreams: []
        },
        // current time slider value as Unix timestamp
        timeSliderValue: null,
        // selected interval preset in ms (-1 if not set)
        selectedInterval: -1,
        // true if graph options are shown
        graphOptionsPopup: false,
        // custom threshold config from graph options
        customThresholds: {
            x: {
                label: "",
                value: null
            },
            y: {
                label: "",
                value: null
            },
            y2: {
                label: "",
                value: null
            }
        },
        // set to datastream index if datastream options are shown
        datastreamOptionsPopup: false,
        /**
         * selected datastream options
         *
         *  datastreamOptions = [
         *      {
         *          datastreamId: <Datastream ID>,
         *          showOnSecondYAxis: <whether to show graph on second y-axis>,
         *          showArithmeticMean: <whether to show arithmetic mean>,
         *          percentilesInput: "<comma separated list of percentiles>",
         *          percentiles: [<list of percentiles from percentilesInput>]
         *      }
         *  ]
         */
        datastreamOptions: [],
        // set to datastream index if datastream table window is shown
        datastreamTableWindow: null
    };
    constructor(props) {
        super(props);
        this.chartRef = null;
        this.setupChartMouseZoom();
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.currentTask === 'SensorThingsTool' && prevProps.currentTask !== 'SensorThingsTool') {
            this.activated();
        } else if (this.props.currentTask !== 'SensorThingsTool' && prevProps.currentTask === 'SensorThingsTool') {
            this.deactivated();
        } else if (this.props.currentTask === 'SensorThingsTool' && this.state.pickGeom && this.state.pickGeom !== prevState.pickGeom) {
            this.queryAtPoint(this.state.pickGeom.coordinates);
        }

        if (this.state.highlightedLocation && this.state.highlightedLocation !== prevState.highlightedLocation) {
            // highlight Location on hover in Location select popup
            const layer = {
                id: "sensorThingsHighlight",
                role: LayerRole.SELECTION
            };
            const feature = {
                type: 'Feature',
                geometry: this.state.highlightedLocation.geom,
                crs: 'EPSG:4326',
                styleName: 'default',
                styleOptions: {
                    fillColor: [0, 0, 0, 0],
                    strokeColor: [7, 138, 163, 0.75],
                    strokeWidth: 4,
                    circleRadius: 10
                }
            };
            this.props.addLayerFeatures(layer, [feature], true);
        } else if (prevState.highlightedLocation && !this.state.highlightedLocation) {
            this.props.removeLayer("sensorThingsHighlight");
        }

        if (this.state.currentLocationId && this.state.currentLocationId !== prevState.currentLocationId) {
            this.loadLocationDatastreams(this.state.currentLocationId);
        }

        if (this.state.currentSensorLocation && this.state.currentSensorLocation !== prevState.currentSensorLocation) {
            // highlight current Location
            const layer = {
                id: "sensorThingsSelection",
                role: LayerRole.SELECTION
            };
            const feature = {
                type: 'Feature',
                geometry: this.state.currentSensorLocation.geom,
                crs: 'EPSG:4326',
                styleName: 'default',
                styleOptions: {
                    fillColor: [0, 0, 0, 0],
                    strokeColor: [242, 151, 84, 0.75],
                    strokeWidth: 4,
                    circleRadius: 10
                }
            };
            this.props.addLayerFeatures(layer, [feature], true);
        } else if (prevState.currentSensorLocation && !this.state.currentSensorLocation) {
            this.props.removeLayer("sensorThingsSelection");
        }

        if (this.state.currentDatastreamsFilter !== prevState.currentDatastreamsFilter) {
            this.filterLocationDatastreams();
        }

        this.state.datastreamOptions.forEach((datastreamOptions, idx) => {
            if (datastreamOptions.showArithmeticMean !== prevState.datastreamOptions[idx]?.showArithmeticMean) {
                this.calculateStatisticsArithmeticMean(idx);
            }
            if (!isEqual(datastreamOptions.percentiles, prevState.datastreamOptions[idx]?.percentiles)) {
                this.calculateStatisticsPercentiles(idx);
            }
        });

        const graphPeriodChanged = (this.state.graph.x.min !== prevState.graph.x.min || this.state.graph.x.max !== prevState.graph.x.max);
        this.state.graph.datastreams.forEach((datastream, idx) => {
            if (datastream.id && !datastream.loading && (datastream.observations === null || graphPeriodChanged)) {
                this.loadDatastreamObservations(idx, datastream.id);
            }
            if (!datastream.loading && prevState.graph.datastreams[idx]?.loading) {
                // update statistics after observations have been loaded
                this.calculateStatisticsArithmeticMean(idx);
                this.calculateStatisticsPercentiles(idx);
            }
        });
        if (this.state.graph.x.min !== prevState.graph.x.min) {
            const periodBegin = this.state.graph.x.min;
            if (this.state.timeSliderValue !== periodBegin) {
                this.setState({timeSliderValue: periodBegin});
            }
        }
        if (graphPeriodChanged) {
            const interval = this.state.graph.x.max - this.state.graph.x.min;
            if (this.state.selectedInterval !== interval) {
                this.setState({selectedInterval: interval});
            }
        }
    }
    render() {
        if (!this.state.showWindow) {
            return null;
        }

        return [
            (
                <ResizeableWindow icon="sensor_things"
                    initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width}
                    initialX={0} initialY={0} key="SensorThingsInfoWindow"
                    onClose={() => this.props.setCurrentTask(null)}
                    title={LocaleUtils.tr("sensorthingstool.title")}
                >
                    {this.renderBody()}
                </ResizeableWindow>
            ),
            this.renderLocationSelectPopup(),
            this.renderLocationInfoWindow(),
            this.renderDatastreamsFilterWindow(),
            this.renderDatastreamTableWindow(),
            (
                <MapSelection
                    active={this.state.locationPickingActive}
                    cursor="crosshair"
                    geomType="Point"
                    geometry={this.state.pickGeom}
                    geometryChanged={geom => this.setState({pickGeom: geom})}
                    hideGeometry
                    key="MapSelection"
                />
            )
        ];
    }
    renderBody = () => {
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            // NOTE: requires sorted data and as Unix timestamps
            parsing: false,
            plugins: {
                legend: {
                    position: 'top',
                    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove']
                },
                mouseZoomPlugin: {
                    events: ['mousemove', 'mouseout', 'mousedown', 'mouseup', 'touchmove', 'touchstart', 'touchend']
                },
                annotation: {
                    annotations: {
                    }
                }
            },
            events: ['mousemove', 'mouseout', 'mousedown', 'mouseup', 'click', 'touchmove', 'touchstart', 'touchend'],
            scales: {
                x: {
                    type: 'time',
                    min: this.state.graph.x.min,
                    max: this.state.graph.x.max,
                    position: this.state.graph.x.positionAtTop ? 'top' : 'bottom',
                    time: {
                        tooltipFormat: this.props.timeFormats.tooltip,
                        displayFormats: this.props.timeFormats
                    }
                },
                y: {
                    type: 'linear',
                    min: this.state.graph.y.min,
                    max: this.state.graph.y.max,
                    reverse: this.state.graph.y.reverse
                }
            }
        };
        const data = {
            datasets: []
        };

        const periodBegin = dayjs(this.state.graph.x.min);
        const periodEnd = dayjs(this.state.graph.x.max);

        const yUnits = new Set();
        const yRightUnits = new Set();
        let fullDatastreamsPeriodBegin = null;
        let fullDatastreamsPeriodEnd = null;
        this.state.graph.datastreams.forEach((datastream, idx) => {
            if (datastream.observations) {
                const datastreamInfo = this.state.datastreams[datastream.id];
                const location = this.state.selectedLocations[datastreamInfo.locationId];
                // add Observations dataset
                const dataset = {
                    label: `${location.name}: ${datastreamInfo.description}`,
                    data: datastream.observations,
                    borderColor: `rgb(${datastream.color.join(',')})`,
                    backgroundColor: `rgba(${datastream.color.join(',')},0.5)`,
                    // custom tooltipLabel without axis marker
                    tooltipLabel: `${location.name}: ${datastreamInfo.description}`,
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.tooltipLabel || '';
                                if (label) {
                                    label += ': ';
                                }
                                const value = context.formattedValue;
                                if (value !== null) {
                                    label += value;
                                    const unit = datastreamInfo.unitOfMeasurement.symbol;
                                    if (unit !== null) {
                                        // append Datastream unit to value
                                        label += ' ' + unit;
                                    }
                                }
                                return label;
                            }
                        }
                    },
                    yAxisID: 'y'
                };

                if (this.state.graph.y2.enabled) {
                    const datastreamOptions = this.state.datastreamOptions[idx];
                    // set target y-axis
                    dataset.yAxisID = datastreamOptions.showOnSecondYAxis ? 'yRight' : 'y';
                    // add axis marker to legend label
                    dataset.label = (datastreamOptions.showOnSecondYAxis ? "🞂 " : "🞀 " ) + dataset.label;

                    // collect units for y-axis titles
                    const unit = datastreamInfo.unitOfMeasurement.symbol;
                    if (datastreamOptions.showOnSecondYAxis) {
                        yRightUnits.add(unit);
                    } else {
                        yUnits.add(unit);
                    }
                } else {
                    // collect units for y-axis title
                    yUnits.add(datastreamInfo.unitOfMeasurement.symbol);
                }

                // collect combined period
                fullDatastreamsPeriodBegin = Math.min(datastreamInfo.period.begin, fullDatastreamsPeriodBegin || datastreamInfo.period.begin);
                fullDatastreamsPeriodEnd = Math.max(datastreamInfo.period.end, fullDatastreamsPeriodEnd || datastreamInfo.period.end);

                data.datasets.push(dataset);
            }
        });

        // show unit in y-axis titles, if unique
        let yUnit = null;
        let yRightUnit = null;
        if (yUnits.size === 1) {
            yUnit = [...yUnits][0];
        }
        if (yRightUnits.size === 1) {
            yRightUnit = [...yRightUnits][0];
        }

        if (this.state.graph.y2.enabled) {
            // add right y-axis
            options.scales.yRight = {
                type: 'linear',
                position: 'right',
                display: 'auto',
                min: this.state.graph.y2.min,
                max: this.state.graph.y2.max,
                reverse: this.state.graph.y2.reverse,
                grid: {
                    drawOnChartArea: this.state.graph.y2.showGrid
                },
                border: {
                    dash: [4, 4]
                }
            };

            // set y-axis titles
            if (yUnit !== null) {
                options.scales.y.title = {
                    text: yUnit,
                    display: true
                };
            }
            if (yRightUnit !== null) {
                options.scales.yRight.title = {
                    text: yRightUnit,
                    display: true
                };
            }
        } else {
            // set y-axis title
            if (yUnit !== null) {
                options.scales.y.title = {
                    text: yUnit,
                    display: true
                };
            }
        }

        // add threshold lines
        const annotationsOptions = options.plugins.annotation.annotations;
        this.state.graph.x.thresholds.forEach((threshold, idx) => {
            annotationsOptions['x' + idx] = this.optionsForThresholdLine('x', threshold.label, threshold.value, threshold.color);
        });
        this.state.graph.y.thresholds.forEach((threshold, idx) => {
            annotationsOptions['y' + idx] = this.optionsForThresholdLine('y', threshold.label, threshold.value, threshold.color);
        });
        if (this.state.graph.y2.enabled) {
            this.state.graph.y2.thresholds.forEach((threshold, idx) => {
                annotationsOptions['yRight' + idx] = this.optionsForThresholdLine('yRight', threshold.label, threshold.value, threshold.color);
            });
        }
        // thresholds for statistics values
        this.state.graph.datastreams.forEach((datastream, idx) => {
            let axis = 'y';
            if (this.state.graph.y2.enabled) {
                if (this.state.datastreamOptions[idx].showOnSecondYAxis) {
                    axis = 'yRight';
                }
            }
            // NOTE: use color of graph dataset
            const color = datastream.color;
            if (datastream.statistics.arithmeticMean !== null) {
                const label = LocaleUtils.tr("sensorthingstool.statistics.arithmeticMean") + ": " + parseFloat(datastream.statistics.arithmeticMean.toFixed(3));
                annotationsOptions['yArithmeticMean' + idx] = this.optionsForThresholdLine(axis, label, datastream.statistics.arithmeticMean, color);
            }
            datastream.statistics.percentiles.forEach((percentile) => {
                const label = percentile.percentile + LocaleUtils.tr("sensorthingstool.statistics.nthPercentile") + ": " + parseFloat(percentile.value.toFixed(3));
                annotationsOptions['yPercentile' + percentile.percentile + "_" + idx] = this.optionsForThresholdLine(axis, label, percentile.value, color);
            });
        });
        // custom thresholds
        if (this.state.customThresholds.x.value !== null) {
            annotationsOptions.x = this.optionsForThresholdLine('x', this.state.customThresholds.x.label, this.state.customThresholds.x.value, [0, 0, 0]);
        }
        if (this.state.customThresholds.y.value !== null) {
            annotationsOptions.yCustom = this.optionsForThresholdLine('y', this.state.customThresholds.y.label, this.state.customThresholds.y.value, [0, 0, 0]);
        }
        if (this.state.graph.y2.enabled && this.state.customThresholds.y2.value !== null) {
            annotationsOptions.yRightCustom = this.optionsForThresholdLine('yRight', this.state.customThresholds.y2.label, this.state.customThresholds.y2.value, [89, 89, 89]);
        }

        const intervalOptions = [
            {label: LocaleUtils.tr("sensorthingstool.intervalOptions.custom"), interval: -1}, // custom
            {label: LocaleUtils.tr("sensorthingstool.intervalOptions.hour"), interval: 3600000}, // 3600 * 1000 ms
            {label: LocaleUtils.tr("sensorthingstool.intervalOptions.day"), interval: 86400000}, // 24 * 3600 * 1000 ms
            {label: LocaleUtils.tr("sensorthingstool.intervalOptions.week"), interval: 604800000}, // 7 * 24 * 3600 * 1000 ms
            {label: LocaleUtils.tr("sensorthingstool.intervalOptions.month"), interval: 2678400000}, // 31 * 24 * 3600 * 1000 ms
            {label: LocaleUtils.tr("sensorthingstool.intervalOptions.year"), interval: 31536000000} // 365 * 24 * 3600 * 1000 ms
        ];

        let updateFullPeriodLabel;
        if (fullDatastreamsPeriodBegin !== null) {
            updateFullPeriodLabel = LocaleUtils.tr("sensorthingstool.showFullPeriod") +
                `\n${dayjs(fullDatastreamsPeriodBegin).format(this.props.timeFormats.tooltip)} - ${dayjs(fullDatastreamsPeriodEnd).format(this.props.timeFormats.tooltip)}`;
        } else {
            // no datastreams selected
            updateFullPeriodLabel = LocaleUtils.tr("sensorthingstool.showDefaultPeriod");
        }

        // Location and Datastreams UI
        let locationSelect = null;
        let btnLocationInfo = null;
        let btnRemoveLocation = null;
        let datastreamSelect = null;
        let datastreams = null;
        if (isEmpty(this.state.selectedLocations)) {
            locationSelect = (
                <div>{LocaleUtils.tr("sensorthingstool.pickLocationDesc")}</div>
            );
        } else {
            locationSelect = (
                <div>
                    {LocaleUtils.tr("sensorthingstool.locationLabel")}:&nbsp;
                    <select onChange={(ev) => this.setState({currentLocationId: parseInt(ev.target.value, 10)})} value={this.state.currentLocationId}>
                        {this.state.selectedLocationsOptions.map((location, idx) => (
                            <option key={"sensor-things-select-location-" + idx} value={location.id}>{location.name}: {location.description}</option>
                        ))}
                    </select>
                </div>
            );
            btnLocationInfo = (
                <button className={"button" + (this.state.showLocationInfoWindow ? " pressed" : "")} onClick={() => this.toggleLocationInfoWindow()} title={LocaleUtils.tr("sensorthingstool.locationInfo.title")}>
                    <Icon icon="info" />
                </button>
            );
            btnRemoveLocation = (
                <button className="button" onClick={this.removeSelectedLocation} title={LocaleUtils.tr("sensorthingstool.removeLocation")}>
                    <Icon icon="trash" />
                </button>
            );

            if (this.state.currentSensorLocation !== null) {
                const datastreamsFilterActive = this.state.currentDatastreamsFilter.thingId !== -1 || this.state.currentDatastreamsFilter.sensorId !== -1 || this.state.currentDatastreamsFilter.observedPropertyId !== -1;
                if (this.state.currentSensorLocation.filteredDatastreams.length > 0) {
                    datastreamSelect = (
                        <div className="sensor-things-location-datastreams">
                            {LocaleUtils.tr("sensorthingstool.datastreamLabel")}:&nbsp;
                            <select onChange={(ev) => this.setState({currentDatastreamId: parseInt(ev.target.value, 10)})} value={this.state.currentDatastreamId}>
                                {this.state.currentSensorLocation.filteredDatastreams.map((datastreamId) => {
                                    const datastream = this.state.datastreams[datastreamId];
                                    return (
                                        <option key={"sensor-things-select-datastream-" + datastream.id} value={datastream.id}>{datastream.description}</option>
                                    );
                                })}
                            </select>
                            <button className="button" onClick={this.addDatastream} title={LocaleUtils.tr("sensorthingstool.addDatastream")}>
                                <Icon icon="plus" />
                            </button>
                            <button className={"button" + (this.state.showDatastreamsFilterWindow ? " pressed" : "") + (datastreamsFilterActive ? " filter-active" : "")} onClick={() => this.toggleDatastreamsFilterWindow()} title={LocaleUtils.tr("sensorthingstool.datastreamsFilter.title")}>
                                <Icon icon="filter" />
                            </button>
                        </div>
                    );
                } else {
                    datastreamSelect = (
                        <div className="sensor-things-location-datastreams">
                            {LocaleUtils.tr("sensorthingstool.datastreamLabel")}:&nbsp;
                            <select>
                                <option>{LocaleUtils.tr("sensorthingstool.datastreamNone")}</option>
                            </select>
                            <button className={"button" + (this.state.showDatastreamsFilterWindow ? " pressed" : "") + (datastreamsFilterActive ? " filter-active" : "")} onClick={() => this.toggleDatastreamsFilterWindow()} title={LocaleUtils.tr("sensorthingstool.datastreamsFilter.title")}>
                                <Icon icon="filter" />
                            </button>
                        </div>
                    );
                }
            }

            datastreams = (
                <table>
                    <tbody>
                        {this.state.graph.datastreams.map((graphDatastreamState, datastreamIndex) => {
                            const datastream = this.state.datastreams[graphDatastreamState.id];
                            const location = this.state.selectedLocations[datastream.locationId];
                            return (
                                <tr className="sensor-things-datastream" key={"sensor-things-datastream-" + datastreamIndex}>
                                    <td>{location.name}</td>
                                    <td><div className="sensor-things-datastream-legend" style={{backgroundColor: `rgba(${graphDatastreamState.color.join(',')},0.5)`, borderColor: `rgb(${graphDatastreamState.color.join(',')})`}} /></td>
                                    <td>{datastream.description}&nbsp;</td>
                                    <td>
                                        <button className={"button" + (this.state.datastreamOptionsPopup === datastreamIndex ? " pressed" : "")} onClick={() => this.toggleDatastreamOptionsPopup(datastreamIndex)} title={LocaleUtils.tr("sensorthingstool.datastreamOptions.title")}>
                                            <Icon icon="info" />
                                        </button>
                                        <button className={"button" + (this.state.datastreamTableWindow === datastreamIndex ? " pressed" : "")} onClick={() => this.toggleDatastreamTableWindow(datastreamIndex)} title={LocaleUtils.tr("sensorthingstool.datastreamTable.title")}>
                                            <Icon icon="list-alt" />
                                        </button>
                                        <button className="button" onClick={() => this.removeDatastream(datastreamIndex)} title={LocaleUtils.tr("sensorthingstool.removeDatastream")}>
                                            <Icon icon="trash" />
                                        </button>
                                        {this.renderDatastreamOptions(datastreamIndex)}
                                        {this.state.graph.datastreams[datastreamIndex].loading ? (<Spinner />) : null}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            );
        }

        return (
            <div className="sensor-things-dialog-body" role="body">
                <div className="sensor-things-location">
                    <div className="sensor-things-header">
                        <div className="sensor-things-locations">
                            {locationSelect}
                            <div className="sensor-things-toolbar">
                                {btnLocationInfo}
                                {btnRemoveLocation}

                                <div className="sensor-things-toolbar-spacer-small" />

                                <button className={"button" + (this.state.locationPickingActive ? " pressed" : "")} onClick={this.toggleLocationPicking} title={LocaleUtils.tr("sensorthingstool.pickLocation")}>
                                    <Icon icon="pick" />
                                </button>
                            </div>
                        </div>

                        <div className="sensor-things-toolbar">
                            <button className="button" onClick={this.exportCSV} title={LocaleUtils.tr("sensorthingstool.exportCSV")}>
                                <Icon icon="export" />
                            </button>
                            <button className="button" onClick={this.exportImage} title={LocaleUtils.tr("sensorthingstool.exportImage")}>
                                <Icon icon="rasterexport" />
                            </button>

                            <div className="sensor-things-toolbar-spacer-small" />

                            <div>
                                <button className={"button" + (this.state.graphOptionsPopup ? " pressed" : "")} onClick={() => this.setState((state) => ({graphOptionsPopup: !state.graphOptionsPopup, datastreamOptionsPopup: null}))} title={LocaleUtils.tr("sensorthingstool.graphOptions.title")}>
                                    <Icon icon="cog" />
                                </button>
                                {this.renderGraphOptions()}
                            </div>
                        </div>
                    </div>

                    {datastreamSelect}
                    {datastreams}
                </div>
                <div className="sensor-things-graph">
                    <Line data={data} options={options} ref={el => { this.chartRef = el; }} />
                </div>
                <div className="sensor-things-graph-controls">
                    {this.renderTimeSlider(fullDatastreamsPeriodBegin, fullDatastreamsPeriodEnd)}

                    <div className="sensor-things-toolbar">
                        <Input onChange={this.updatePeriodBeginDate} type="date" value={periodBegin.format('YYYY-MM-DD')} />
                        <Input onChange={this.updatePeriodBeginTime} type="time" value={periodBegin.format('HH:mm')} />

                        <div className="sensor-things-toolbar-spacer" />

                        <button className="button" onClick={this.updatePeriodIntervalAfterBegin} title={LocaleUtils.tr("sensorthingstool.setPeriodAfterBegin")}>
                            <Icon icon="after" />
                        </button>
                        <select onChange={(ev) => this.setState({selectedInterval: parseInt(ev.target.value, 10)})} title={LocaleUtils.tr("sensorthingstool.selectInterval")} value={this.state.selectedInterval}>
                            {intervalOptions.map((interval, idx) => {
                                return (
                                    <option key={"sensor-things-select-interval-" + idx} value={interval.interval}>{interval.label}</option>
                                );
                            })}
                        </select>
                        <button className="button" onClick={this.updatePeriodIntervalBeforeEnd} title={LocaleUtils.tr("sensorthingstool.setPeriodBeforeEnd")}>
                            <Icon icon="before" />
                        </button>

                        <div className="sensor-things-toolbar-spacer-small" />

                        <button className="button" onClick={this.updatePeriodPrevInterval} title={LocaleUtils.tr("sensorthingstool.showPrevPeriod")}>
                            <Icon icon="nav-left" />
                        </button>
                        <button className="button" onClick={this.updatePeriodNextInterval} title={LocaleUtils.tr("sensorthingstool.showNextPeriod")}>
                            <Icon icon="nav-right" />
                        </button>
                        <button className="button" onClick={this.updatePeriodNow} title={LocaleUtils.tr("sensorthingstool.setEndToNow")}>
                            <Icon icon="today" />
                        </button>

                        <div className="sensor-things-toolbar-spacer-small" />

                        <button className="button" onClick={this.zoomIn} title={LocaleUtils.tr("sensorthingstool.zoomIn")}>
                            <Icon icon="zoomin" />
                        </button>
                        <button className="button" onClick={this.zoomOut} title={LocaleUtils.tr("sensorthingstool.zoomOut")}>
                            <Icon icon="zoomout" />
                        </button>
                        <button className="button" onClick={this.updateFullPeriod} title={updateFullPeriodLabel}>
                            <Icon icon="home" />
                        </button>

                        <div className="sensor-things-toolbar-spacer" />

                        <Input onChange={this.updatePeriodEndDate} type="date" value={periodEnd.format('YYYY-MM-DD')} />
                        <Input onChange={this.updatePeriodEndTime} type="time" value={periodEnd.format('HH:mm')} />
                    </div>
                </div>
            </div>
        );
    };
    renderLocationSelectPopup = () => {
        if (this.state.pickGeom && this.state.locationsAtPoint.length > 0) {
            // show popup with list of Locations at picking pos, cf. MapInfoTooltip
            const pixel = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK)(this.state.pickGeom.coordinates);
            const style = {
                left: pixel[0] + 16 + "px",
                top: pixel[1] + "px"
            };
            return (
                <div className="sensor-things-location-select" key="SensorThingsLocationSelectPopup" style={style}>
                    <b>{LocaleUtils.tr("sensorthingstool.selectLocation")}:</b><br/>
                    {this.state.locationsAtPoint.map((location, idx) => (
                        <div key={"select-location-" + idx}
                            onClickCapture={() => this.addLocation(location)}
                            onMouseOut={() => this.setState({highlightedLocation: null})}
                            onMouseOver={() => this.setState({highlightedLocation: location})} >
                            {location.name}: {location.description}
                        </div>
                    ))}
                </div>
            );
        } else {
            return null;
        }
    };
    toggleLocationPicking = () => {
        this.setState((state) => ({locationPickingActive: !state.locationPickingActive, pickGeom: null}));
    };
    addLocation = (location) => {
        if (this.state.selectedLocations[location.id] === undefined) {
            // add new Location
            this.setState((state) => {
                // update Locations list sorted by name and description
                const nextSelectedLocationsOptions = [
                    ...state.selectedLocationsOptions,
                    {
                        id: location.id,
                        name: location.name,
                        description: location.description
                    }
                ].sort((a, b) => a.name.localeCompare(b.name) || a.description.localeCompare(b.description));

                return {
                    selectedLocations: {
                        ...state.selectedLocations,
                        [location.id]: location
                    },
                    selectedLocationsOptions: nextSelectedLocationsOptions,
                    // select new Location
                    currentLocationId: location.id
                };
            });
        } else {
            // select previously added Location
            this.setState({currentLocationId: location.id});
        }
    };
    removeSelectedLocation = () => {
        if (this.state.currentSensorLocation === null) {
            // skip if currentSensorLocation not yet ready
            return;
        }

        this.setState((state) => {
            // remove currently selected Location
            const nextSelectedLocations = {...state.selectedLocations};
            delete nextSelectedLocations[state.currentLocationId];
            const nextSelectedLocationsOptions = state.selectedLocationsOptions.filter((location) => location.id !== state.currentLocationId);
            // select first Location
            const nextSelectedLocationId = nextSelectedLocationsOptions[0]?.id;
            // remove Datastreams of removed Location
            const nextDatastreams = {...state.datastreams};
            state.currentSensorLocation.datastreams.forEach((datastreamID) => { delete nextDatastreams[datastreamID]; });

            return {
                selectedLocations: nextSelectedLocations,
                selectedLocationsOptions: nextSelectedLocationsOptions,
                currentLocationId: nextSelectedLocationId,
                currentSensorLocation: null,
                currentDatastreamsFilter: {
                    thingId: -1,
                    sensorId: -1,
                    observedPropertyId: -1
                },
                currentDatastreamId: null,
                datastreams: nextDatastreams,
                graph: {
                    ...state.graph,
                    datastreams: state.graph.datastreams.filter((datastream) => !state.currentSensorLocation.datastreams.includes(datastream.id))
                },
                datastreamOptions: state.datastreamOptions.filter((options) => !state.currentSensorLocation.datastreams.includes(options.datastreamId))
            };
        });
    };
    updateDatastreamsFilter = (field, value) => {
        this.setState((state) => ({
            currentDatastreamsFilter: {
                ...state.currentDatastreamsFilter,
                [field]: parseInt(value, 10)
            }
        }));
    };
    addDatastream = () => {
        if (this.state.currentDatastreamId !== undefined) {
            this.setState((state) => {
                // find next unused color
                const availableColors = new Set(state.graphColors.map((color, idx) => idx));
                const usedColors = new Set(state.graph.datastreams.map((datastream) => datastream.colorIdx));
                const unusedColors = [...availableColors.difference(usedColors)].sort((a, b) => a - b);
                const colorIdx = unusedColors[0];
                let color;
                if (colorIdx !== undefined) {
                    // use predefined color
                    color = state.graphColors[colorIdx];
                } else {
                    // use random color
                    color = [
                        Math.round(Math.random() * 255),
                        Math.round(Math.random() * 255),
                        Math.round(Math.random() * 255)
                    ];
                }

                return {
                    graph: {
                        ...state.graph,
                        datastreams: [
                            ...state.graph.datastreams,
                            {
                                id: state.currentDatastreamId,
                                observations: null,
                                loading: false,
                                colorIdx: colorIdx,
                                color: color,
                                statistics: {
                                    arithmeticMean: null,
                                    percentiles: []
                                }
                            }
                        ]
                    },
                    datastreamOptions: [
                        ...state.datastreamOptions,
                        {
                            datastreamId: state.currentDatastreamId,
                            showOnSecondYAxis: false,
                            showArithmeticMean: false,
                            percentilesInput: "",
                            percentiles: []
                        }
                    ]
                };
            });
        }
    };
    removeDatastream = (datastreamIndex) => {
        this.setState((state) => {
            let datastreamOptionsPopup = state.datastreamOptionsPopup;
            if (datastreamOptionsPopup !== null) {
                if (datastreamOptionsPopup === datastreamIndex) {
                    datastreamOptionsPopup = null;
                } else if (datastreamOptionsPopup > datastreamIndex) {
                    // adjust selected datastream index after removal
                    datastreamOptionsPopup = datastreamOptionsPopup - 1;
                }
            }

            let datastreamTableWindow = state.datastreamTableWindow;
            if (datastreamTableWindow !== null) {
                if (datastreamTableWindow === datastreamIndex) {
                    datastreamTableWindow = null;
                } else if (datastreamTableWindow > datastreamIndex) {
                    // adjust selected datastream index after removal
                    datastreamTableWindow = datastreamTableWindow - 1;
                }
            }

            return {
                graph: {
                    ...state.graph,
                    datastreams: state.graph.datastreams.filter((datastream, idx) => idx !== datastreamIndex)
                },
                datastreamOptionsPopup: datastreamOptionsPopup,
                datastreamOptions: state.datastreamOptions.filter((options, idx) => idx !== datastreamIndex),
                datastreamTableWindow: datastreamTableWindow
            };
        });
    };
    // NOTE: color as [<r>, <g>, <b>] (0-255)
    optionsForThresholdLine = (axisID, label, thresholdValue, color) => {
        const annotationOptions = {
            type: 'line',
            scaleID: axisID,
            value: thresholdValue,
            borderColor: `rgba(${color.join(',')},0.8)`,
            borderWidth: 2,
            drawTime: 'beforeDatasetsDraw'
        };
        if (label) {
            // add threshold label
            annotationOptions.label = {
                content: label,
                backgroundColor: 'transparent',
                color: '#666666',
                display: true,
                padding: 2,
                font: {
                    weight: 'normal'
                },
                drawTime: 'afterDatasetsDraw'
            };

            if (axisID === 'x') {
                // vertical threshold label for x-axis
                annotationOptions.label = {
                    ...annotationOptions.label,
                    position: 'end',
                    rotation: -90,
                    xAdjust: (context, opts) => {
                        // get pixel distance to left and right borders of graph area
                        const pixelPos = context.chart.scales.x.getPixelForValue(opts.value);
                        const diffLeft = pixelPos - context.chart.chartArea.left;
                        const diffRight = context.chart.chartArea.right - pixelPos;

                        if (diffLeft < 0 || diffRight < 0) {
                            // threshold value is outside visible area
                            return 0;
                        }

                        // adjust offset to position the label to the side of the threshold line
                        // place left of line
                        let offset = -7;
                        if (diffLeft < 9) {
                            // adjust offset to place right of line
                            offset = 3 + diffLeft * 0.5;
                        } else if (diffLeft < 16) {
                            // place right of line
                            offset = 11;
                        } else if (diffRight < 11) {
                            // adjust offset to place left of line
                            offset = -diffRight * 0.5;
                        }
                        return offset;
                    }
                };
            } else {
                // horizontal threshold label for y-axis
                annotationOptions.label = {
                    ...annotationOptions.label,
                    position: (axisID === 'yRight') ? 'end' : 'start',
                    yAdjust: (context, opts) => {
                        // get pixel distance to top and bottom borders of graph area
                        const pixelPos = context.chart.scales[opts.scaleID].getPixelForValue(opts.value);
                        const diffTop = pixelPos - context.chart.chartArea.top;
                        const diffBottom = context.chart.chartArea.bottom - pixelPos;

                        if (diffTop < 0 || diffBottom < 0) {
                            // threshold value is outside visible area
                            return 0;
                        }

                        // adjust offset to position the label above or below the threshold line
                        // place above line
                        let offset = -7;
                        if (diffTop < 9) {
                            // adjust offset to place below line
                            offset = 3 + diffTop * 0.5;
                        } else if (diffTop < 16) {
                            // place below line
                            offset = 11;
                        } else if (diffBottom < 11) {
                            // adjust offset to place above line
                            offset = -diffBottom * 0.5;
                        }
                        return offset;
                    }
                };
            }
        }
        return annotationOptions;
    };
    renderTimeSlider = (fullDatastreamsPeriodBegin, fullDatastreamsPeriodEnd) => {
        // disable time slider for now
        return null;

        /*
        if (fullDatastreamsPeriodBegin === null || fullDatastreamsPeriodEnd === null) {
            return null;
        }

        const timeSliderBegin = fullDatastreamsPeriodBegin;
        const timeSliderEnd = fullDatastreamsPeriodEnd;
        // set step size to 24h
        const timeSliderStep = 86400000; // 24 * 3600 * 1000

        return (
            <div className="sensor-things-timeslider">
                <input max={timeSliderEnd} min={timeSliderBegin} onChange={(ev) => this.setState({timeSliderValue: parseInt(ev.target.value, 10)})} onKeyUp={this.updatePeriodFromTimeSlider} onMouseUp={this.updatePeriodFromTimeSlider} onTouchEnd={this.updatePeriodFromTimeSlider} step={timeSliderStep} type="range" value={this.state.timeSliderValue} />
                <span className="sensor-things-timeslider-tooltip">
                    {dayjs(this.state.timeSliderValue).format(this.props.timeFormats.tooltip)}
                </span>
            </div>
        );
        */
    };
    renderGraphOptions = () => {
        if (!this.state.graphOptionsPopup) {
            return null;
        }

        // convert any custom threshold value for x-axis
        let thresholdValueXDate = null;
        let thresholdValueXTime = null;
        if (this.state.customThresholds.x.value !== null) {
            const thresholdValueX = dayjs(this.state.customThresholds.x.value);
            thresholdValueXDate = thresholdValueX.format('YYYY-MM-DD');
            thresholdValueXTime = thresholdValueX.format('HH:mm');
        }

        return (
            <div className="sensor-things-options">
                <div className="sensor-things-options-group">
                    <div className="sensor-things-options-title">{LocaleUtils.tr("sensorthingstool.graphOptions.xAxis")}</div>
                    <div className="sensor-things-options-content">
                        <table>
                            <tbody>
                                <tr>
                                    <td />
                                    <td>
                                        <label><input checked={this.state.graph.x.positionAtTop} onChange={(ev) => this.updateGraphAxis('x', {positionAtTop: ev.target.checked})} type="checkbox" /> {LocaleUtils.tr("sensorthingstool.graphOptions.xAxisAtTop")}</label>
                                    </td>
                                </tr>
                                <tr>
                                    <td>{LocaleUtils.tr("sensorthingstool.graphOptions.threshold")}:</td>
                                    <td>
                                        <Input onChange={this.updateCustomThresholdXDate} type="date" value={thresholdValueXDate} />
                                        <Input onChange={this.updateCustomThresholdXTime} type="time" value={thresholdValueXTime} />
                                        <button className={"button reset-button"} onClick={() => this.updateCustomThreshold('x', {value: null})}>
                                            <Icon icon="clear" />
                                        </button>
                                    </td>
                                </tr>
                                <tr>
                                    <td />
                                    <td>
                                        <input onChange={(ev) => this.updateCustomThreshold('x', {label: ev.target.value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.thresholdLabel")} type="text" value={this.state.customThresholds.x.label} />
                                        <button className={"button reset-button"} onClick={() => this.updateCustomThreshold('x', {label: ""})} >
                                            <Icon icon="clear" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="sensor-things-options-group">
                    <div className="sensor-things-options-title">{LocaleUtils.tr("sensorthingstool.graphOptions.yAxis")}</div>
                    <div className="sensor-things-options-content">
                        <table>
                            <tbody>
                                <tr>
                                    <td />
                                    {this.state.graph.y2.enabled ? (<td />) : null}
                                    <td>
                                        <label><input checked={this.state.graph.y2.enabled} onChange={(ev) => this.updateGraphAxis('y2', {enabled: ev.target.checked})} type="checkbox"  /> {LocaleUtils.tr("sensorthingstool.graphOptions.toggleSecondYAxis")}</label>
                                    </td>
                                </tr>
                                <tr>
                                    <td>{LocaleUtils.tr("sensorthingstool.graphOptions.yMax")}:</td>
                                    <td>
                                        <div className="sensor-things-number-field">
                                            <NumberInput decimals={3} hideArrows onChange={value => this.updateGraphAxis('y', {max: value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.yAuto")} value={this.state.graph.y.max} />
                                            <button className={"button reset-button"} onClick={() => this.updateGraphAxis('y', {max: null})}>
                                                <Icon icon="clear" />
                                            </button>
                                        </div>
                                    </td>
                                    {this.state.graph.y2.enabled ? (
                                        <td>
                                            <div className="sensor-things-number-field">
                                                <NumberInput decimals={3} hideArrows onChange={value => this.updateGraphAxis('y2', {max: value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.yAuto")} value={this.state.graph.y2.max} />
                                                <button className={"button reset-button"} onClick={() => this.updateGraphAxis('y2', {max: null})}>
                                                    <Icon icon="clear" />
                                                </button>
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                                <tr>
                                    <td>{LocaleUtils.tr("sensorthingstool.graphOptions.yMin")}:</td>
                                    <td>
                                        <div className="sensor-things-number-field">
                                            <NumberInput decimals={3} hideArrows onChange={value => this.updateGraphAxis('y', {min: value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.yAuto")} value={this.state.graph.y.min} />
                                            <button className={"button reset-button"} onClick={() => this.updateGraphAxis('y', {min: null})}>
                                                <Icon icon="clear" />
                                            </button>
                                        </div>
                                    </td>
                                    {this.state.graph.y2.enabled ? (
                                        <td>
                                            <div className="sensor-things-number-field">
                                                <NumberInput decimals={3} hideArrows onChange={value => this.updateGraphAxis('y2', {min: value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.yAuto")} value={this.state.graph.y2.min} />
                                                <button className={"button reset-button"} onClick={() => this.updateGraphAxis('y2', {min: null})}>
                                                    <Icon icon="clear" />
                                                </button>
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                                <tr>
                                    <td />
                                    <td>
                                        <label><input checked={this.state.graph.y.reverse} onChange={(ev) => this.updateGraphAxis('y', {reverse: ev.target.checked})} type="checkbox" /> {LocaleUtils.tr("sensorthingstool.graphOptions.reverseAxis")}</label>
                                    </td>
                                    {this.state.graph.y2.enabled ? (
                                        <td>
                                            <label><input checked={this.state.graph.y2.reverse} onChange={(ev) => this.updateGraphAxis('y2', {reverse: ev.target.checked})} type="checkbox" /> {LocaleUtils.tr("sensorthingstool.graphOptions.reverseAxis")}</label>
                                        </td>
                                    ) : null}
                                </tr>
                                {this.state.graph.y2.enabled ? (
                                    <tr>
                                        <td />
                                        <td />
                                        <td>
                                            <label><input checked={this.state.graph.y2.showGrid} onChange={(ev) => this.updateGraphAxis('y2', {showGrid: ev.target.checked})} type="checkbox" /> {LocaleUtils.tr("sensorthingstool.graphOptions.toggleGridLines")}</label>
                                        </td>
                                    </tr>
                                ) : null}

                                <tr>
                                    <td>{LocaleUtils.tr("sensorthingstool.graphOptions.threshold")}:</td>
                                    <td>
                                        <div className="sensor-things-number-field">
                                            <NumberInput decimals={3} hideArrows onChange={value => this.updateCustomThreshold('y', {value: value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.thresholdValue")} value={this.state.customThresholds.y.value} />
                                            <button className={"button reset-button"} onClick={() => this.updateCustomThreshold('y', {value: null})}>
                                                <Icon icon="clear" />
                                            </button>
                                        </div>
                                    </td>
                                    {this.state.graph.y2.enabled ? (
                                        <td>
                                            <div className="sensor-things-number-field">
                                                <NumberInput decimals={3} hideArrows onChange={value => this.updateCustomThreshold('y2', {value: value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.thresholdValue")} value={this.state.customThresholds.y2.value} />
                                                <button className={"button reset-button"} onClick={() => this.updateCustomThreshold('y2', {value: null})}>
                                                    <Icon icon="clear" />
                                                </button>
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                                <tr>
                                    <td />
                                    <td>
                                        <input onChange={(ev) => this.updateCustomThreshold('y', {label: ev.target.value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.thresholdLabel")} type="text" value={this.state.customThresholds.y.label} />
                                        <button className={"button reset-button"} onClick={() => this.updateCustomThreshold('y', {label: ""})} >
                                            <Icon icon="clear" />
                                        </button>
                                    </td>
                                    {this.state.graph.y2.enabled ? (
                                        <td>
                                            <input onChange={(ev) => this.updateCustomThreshold('y2', {label: ev.target.value})} placeholder={LocaleUtils.tr("sensorthingstool.graphOptions.thresholdLabel")} type="text" value={this.state.customThresholds.y2.label} />
                                            <button className={"button reset-button"} onClick={() => this.updateCustomThreshold('y2', {label: ""})} >
                                                <Icon icon="clear" />
                                            </button>
                                        </td>
                                    ) : null}
                                </tr>

                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };
    toggleLocationInfoWindow = () => {
        this.setState((state) => ({showLocationInfoWindow: !state.showLocationInfoWindow}));
    };
    renderLocationInfoWindow = () => {
        if (!this.state.showLocationInfoWindow) {
            return null;
        }

        const location = this.state.currentSensorLocation;
        let locationInfoRows = [];
        if (location !== null) {
            locationInfoRows = [
                // [<label>, <value>]
                [LocaleUtils.tr("sensorthingstool.locationInfo.name"), location.name],
                [LocaleUtils.tr("sensorthingstool.locationInfo.description"), location.description]
            ];
            // TODO: configurable custom properties
            location.filterOptions.things.forEach((thing) => {
                const thingProperties = thing.properties || {};
                if (thingProperties.platform !== undefined) {
                    locationInfoRows.push([LocaleUtils.tr("sensorthingstool.locationInfo.platform"), thingProperties.platform]);
                }
                if (thingProperties.sensor_serial_nr !== undefined) {
                    locationInfoRows.push([LocaleUtils.tr("sensorthingstool.locationInfo.serialNumber"), thingProperties.sensor_serial_nr]);
                }
                if (thingProperties.platform !== undefined) {
                    // NOTE: only if platform present
                    locationInfoRows.push([LocaleUtils.tr("sensorthingstool.locationInfo.qompSensorId"), thing.id]);
                }
                if (thingProperties.inactive !== undefined) {
                    locationInfoRows.push([LocaleUtils.tr("sensorthingstool.locationInfo.inactive"), thingProperties.inactive]);
                }
            });
        }

        return (
            <ResizeableWindow icon="info"
                initialHeight={168} initialWidth={500}
                initialX={this.props.windowSize.width + 10} initialY={0} key="SensorThingsLocationInfoWindow"
                onClose={() => this.setState({showLocationInfoWindow: false})}
                title={LocaleUtils.tr("sensorthingstool.locationInfo.title")}
            >
                <div className="sensor-things-dialog-body" role="body">
                    <table className="sensor-things-location-info">
                        <tbody>
                            {locationInfoRows.map((info, infoIndex) => {
                                return (
                                    <tr key={"sensor-things-location-info-" + infoIndex}>
                                        <td>{info[0]}:</td>
                                        <td>{info[1]}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </ResizeableWindow>
        );
    };
    toggleDatastreamsFilterWindow = () => {
        this.setState((state) => ({showDatastreamsFilterWindow: !state.showDatastreamsFilterWindow}));
    };
    renderDatastreamsFilterWindow = () => {
        if (!this.state.showDatastreamsFilterWindow || this.state.currentSensorLocation === null) {
            return null;
        }

        return (
            <ResizeableWindow fitHeight="true" icon="filter"
                initialWidth={500}
                initialX={this.props.windowSize.width + 10} initialY={0} key="SensorThingsDatastreamsFilterWindow"
                onClose={() => this.setState({showDatastreamsFilterWindow: false})}
                title={LocaleUtils.tr("sensorthingstool.datastreamsFilter.title")}
            >
                <div className="sensor-things-dialog-body" role="body">
                    <table className="sensor-things-datastreams-filter">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("sensorthingstool.datastreamsFilter.thing")}:&nbsp;</td>
                                <td>
                                    <select onChange={(ev) => this.updateDatastreamsFilter('thingId', ev.target.value)} value={this.state.currentDatastreamsFilter.thingId}>
                                        <option value="-1">{LocaleUtils.tr("common.select")}</option>
                                        {this.state.currentSensorLocation.filterOptions.things.map((thing) => (
                                            <option key={"sensor-things-select-filter-thing-" + thing.id} value={thing.id}>{thing.optionText}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sensorthingstool.datastreamsFilter.sensor")}:&nbsp;</td>
                                <td>
                                    <select onChange={(ev) => this.updateDatastreamsFilter('sensorId', ev.target.value)} value={this.state.currentDatastreamsFilter.sensorId}>
                                        <option value="-1">{LocaleUtils.tr("common.select")}</option>
                                        {this.state.currentSensorLocation.filterOptions.sensors.map((sensor) => (
                                            <option key={"sensor-things-select-filter-sensor-" + sensor.id} value={sensor.id}>{sensor.optionText}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sensorthingstool.datastreamsFilter.observedProperty")}:&nbsp;</td>
                                <td>
                                    <select onChange={(ev) => this.updateDatastreamsFilter('observedPropertyId', ev.target.value)} value={this.state.currentDatastreamsFilter.observedPropertyId}>
                                        <option value="-1">{LocaleUtils.tr("common.select")}</option>
                                        {this.state.currentSensorLocation.filterOptions.observedProperties.map((observedProperty) => (
                                            <option key={"sensor-things-select-filter-observed-property-" + observedProperty.id} value={observedProperty.id}>{observedProperty.optionText}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </ResizeableWindow>
        );
    };
    toggleDatastreamOptionsPopup = (datastreamIndex) => {
        let datastreamOptionsPopup = null;
        if (this.state.datastreamOptionsPopup !== datastreamIndex) {
            // show datastream options popup
            datastreamOptionsPopup = datastreamIndex;
        } else {
            // close datastream options popup
            datastreamOptionsPopup = null;
        }
        this.setState({datastreamOptionsPopup: datastreamOptionsPopup, graphOptionsPopup: false});
    };
    formatCalibrationPart = (value, xTerm) => {
        if (value !== 0.0) {
            // omit factor if value is 1 or -1
            const factor = Math.abs(value) === 1.0 ? '' : `${Math.abs(value)} `;
            // set operator to + or -
            const sign = value > 0.0 ? '+' : '-';
            return ` ${sign} ${factor}${xTerm}`;
        } else {
            return "";
        }
    };
    renderDatastreamOptions = (datastreamIndex) => {
        if (this.state.datastreamOptionsPopup !== datastreamIndex) {
            return null;
        }

        const datastream = this.state.graph.datastreams[datastreamIndex];
        const datastreamInfo = this.state.datastreams[datastream.id];
        const datastreamInfoRows = [
            // [<label>, <value>]
            [LocaleUtils.tr("sensorthingstool.datastreamInfo.name"), datastreamInfo.name],
            [LocaleUtils.tr("sensorthingstool.datastreamInfo.description"), datastreamInfo.description],
            [LocaleUtils.tr("sensorthingstool.datastreamInfo.unit"), datastreamInfo.unitOfMeasurement.symbol]
        ];
        const datastreamProperties = datastreamInfo.properties || {};
        // TODO: configurable custom properties
        if (datastreamProperties.calibration !== undefined && datastreamProperties.calibration instanceof Array) {
            const [a, b, c, d] = datastreamProperties.calibration;

            // format calibration text as "a + b x + c x² + d x³" while omitting 0 terms
            let calibrationText = "";
            if (a !== 0.0) {
                calibrationText += a;
            }
            calibrationText += this.formatCalibrationPart(b, 'x');
            calibrationText += this.formatCalibrationPart(c, 'x²');
            calibrationText += this.formatCalibrationPart(d, 'x³');
            // remove any " + " prefix if a == 0
            calibrationText = calibrationText.replace(/^ \+ /, '');

            datastreamInfoRows.push([LocaleUtils.tr("sensorthingstool.datastreamInfo.calibration"), calibrationText]);
        }

        const datastreamOptions = this.state.datastreamOptions[datastreamIndex];
        const datastreamStats = this.state.graph.datastreams[datastreamIndex].statistics;
        return (
            <div className="sensor-things-options sensor-things-datastream-options">
                <div className="sensor-things-options-group">
                    <div className="sensor-things-options-content">
                        <label><input checked={datastreamOptions.showOnSecondYAxis} onChange={(ev) => this.updateDatastreamOptions(datastreamIndex, {showOnSecondYAxis: ev.target.checked})} type="checkbox" /> {LocaleUtils.tr("sensorthingstool.datastreamOptions.showOnSecondYAxis")}</label>
                    </div>
                </div>
                <div className="sensor-things-options-group">
                    <div className="sensor-things-options-title">{LocaleUtils.tr("sensorthingstool.datastreamInfo.title")}</div>
                    <div className="sensor-things-options-content">
                        <table>
                            <tbody>
                                {datastreamInfoRows.map((info, infoIndex) => {
                                    return (
                                        <tr key={"sensor-things-datastream-info-" + infoIndex}>
                                            <td>{info[0]}:</td>
                                            <td>{info[1]}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="sensor-things-options-group">
                    <div className="sensor-things-options-title">{LocaleUtils.tr("sensorthingstool.datastreamOptions.title")}</div>
                    <div className="sensor-things-options-content">
                        <table>
                            <tbody>
                                <tr>
                                    <td />
                                    <td>
                                        <label><input checked={datastreamOptions.showArithmeticMean} onChange={(ev) => this.updateDatastreamOptions(datastreamIndex, {showArithmeticMean: ev.target.checked})} type="checkbox" /> {LocaleUtils.tr("sensorthingstool.datastreamOptions.arithmeticMean")}</label>
                                    </td>
                                </tr>
                                <tr>
                                    <td>{LocaleUtils.tr("sensorthingstool.datastreamOptions.percentiles")}:</td>
                                    <td>
                                        <input onChange={(ev) => this.updateDatastreamOptions(datastreamIndex, {percentilesInput: ev.target.value})} placeholder={LocaleUtils.tr("sensorthingstool.datastreamOptions.percentiles")} title={LocaleUtils.tr("sensorthingstool.datastreamOptions.percentilesDesc")} type="text" value={datastreamOptions.percentilesInput} />
                                        <button className="button reset-button" onClick={() => this.updateDatastreamOptions(datastreamIndex, {percentiles: "refresh"})} title={LocaleUtils.tr("sensorthingstool.datastreamOptions.showPercentiles")}>
                                            <Icon icon="plus" />
                                        </button>
                                        <button className="button reset-button" onClick={() => this.updateDatastreamOptions(datastreamIndex, {percentilesInput: "", percentiles: []})} >
                                            <Icon icon="clear" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <table className="sensor-things-datastream-statistics-table">
                            <tbody>
                                {datastreamStats.arithmeticMean !== null ? (
                                    <tr>
                                        <td>{LocaleUtils.tr("sensorthingstool.statistics.arithmeticMean")}:</td>
                                        <td className="sensor-things-datastream-statistics-value">{parseFloat(datastreamStats.arithmeticMean.toFixed(3))}</td>
                                    </tr>
                                ) : null}
                                {datastreamStats.percentiles.map((percentile, idx) => (
                                    <tr key={"sensor-things-datastream-statistics-percentile-" + idx}>
                                        <td>{percentile.percentile}{LocaleUtils.tr("sensorthingstool.statistics.nthPercentile")}:</td>
                                        <td className="sensor-things-datastream-statistics-value">{parseFloat(percentile.value.toFixed(3))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };
    updateDatastream = (datastreamIndex, datastreamId) => {
        if (datastreamId !== this.state.graph.datastreams[datastreamIndex].id) {
            this.setState((state) => ({
                graph: {
                    ...state.graph,
                    datastreams: state.graph.datastreams.map((datastream, idx) => {
                        if (idx === datastreamIndex) {
                            return {
                                ...datastream,
                                id: datastreamId,
                                // clear observations
                                observations: null,
                                loading: false,
                                // clear statistics
                                statistics: {
                                    arithmeticMean: null,
                                    percentiles: []
                                }
                            };
                        }
                        return datastream;
                    })
                }
            }));
        }
    };
    toggleDatastreamTableWindow = (datastreamIndex) => {
        let datastreamTableWindow = null;
        if (this.state.datastreamTableWindow !== datastreamIndex) {
            // show datastream table window
            datastreamTableWindow = datastreamIndex;
        } else {
            // close datastream table window
            datastreamTableWindow = null;
        }
        this.setState({datastreamTableWindow: datastreamTableWindow});
    };
    renderDatastreamTableWindow = () => {
        if (this.state.datastreamTableWindow === null) {
            return null;
        }

        const datastream = this.state.graph.datastreams[this.state.datastreamTableWindow];
        const datastreamInfo = this.state.datastreams[datastream.id];
        const location = this.state.selectedLocations[datastreamInfo.locationId];

        // format periods
        const fullPeriodBegin = dayjs(datastreamInfo.period.begin).format(this.props.timeFormats.tooltip);
        const fullPeriodEnd = dayjs(datastreamInfo.period.end).format(this.props.timeFormats.tooltip);
        const periodBegin = dayjs(this.state.graph.x.min).format(this.props.timeFormats.tooltip);
        const periodEnd = dayjs(this.state.graph.x.max).format(this.props.timeFormats.tooltip);

        const unit = datastreamInfo.unitOfMeasurement.symbol;

        return (
            <ResizeableWindow icon="sensor_things"
                initialHeight={600} initialWidth={500}
                initialX={this.props.windowSize.width + 10} initialY={0} key="SensorThingsDatastreamTableWindow"
                onClose={() => this.setState({datastreamTableWindow: null})}
                title={LocaleUtils.tr("sensorthingstool.datastreamTable.title")}
            >
                <div className="sensor-things-dialog-body" role="body">
                    <table>
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("sensorthingstool.locationLabel")}:</td>
                                <td>{location.name}</td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sensorthingstool.datastreamLabel")}:</td>
                                <td>{datastreamInfo.description}</td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sensorthingstool.datastreamTable.fullPeriod")}:</td>
                                <td>{fullPeriodBegin} - {fullPeriodEnd}</td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sensorthingstool.datastreamTable.selectedPeriod")}:</td>
                                <td>{periodBegin} - {periodEnd}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="sensor-things-datastream-observations-table-wrapper">
                        <table className="sensor-things-datastream-observations-table">
                            <thead>
                                <tr>
                                    <th>{LocaleUtils.tr("sensorthingstool.datastreamTable.timestamp")}</th>
                                    <th>{LocaleUtils.tr("sensorthingstool.datastreamTable.value")}</th>
                                    <th>{LocaleUtils.tr("sensorthingstool.datastreamTable.unit")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(datastream.observations || []).map((observation, observationIndex) => {
                                    return (
                                        <tr key={"sensor-things-table-observation-" + observationIndex}>
                                            <td>{dayjs(observation.x).format(this.props.timeFormats.tooltip)}</td>
                                            <td>{observation.y}</td>
                                            <td>{unit}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="sensor-things-toolbar">
                        <div className="sensor-things-toolbar-spacer" />
                        <button className="button" onClick={this.exportSingleCSV} title={LocaleUtils.tr("sensorthingstool.exportCSV")}>
                            <Icon icon="export" />
                        </button>
                    </div>
                </div>
            </ResizeableWindow>
        );
    };
    activated = () => {
        this.setState({showWindow: true, pickGeom: null});
        this.initPeriod();
    };
    deactivated = () => {
        this.setState({showWindow: false, pickGeom: null});
    };
    initPeriod = () => {
        if (this.state.graph.x.min === null) {
            // set initial default period to the last 24h
            const now = Date.now();
            this.updateGraphAxis('x', {
                min: now - 24 * 3600 * 1000,
                max: now
            });
        }
    };
    queryAtPoint = (point) => {
        this.setState({locationsAtPoint: []});

        // calculate BBox for tolerance in pixels, in local SRS
        const resolution = MapUtils.computeForZoom(this.props.map.resolutions, this.props.map.zoom);
        const dx = this.props.queryTolerance * resolution;
        const dy = dx;
        const bbox = [point[0] - dx, point[1] - dy, point[0] + dx, point[1] + dy];
        // transform BBox to WGS84 coords
        const wgs84Bbox = CoordinatesUtils.reprojectBbox(bbox, this.props.map.projection, 'EPSG:4326');
        // build WKT string for BBox (limit coord precision to ~3cm)
        const minX = wgs84Bbox[0].toFixed(6);
        const minY = wgs84Bbox[1].toFixed(6);
        const maxX = wgs84Bbox[2].toFixed(6);
        const maxY = wgs84Bbox[3].toFixed(6);
        const wgs84Wkt = `POLYGON((${minX} ${minY},${maxX} ${minY},${maxX} ${maxY},${minX} ${maxY},${minX} ${minY}))`;

        // track results by server
        let queriesPending = this.props.sensorThingsApiUrls.length;
        const locationsByServer = this.props.sensorThingsApiUrls.map((sensorThingsApi) => ({
            url: sensorThingsApi.url,
            locationsAtPoint: []
        }));

        // query all SensorThings APIs
        this.props.sensorThingsApiUrls.forEach((sensorThingsApi, idx) => {
            // update SensorThings API URL for current theme
            const sensorThingsApiUrl = sensorThingsApi.url.replace('$theme$', this.props.theme.name);

            // build BBox filter
            let filter = "st_intersects(location, geography'" + wgs84Wkt + "')";
            if (sensorThingsApi.locationsFilter !== undefined) {
                // combine BBox filter with provided Locations filter
                filter = `${filter} and (${sensorThingsApi.locationsFilter})`;
            }

            // query SensorThings API for Locations within BBox
            const url = sensorThingsApiUrl.replace(/\/$/, '') + '/Locations';
            const params = {
                $filter: filter,
                $orderBy: "name,description"
            };

            axios.get(url, {params}).then(response => {
                queriesPending -= 1;

                // collect Locations
                response.data.value.forEach((location) => {
                    locationsByServer[idx].locationsAtPoint.push({
                        id: location['@iot.id'],
                        name: location.name,
                        description: location.description,
                        link: location['@iot.selfLink'],
                        geom: location.location
                    });
                });

                if (queriesPending === 0) {
                    // all queries completed, show combined locations
                    const locations = locationsByServer.map((result) => result.locationsAtPoint).flat();
                    this.setState({locationsAtPoint: locations});
                }
            }).catch(e => {
                // eslint-disable-next-line
                console.warn(`SensorThings API locations query failed for ${url}: ${e.message}`);
                queriesPending -= 1;
            });
        });
    };
    loadLocationDatastreams = (locationId) => {
        // get Datastreams of selected Location
        const selectedLocation = this.state.selectedLocations[locationId];
        const params = {
            $expand: "Things($expand=Datastreams($expand=Sensor($select=@iot.id,name,description),ObservedProperty($select=@iot.id,name,description)))"
        };
        axios.get(selectedLocation.link, {params}).then(response => {
            if (locationId !== this.state.currentLocationId) {
                // skip results, as a different Location has been selected in the meantime while this request was still loading
                return;
            }

            const location = response.data;

            // collect flat list of Datastreams of all Things of this Location
            const datastreamIds = [];
            const datastreamsLookup = {};
            const thingsLookup = {};
            const sensorsLookup = {};
            const observedPropertiesLookup = {};

            // format text shown in dropdown option
            const optionTextForItem = (item) => {
                let text = "";
                if (item.description === undefined) {
                    // show only name if there is no description present
                    text = item.name;
                } else if (item.name === item.description) {
                    // show only name if name and description are identical
                    text = item.name;
                } else {
                    // show name and description
                    text = `${item.name}: ${item.description}`;
                }
                return text;
            };

            location.Things.forEach((thing) => {
                thing.Datastreams.forEach((datastream) => {
                    const datastreamId = datastream['@iot.id'];
                    datastreamIds.push(datastreamId);

                    // parse period from phenomenonTime as Unix timestamps
                    // e.g. "2023-09-19T07:01:00Z/2023-09-19T15:21:00Z"
                    //      -> 1695106860000, 1695136860000
                    let periodBegin = null;
                    let periodEnd = null;
                    if (datastream.phenomenonTime) {
                        const parts = datastream.phenomenonTime.split('/');
                        periodBegin = Date.parse(parts[0]);
                        periodEnd = Date.parse(parts[1]);
                    }

                    const sensor = datastream.Sensor;
                    const observedProperty = datastream.ObservedProperty;

                    datastreamsLookup[datastreamId] = {
                        locationId: location['@iot.id'],
                        thingId: thing['@iot.id'],
                        sensorId: sensor['@iot.id'],
                        observedPropertyId: observedProperty['@iot.id'],
                        id: datastreamId,
                        name: datastream.name,
                        description: datastream.description,
                        unitOfMeasurement: datastream.unitOfMeasurement,
                        phenomenonTime: datastream.phenomenonTime,
                        period: {
                            begin: periodBegin,
                            end: periodEnd
                        },
                        properties: datastream.properties,
                        link: datastream['@iot.selfLink']
                    };

                    thingsLookup[thing['@iot.id']] = {
                        id: thing['@iot.id'],
                        name: thing.name,
                        description: thing.description,
                        optionText: optionTextForItem(thing),
                        properties: thing.properties
                    };

                    sensorsLookup[sensor['@iot.id']] = {
                        id: sensor['@iot.id'],
                        name: sensor.name,
                        description: sensor.description,
                        // NOTE: show only name if description is identical
                        optionText: optionTextForItem(sensor)
                    };

                    observedPropertiesLookup[observedProperty['@iot.id']] = {
                        id: observedProperty['@iot.id'],
                        name: observedProperty.name,
                        description: observedProperty.description,
                        // NOTE: show only name if description is identical
                        optionText: optionTextForItem(observedProperty)
                    };
                });
            });

            // collect filter options sorted by name and description
            const thingsFilterOptions = Object.values(thingsLookup).sort((a, b) => a.name.localeCompare(b.name) || a.description.localeCompare(b.description));
            const sensorsFilterOptions = Object.values(sensorsLookup).sort((a, b) => a.name.localeCompare(b.name) || a.description.localeCompare(b.description));
            const observedPropertiesFilterOptions = Object.values(observedPropertiesLookup).sort((a, b) => a.name.localeCompare(b.name) || a.description.localeCompare(b.description));

            this.setState((state) => ({
                currentSensorLocation: {
                    id: location['@iot.id'],
                    name: location.name,
                    description: location.description,
                    geom: location.location,
                    datastreams: datastreamIds,
                    filterOptions: {
                        things: thingsFilterOptions,
                        sensors: sensorsFilterOptions,
                        observedProperties: observedPropertiesFilterOptions
                    },
                    filteredDatastreams: datastreamIds
                },
                currentDatastreamsFilter: {
                    thingId: -1,
                    sensorId: -1,
                    observedPropertyId: -1
                },
                currentDatastreamId: datastreamIds[0],
                datastreams: {
                    ...state.datastreams,
                    ...datastreamsLookup
                }
            }));
        }).catch(e => {
            // eslint-disable-next-line
            console.warn("SensorThings API location query failed:", e.message);
        });
    };
    filterLocationDatastreams = () => {
        if (this.state.currentSensorLocation !== null) {
            let filteredDatastreams = this.state.currentSensorLocation.datastreams;

            if (this.state.currentDatastreamsFilter.thingId !== -1) {
                // filter by Thing
                filteredDatastreams = filteredDatastreams.filter((datastreamId) => (
                    this.state.datastreams[datastreamId].thingId === this.state.currentDatastreamsFilter.thingId
                ));
            }
            if (this.state.currentDatastreamsFilter.sensorId !== -1) {
                // filter by Sensor
                filteredDatastreams = filteredDatastreams.filter((datastreamId) => (
                    this.state.datastreams[datastreamId].sensorId === this.state.currentDatastreamsFilter.sensorId
                ));
            }
            if (this.state.currentDatastreamsFilter.observedPropertyId !== -1) {
                // filter by ObservedProperty
                filteredDatastreams = filteredDatastreams.filter((datastreamId) => (
                    this.state.datastreams[datastreamId].observedPropertyId === this.state.currentDatastreamsFilter.observedPropertyId
                ));
            }

            this.setState((state) => ({
                currentSensorLocation: {
                    ...state.currentSensorLocation,
                    filteredDatastreams: filteredDatastreams
                },
                currentDatastreamId: filteredDatastreams[0]
            }));
        }
    };
    loadDatastreamObservations = (datastreamIndex, datastreamId) => {
        // mark as loading
        this.setState((state) => ({
            graph: {
                ...state.graph,
                datastreams: state.graph.datastreams.map((datastream, idx) => {
                    if (idx === datastreamIndex) {
                        return {
                            ...datastream,
                            loading: true
                        };
                    }
                    return datastream;
                })
            }
        }));

        const limit = 10000;

        // get Observations within selected graph period
        const datastream = this.state.datastreams[datastreamId];
        const filterPeriodStart = dayjs(this.state.graph.x.min).toISOString();
        const filterPeriodEnd = dayjs(this.state.graph.x.max).toISOString();
        const filter = `phenomenonTime ge ${filterPeriodStart} and phenomenonTime le ${filterPeriodEnd}`;

        this.loadObservations(datastreamIndex, datastreamId, datastream.link.replace(/\/$/, '') + '/Observations', limit, 0, filter, []);
    };
    // load obervations with pagination
    loadObservations = (datastreamIndex, datastreamId, observationsUrl, limit, skip, filter, observations) => {
        const params = {
            $select: "phenomenonTime,result",
            $orderby: "phenomenonTime asc",
            $top: limit,
            $skip: skip
        };
        if (filter) {
            params.$filter = filter;
        }
        axios.get(observationsUrl, {params}).then(response => {
            if (datastreamId !== this.state.graph.datastreams[datastreamIndex].id) {
                // skip results, as a different Datastream has been selected in the meantime while this request was still loading
                return;
            }

            // add current batch to observations
            observations = observations.concat(response.data.value);

            if (response.data['@iot.nextLink']) {
                // load next batch
                this.loadObservations(datastreamIndex, datastreamId, observationsUrl, limit, skip + response.data.value.length, filter, observations);
            } else {
                // update datastream observations and reset loading
                this.setState((state) => ({
                    graph: {
                        ...state.graph,
                        datastreams: state.graph.datastreams.map((datastream, idx) => {
                            if (idx === datastreamIndex) {
                                return {
                                    ...datastream,
                                    // convert to dataset data for Chart.js
                                    observations: observations.map((observation) => ({
                                        // NOTE: phenomenonTime may be a time instant or period
                                        //       e.g. "2023-11-01T09:00:00Z"
                                        //       e.g. "2023-11-01T09:00:00Z/2023-11-01T10:00:00Z"
                                        // NOTE: convert to Unix timestamps for better performance
                                        x: Date.parse(observation.phenomenonTime.split('/')[0]),
                                        y: observation.result
                                    })),
                                    loading: false
                                };
                            }
                            return datastream;
                        })
                    }
                }));
            }
        }).catch(e => {
            // eslint-disable-next-line
            console.warn("SensorThings API observations query failed:", e.message);
        });
    };
    // clear all datastream observations
    clearObservations = () => {
        this.state.graph.datastreams.forEach((datastream, idx) => {
            this.updateDatastream(idx, "");
        });
    };
    updatePeriodBeginDate = (dateString) => {
        if (dateString) {
            this.updateGraphAxis('x', {min: this.timestampAtDate(this.state.graph.x.min, dateString)});
        }
    };
    updatePeriodBeginTime = (timeString) => {
        if (timeString) {
            this.updateGraphAxis('x', {min: this.timestampAtTime(this.state.graph.x.min, timeString)});
        }
    };
    updatePeriodEndDate = (dateString) => {
        if (dateString) {
            this.updateGraphAxis('x', {max: this.timestampAtDate(this.state.graph.x.max, dateString)});
        }
    };
    updatePeriodEndTime = (timeString) => {
        if (timeString) {
            this.updateGraphAxis('x', {max: this.timestampAtTime(this.state.graph.x.max, timeString)});
        }
    };
    updatePeriodFromTimeSlider = (timestamp) => {
        // move current interval to begin at new timestamp from time slider
        const interval = this.state.graph.x.max - this.state.graph.x.min;
        this.updateGraphAxis('x', {min: this.state.timeSliderValue, max: this.state.timeSliderValue + interval});
    };
    updatePeriodIntervalAfterBegin = () => {
        if (this.state.selectedInterval !== -1) {
            // update period end for selected interval after current period start
            this.updateGraphAxis('x', {max: this.state.graph.x.min + this.state.selectedInterval});
        }
    };
    updatePeriodIntervalBeforeEnd = () => {
        if (this.state.selectedInterval !== -1) {
            // update period begin for selected interval before current period end
            this.updateGraphAxis('x', {min: this.state.graph.x.max - this.state.selectedInterval});
        }
    };
    updatePeriodPrevInterval = () => {
        const interval = this.state.graph.x.max - this.state.graph.x.min;
        this.updateGraphAxis('x', {min: this.state.graph.x.min - interval, max: this.state.graph.x.max - interval});
    };
    updatePeriodNextInterval = () => {
        const interval = this.state.graph.x.max - this.state.graph.x.min;
        this.updateGraphAxis('x', {min: this.state.graph.x.min + interval, max: this.state.graph.x.max + interval});
    };
    updatePeriodNow = () => {
        const interval = this.state.graph.x.max - this.state.graph.x.min;
        const now = Date.now();
        this.updateGraphAxis('x', {min: now - interval, max: now});
    };
    updateFullPeriod = () => {
        let fullDatastreamsPeriodBegin = null;
        let fullDatastreamsPeriodEnd = null;
        this.state.graph.datastreams.forEach((datastream) => {
            if (datastream.observations) {
                // collect combined period
                const datastreamInfo = this.state.datastreams[datastream.id];
                fullDatastreamsPeriodBegin = Math.min(datastreamInfo.period.begin, fullDatastreamsPeriodBegin || datastreamInfo.period.begin);
                fullDatastreamsPeriodEnd = Math.max(datastreamInfo.period.end, fullDatastreamsPeriodEnd || datastreamInfo.period.end);
            }
        });

        let periodBegin;
        let periodEnd;
        if (fullDatastreamsPeriodBegin !== null) {
            // show combined full period of all datastreams
            periodBegin = fullDatastreamsPeriodBegin;
            periodEnd = fullDatastreamsPeriodEnd;
        } else {
            // show default period without data (cf. initPeriod())
            const now = Date.now();
            periodBegin = now - 24 * 3600 * 1000;
            periodEnd = now;
        }
        this.setState((state) => ({
            graph: {
                ...state.graph,
                x: {
                    ...state.graph.x,
                    min: periodBegin,
                    max: periodEnd
                },
                // NOTE: reset range of y-axes to auto
                y: {
                    ...state.graph.y,
                    min: null,
                    max: null
                },
                y2: {
                    ...state.graph.y2,
                    min: null,
                    max: null
                }
            }
        }));
    };
    zoomIn = () => {
        // zoom in at middle of current interval
        const interval = this.state.graph.x.max - this.state.graph.x.min;
        const intervalDelta = interval * (1.0 - 1.0 / this.props.zoomFactor);
        const periodBegin = this.state.graph.x.min + intervalDelta / 2.0;
        const periodEnd = this.state.graph.x.max - intervalDelta / 2.0;
        this.updateGraphAxis('x', {min: periodBegin, max: periodEnd});
    };
    zoomOut = () => {
        // zoom out from middle of current interval
        const interval = this.state.graph.x.max - this.state.graph.x.min;
        const intervalDelta = interval * (this.props.zoomFactor - 1.0);
        const periodBegin = this.state.graph.x.min - intervalDelta / 2.0;
        const periodEnd = this.state.graph.x.max + intervalDelta / 2.0;
        this.setState((state) => ({
            graph: {
                ...state.graph,
                x: {
                    ...state.graph.x,
                    min: periodBegin,
                    max: periodEnd
                },
                // NOTE: reset range of y-axes to auto
                y: {
                    ...state.graph.y,
                    min: null,
                    max: null
                },
                y2: {
                    ...state.graph.y2,
                    min: null,
                    max: null
                }
            }
        }));
    };
    // return timestamp with new date part
    // dateString = "<YYYY-MM-DD>"
    timestampAtDate = (timestamp, dateString) => {
        const newDate = dayjs(dateString, "YYYY-MM-DD");
        return dayjs(timestamp).year(newDate.year()).month(newDate.month()).date(newDate.date()).valueOf();
    };
    // return timestamp with new time part
    // timeString = "<HH:mm>"
    timestampAtTime = (timestamp, timeString) => {
        const parts = timeString.split(":").map(value => parseInt(value, 10));
        return dayjs(timestamp).hour(parts[0]).minute(parts[1]).second(0).millisecond(0).valueOf();
    };
    updateGraphAxis = (axis, diff) => {
        this.setState((state) => ({
            graph: {
                ...state.graph,
                [axis]: {
                    ...state.graph[axis],
                    ...diff
                }
            }
        }));
    };
    updateCustomThresholdXDate = (dateString) => {
        if (dateString) {
            // NOTE: init with submitted date at 00:00 if threshold not set
            const timestamp = this.state.customThresholds.x.value === null ? dayjs(dateString, "YYYY-MM-DD") : this.state.customThresholds.x.value;
            this.updateCustomThreshold('x', {value: this.timestampAtDate(timestamp, dateString)});
        } else {
            // clear threshold
            this.updateCustomThreshold('x', {value: null});
        }
    };
    updateCustomThresholdXTime = (timeString) => {
        if (timeString) {
            // NOTE: init with today's date if threshold not set
            const timestamp = this.state.customThresholds.x.value === null ? Date.now() : this.state.customThresholds.x.value;
            this.updateCustomThreshold('x', {value: this.timestampAtTime(timestamp, timeString)});
        } else if (this.state.customThresholds.x.value !== null) {
            // reset time to 00:00, but keep date
            this.updateCustomThreshold('x', {value: this.timestampAtTime(this.state.customThresholds.x.value, "00:00")});
        } else {
            // clear threshold
            this.updateCustomThreshold('x', {value: null});
        }
    };
    updateCustomThreshold = (axis, diff) => {
        this.setState((state) => ({
            customThresholds: {
                ...state.customThresholds,
                [axis]: {
                    ...state.customThresholds[axis],
                    ...diff
                }
            }
        }));
    };
    updateDatastreamOptions = (datastreamIndex, diff) => {
        if (diff.percentiles === 'refresh') {
            // parse submitted percentilesInput string
            const percentiles = [];
            this.state.datastreamOptions[datastreamIndex].percentilesInput.split(",").forEach((percentile) => {
                const value = parseInt(percentile, 10);
                if (!isNaN(value) && value >= 0 && value <= 100) {
                    percentiles.push(value);
                }
            });
            diff.percentiles = percentiles;
            // update percentilesInput string
            diff.percentilesInput = percentiles.join(', ');
        }

        this.setState((state) => ({
            datastreamOptions: state.datastreamOptions.map((options, idx) => {
                if (idx === datastreamIndex) {
                    return {
                        ...options,
                        ...diff
                    };
                }
                return options;
            })
        }));
    };
    calculateStatisticsArithmeticMean = (datastreamIndex) => {
        let arithmeticMean = null;
        if (this.state.datastreamOptions[datastreamIndex].showArithmeticMean) {
            const observations = this.state.graph.datastreams[datastreamIndex].observations;
            if (observations !== null && observations.length > 0) {
                // calculate arithmetic mean
                let sum = 0;
                observations.forEach((observation) => {
                    sum += observation.y;
                });
                arithmeticMean = sum / observations.length;
            }
        }

        // update arithmetic mean of datastream
        this.setState((state) => ({
            graph: {
                ...state.graph,
                datastreams: state.graph.datastreams.map((datastream, idx) => {
                    if (idx === datastreamIndex) {
                        return {
                            ...datastream,
                            statistics: {
                                ...datastream.statistics,
                                arithmeticMean: arithmeticMean
                            }
                        };
                    }
                    return datastream;
                })
            }
        }));
    };
    calculateStatisticsPercentiles = (datastreamIndex) => {
        const percentiles = [];
        if (this.state.datastreamOptions[datastreamIndex].percentiles.length > 0) {
            const observations = this.state.graph.datastreams[datastreamIndex].observations;
            if (observations !== null && observations.length > 0) {
                // sort observation values
                const sortedValues = observations.map((observation) => observation.y).sort((a, b) => a - b);
                const n = sortedValues.length;

                this.state.datastreamOptions[datastreamIndex].percentiles.forEach((percentile) => {
                    // calculate percentile
                    // cf. https://de.wikipedia.org/wiki/Empirisches_Quantil
                    let value;
                    if (percentile === 0) {
                        value = sortedValues[0];
                    } else if (percentile === 100) {
                        value = sortedValues[n - 1];
                    } else {
                        const p = percentile / 100.0;
                        const np = n * p;
                        if (np === Math.floor(np)) {
                            value = 0.5 * (sortedValues[np - 1] + sortedValues[np]);
                        } else {
                            value = sortedValues[Math.floor(np)];
                        }
                    }

                    percentiles.push({
                        percentile: percentile,
                        value: value
                    });
                });
            }
        }

        // update percentiles of datastream
        this.setState((state) => ({
            graph: {
                ...state.graph,
                datastreams: state.graph.datastreams.map((datastream, idx) => {
                    if (idx === datastreamIndex) {
                        return {
                            ...datastream,
                            statistics: {
                                ...datastream.statistics,
                                percentiles: percentiles
                            }
                        };
                    }
                    return datastream;
                })
            }
        }));
    };
    exportCSV = () => {
        if (isEmpty(this.state.selectedLocations)) {
            return;
        }

        let csvLines = [];
        csvLines.push(["locationID", "locationName", "datastreamID", "datastreamName", "timestamp", "timestring", "value", "unit"]);
        this.state.graph.datastreams.forEach((datastream) => {
            if (datastream.observations) {
                const datastreamInfo = this.state.datastreams[datastream.id];
                const location = this.state.selectedLocations[datastreamInfo.locationId];

                // NOTE: wrap text values in double quotes for escaping
                csvLines = csvLines.concat(datastream.observations.map((observation) => [
                    location.id,
                    `"${location.name.replace('"', '""')}"`,
                    datastreamInfo.id,
                    `"${datastreamInfo.name.replace('"', '""')}"`,
                    // observation time as Unix timestamp in seconds
                    observation.x / 1000,
                    // observation time as ISO8601 string
                    dayjs(observation.x).format(),
                    observation.y,
                    `"${datastreamInfo.unitOfMeasurement.symbol.replace('"', '""')}"`
                ]));
            }
        });
        if (csvLines.length < 2) {
            // no observations present
            return;
        }

        const csv = csvLines.map((csvLine) => csvLine.join(";")).join("\n");
        FileSaver.saveAs(new Blob([csv], {type: "text/csv;charset=utf-8"}), "sensor_observations.csv");
    };
    exportSingleCSV = () => {
        if (this.state.datastreamTableWindow === null) {
            return;
        }

        const datastream = this.state.graph.datastreams[this.state.datastreamTableWindow];
        const datastreamInfo = this.state.datastreams[datastream.id];
        const location = this.state.selectedLocations[datastreamInfo.locationId];
        if (datastream.observations === null) {
            return;
        }

        let csvLines = [];
        csvLines.push(["locationID", "locationName", "datastreamID", "datastreamName", "timestamp", "timestring", "value", "unit"]);
        // NOTE: wrap text values in double quotes for escaping
        csvLines = csvLines.concat(datastream.observations.map((observation) => [
            location.id,
            `"${location.name.replace('"', '""')}"`,
            datastreamInfo.id,
            `"${datastreamInfo.name.replace('"', '""')}"`,
            // observation time as Unix timestamp in seconds
            observation.x / 1000,
            // observation time as ISO8601 string
            dayjs(observation.x).format(),
            observation.y,
            `"${datastreamInfo.unitOfMeasurement.symbol.replace('"', '""')}"`
        ]));
        if (csvLines.length < 2) {
            // no observations present
            return;
        }

        const csv = csvLines.map((csvLine) => csvLine.join(";")).join("\n");
        FileSaver.saveAs(new Blob([csv], {type: "text/csv;charset=utf-8"}), "sensor_observations.csv");
    };
    exportImage = () => {
        if (isEmpty(this.state.selectedLocations)) {
            return;
        }

        const imgBase64 = this.chartRef.toBase64Image('image/png');

        // parse base64 string, e.g. "data:image/png;base64,abcd1234..."
        const parts = imgBase64.split(',');
        const imgData = new Buffer(parts[1], "base64");
        const imgType = parts[0].split(':')[1].split(';')[0];

        FileSaver.saveAs(new Blob([imgData], {type: imgType}), "sensor_observations.png");
    };
    setupChartMouseZoom = () => {
        const mouseZoomPlugin = {
            id: 'mouseZoomPlugin',
            beforeEvent(chart, args) {
                const event = args.event;
                if (event.type === 'mousedown') {
                    // start drawing zoom rect
                    const canvasPosition = getRelativePosition(event, chart);
                    this.drawing = true;
                    this.drawStart = {
                        x: canvasPosition.x,
                        y: canvasPosition.y
                    };
                    this.drawEnd = null;
                } else if (event.type === 'mousemove') {
                    if (this.drawing) {
                        // update zoom rect while drawing
                        const canvasPosition = getRelativePosition(event, chart);
                        if (Math.abs(canvasPosition.x - this.drawStart.x) > this.component.props.zoomRectMinSize.width && Math.abs(canvasPosition.y - this.drawStart.y) > this.component.props.zoomRectMinSize.height) {
                            this.drawEnd = {
                                x: canvasPosition.x,
                                y: canvasPosition.y
                            };
                        } else {
                            // skip if zoom rect is too small
                            this.drawEnd = null;
                        }
                        chart.draw();
                    }
                } else if (event.type === 'mouseup') {
                    if (this.drawing) {
                        if (this.drawEnd === null) {
                            // skip if no zoom rect yet
                            this.drawing = false;
                            return;
                        }

                        // zoom to rect after finishing drawing

                        // calc axis ranges from rect
                        const periodBegin = chart.scales.x.getValueForPixel(Math.min(this.drawStart.x, this.drawEnd.x));
                        const periodEnd = chart.scales.x.getValueForPixel(Math.max(this.drawStart.x, this.drawEnd.x));
                        const minY = chart.scales.y.getValueForPixel(Math.max(this.drawStart.y, this.drawEnd.y));
                        const maxY = chart.scales.y.getValueForPixel(Math.min(this.drawStart.y, this.drawEnd.y));
                        let minY2 = null;
                        let maxY2 = null;
                        if (this.component.state.graph.y2.enabled) {
                            minY2 = chart.scales.yRight.getValueForPixel(Math.max(this.drawStart.y, this.drawEnd.y));
                            maxY2 = chart.scales.yRight.getValueForPixel(Math.min(this.drawStart.y, this.drawEnd.y));
                        }

                        // clear zoom rect
                        this.drawing = false;
                        this.drawStart = null;
                        this.drawEnd = null;
                        chart.draw();

                        // zoom to selected range
                        this.component.setState((state) => ({
                            graph: {
                                ...state.graph,
                                x: {
                                    ...state.graph.x,
                                    min: periodBegin,
                                    max: periodEnd
                                },
                                y: {
                                    ...state.graph.y,
                                    min: minY,
                                    max: maxY
                                },
                                y2: {
                                    ...state.graph.y2,
                                    min: minY2,
                                    max: maxY2
                                }
                            }
                        }));
                    }
                } else if (event.type === 'mouseout') {
                    // abort drawing rect

                    // clear zoom rect
                    this.drawing = false;
                    this.drawStart = null;
                    this.drawEnd = null;
                    chart.draw();
                }
            },
            afterDraw(chart) {
                if (!this.drawing || this.drawStart === null || this.drawEnd === null) {
                    return;
                }

                // draw zoom rect
                const {ctx} = chart;
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = '#595959';
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1;
                ctx.strokeRect(this.drawStart.x, this.drawStart.y, this.drawEnd.x - this.drawStart.x, this.drawEnd.y - this.drawStart.y);
                ctx.restore();
            },
            drawing: false,
            drawStart: null,
            drawEnd: null,
            component: this
        };
        ChartJS.register(mouseZoomPlugin);
    };
}

const selector = state => ({
    map: state.map,
    theme: state.theme.current,
    currentTask: state.task.id
});

export default connect(
    selector,
    {
        setCurrentTask: setCurrentTask,
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer
    }
)(SensorThingsTool);
