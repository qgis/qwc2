/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import ol from 'openlayers';

import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';

import './OlLocate.css';

const createPopup = function() {
    const pop = document.createElement('div');
    pop.setAttribute("class", "ol-popup");
    const popDismis = document.createElement('a');
    popDismis.setAttribute("class", "ol-popup-close-btn");
    popDismis.setAttribute("href", "#close");
    popDismis.innerHTML = "x";
    const popCntWrap = document.createElement('div');
    popCntWrap.setAttribute("class", "ol-popup-cnt-wrapper");
    const popCnt = document.createElement('div');
    popCnt.setAttribute("class", "ol-popup-cnt");
    popCntWrap.appendChild(popCnt);
    const popTipWrap = document.createElement('div');
    popTipWrap.setAttribute("class", "ol-popup-tip-wrapper");
    const popTip = document.createElement('div');
    popTip.setAttribute("class", "ol-popup-tip");
    popTipWrap.appendChild(popTip);
    pop.appendChild(popDismis);
    pop.appendChild(popCntWrap);
    pop.appendChild(popTipWrap);
    return pop;
};

export default class OlLocate extends ol.Object {
    constructor(map, optOptions) {
        super();
        this.set("state", "DISABLED");
        this.map = map;
        const defOptions = {
            drawCircle: true, // draw accuracy circle
            follow: true, // follow with zoom and pan the user's location
            stopFollowingOnDrag: false, // if follow is true, stop following when map is dragged (deprecated)
            // if true locate control remains active on click even if the user's location is in view.
            // clicking control will just pan to location not implemented
            remainActive: true,
            locateStyle: this._getDefaultStyles(),
            metric: true,
            onLocationError: this.onLocationError,
            // keep the current map zoom level when displaying the user's location. (if 'false', use maxZoom)
            keepCurrentZoomLevel: false,
            showPopup: false, // display a popup when the user click on the inner marker
            strings: {
                metersUnit: LocaleUtils.tr("locate.metersUnit"),
                feetUnit: LocaleUtils.tr("locate.feetUnit"),
                popup: LocaleUtils.tr("locate.popup")
            },
            locateOptions: {
                maximumAge: 2000,
                enableHighAccuracy: false,
                timeout: 10000,
                maxZoom: 18
            }
        };

        this.options = {...defOptions, ...optOptions};
        this.geolocate = new ol.Geolocation({
            projection: this.map.getView().getProjection(),
            trackingOptions: this.options.locateOptions
        });
        this.geolocate.on('change:position', this._updatePosFt, this);
        this.popup = createPopup();
        this.popup.hidden = true;
        this.popCnt = this.popup.getElementsByClassName("ol-popup-cnt")[0];
        this.overlay = new ol.Overlay({
            element: this.popup,
            positioning: 'top-center',
            stopEvent: false
        });
        this.layer = new ol.layer.Vector({
            source: new ol.source.Vector({ useSpatialIndex: false })
        });
        this.posFt = new ol.Feature({
            geometry: this.geolocate.getAccuracyGeometry(),
            name: 'position',
            id: '_locate-pos'
        });
        this.posFt.setStyle(this.options.locateStyle);
        this.layer.getSource().addFeature(this.posFt);
    }
    start = () => {
        this.geolocate.on('error', this.options.onLocationError, this);
        this.follow = this.options.follow;
        this.geolocate.setTracking(true);
        this.layer.setMap(this.map);
        this.map.addOverlay(this.overlay);
        if (this.options.showPopup) {
            this.map.on('click', this.mapClick, this);
            this.map.on('touch', this.mapClick, this);
        }
        if (this.options.stopFollowingOnDrag) {
            this.map.on('pointerdrag', this.stopFollow, this);
        }
        if (!this.p) {
            this.set("state", "LOCATING");
            this.set("position", null);
        } else {
            this._updatePosFt();
        }
    };
    stop = () => {
        this.geolocate.un('error', this.options.onLocationError, this);
        this.geolocate.setTracking(false);
        this.popup.hide = true;
        this.map.removeOverlay(this.overlay);
        this.layer.setMap( null );
        if (this.options.showPopup) {
            this.map.un('click', this.mapClick);
            this.map.un('touch', this.mapClick);
        }
        if (this.options.stopFollowingOnDrag && this.follow) {
            this.map.un('pointerdrag', this.stopFollow, this);
        }
        this.set("state", "DISABLED");
        this.set("position", null);
    };
    startFollow = () => {
        this.follow = true;
        if (this.options.stopFollowingOnDrag) {
            this.map.on('pointerdrag', this.stopFollow, this);
        }
        if (this.p) {
            this._updatePosFt();
        }
    };
    stopFollow = () => {
        this.follow = false;
        this.map.un('pointerdrag', this.stopFollow, this);
        this.set("state", "ENABLED");
    };
    updateView = (point) => {
        if (this.follow) {
            this.map.getView().setCenter(point.getCoordinates());
            if (!this.options.keepCurrentZoomLevel) {
                this.map.getView().setZoom(this.options.locateOptions.maxZoom);
            }
        }
    };
    onLocationError = (err) => {
        // eslint-disable-next-line
        alert(err.message);
    };
    mapClick = (evt) => {
        const feature = this.map.forEachFeatureAtPixel(evt.pixel, (ft) => ft);
        if (feature && feature.get('id') === '_locate-pos' && this.popup.hidden) {
            this._updatePopUpCnt();
        } else if (!this.popup.hidden ) {
            this.popUp.hidden = true;
        }
    };
    setStrings = (newStrings) => {
        this.options.strings = {...this.options.strings, ...newStrings};
    };
    setProjection = (projection) => {
        this.geolocate.setProjection(projection);
    };
    _updatePosFt = () => {
        const state = this.get("state");
        const nState = (this.follow) ? "FOLLOWING" : "ENABLED";
        if (nState !== state) {
            this.set("state", nState);
        }
        const p = this.geolocate.getPosition();
        const wgsPos = CoordinatesUtils.reproject(p, this.map.getView().getProjection(), "EPSG:4326");
        this.set("position", wgsPos);
        this.p = p;
        const point = new ol.geom.Point(p);
        if (this.options.drawCircle) {
            const accuracy = new ol.geom.Circle(point.getCoordinates(), this.geolocate.getAccuracy());
            this.posFt.setGeometry(new ol.geom.GeometryCollection([point, accuracy]));
        } else {
            this.posFt.setGeometry(new ol.geom.GeometryCollection([point]));
        }
        if (!this.popup.hidden) {
            this._updatePopUpCnt();
        }
        if (this.follow) {
            this.updateView(point);
        }
        // Update only once
        if (!this.options.remainActive) {
            this.geolocate.setTracking(false);
        }
    };
    _updatePopUpCnt = () => {
        let distance;
        let unit;
        if (this.options.metric) {
            distance = this.geolocate.getAccuracy();
            unit = this.options.strings.metersUnit;
        } else {
            distance = Math.round(this.geolocate.getAccuracy() * 3.2808399);
            unit = this.options.strings.feetUnit;
        }
        const cnt = this.options.strings.popup.replace("{distance}", distance);
        this.popCnt.innerHTML = cnt.replace("{unit}", unit);
        this.overlay.setPosition(this.posFt.getGeometry().getGeometries()[0].getCoordinates());
        this.popup.hidden = false;
    };
    _getDefaultStyles = () => {
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: 6,
                fill: new ol.style.Fill({color: 'rgba(42,147,238,0.7)'}),
                stroke: new ol.style.Stroke({color: 'rgba(19,106,236,1)', width: 2})
            }),
            fill: new ol.style.Fill({color: 'rgba(19,106,236,0.15)'}),
            stroke: new ol.style.Stroke({color: 'rgba(19,106,236,1)', width: 2})
        });
    };
}
