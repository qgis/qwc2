/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import MapUtils from 'qwc2/utils/MapUtils';
import ResourceRegistry from 'qwc2/utils/ResourceRegistry';

import {addLayer, addLayerFeatures, changeLayerProperty, removeLayer, LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import ResizeableWindow from '../components/ResizeableWindow';
import Spinner from '../components/Spinner';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';

import './style/Cyclomedia.css';


const Status = {LOGIN: 0, INITIALIZING: 1, INITIALIZED: 2, ERROR: 3, LOADPOS: 4, HAVEPOS: 5};

/**
 * Cyclomedia integration for QWC2.
 */
class Cyclomedia extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        /** The Cyclomedia API key */
        apikey: PropTypes.string,
        changeLayerProperty: PropTypes.func,
        click: PropTypes.object,
        /** OAuth client ID. */
        clientId: PropTypes.string,
        /** The cyclomedia version. */
        cyclomediaVersion: PropTypes.string,
        /** Whether to display Cyclomedia measurement geometries on the map. */
        displayMeasurements: PropTypes.bool,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        /** The relative path to the redirect login handling of oauth. */
        loginRedirectUri: PropTypes.string,
        /** The relative path to the redirect logout handling of oauth. */
        logoutRedirectUri: PropTypes.string,
        mapCrs: PropTypes.string,
        mapScale: PropTypes.number,
        /** The maximum map scale above which the recordings WFS won't be displayed. */
        maxMapScale: PropTypes.number,
        /** The projection to use for Cyclomedia. */
        projection: PropTypes.string,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
    };
    static defaultProps = {
        cyclomediaVersion: '23.6',
        displayMeasurements: true,
        geometry: {
            initialWidth: 480,
            initialHeight: 640,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        },
        maxMapScale: 10000,
        projection: 'EPSG:3857'
    };
    state = {
        status: Status.LOGIN,
        message: "",
        username: "",
        password: "",
        loginFailed: false
    };
    constructor(props) {
        super(props);
        this.iframe = null;
        this.iframePollIntervall = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (!prevProps.active && this.props.active) {
            this.setState({status: this.props.clientId ? Status.INITIALIZING : Status.LOGIN, loginFailed: false});
        } else if (
            (prevProps.active && !this.props.active) ||
            (prevProps.theme && !this.props.theme)
        ) {
            this.onClose();
        }
        // Load WFS when loading
        if (this.state.status === Status.INITIALIZING && prevState.status < Status.INITIALIZING) {
            this.addRecordingsWFS();
        }
        // Handle map click events
        if ((this.state.status === Status.INITIALIZED || this.state.status === Status.HAVEPOS) && this.iframe) {
            const clickPoint = this.queryPoint(prevProps);
            if (clickPoint) {
                const posStr = clickPoint[0] + "," + clickPoint[1];
                this.iframe.contentWindow.openImage(posStr, this.props.mapCrs);
                if (this.state.status !== Status.LOADPOS) {
                    this.setState({status: Status.LOADPOS});
                    this.props.removeLayer('cyclomedia-cone');
                    this.props.removeLayer('cyclomedia-measurements');
                    ResourceRegistry.removeResource("cyclomedia-cone");
                }
            }
        }
        if (this.props.active && this.props.mapScale !== prevProps.mapScale) {
            this.props.changeLayerProperty('cyclomedia-recordings', 'visibility', this.props.mapScale <= this.props.maxMapScale);
        }
        if (this.state.status === Status.LOGIN && prevState.status > Status.LOGIN) {
            this.props.removeLayer('cyclomedia-recordings');
            this.props.removeLayer('cyclomedia-cone');
            this.props.removeLayer('cyclomedia-measurements');
            ResourceRegistry.removeResource("cyclomedia-cone");
        }
    }
    onClose = () => {
        this.props.setCurrentTask(null);
        this.setState({status: Status.LOGIN, loginFailed: false});
        this.iframe = null;
    };
    render() {
        if (!this.props.active) {
            return null;
        }
        let overlay = null;
        if (this.state.status === Status.LOGIN) {
            overlay = (
                <div className="cyclomedia-body-overlay">
                    <div className="cyclomedia-login">
                        <table>
                            <tbody>
                                <tr>
                                    <td>Username:</td>
                                    <td><input onChange={ev => this.setState({username: ev.target.value})} type="text" value={this.state.username} /></td>
                                </tr>
                                <tr>
                                    <td>Password:</td>
                                    <td><input onChange={ev => this.setState({password: ev.target.value})} type="password" value={this.state.password} /></td>
                                </tr>
                                <tr>
                                    <td colSpan="2">
                                        <button className="button" disabled={!this.state.username} onClick={() => this.setState({status: Status.INITIALIZING})} type="button">{LocaleUtils.tr("cyclomedia.login")}</button>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="cyclomedia-login-message" colSpan="2">{this.state.message}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        } else if (this.state.status === Status.INITIALIZING) {
            overlay = (
                <div className="cyclomedia-body-overlay">
                    <Spinner /><span>{LocaleUtils.tr("cyclomedia.initializing")}</span>
                </div>
            );
        } else if (this.state.status === Status.ERROR) {
            overlay = (
                <div className="cyclomedia-body-overlay">
                    <span>{LocaleUtils.tr("cyclomedia.loaderror")}</span>
                </div>
            );
        } else if (this.state.status === Status.INITIALIZED) {
            overlay = (
                <div className="cyclomedia-body-overlay">
                    <span>{LocaleUtils.tr("cyclomedia.clickonmap")}</span>
                </div>
            );
        } else if (this.state.status === Status.LOADPOS) {
            overlay = (
                <div className="cyclomedia-body-overlay">
                    <Spinner /><span>{LocaleUtils.tr("cyclomedia.loading")}</span>
                </div>
            );
        }
        return (
            <ResizeableWindow dockable={this.props.geometry.side} icon="cyclomedia"
                initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={this.onClose} splitScreenWhenDocked title={LocaleUtils.trmsg("cyclomedia.title")}
            >
                <div className="cyclomedia-body" role="body">
                    {this.props.mapScale > this.props.maxMapScale && this.state.status > Status.LOGIN ? (
                        <div className="cyclomedia-scale-hint">
                            {LocaleUtils.tr("cyclomedia.scalehint", this.props.maxMapScale)}
                        </div>
                    ) : null}
                    {this.state.status > Status.LOGIN ? (
                        <iframe className="cyclomedia-frame" onLoad={ev => this.setupIframe(ev.target)} ref={el => this.setIframeRef(el)} />
                    ) : null}
                    {overlay}
                </div>
            </ResizeableWindow>
        );
    }
    setIframeRef = (iframe) => {
        if (iframe) {
            this.iframe = iframe;
            this.iframePollIntervall = setInterval(() => this.setupIframe(iframe), 500);
        }
    };
    setupIframe = (iframe) => {
        if (!iframe.getAttribute("content-set")) {
            if (iframe.contentWindow && iframe.contentWindow.document) {
                iframe.setAttribute("content-set", true);
                iframe.contentWindow.document.open();
                iframe.contentWindow.document.write(this.cyclomediaIndexHtml());
                iframe.contentWindow.document.close();
                this.iframe = iframe;
            }
        } else if (!iframe.getAttribute("callback-registered")) {
            if (iframe.contentWindow && iframe.contentWindow.registerCallbacks) {
                iframe.setAttribute("callback-registered", true);
                iframe.contentWindow.registerCallbacks(this.apiInitialized, this.panoramaPositionChanged, this.measurementChanged);
            }
        } else if (!iframe.getAttribute("init-called")) {
            if (iframe.contentWindow && iframe.contentWindow.StreetSmartApi) {
                iframe.setAttribute("init-called", true);
                iframe.contentWindow.initApi();
            }
        } else {
            clearInterval(this.iframePollIntervall);
        }
    };
    apiInitialized = (success, message = "") => {
        this.setState({status: success ? Status.INITIALIZED : Status.LOGIN, message: message, loginFailed: !success});
    };
    panoramaPositionChanged = (posData) => {
        if (this.state.status !== Status.HAVEPOS) {
            this.setState({status: Status.HAVEPOS});
        }
        const scale = 50;
        const angle = posData.hFov / 2.0;
        const width = Math.sin(angle);
        const length = Math.sqrt(1.0 - width * width);
        const size = scale / Math.sqrt(width * length);
        const coordinates = [
            [0, 0],
            [size * width * 2, 0],
            [size * width, size * length]
        ];
        const dimensions = [coordinates[1][0] + 0.5, coordinates[2][1] + 0.5];
        const canvas = document.createElement('canvas');
        canvas.width = dimensions[0];
        canvas.height = dimensions[1];
        const context = canvas.getContext('2d');
        context.fillStyle = 'rgba(255, 0, 0, 0.5)';
        context.strokeStyle = '#FF0000';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(coordinates[0][0], coordinates[0][1]);
        coordinates.slice(1).forEach(coo => context.lineTo(coo[0], coo[1]));
        context.closePath();
        context.fill();
        ResourceRegistry.addResource("cyclomedia-cone", context.canvas);
        const feature = {
            geometry: {
                type: 'Point',
                coordinates: posData.pos
            },
            crs: posData.crs,
            styleName: 'image',
            styleOptions: {
                img: "cyclomedia-cone",
                rotation: posData.yaw,
                size: dimensions
            }
        };
        const layer = {
            id: "cyclomedia-cone",
            role: LayerRole.MARKER
        };
        this.props.addLayerFeatures(layer, [feature], true);
    };
    measurementChanged = (measurement) => {
        if (this.props.displayMeasurements) {
            if (measurement) {
                const layer = {
                    id: "cyclomedia-measurements",
                    role: LayerRole.MARKER,
                    crs: measurement.crs.properties.name,
                    styleOptions: {
                        strokeColor: 'red',
                        strokeWidth: 4,
                        fillColor: [255, 0, 0, 0.25],
                        strokeDash: []
                    }
                };
                this.props.addLayerFeatures(layer, measurement.features, true);
            } else {
                this.props.removeLayer("cyclomedia-measurements");
            }
        }
    };
    cyclomediaIndexHtml = () => {
        const supportedLang = ["de", "en-GB", "en-US", "fi", "fr", "nl", "tr", "pl"];
        let lang = LocaleUtils.lang();
        if (supportedLang.indexOf(lang) < 0) {
            lang = lang.slice(0, 2);
            if (supportedLang.indexOf(lang) < 0) {
                lang = "en-US";
            }
        }
        const loginOauth = !!this.props.clientId && !this.state.loginFailed;
        return `
            <!DOCTYPE html>
            <html>
            <head>
            <script type="text/javascript" src="https://unpkg.com/react@16.12.0/umd/react.production.min.js"></script>
            <script type="text/javascript" src="https://unpkg.com/react-dom@16.12.0/umd/react-dom.production.min.js"></script>
            <script type="text/javascript" src="https://streetsmart.cyclomedia.com/api/v${this.props.cyclomediaVersion}/StreetSmartApi.js"></script>
            <script type="text/javascript">
            let apiInitialized = false;
            let initCallback = null;
            let posCallback = null;
            let measureCallback = null;

            function initApi() {
                StreetSmartApi.init({
                    targetElement: document.getElementById("streetsmartApi"),
                    username: "${this.state.username || undefined}",
                    password: "${this.state.password || undefined}",
                    apiKey: "${this.props.apikey}",
                    clientId: "${this.props.clientId}",
                    loginOauth: ${loginOauth},
                    loginRedirectUri: "${this.props.loginRedirectUri}",
                    logoutRedirectUri: "${this.props.logoutRedirectUri}",
                    srs: "${this.props.projection}",
                    locale: "${lang}",
                    configurationUrl: 'https://atlas.cyclomedia.com/configuration',
                    addressSettings: {
                        locale: "us",
                        database: "Nokia"
                    }
                }).then(() => {
                    apiInitialized = true;
                    if (initCallback) {
                        initCallback(true);
                    }
                }, (e) => {
                    apiInitialized = false;
                    if (initCallback) {
                        initCallback(false, e.message);
                    }
                });
            }
            function openImage(posStr, crs) {
                if (!apiInitialized) {
                    return;
                }
                StreetSmartApi.open(posStr, {
                    viewerType: StreetSmartApi.ViewerType.PANORAMA,
                    srs: crs,
                    panoramaViewer: {
                         closable: false,
                         maximizable: true,
                         replace: true,
                         recordingsVisible: true,
                         navbarVisible: true,
                         timeTravelVisible: true,
                         measureTypeButtonVisible: true,
                         measureTypeButtonStart: true,
                         measureTypeButtonToggle: true,
                     },
                }).then((result) => {
                    if (result && result[0]){
                        window.panoramaViewer = result[0];
                        window.panoramaViewer.on(StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE, changeView);
                        window.panoramaViewer.on(StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE, changeView);
                        StreetSmartApi.on(StreetSmartApi.Events.measurement.MEASUREMENT_CHANGED, changeMeasurement);
                        StreetSmartApi.on(StreetSmartApi.Events.measurement.MEASUREMENT_STOPPED, stopMeasurement);
                    }
                }).catch((reason) => {
                    console.log('Failed to create component(s) through API: ' + reason);
                });
            }
            function changeView() {
                if (posCallback) {
                    const recording = window.panoramaViewer.getRecording();
                    const orientation = window.panoramaViewer.getOrientation();
                    const pos = recording.xyz;
                    const posData = {
                        pos: [pos[0], pos[1]],
                        crs: recording.srs,
                        yaw: orientation.yaw * Math.PI / 180,
                        hFov: orientation.hFov * Math.PI / 180.0
                    }
                    posCallback(posData);
                }
            }
            function changeMeasurement(e) {
                measureCallback(e.detail.activeMeasurement);
            }
            function stopMeasurement() {
                measureCallback(null);
            }
            function registerCallbacks(_initCallback, _posCallback, _measureCallback) {
                initCallback = _initCallback;
                posCallback = _posCallback;
                measureCallback = _measureCallback;
            }
            </script>
            <style>
              html, body, #streetsmartApi {height: 100%;}
            </style>
            </head>
            <body style="margin: 0">
            <div id="streetsmartApi">
            </div>
            </body>
            </html>
        `;
    };
    addRecordingsWFS = () => {
        const layer = {
            uuid: 'cyclomedia-recordings',
            id: 'cyclomedia-recordings',
            type: 'wfs',
            loader: (vectorSource, extent, resolution, projection, success, failure) => {
                const bbox = CoordinatesUtils.reprojectBbox(extent, projection.getCode(), this.props.projection);
                const postData = `
                    <wfs:GetFeature service="WFS" version="1.1.0" resultType="results" outputFormat="text/xml; subtype=gml/3.1.1" xmlns:wfs="http://www.opengis.net/wfs">
                        <wfs:Query typeName="atlas:Recording" srsName="${this.props.projection}" xmlns:atlas="http://www.cyclomedia.com/atlas">
                            <ogc:Filter xmlns:ogc="http://www.opengis.net/ogc">
                                <ogc:And>
                                    <ogc:BBOX>
                                        <gml:Envelope srsName="${this.props.projection}" xmlns:gml="http://www.opengis.net/gml">
                                        <gml:lowerCorner>${bbox[0]} ${bbox[1]}</gml:lowerCorner>
                                        <gml:upperCorner>${bbox[2]} ${bbox[3]}</gml:upperCorner>
                                        </gml:Envelope>
                                    </ogc:BBOX>
                                    <ogc:PropertyIsNull>
                                        <ogc:PropertyName>expiredAt</ogc:PropertyName>
                                    </ogc:PropertyIsNull>
                                </ogc:And>
                            </ogc:Filter>
                        </wfs:Query>
                    </wfs:GetFeature>
                `;
                const xhr = new XMLHttpRequest();
                xhr.open('POST', 'https://atlasapi.cyclomedia.com/api/Recordings/wfs');
                xhr.setRequestHeader("Authorization", "Basic " + btoa(this.state.username + ":" + this.state.password));
                const onError = function() {
                    vectorSource.removeLoadedExtent(extent);
                    failure();
                };
                xhr.onerror = onError;
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const features = vectorSource.getFormat().readFeatures(xhr.responseText,
                            {
                                dataProjection: this.props.projection,
                                featureProjection: projection.getCode()
                            }
                        );
                        vectorSource.addFeatures(features);
                        success(features);
                    } else {
                        onError();
                    }
                };
                xhr.send(postData);
            },
            name: 'atlas:Recording',
            version: '1.1.0',
            projection: this.props.projection,
            formats: ['text/xml; subtype=gml/3.1.1'],
            invertAxisOrientation: true,
            role: LayerRole.SELECTION,
            color: '#6666FF',
            visibility: this.props.mapScale <= this.props.maxMapScale
        };
        this.props.addLayer(layer);
    };
    queryPoint = (prevProps) => {
        if (this.props.click === prevProps.click)  {
            return null;
        }
        const cmFeature = this.props.click.features.find(feature => feature.layerId === 'cyclomedia-recordings');
        return cmFeature ? cmFeature.geometry.coordinates : null;
    };
}


export default connect((state) => ({
    active: state.task.id === "Cyclomedia",
    click: state.map.click,
    mapCrs: state.map.projection,
    mapScale: MapUtils.computeForZoom(state.map.scales, state.map.zoom),
    theme: state.theme.current
}), {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures,
    changeLayerProperty: changeLayerProperty,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask
})(Cyclomedia);
