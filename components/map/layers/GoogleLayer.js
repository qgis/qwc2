/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import ol from 'openlayers';

let layersMap;
let rendererItem;
// internal state for visibility of all Google Maps layers in layer tree
const layerVisibilities = {};
const gmaps = {};
const isTouchSupported = 'ontouchstart' in window;
const startEvent = isTouchSupported ? 'touchstart' : 'mousedown';
const moveEvent = isTouchSupported ? 'touchmove' : 'mousemove';
const endEvent = isTouchSupported ? 'touchend' : 'mouseup';

// NOTE: For the GoogleLayer to work, you MUST use EPSG:3857 as map projection and the google mercator scales:
// [591658711,295829355,147914678,73957339,36978669,18489335,9244667,4622334,2311167,1155583,577792,288896,144448,72224,36112,18056,9028,4514,2257,1128,564,282,141,71,35,18,9,4,2]

export default {
    create: (options, map) => {
        const google = window.google;
        const mapId = map.get('id');
        if (mapId !== 'map') {
            // ignore if not main map, e.g. overview
            return null;
        }

        if (!layersMap) {
            layersMap = {
                HYBRID: google.maps.MapTypeId.HYBRID,
                SATELLITE: google.maps.MapTypeId.SATELLITE,
                ROADMAP: google.maps.MapTypeId.ROADMAP,
                TERRAIN: google.maps.MapTypeId.TERRAIN
            };
        }
        if (!gmaps[mapId]) {
            gmaps[mapId] = new google.maps.Map(document.getElementById(mapId + 'gmaps'), {
                disableDefaultUI: true,
                keyboardShortcuts: false,
                draggable: false,
                disableDoubleClickZoom: true,
                scrollwheel: false,
                streetViewControl: false,
                tilt: 0
            });
        }
        gmaps[mapId].setMapTypeId(layersMap[options.name]);
        const mapContainer = document.getElementById(mapId + 'gmaps');
        const setCenter = () => {
            if (mapContainer.style.visibility !== 'hidden') {
                const center = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');
                gmaps[mapId].setCenter(new google.maps.LatLng(center[1], center[0]));
            }
        };
        const setZoom = () => {
            if (mapContainer.style.visibility !== 'hidden') {
                gmaps[mapId].setZoom(Math.round(map.getView().getZoom()));
            }
        };

        /**
         * @param point {array}: [x, y]
         * @param alpha {number}: rotation in degrees
         */
        const rotatePoint = (point, alpha) => {
            const radAlpha = alpha * Math.PI / 180;
            const x = point[0];
            const y = point[1];

            const rx = x * Math.cos(radAlpha) - y * Math.sin(radAlpha);
            const ry = x * Math.sin(radAlpha) + y * Math.cos(radAlpha);

            return [rx, ry];
        };

        /**
         * @param rotation {number}: rotation in degrees
         * @param size {array}: map size [w, h]
         */
        const calculateRotatedSize = (rotation, size) => {
            const w = size[0];
            const h = size[1];

            const vertices = [
            //  [   x  ,   y  ]
                [ w / 2, h / 2],
                [-w / 2, h / 2],
                [-w / 2, -h / 2],
                [ w / 2, -h / 2]
            ];

            const rVertices = vertices.map((p) => {return rotatePoint(p, rotation); });

            const Xs = rVertices.map((p) => {return p[0]; });
            const Ys = rVertices.map((p) => {return p[1]; });

            const maxX = Math.max.apply(null, Xs);
            const minX = Math.min.apply(null, Xs);
            const maxY = Math.max.apply(null, Ys);
            const minY = Math.min.apply(null, Ys);

            const H = Math.abs(maxY) + Math.abs(minY);
            const W = Math.abs(maxX) + Math.abs(minX);

            return {width: W, height: H};
        };

        const setRotation = () => {
            if (mapContainer.style.visibility !== 'hidden') {
                const rotation = map.getView().getRotation() * 180 / Math.PI;

                mapContainer.style.transform = "rotate(" + rotation + "deg)";
                google.maps.event.trigger(gmaps[mapId], "resize");
            }
        };

        const setViewEventListeners = () => {
            const view = map.getView();
            view.on('change:center', setCenter);
            view.on('change:resolution', setZoom);
            view.on('change:rotation', setRotation);
        };
        map.on('change:view', setViewEventListeners);

        setViewEventListeners();
        setCenter();
        setZoom();

        const viewport = map.getViewport();
        let oldTrans = document.getElementById(mapId + 'gmaps').style.transform;

        let mousedown = false;
        let mousemove = false;

        const resizeGoogleLayerIfRotated = () => {
            const degrees = /[+-]?\d+\.?\d*/i;
            const newTrans = document.getElementById(mapId + 'gmaps').style.transform;
            if (newTrans !== oldTrans && newTrans.indexOf('rotate') !== -1) {
                const rotation = parseFloat(newTrans.match(degrees)[0]);
                const size = calculateRotatedSize(-rotation, map.getSize());
                mapContainer.style.width = size.width + 'px';
                mapContainer.style.height = size.height + 'px';
                mapContainer.style.left = (Math.round((map.getSize()[0] - size.width) / 2.0)) + 'px';
                mapContainer.style.top = (Math.round((map.getSize()[1] - size.height) / 2.0)) + 'px';
                google.maps.event.trigger(gmaps[mapId], "resize");
                setCenter();
            }
        };

        viewport.addEventListener(startEvent, () => {
            mousedown = true;
        });
        viewport.addEventListener(endEvent, () => {
            if (mousemove && mousedown) {
                resizeGoogleLayerIfRotated();
            }
            oldTrans = document.getElementById(mapId + 'gmaps').style.transform;
            mousedown = false;
        });
        viewport.addEventListener(moveEvent, () => {
            mousemove = mousedown;
        });

        return null;
    },
    render(options, map) {
        const mapId = map.get('id');
        if (mapId !== 'map') {
            // ignore if not main map, e.g. overview
            return null;
        }

        // the first item that call render will take control
        if (!rendererItem) {
            rendererItem = options.name;
        }
        const wrapperStyle = {
            zIndex: -1,
            position: 'fixed',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        };
        const gmapsStyle = {
            height: '100%'
        };

        const visibilityChanged = (layerVisibilities[options.id] !== options.visibility);
        layerVisibilities[options.id] = options.visibility;

        if (options.visibility === true) {
            const div = document.getElementById(mapId + "gmaps");
            if (div) {
                // override div visibility
                div.style.visibility = 'visible';
            }
            if (gmaps[mapId] && layersMap) {
                gmaps[mapId].setMapTypeId(layersMap[options.name]);
                gmaps[mapId].setTilt(0);

                if (visibilityChanged) {
                    // update map extent when turning visibility on
                    const center = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');
                    gmaps[mapId].setCenter(new window.google.maps.LatLng(center[1], center[0]));
                    gmaps[mapId].setZoom(map.getView().getZoom());
                }
            }
        } else {
            gmapsStyle.visibility = 'hidden'; // used only for the renered div
        }
        // To hide the map when visibility is set to false for every
        // instance of google layer
        if (rendererItem === options.name) {
            // assume the first render the div for gmaps
            const div = document.getElementById(mapId + "gmaps");
            if (div) {
                div.style.visibility = options.visibility ? 'visible' : 'hidden';
            }
            return (
                <div style={wrapperStyle}>
                    <div className="fill" id={mapId + "gmaps"} style={gmapsStyle} />
                </div>
            );
        }
        return null;
    },
    update(layer, newOptions, oldOptions, map) {
        const mapId = map.get('id');
        const google = window.google;
        if (!oldOptions.visibility && newOptions.visibility) {
            const view = map.getView();
            const center = ol.proj.transform(view.getCenter(), 'EPSG:3857', 'EPSG:4326');
            gmaps[mapId].setCenter(new google.maps.LatLng(center[1], center[0]));
            gmaps[mapId].setZoom(view.getZoom());
        }
    }
};
