/**
 * Copyright 2015-2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const ol = require('openlayers');
const React = require('react');
const PropTypes = require('prop-types');
const assign = require('object-assign');
const isEmpty = require('lodash.isempty');

const CoordinatesUtils = require('../../../utils/CoordinatesUtils');
const mapUtils = require('../../../utils/MapUtils');

class OpenlayersMap extends React.Component {
    static propTypes = {
        id: PropTypes.string,
        center: PropTypes.array,
        zoom: PropTypes.number.isRequired,
        mapStateSource: PropTypes.string,
        projection: PropTypes.string,
        onMapViewChanges: PropTypes.func,
        onClick: PropTypes.func,
        mapOptions: PropTypes.object,
        zoomControl: PropTypes.bool,
        mousePointer: PropTypes.string,
        trackMousePos: PropTypes.bool,
        identifyEnabled: PropTypes.bool,
        onMouseMove: PropTypes.func,
        setLayerLoading: PropTypes.func,
        registerHooks: PropTypes.bool,
        interactive: PropTypes.bool
    }
    static defaultProps = {
        id: 'map',
        onMapViewChanges: () => {},
        onClick: () => {},
        onMouseMove: () => {},
        setLayerLoading: () => {},
        mapOptions: {},
        projection: 'EPSG:3857',
        registerHooks: true,
        interactive: true
    }
    componentDidMount() {
        let interactionsOptions = assign(this.props.interactive ? {} : {
            doubleClickZoom: false,
            altShiftDragRotate: true,
            shiftDragZoom: true,
            pinchRotate: true,
            pinchZoom: true
        }, this.props.mapOptions.interactions);

        let interactions = ol.interaction.defaults(assign(
            interactionsOptions, {
                dragPan: false, // don't create default interaction, but create it below with custom params
                mouseWheelZoom: false // don't create default interaction, but create it below with custom params
        }));
        interactions.extend([
            new ol.interaction.DragPan({kinetic: null})
        ]);
        interactions.extend([
            new ol.interaction.MouseWheelZoom({duration: this.props.mapOptions.zoomDuration || 0})
        ]);
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
          view: this.createView(this.props.center, this.props.zoom, this.props.projection, this.props.resolutions)
        });
        if(this.props.mapOptions.antialiasing === false) {
            map.on('precompose', function(evt) {
                evt.context.imageSmoothingEnabled = false;
                evt.context.webkitImageSmoothingEnabled = false;
                evt.context.mozImageSmoothingEnabled = false;
                evt.context.msImageSmoothingEnabled = false;
            });
        }
        map.on('moveend', this.updateMapInfoState);
        map.on('click', (event) => {
            if(!this.props.identifyEnabled && this.map.getFeaturesAtPixel(event.pixel)) {
                // Ignore
                return;
            }
            this.props.onClick({
                coordinate: this.map.getEventCoordinate(event.originalEvent),
                pixel: this.map.getEventPixel(event.originalEvent),
                modifiers: {
                    alt: event.originalEvent.altKey,
                    ctrl: event.originalEvent.ctrlKey,
                    shift: event.originalEvent.shiftKey
                },
                button: 0
            });
        });
        map.getViewport().addEventListener('contextmenu', (event)  => {
            event.preventDefault();
            this.props.onClick({
                coordinate: this.map.getEventCoordinate(event),
                pixel: this.map.getEventPixel(event),
                modifiers: {
                    alt: event.altKey,
                    ctrl: event.ctrlKey,
                    shift: event.shiftKey
                },
                button: 2
            });
            return false;
        });
        map.on('pointermove', (event) => {
            if(this.props.trackMousePos) {
                this.props.onMouseMove({
                    position: {
                        coordinate: event.coordinate,
                        pixel: event.pixel
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
        let bbox = {
            bounds: view.calculateExtent(this.map.getSize()),
            rotation: view.getRotation()
        }
        let size = {
            width: this.map.getSize()[0],
            height: this.map.getSize()[1]
        };
        this.props.onMapViewChanges(c, view.getZoom() || 0, bbox, size, this.props.id, this.props.projection);
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
                projection: this.props.projection,
                setLayerLoading: this.props.setLayerLoading,
            }) : null;
        }) : null;

        return (
            <div id={this.props.id}>
                {children}
            </div>
        );
    }
    createView = (center, zoom, projection, resolutions) => {
        const viewOptions = {
            projection: projection,
            center: center,
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
        const centerChanged = newProps.center[0] != this.props.center[0] ||
                              newProps.center[1] != this.props.center[1];

        if (centerChanged) {
            view.setCenter(newProps.center);
        }
        if (newProps.zoom !== this.props.zoom) {
            view.setZoom(newProps.zoom);
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
