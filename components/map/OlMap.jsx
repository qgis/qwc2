/**
 * Copyright 2015-2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import ol from 'openlayers';
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import {changeMapView, clickOnMap} from '../../actions/map';
import {changeMousePositionState} from '../../actions/mousePosition';
import {setCurrentTask} from '../../actions/task';
import ConfigUtils from '../../utils/ConfigUtils';
import MapUtils from '../../utils/MapUtils';

class OlMap extends React.Component {
    static propTypes = {
        bbox: PropTypes.object,
        center: PropTypes.array,
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        id: PropTypes.string,
        mapOptions: PropTypes.object,
        mapStateSource: PropTypes.string,
        onClick: PropTypes.func,
        onMapViewChanges: PropTypes.func,
        onMouseMove: PropTypes.func,
        projection: PropTypes.string,
        resolutions: PropTypes.array,
        setCurrentTask: PropTypes.func,
        trackMousePos: PropTypes.bool,
        unsetTaskOnMapClick: PropTypes.bool,
        zoom: PropTypes.number.isRequired
    }
    static defaultProps = {
        id: 'map',
        mapOptions: {}
    }
    state = {
        projection: null,
        resolutions: [],
        rebuildView: false
    }
    constructor(props) {
        super(props);

        const interactions = ol.interaction.defaults({
            dragPan: false, // don't create default interaction, but create it below with custom params
            mouseWheelZoom: false // don't create default interaction, but create it below with custom params
        });
        interactions.extend([
            new ol.interaction.DragPan({kinetic: null}),
            new ol.interaction.MouseWheelZoom({
                duration: props.mapOptions.zoomDuration || 250,
                constrainResolution: ConfigUtils.getConfigProp('allowFractionalZoom') === true ? false : true
            })
        ]);
        const controls = ol.control.defaults({
            zoom: false,
            attributionOptions: ({collapsible: false})
        });
        const map = new ol.Map({
            layers: [],
            controls: controls,
            interactions: interactions,
            view: this.createView(props.center, props.zoom, props.projection, props.resolutions, props.mapOptions.enableRotation)
        });
        map.on('moveend', this.updateMapInfoState);
        map.on('singleclick', (event) => this.onClick(0, event.originalEvent, event.pixel));
        map.getViewport().addEventListener('contextmenu', (event) => this.onClick(2, event, this.map.getEventPixel(event)));
        map.on('pointermove', (event) => {
            if (this.props.trackMousePos) {
                this.props.onMouseMove({
                    position: {
                        coordinate: event.coordinate,
                        pixel: event.pixel
                    }
                });
            }
        });
        map.set('id', props.id);

        this.map = map;
        this.registerHooks();
    }
    componentDidMount() {
        this.map.setTarget(this.props.id);
        this.updateMapInfoState();
    }
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
    componentDidUpdate(prevProps, prevState) {
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
    render() {
        if (this.state.rebuildView) {
            const overviewMap = this.map.getControls().getArray().find(control => control instanceof ol.control.OverviewMap);
            const view = this.createView(this.props.center, this.props.zoom, this.props.projection, this.props.resolutions, this.props.mapOptions.enableRotation);
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
            this.map.render();
        }

        const children = React.Children.map(this.props.children, child => {
            return child ? React.cloneElement(child, {
                map: this.map,
                projection: this.props.projection
            }) : null;
        });

        return (
            <div id={this.props.id}>
                {children}
            </div>
        );
    }
    onClick = (button, event, pixel) => {
        if (button === 2) {
            event.preventDefault();
        }
        if (this.props.unsetTaskOnMapClick) {
            this.props.setCurrentTask(null);
            return;
        }
        const features = [];
        this.map.forEachFeatureAtPixel(pixel, (feature, layer) => {
            features.push([feature, layer]);
        });
        let data = {
            coordinate: this.map.getEventCoordinate(event),
            pixel: this.map.getEventPixel(event),
            modifiers: {
                alt: event.altKey,
                ctrl: event.ctrlKey,
                shift: event.shiftKey
            },
            button: button
        };
        if (!isEmpty(features)) {
            const feature = features[0][0];
            const layer = features[0][1];
            data = {
                ...data,
                layer: layer ? layer.get('id') : null,
                feature: feature.getId(),
                geomType: feature.getGeometry().getType(),
                geometry: feature.getGeometry().getCoordinates ? feature.getGeometry().getCoordinates() : null
            };
        }
        this.props.onClick(data);
    }
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
    }
    createView = (center, zoom, projection, resolutions, enableRotation) => {
        const viewOptions = {
            projection: projection,
            center: center,
            zoom: zoom,
            resolutions: resolutions,
            constrainRotation: false,
            enableRotation: enableRotation !== false
        };
        return new ol.View(viewOptions);
    }
    registerHooks = () => {
        MapUtils.registerHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK, (pos) => {
            return this.map.getPixelFromCoordinate(pos);
        });
        MapUtils.registerHook(MapUtils.GET_COORDINATES_FROM_PIXEL_HOOK, (pixel) => {
            return this.map.getCoordinateFromPixel(pixel);
        });
    }
}

export default connect((state) => ({
    trackMousePos: state.mousePosition.enabled || false,
    unsetTaskOnMapClick: state.task.unsetOnMapClick
}), {
    onMapViewChanges: changeMapView,
    onClick: clickOnMap,
    onMouseMove: changeMousePositionState,
    setCurrentTask: setCurrentTask
})(OlMap);
