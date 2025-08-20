/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import {changeLocateState, changeLocatePosition, onLocateError} from '../../actions/locate';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/LocateSupport.css';

/**
 * GPS locate support for the map component.
 */
class LocateSupport extends React.Component {
    static propTypes = {
        changeLocatePosition: PropTypes.func,
        changeLocateState: PropTypes.func,
        /** Whether to draw an accuracy circle around the location point. */
        drawCircle: PropTypes.bool,
        locateState: PropTypes.object,
        map: PropTypes.object,
        /** Whether to display the accuracy in meters (`true`) or in feet (`false`). */
        metric: PropTypes.bool,
        onLocateError: PropTypes.func,
        projection: PropTypes.string,
        /** Whether to show a popup displaying accuracy information when clicking on the location point. */
        showPopup: PropTypes.bool,
        /** The geolocation startup mode. Either `DISABLED`, `ENABLED` or `FOLLOWING`. */
        startupMode: PropTypes.string,
        startupParams: PropTypes.object,
        /** Whether to stop following when the map is dragged. */
        stopFollowingOnDrag: PropTypes.bool,
        /** Tracking options, as documented in the [HTML5 Geolocation spec](https://www.w3.org/TR/geolocation-API/#position_options_interface) */
        trackingOptions: PropTypes.object
    };
    static defaultProps = {
        drawCircle: true,
        metric: true,
        showPopup: false,
        startupMode: "DISABLED",
        stopFollowingOnDrag: false,
        trackingOptions: {
            maximumAge: 2000,
            enableHighAccuracy: true,
            timeout: 10000
        }
    };
    constructor(props) {
        super(props);
        const trackingOptions = {...LocateSupport.defaultProps.trackingOptions, ...props.trackingOptions};

        this.geolocate = new ol.Geolocation({
            projection: this.props.projection,
            trackingOptions: trackingOptions
        });

        this.posLayer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            zIndex: 1000000,
            style: this.locationPositionFeatureStyle
        });
        this.posFeature = new ol.Feature();
        this.posFeature.set('__suppress_map_click', true);
        this.posLayer.getSource().addFeature(this.posFeature);

        this.posPopup = this.createPopup();
        this.posOverlay = new ol.Overlay({
            element: this.posPopup,
            positioning: 'top-center',
            stopEvent: true
        });
        this.posOverlayContents = this.posPopup.getElementsByClassName("locate-popup-contents")[0];
        this.posPopup.getElementsByClassName("locate-popup-close")[0].onclick = () => { this.posPopup.hidden = true; };

        this.requestedMode = 'DISABLED';
    }
    componentDidMount() {
        const startupMode = this.props.startupMode.toUpperCase();
        const startupParams = this.props.startupParams;
        const highlightCenter = ["true", "1"].includes((startupParams.hc || "").toLowerCase());
        const searchParams = startupParams.hp || startupParams.hf || startupParams.st;
        if (startupMode !== "DISABLED" && !searchParams && !highlightCenter) {
            this.requestedMode = startupMode;
            this.start();
        }
    }
    componentDidUpdate(prevProps) {
        const newState = this.props.locateState.state;
        const oldState = prevProps.locateState.state;
        if (newState !== oldState) {
            if (newState === "ENABLED" || newState === "FOLLOWING") {
                this.requestedMode = newState;
                if (oldState === "DISABLED") {
                    this.start();
                }
            } else if (newState === "DISABLED") {
                this.requestedMode = "DISABLED";
                this.stop();
            }
        }
        if (this.props.projection !== prevProps.projection) {
            this.geolocate.setProjection(this.props.projection);
        }
    }
    render() {
        return null;
    }
    onLocationError = (err) => {
        this.props.onLocateError(err.message);
        // User denied geolocation prompt
        if (err.code === 1) {
            this.props.changeLocateState("PERMISSION_DENIED");
        } else {
            this.props.changeLocateState("DISABLED");
        }
        this.stop();
    };
    start = () => {
        this.props.changeLocateState("LOCATING");
        this.geolocate.on('change:position', this.positionChanged);
        this.geolocate.on('error', this.onLocationError);
        this.geolocate.setTracking(true);
        this.props.map.addLayer(this.posLayer);
        this.props.map.addOverlay(this.posOverlay);
        this.props.map.on('pointerdrag', this.maybeStopFollow);
        this.props.map.on('click', this.maybeShowPopup);
        this.props.map.on('touch', this.maybeShowPopup);
        this.posPopup.hidden = true;
        this.posLayer.setVisible(false);
    };
    stop = () => {
        this.geolocate.un('change:position', this.positionChanged);
        this.geolocate.un('error', this.onLocationError);
        this.geolocate.setTracking(false);
        this.props.map.removeLayer(this.posLayer);
        this.props.map.removeOverlay(this.posOverlay);
        this.props.map.un('pointerdrag', this.maybeStopFollow);
        this.props.map.un('click', this.maybeShowPopup);
        this.props.map.un('touch', this.maybeShowPopup);
    };
    positionChanged = () => {
        if (this.props.locateState.state === "LOCATING") {
            this.props.changeLocateState(this.requestedMode);
            this.posLayer.setVisible(true);
        }

        const mapPos = this.geolocate.getPosition();
        const wgsPos = CoordinatesUtils.reproject(mapPos, this.props.projection, "EPSG:4326");
        this.props.changeLocatePosition(wgsPos);

        const point = new ol.geom.Point(mapPos);
        if (this.props.drawCircle) {
            const circle = new ol.geom.Circle(mapPos, this.geolocate.getAccuracy());
            this.posFeature.setGeometry(new ol.geom.GeometryCollection([point, circle]));
        } else {
            this.posFeature.setGeometry(point);
        }
        if (!this.posPopup.hidden) {
            this.updatePopupContents();
        }
        if (this.props.locateState.state === "FOLLOWING") {
            this.props.map.getView().setCenter(mapPos);
        }
    };
    maybeStopFollow = () => {
        if (this.props.locateState.state === "FOLLOWING" && this.props.stopFollowingOnDrag) {
            this.props.changeLocateState("ENABLED");
        }
    };
    maybeShowPopup = (ev) => {
        if (this.props.showPopup) {
            const feature = this.props.map.getFeaturesAtPixel(ev.pixel, {
                layerFilter: layer => layer === this.posLayer
            })[0];
            if (feature) {
                this.posPopup.hidden = false;
                this.updatePopupContents();
                ev.stopPropagation();
            } else {
                this.posPopup.hidden = true;
            }
        }
    };
    updatePopupContents = () => {
        const accuracy = this.geolocate.getAccuracy();
        let contents = LocaleUtils.tr("locate.popup");
        if (this.props.metric) {
            contents = contents.replace("{distance}", accuracy);
            contents = contents.replace("{unit}", LocaleUtils.tr("locate.metersUnit"));
        } else {
            contents = contents.replace("{distance}", Math.round(accuracy * 3.2808399));
            contents = contents.replace("{unit}", LocaleUtils.tr("locate.feetUnit"));
        }
        this.posOverlayContents.innerHTML = contents;
        this.posOverlay.setPosition(this.posFeature.getGeometry().getGeometries()[0].getCoordinates());
    };
    locationPositionFeatureStyle = () => {
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: 6,
                fill: new ol.style.Fill({color: 'rgba(42, 147, 238, 0.7)'}),
                stroke: new ol.style.Stroke({color: 'rgba(19, 106, 236, 1)', width: 2})
            }),
            fill: new ol.style.Fill({color: 'rgba(19, 106, 236, 0.15)'}),
            stroke: new ol.style.Stroke({color: 'rgba(19, 106, 236, 1)', width: 2})
        });
    };
    createPopup = ()  => {
        const popup = document.createElement('div');
        popup.className = "locate-popup";
        popup.innerHTML = `
          <a class="locate-popup-close">✖</a>
          <div class="locate-popup-contents">
        `;
        return popup;
    };
}

export default connect((state) => ({
    locateState: state.locate,
    startupParams: state.localConfig.startupParams
}), {
    changeLocateState,
    changeLocatePosition,
    onLocateError
})(LocateSupport);
