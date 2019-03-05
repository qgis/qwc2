/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');

var layersMap;
var rendererItem;
var gmaps = {};
var isTouchSupported = 'ontouchstart' in window;
var startEvent = isTouchSupported ? 'touchstart' : 'mousedown';
var moveEvent = isTouchSupported ? 'touchmove' : 'mousemove';
var endEvent = isTouchSupported ? 'touchend' : 'mouseup';

// NOTE: For the GoogleLayer to work, you MUST use EPSG:3857 as map projection and the google mercator scales:
// [591658711,295829355,147914678,73957339,36978669,18489335,9244667,4622334,2311167,1155583,577792,288896,144448,72224,36112,18056,9028,4514,2257,1128,564,282,141,71,35,18,9,4,2]

let GoogleLayer = {
    create: (options, map, mapId) => {
        let google = window.google;
        if (!layersMap) {
            layersMap = {
               'HYBRID': google.maps.MapTypeId.HYBRID,
               'SATELLITE': google.maps.MapTypeId.SATELLITE,
               'ROADMAP': google.maps.MapTypeId.ROADMAP,
               'TERRAIN': google.maps.MapTypeId.TERRAIN
           };
        }
        if (!gmaps[mapId]) {
            gmaps[mapId] = new google.maps.Map(document.getElementById(mapId + 'gmaps'), {
              disableDefaultUI: true,
              keyboardShortcuts: false,
              draggable: false,
              disableDoubleClickZoom: true,
              scrollwheel: false,
              streetViewControl: false
            });
        }
        gmaps[mapId].setMapTypeId(layersMap[options.name]);
        let mapContainer = document.getElementById(mapId + 'gmaps');
        let setCenter = () => {
            if (mapContainer.style.visibility !== 'hidden') {
                const center = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');
                gmaps[mapId].setCenter(new google.maps.LatLng(center[1], center[0]));
            }
        };
        let setZoom = () => {
            if (mapContainer.style.visibility !== 'hidden') {
                gmaps[mapId].setZoom(Math.round(map.getView().getZoom()));
            }
        };

        /**
         * @param point {array}: [x, y]
         * @param alpha {number}: rotation in degrees
         */
        let rotatePoint = (point, alpha) => {
            const radAlpha = alpha * Math.PI / 180;
            const x = point[0];
            const y = point[1];

            let rx = x * Math.cos(radAlpha) - y * Math.sin(radAlpha);
            let ry = x * Math.sin(radAlpha) + y * Math.cos(radAlpha);

            return [rx, ry];
        };

        /**
         * @param rotation {number}: rotation in degrees
         * @param size {array}: map size [w, h]
         */
        let calculateRotatedSize = (rotation, size) => {
            let w = size[0];
            let h = size[1];

            let vertices = [
            //  [   x  ,   y  ]
                [ w / 2, h / 2],
                [-w / 2, h / 2],
                [-w / 2, -h / 2],
                [ w / 2, -h / 2]
            ];

            let rVertices = vertices.map((p) => {return rotatePoint(p, rotation); });

            let Xs = rVertices.map((p) => {return p[0]; });
            let Ys = rVertices.map((p) => {return p[1]; });

            let maxX = Math.max.apply(null, Xs);
            let minX = Math.min.apply(null, Xs);
            let maxY = Math.max.apply(null, Ys);
            let minY = Math.min.apply(null, Ys);

            let H = Math.abs(maxY) + Math.abs(minY);
            let W = Math.abs(maxX) + Math.abs(minX);

            return {width: W, height: H};
        };

        let setRotation = () => {
            if (mapContainer.style.visibility !== 'hidden') {
                const rotation = map.getView().getRotation() * 180 / Math.PI;

                mapContainer.style.transform = "rotate(" + rotation + "deg)";
                google.maps.event.trigger(gmaps[mapId], "resize");
            }
        };

        let setViewEventListeners = () => {
            let view = map.getView();
            view.on('change:center', setCenter);
            view.on('change:resolution', setZoom);
            view.on('change:rotation', setRotation);
        }
        map.on('change:view', setViewEventListeners);

        setViewEventListeners();
        setCenter();
        setZoom();

        let viewport = map.getViewport();
        let oldTrans = document.getElementById(mapId + 'gmaps').style.transform;

        let mousedown = false;
        let mousemove = false;

        let resizeGoogleLayerIfRotated = () => {
            let degrees = /[\+\-]?\d+\.?\d*/i;
            let newTrans = document.getElementById(mapId + 'gmaps').style.transform;
            if (newTrans !== oldTrans && newTrans.indexOf('rotate') !== -1) {
                let rotation = parseFloat(newTrans.match(degrees)[0]);
                let size = calculateRotatedSize(-rotation, map.getSize());
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
    render(options, map, mapId) {
        // the first item that call render will take control
        if (!rendererItem) {
            rendererItem = options.name;
        }
        let wrapperStyle = {
            zIndex: -1,
            position: 'fixed',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        };
        let gmapsStyle = {
            height: '100%'
        };
        if (options.visibility === true) {
            let div = document.getElementById(mapId + "gmaps");
            if (div) {
                div.style.visibility = 'visible';
            }
            if (gmaps[mapId] && layersMap) {
                gmaps[mapId].setMapTypeId(layersMap[options.name]);
                gmaps[mapId].setTilt(0);
            }
        } else {
            gmapsStyle.visibility = 'hidden'; // used only for the renered div
        }
        // To hide the map when visibility is set to false for every
        // instance of google layer
        if (rendererItem === options.name) {
            // assume the first render the div for gmaps
            let div = document.getElementById(mapId + "gmaps");
            if (div) {
                div.style.visibility = options.visibility ? 'visible' : 'hidden';
            }
            return (
                <div style={wrapperStyle}>
                <div id={mapId + "gmaps"} className="fill" style={gmapsStyle}></div>
                </div>
            );
        }
        return null;
    },
    update(layer, newOptions, oldOptions, map, mapId) {
        let google = window.google;
        if (!oldOptions.visibility && newOptions.visibility) {
            let view = map.getView();
            const center = ol.proj.transform(view.getCenter(), 'EPSG:3857', 'EPSG:4326');
            gmaps[mapId].setCenter(new google.maps.LatLng(center[1], center[0]));
            gmaps[mapId].setZoom(view.getZoom());
        }
    }

};

module.exports = GoogleLayer;
