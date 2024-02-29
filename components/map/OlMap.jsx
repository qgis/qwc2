/**
 * Copyright 2015-2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import {changeMapView, clickOnMap} from '../../actions/map';
import {changeMousePositionState} from '../../actions/mousePosition';
import {setCurrentTask} from '../../actions/task';
import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import MapUtils from '../../utils/MapUtils';

ol.Map.prototype.setRequestsPaused = function(paused) {
    this.requestsPaused_ = paused;
    this.tileQueue_.setRequestsPaused(paused);
    this.getView().setRequestsPaused(paused);
    if (!paused) {
        this.render();
    }
};

class OlMap extends React.Component {
    static propTypes = {
        bbox: PropTypes.object,
        center: PropTypes.array,
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        fullExtent: PropTypes.object,
        id: PropTypes.string,
        mapMargins: PropTypes.object,
        mapOptions: PropTypes.object,
        mapStateSource: PropTypes.string,
        onClick: PropTypes.func,
        onMapViewChanges: PropTypes.func,
        onMouseMove: PropTypes.func,
        panPageSize: PropTypes.number,
        panStepSize: PropTypes.number,
        projection: PropTypes.string,
        resolutions: PropTypes.array,
        setCurrentTask: PropTypes.func,
        trackMousePos: PropTypes.bool,
        unsetTaskOnMapClick: PropTypes.bool,
        zoom: PropTypes.number.isRequired
    };
    static defaultProps = {
        id: 'map',
        mapOptions: {
            panPageSize: 1,
            panStepSize: 0.25
        }
    };
    state = {
        mapOptions: {},
        projection: null,
        resolutions: [],
        rebuildView: false
    };
    constructor(props) {
        super(props);
        this.ignoreNextClick = false;
        this.state.mapOptions = {
            ...OlMap.defaultProps.mapOptions,
            ...props.mapOptions
        };

        const interactions = ol.interaction.defaults({
            // don't create these default interactions, but create them below with custom params
            dragPan: false,
            mouseWheelZoom: false,
            keyboard: false
        });
        this.keyboardPanInteractions = [];
        let kinetic = null;
        if (this.state.mapOptions.kineticPanParams)  {
            kinetic = new ol.Kinetic(
                this.state.mapOptions.kineticPanParams.decay,
                this.state.mapOptions.kineticPanParams.minVelocity,
                this.state.mapOptions.kineticPanParams.delay
            );
        }
        interactions.extend([
            new ol.interaction.DragPan({
                kinetic: kinetic,
                condition: (ev) => {
                    const oev = ev.originalEvent;
                    return (
                        (!oev.altKey && !(oev.metaKey || oev.ctrlKey) && !oev.shiftKey) &&
                        oev.isPrimary !== false &&
                        (oev.button === 0 || oev.button === 1)
                    );
                }
            }),
            new ol.interaction.MouseWheelZoom({
                duration: this.state.mapOptions.zoomDuration || 250,
                constrainResolution: ConfigUtils.getConfigProp('allowFractionalZoom') === true ? false : true
            }),
            new ol.interaction.KeyboardZoom()
        ]);
        const controls = ol.control.defaults({
            zoom: false,
            attribution: false,
            rotateOptions: ({tipLabel: LocaleUtils.tr("map.resetrotation")})
        });
        const map = new ol.Map({
            layers: [],
            controls: controls,
            interactions: interactions,
            keyboardEventTarget: document,
            view: this.createView(props.center, props.zoom, props.projection, props.resolutions, this.state.mapOptions.enableRotation, this.state.mapOptions.rotation)
        });
        this.unpauseTimeout = null;
        this.moving = false;
        map.on('movestart', () => {
            this.moving = true;
            this.map.setRequestsPaused(true);
        });
        map.on('moveend', () => {
            this.unblockRequests();
        });
        map.on('singleclick', (event) => this.onClick(0, event.originalEvent, event.pixel));
        map.getViewport().addEventListener('contextmenu', (event) => this.onClick(2, event, this.map.getEventPixel(event)));
        map.on('pointermove', (event) => {
            if (this.props.trackMousePos && !this.moving) {
                this.props.onMouseMove({
                    position: {
                        coordinate: event.coordinate,
                        pixel: event.pixel
                    }
                });
            }
        });
        map.set('id', props.id);
        map.setIgnoreNextClick = (ignore) => {
            this.ignoreNextClick = ignore;
        };

        this.map = map;
        this.registerHooks();

        this.recreateKeyboardInteractions();
        window.addEventListener('resize', this.recreateKeyboardInteractions);
    }
    componentDidMount() {
        this.map.setTarget(this.props.id);
        this.updateMapInfoState();
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.recreateKeyboardInteractions);
    }
    recreateKeyboardInteractions = () => {
        this.keyboardPanInteractions.forEach(interaction => {
            this.map.removeInteraction(interaction);
        });
        this.keyboardPanInteractions = [
            new ol.interaction.KeyboardPan({pixelDelta: this.state.mapOptions.panStepSize * document.body.offsetWidth, condition: this.panHStepCondition}),
            new ol.interaction.KeyboardPan({pixelDelta: this.state.mapOptions.panStepSize * document.body.offsetHeight, condition: this.panVStepCondition}),
            new ol.interaction.KeyboardPan({pixelDelta: this.state.mapOptions.panPageSize * document.body.offsetWidth, condition: this.panHPageCondition}),
            new ol.interaction.KeyboardPan({pixelDelta: this.state.mapOptions.panPageSize * document.body.offsetHeight, condition: this.panVPageCondition})
        ];
        this.keyboardPanInteractions.forEach(interaction => {
            this.map.addInteraction(interaction);
        });
    };
    unblockRequests = () => {
        if (this.moving) {
            if (this.unpauseTimeout) {
                clearTimeout(this.unpauseTimeout);
            }
            this.unpauseTimeout = setTimeout(() => {
                this.updateMapInfoState();
                this.map.setRequestsPaused(false);
                this.unpauseTimeout = null;
                this.moving = false;
            }, 500);
        }
    };
    static getDerivedStateFromProps(nextProps, state) {
        if ((nextProps.projection !== state.projection) || (nextProps.resolutions !== state.resolutions)) {
            return {
                rebuildView: true,
                projection: nextProps.projection,
                resolutions: nextProps.resolutions
            };
        }
        return null;
    }
    componentDidUpdate(prevProps) {
        if (prevProps.id !== this.props.mapStateSource) {
            const view = this.map.getView();
            if (prevProps.center !== this.props.center) {
                view.setCenter(this.props.center);
            }
            if (prevProps.zoom !== this.props.zoom) {
                view.setZoom(this.props.zoom);
            }
            if (prevProps.bbox.rotation !== this.props.bbox.rotation) {
                view.setRotation(this.props.bbox.rotation);
            }
        }
        if (this.state.rebuildView) {
            this.setState({rebuildView: false});
        }
    }
    panHStepCondition = (ev) => {
        const horiz = ev.originalEvent.keyCode === 37 || ev.originalEvent.keyCode === 39;
        return horiz && ol.events.condition.noModifierKeys(ev) && ol.events.condition.targetNotEditable(ev);
    };
    panVStepCondition = (ev) => {
        const vert = ev.originalEvent.keyCode === 38 || ev.originalEvent.keyCode === 40;
        return vert && ol.events.condition.noModifierKeys(ev) && ol.events.condition.targetNotEditable(ev);
    };
    panHPageCondition = (ev) => {
        const horiz = ev.originalEvent.keyCode === 37 || ev.originalEvent.keyCode === 39;
        return horiz && ol.events.condition.shiftKeyOnly(ev) && ol.events.condition.targetNotEditable(ev);
    };
    panVPageCondition = (ev) => {
        const vert = ev.originalEvent.keyCode === 38 || ev.originalEvent.keyCode === 40;
        return vert && ol.events.condition.shiftKeyOnly(ev) && ol.events.condition.targetNotEditable(ev);
    };
    render() {
        if (this.state.rebuildView) {
            const overviewMap = this.map.getControls().getArray().find(control => control instanceof ol.control.OverviewMap);
            const view = this.createView(this.props.center, this.props.zoom, this.props.projection, this.props.resolutions, this.state.mapOptions.enableRotation, this.state.mapOptions.rotation);
            if (overviewMap) {
                overviewMap.getOverviewMap().setView(view);
            }
            this.map.setView(view);
            // We have to force ol to drop tile and reload
            this.map.getLayers().forEach((l) => {
                if (l instanceof ol.layer.Group) {
                    l.getLayers().forEach(sublayer => {
                        const source = sublayer.getSource();
                        if (source.getTileLoadFunction) {
                            source.setTileLoadFunction(source.getTileLoadFunction());
                        }
                    });
                } else {
                    const source = l.getSource();
                    if (source.getTileLoadFunction) {
                        source.setTileLoadFunction(source.getTileLoadFunction());
                    }
                }
            });
            view.setZoom(this.props.zoom);
            view.setCenter(this.props.center);
            this.map.render();
        }

        const children = React.Children.map(this.props.children, child => {
            return child ? React.cloneElement(child, {
                map: this.map,
                projection: this.props.projection
            }) : null;
        });

        const style = {
            left: this.props.mapMargins.left,
            right: this.props.mapMargins.right,
            top: this.props.mapMargins.top,
            bottom: this.props.mapMargins.bottom
        };

        return (
            <div id={this.props.id} key="map" style={style}>
                {children}
            </div>
        );
    }
    onClick = (button, event, pixel) => {
        if (this.ignoreNextClick) {
            this.ignoreNextClick = false;
            return;
        }
        if (button === 2) {
            event.preventDefault();
        }
        if (this.props.unsetTaskOnMapClick) {
            this.props.setCurrentTask(null);
            return;
        }
        const features = [];
        const format = new ol.format.GeoJSON();
        this.map.forEachFeatureAtPixel(pixel, (feature, layer) => {
            const featureObj = format.writeFeatureObject(feature);
            featureObj.layerId = layer ? layer.get('id') : null;
            features.push(featureObj);
        });
        const data = {
            ts: +new Date(),
            coordinate: this.map.getEventCoordinate(event),
            pixel: this.map.getEventPixel(event),
            features: features,
            modifiers: {
                alt: event.altKey,
                ctrl: event.ctrlKey,
                shift: event.shiftKey
            },
            button: button
        };
        this.props.onClick(data);
    };
    updateMapInfoState = () => {
        const view = this.map.getView();
        const c = view.getCenter() || [0, 0];
        const bbox = {
            bounds: view.calculateExtent(this.map.getSize()),
            rotation: view.getRotation()
        };
        const size = {
            width: this.map.getSize()[0],
            height: this.map.getSize()[1]
        };
        this.props.onMapViewChanges(c, view.getZoom() || 0, bbox, size, this.props.id, this.props.projection);
    };
    createView = (center, zoom, projection, resolutions, enableRotation, rotation) => {
        const extent = this.props.mapOptions.constrainExtent && this.props.fullExtent ? CoordinatesUtils.reprojectBbox(this.props.fullExtent.bounds, this.props.fullExtent.crs, projection) : undefined;
        const viewOptions = {
            projection: projection,
            center: center,
            zoom: zoom,
            constrainResolution: ConfigUtils.getConfigProp('allowFractionalZoom') === true ? false : true,
            resolutions: resolutions,
            constrainRotation: false,
            enableRotation: enableRotation !== false,
            rotation: MapUtils.degreesToRadians(rotation) || 0,
            extent: extent
        };
        return new ol.View(viewOptions);
    };
    registerHooks = () => {
        MapUtils.registerHook(MapUtils.GET_MAP, this.map);
        MapUtils.registerHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK, (pos) => {
            return this.map.getPixelFromCoordinate(pos);
        });
        MapUtils.registerHook(MapUtils.GET_COORDINATES_FROM_PIXEL_HOOK, (pixel) => {
            return this.map.getCoordinateFromPixel(pixel);
        });
        MapUtils.registerHook(MapUtils.GET_NATIVE_LAYER, (id) => {
            return this.map.getLayers().getArray().find(layer => layer.get('id') === id);
        });
    };
}

export default connect((state) => ({
    mapMargins: state.windows.mapMargins,
    trackMousePos: state.mousePosition.enabled || false,
    unsetTaskOnMapClick: state.task.unsetOnMapClick
}), {
    onMapViewChanges: changeMapView,
    onClick: clickOnMap,
    onMouseMove: changeMousePositionState,
    setCurrentTask: setCurrentTask
})(OlMap);
