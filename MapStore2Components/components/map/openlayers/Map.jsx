/**
 * Copyright 2015-2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ol = require('openlayers');
var React = require('react');
const PropTypes = require('prop-types');
var assign = require('object-assign');

var CoordinatesUtils = require('../../../utils/CoordinatesUtils');
var mapUtils = require('../../../utils/MapUtils');

const isEmpty = require('lodash.isempty');

class OpenlayersMap extends React.Component {
    static propTypes = {
        id: PropTypes.string,
        style: PropTypes.object,
        center: PropTypes.shape({
            x: PropTypes.number.isRequired,
            y: PropTypes.number.isRequired
        }),
        zoom: PropTypes.number.isRequired,
        mapStateSource: PropTypes.string,
        projection: PropTypes.string,
        onMapViewChanges: PropTypes.func,
        onClick: PropTypes.func,
        mapOptions: PropTypes.object,
        zoomControl: PropTypes.bool,
        mousePointer: PropTypes.string,
        onMouseMove: PropTypes.func,
        onLayerLoading: PropTypes.func,
        onLayerLoad: PropTypes.func,
        onLayerError: PropTypes.func,
        resize: PropTypes.number,
        registerHooks: PropTypes.bool,
        interactive: PropTypes.bool,
        onInvalidLayer: PropTypes.func
    }
    static defaultProps = {
        id: 'map',
        onMapViewChanges: () => {},
        onInvalidLayer: () => {},
        onClick: () => {},
        onMouseMove: () => {},
        mapOptions: {},
        projection: 'EPSG:3857',
        onLayerLoading: () => {},
        onLayerLoad: () => {},
        onLayerError: () => {},
        resize: 0,
        registerHooks: true,
        interactive: true
    }
    componentDidMount() {
        let interactionsOptions = assign(this.props.interactive ? {} : {
            doubleClickZoom: false,
            dragPan: false,
            altShiftDragRotate: false,
            keyboard: false,
            mouseWheelZoom: false,
            shiftDragZoom: false,
            pinchRotate: false,
            pinchZoom: false
        }, this.props.mapOptions.interactions);

        let interactions = ol.interaction.defaults(assign({
            dragPan: false,
            mouseWheelZoom: false
        }, interactionsOptions, {}));
        if (interactionsOptions === undefined || interactionsOptions.dragPan === undefined || interactionsOptions.dragPan) {
            interactions.extend([
                new ol.interaction.DragPan({kinetic: false})
            ]);
        }
        if (interactionsOptions === undefined || interactionsOptions.mouseWheelZoom === undefined || interactionsOptions.mouseWheelZoom) {
            interactions.extend([
                new ol.interaction.MouseWheelZoom({duration: 0})
            ]);
        }
        let controls = ol.control.defaults(assign({
            zoom: this.props.zoomControl,
            attributionOptions: ({
              collapsible: false
            })
        }, this.props.mapOptions.controls));
        let map = new ol.Map({
          layers: [],
          controls: controls,
          interactions: interactions,
          target: this.props.id,
          view: this.createView(this.props.center, Math.round(this.props.zoom), this.props.projection, this.props.resolutions)
        });
        map.on('moveend', this.updateMapInfoState);
        map.on('singleclick', (event) => {
            let latlng = ol.proj.toLonLat(event.coordinate, this.props.projection);
            this.props.onClick({
                latlng: {
                    lng: latlng[0],
                    lat: latlng[1]
                },
                pixel: {
                    x: event.pixel[0],
                    y: event.pixel[1]
                },
                modifiers: {
                    alt: event.originalEvent.altKey,
                    ctrl: event.originalEvent.ctrlKey,
                    shift: event.originalEvent.shiftKey
                }
            });
        });
        map.on('pointermove', (event) => {
            if (!event.dragging) {
                let latlng = ol.proj.toLonLat(event.coordinate, this.props.projection);
                this.props.onMouseMove({
                    latlng: {
                        lng: latlng[0],
                        lat: latlng[1]
                    },
                    pixel: {
                        x: event.pixel[0],
                        y: event.pixel[1]
                    }
                });
            }
        });

        this.map = map;
        this.updateMapInfoState();
        this.setMousePointer(this.props.mousePointer);
        // NOTE: this re-call render function after div creation to have the map initialized.
        this.forceUpdate();

        if (this.props.registerHooks) {
            this.registerHooks();
        }
    }
    updateMapInfoState = () => {
        let view = this.map.getView();
        let c = view.getCenter() || [0, 0];
        let bbox = view.calculateExtent(this.map.getSize());
        let size = {
            width: this.map.getSize()[0],
            height: this.map.getSize()[1]
        };
        this.props.onMapViewChanges(
            {x: c[0], y: c[1]},
            view.getZoom(),
            {
                bounds: bbox,
                rotation: view.getRotation()
            }, size, this.props.id, this.props.projection);
    }
    componentWillReceiveProps(newProps) {
        if (newProps.mousePointer !== this.props.mousePointer) {
            this.setMousePointer(newProps.mousePointer);
        }

        if (newProps.zoomControl !== this.props.zoomControl) {
            if (newProps.zoomControl) {
                this.map.addControl(new ol.control.Zoom());
            } else {
                this.map.removeControl(this.map.getControls().getArray().filter((ctl) => ctl instanceof ol.control.Zoom)[0]);
            }
        }

        if (this.props.id !== newProps.mapStateSource) {
            this._updateMapPositionFromNewProps(newProps);
        }

        if (newProps.resize !== this.props.resize) {
            setTimeout(() => {
                this.map.updateSize();
            }, 0);
        }

        if ((this.props.projection !== newProps.projection) || (this.props.resolutions !== newProps.resolutions)) {
            this.map.setView(this.createView(newProps.center, newProps.zoom, newProps.projection, newProps.resolutions));
            // We have to force ol to drop tile and reload
            this.map.getLayers().forEach((l) => {
                let source = l.getSource();
                if (source.getTileLoadFunction) {
                    source.setTileLoadFunction(source.getTileLoadFunction());
                }
            });
            this.map.render();
        }
    }
    componentWillUnmount() {
        this.map.setTarget(null);
    }
    render() {
        const map = this.map;
        const children = map ? React.Children.map(this.props.children, child => {
            return child ? React.cloneElement(child, {
                map: map,
                mapId: this.props.id,
                onLayerLoading: this.props.onLayerLoading,
                onLayerError: this.props.onLayerError,
                onLayerLoad: this.props.onLayerLoad,
                projection: this.props.projection,
                onInvalid: this.props.onInvalidLayer
            }) : null;
        }) : null;

        return (
            <div id={this.props.id} style={this.props.style}>
                {children}
            </div>
        );
    }
    createView = (center, zoom, projection, resolutions) => {
        const viewOptions = {
            projection: projection,
            center: [center.x, center.y],
            zoom: zoom,
            resolutions: resolutions
        };
        if(this.props.maxExtent) {
            ol.proj.get(projection).setExtent(this.props.maxExtent);
        }
        return new ol.View(viewOptions);
    }
    _updateMapPositionFromNewProps = (newProps) => {
        var view = this.map.getView();
        const centerChanged = newProps.center.x != this.props.center.x ||
                              newProps.center.y != this.props.center.y;

        if (centerChanged) {
            view.setCenter([newProps.center.x, newProps.center.y]);
        }
        if (Math.round(newProps.zoom) !== this.props.zoom) {
            view.setZoom(Math.round(newProps.zoom));
        }
        if(newProps.bbox.rotation !== this.props.bbox.rotation) {
            view.setRotation(newProps.bbox.rotation);
        }
    }
    setMousePointer = (pointer) => {
        if (this.map) {
            const mapDiv = this.map.getViewport();
            mapDiv.style.cursor = pointer || 'auto';
        }
    }
    registerHooks = () => {
        mapUtils.registerHook(mapUtils.GET_PIXEL_FROM_COORDINATES_HOOK, (pos) => {
            return this.map.getPixelFromCoordinate(pos);
        });
        mapUtils.registerHook(mapUtils.GET_COORDINATES_FROM_PIXEL_HOOK, (pixel) => {
            return this.map.getCoordinateFromPixel(pixel);
        });
    }
};

module.exports = OpenlayersMap;
