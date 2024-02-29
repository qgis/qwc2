/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import ol from 'openlayers';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole} from '../../actions/layers';
import {setSnappingConfig} from '../../actions/map';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import IdentifyUtils from '../../utils/IdentifyUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import MapUtils from '../../utils/MapUtils';
import VectorLayerUtils from '../../utils/VectorLayerUtils';
import SnapInteraction from './SnapInteraction';

import './style/SnappingSupport.css';


class SnappingSupport extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        map: PropTypes.object,
        mapObj: PropTypes.object,
        setSnappingConfig: PropTypes.func,
        task: PropTypes.string,
        theme: PropTypes.object
    };
    state = {
        reqId: null, // FeatureInfo request ID
        invalid: true, // Whether the feature cache needs to be rebuilt
        havesnaplayers: false, // Whether there are any snaplayers
        drawing: false // Whether a drawing interaction is active,
    };
    constructor(props) {
        super(props);
        this.source = new ol.source.Vector();
        this.snapInteraction = new SnapInteraction({
            source: this.source,
            edge: this.snapToEdge(props.mapObj.snapping),
            vertex: this.snapToVertex(props.mapObj.snapping)
        });
        this.snapInteraction.setActive(this.props.mapObj.snapping.active);
        this.inEventHandler = false;

        props.map.getInteractions().on('add', this.handleInteractionAdded);
        props.map.getInteractions().on('remove', this.handleInteractionRemoved);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.mapObj.bbox !== prevProps.mapObj.bbox || this.props.theme !== prevProps.theme) {
            this.setState({invalid: true});
            this.refreshFeatureCache(true);
        } else if (this.props.layers !== prevProps.layers && this.state.havesnaplayers) {
            const layersChanged = this.props.layers.find(layer => {
                if (layer.role === LayerRole.THEME) {
                    const prev = prevProps.layers.find(prevLayer => layer.uuid === prevLayer.uuid);
                    return prev && layer.rev !== prev.rev;
                } else if (layer.role === LayerRole.USERLAYER && layer.type === 'vector') {
                    const prev = prevProps.layers.find(prevLayer => layer.uuid === prevLayer.uuid);
                    return prev && prev.features !== layer.features;
                }
                return false;
            });
            if (layersChanged) {
                this.setState({invalid: true});
                // Delay to avoid refreshing the cache before QGIS Server can pick up the new feature
                setTimeout(() => { this.refreshFeatureCache(true); }, 1500);
            }
        }
        if (this.props.mapObj.snapping.active !== prevProps.mapObj.snapping.active || this.state.drawing !== prevState.drawing) {
            this.snapInteraction.setActive(this.props.mapObj.snapping.active !== false);
            this.snapInteraction.setSnapEdge(this.snapToEdge(this.props.mapObj.snapping));
            this.snapInteraction.setSnapVertex(this.snapToVertex(this.props.mapObj.snapping));
            if (this.props.mapObj.snapping.active) {
                this.refreshFeatureCache();
            }
        }
    }
    render() {
        if (!this.state.drawing || !this.props.mapObj.snapping.enabled) {
            return null;
        }
        const disabled = !this.state.havesnaplayers || this.props.mapObj.snapping.active === false;
        const toolbarClass = disabled ? "snapping-toolbar-inactive" : "";
        const snapEdge = this.snapToEdge(this.props.mapObj.snapping);
        const snapVertex = this.snapToVertex(this.props.mapObj.snapping);
        return (
            <div className="snapping-toolbar-container">
                <div className={toolbarClass}>
                    {this.state.reqId !== null ? (
                        <Spinner/>
                    ) : (
                        <span>
                            <button className={"button" + (snapVertex ? " pressed" : "")} onClick={() => this.toggleSnap('vertex')} title={LocaleUtils.tr("snapping.vertex")}>
                                <Icon icon="snap_vertex" size="large" />
                            </button>
                            <button className={"button" + (snapEdge ? " pressed" : "")} onClick={() => this.toggleSnap('edge')} title={LocaleUtils.tr("snapping.edge")}>
                                <Icon icon="snap_edge" size="large" />
                            </button>
                        </span>
                    )}
                    &nbsp;
                    {this.state.reqId ? LocaleUtils.tr("snapping.loading") : LocaleUtils.tr("snapping.snappingenabled")}
                </div>
            </div>
        );
    }
    snapToEdge = (snappingConfig) => {
        return snappingConfig.active === true || snappingConfig.active === 'edge';
    };
    snapToVertex = (snappingConfig) => {
        return snappingConfig.active === true || snappingConfig.active === 'vertex';
    };
    toggleSnap = (mode) => {
        let active = this.props.mapObj.snapping.active;
        if (mode === 'edge') {
            if (active === true) {
                active = 'vertex';
            } else if (active === 'edge') {
                active = false;
            } else if (active === 'vertex') {
                active = true;
            } else {
                active = 'edge';
            }
        } else if (mode === 'vertex') {
            if (active === true) {
                active = 'edge';
            } else if (active === 'vertex') {
                active = false;
            } else if (active === 'edge') {
                active = true;
            } else {
                active = 'vertex';
            }
        }
        this.props.setSnappingConfig(true, active);
    };
    handleInteractionAdded = (ev) => {
        if (this.inEventHandler) {
            return;
        }
        this.inEventHandler = true;
        this.addSnapInteractionIfNeeded(ev.target);
        this.inEventHandler = false;
    };
    handleInteractionRemoved = (ev) => {
        if (this.inEventHandler) {
            return;
        }
        this.inEventHandler = true;
        // If the removed interaction is the snap interaction, which should always be
        // the last interaction, remove the interaction preceding the snap interaction
        if (ev.element === this.snapInteraction) {
            ev.target.pop();
        }
        this.addSnapInteractionIfNeeded(ev.target);
        this.inEventHandler = false;
    };
    addSnapInteractionIfNeeded = (interactions) => {
        // Just to be sure
        interactions.remove(this.snapInteraction);
        // If there is any draw or modify interaction, add snapping interaction
        let added = false;
        if (this.props.mapObj.snapping.enabled) {
            for (let i = 0; i < interactions.getLength(); ++i) {
                const interaction = interactions.item(i);
                if ((interaction instanceof ol.interaction.Draw) || (interaction instanceof ol.interaction.Modify)) {
                    interactions.push(this.snapInteraction);
                    added = true;
                    break;
                }
            }
        }
        this.setState({drawing: added});
    };
    refreshFeatureCache = (force) => {
        if (!this.state.invalid && !force) {
            return;
        }
        this.source.clear();
        const themeLayer = this.props.layers.find(layer => layer.role === LayerRole.THEME);
        if (!this.props.theme || !themeLayer || !this.state.drawing) {
            return;
        }
        const snappingConfig = this.props.theme.snapping || {};
        // Gather snapping layers based on visibility scale ranges
        const scale = MapUtils.computeForZoom(this.props.mapObj.scales, this.props.mapObj.zoom);
        const snapLayers = (snappingConfig.snaplayers || []).reduce((res, cur) => {
            if (cur.min !== undefined && cur.min !== null && scale < cur.min) {
                // Below scale range
                return res;
            }
            if (cur.max !== undefined && cur.max !== null && scale >= cur.max) {
                // Above scale range
                return res;
            }
            return [...res, cur.name];
        }, []);
        // Gather local snap layers
        const snapToWfs = scale < snappingConfig.wfsMaxScale;
        const localLayers = [];
        this.props.layers.forEach(layer => {
            if (layer.role === LayerRole.USERLAYER && (layer.type === 'vector' || (layer.type === "wfs" && snapToWfs))) {
                const olLayer =  this.props.map.getLayers().getArray().find(l => l.get('id') === layer.id);
                if (olLayer && olLayer.getSource() && olLayer.getSource().getFeaturesInExtent) {
                    localLayers.push(olLayer);
                }
            }
        });
        this.setState({reqId: null, havesnaplayers: !isEmpty(snapLayers) || !isEmpty(localLayers)});
        if (!this.snapInteraction.getMap() || !this.snapInteraction.getActive()) {
            return;
        }
        if (snapLayers.length === 0) {
            this.addLocalSnapFeatures(localLayers);
            return;
        }
        const xmin = this.props.mapObj.bbox.bounds[0];
        const ymin = this.props.mapObj.bbox.bounds[1];
        const xmax = this.props.mapObj.bbox.bounds[2];
        const ymax = this.props.mapObj.bbox.bounds[3];
        const filterGeom = VectorLayerUtils.geoJSONGeomToWkt({
            type: 'Polygon',
            coordinates: [[
                [xmin, ymin],
                [xmax, ymin],
                [xmax, ymax],
                [xmin, ymax],
                [xmin, ymin]
            ]]
        });
        const options = {
            LAYERATTRIBS: JSON.stringify([]),
            with_htmlcontent: false,
            with_bbox: false,
            feature_count: snappingConfig.featureCount || 500
        };
        const request = IdentifyUtils.buildFilterRequest(themeLayer, snapLayers.join(","), filterGeom, this.props.mapObj, options);
        const reqId = uuidv1();
        this.setState({reqId: reqId});
        IdentifyUtils.sendRequest(request, (response) => {
            if (this.state.reqId !== reqId) {
                return;
            }
            if (response) {
                const result = IdentifyUtils.parseXmlResponse(response, this.props.mapObj.projection);
                const features = Object.values(result).reduce((res, cur) => [...res, ...cur], []);
                const format = new ol.format.GeoJSON();
                const olFeatures = format.readFeatures({
                    type: "FeatureCollection",
                    features: features.map(feature => ({...feature, id: uuidv1()}))
                });
                this.source.addFeatures(olFeatures);
                // Add features from local layers
                this.addLocalSnapFeatures(localLayers);
                this.setState({invalid: false, reqId: null, havesnaplayers: true});
            } else {
                this.setState({reqId: null});
            }
        });
    };
    addLocalSnapFeatures = (localLayers) => {
        const extent = this.props.mapObj.bbox.bounds;
        const projection = ol.proj.get(this.props.mapObj.projection);
        localLayers.forEach(olLayer => {
            const olFeatures = olLayer.getSource().getFeaturesInExtent(extent, projection);
            this.source.addFeatures(olFeatures);
        });
    };
}

export default connect((state) => ({
    layers: state.layers.flat,
    mapObj: state.map,
    task: state.task.id,
    theme: state.theme.current
}), {
    setSnappingConfig: setSnappingConfig
})(SnappingSupport);
