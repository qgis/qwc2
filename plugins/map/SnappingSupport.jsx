/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import ol from 'openlayers';
import uuid from 'uuid';
import {LayerRole} from '../../actions/layers';
import {setSnappingConfig} from '../../actions/map';
import Spinner from '../../components/Spinner';
import LocaleUtils from '../../utils/LocaleUtils';
import MapUtils from '../../utils/MapUtils';
import IdentifyUtils from '../../utils/IdentifyUtils';
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
    }
    state = {
        reqId: null, // FeatureInfo request ID
        invalid: true, // Whether the feature cache needs to be rebuilt
        havesnaplayers: false, // Whether there are any snaplayers
        active: true, // Whether the interaction is active
        drawing: false // WHether a drawing interaction is active
    }
    constructor(props) {
        super(props);
        this.source = new ol.source.Vector();
        this.snapInteraction = new SnapInteraction({source: this.source});
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
            const revChanged = this.props.layers.find(layer => {
                const prev = layer.role === LayerRole.THEME ? prevProps.layers.find(prevLayer => layer.uuid === prevLayer.uuid) : null;
                return prev && layer.rev !== prev.rev;
            });
            if (revChanged) {
                this.setState({invalid: true});
                // Delay to avoid refreshing the cache before QGIS Server can pick up the new feature
                setTimeout(() => { this.refreshFeatureCache(true); }, 1500);
            }
        }
        if (this.props.mapObj.snapping.active !== prevProps.mapObj.snapping.active) {
            this.snapInteraction.setActive(this.props.mapObj.snapping.active);
            if (this.props.mapObj.snapping.active) {
                this.refreshFeatureCache();
            }
        }
    }
    render() {
        if (!this.state.drawing) {
            return null;
        }
        const toolbarClass = !this.state.havesnaplayers ? "snapping-toolbar-inactive" : "";
        return (
            <div className="snapping-toolbar-container">
                <div className={toolbarClass}>
                    <label>
                        {this.state.reqId !== null ? (
                            <Spinner/>
                        ) : (
                            <input checked={this.props.mapObj.snapping.active} onChange={ev => this.props.setSnappingConfig(true, ev.target.checked)} type="checkbox" />
                        )}
                        &nbsp;
                        {this.state.reqId ? LocaleUtils.tr("snapping.loading") : LocaleUtils.tr("snapping.snappingenabled")}
                    </label>
                </div>
            </div>
        );
    }
    handleInteractionAdded = (ev) => {
        if (this.inEventHandler) {
            return;
        }
        this.inEventHandler = true;
        this.addSnapInteractionIfNeeded(ev.target);
        this.inEventHandler = false;
    }
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
    }
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
                    this.refreshFeatureCache();
                    added = true;
                    break;
                }
            }
        }
        this.setState({drawing: added});
    }
    refreshFeatureCache = (force) => {
        if (!this.state.invalid && !force) {
            return;
        }
        const themeLayer = this.props.layers.find(layer => layer.role === LayerRole.THEME);
        if (!this.props.theme || !themeLayer) {
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
        this.setState({reqId: null, havesnaplayers: !isEmpty(snapLayers)});
        if (snapLayers.length === 0) {
            return;
        }
        if (!this.snapInteraction.getMap() || !this.snapInteraction.getActive()) {
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
        const reqId = uuid.v1();
        this.setState({reqId: reqId});
        axios.get(request.url, {params: request.params}).then((response) => {
            if (this.state.reqId !== reqId) {
                return;
            }
            const result = IdentifyUtils.parseXmlResponse(response.data, this.props.mapObj.projection);
            const features = Object.values(result).reduce((res, cur) => [...res, ...cur], []);
            this.source.clear();
            const format = new ol.format.GeoJSON();
            const olFeatures = format.readFeatures({
                type: "FeatureCollection",
                features: features
            });
            this.source.addFeatures(olFeatures);
            this.setState({invalid: false, reqId: null, havesnaplayers: true});
        }).catch(e => {
            if (this.state.reqId === reqId) {
                this.setState({reqId: null});
            }
            console.log(e);
        });
    }
}

export default connect((state) => ({
    layers: state.layers.flat,
    mapObj: state.map,
    task: state.task.id,
    theme: state.theme.current
}), {
    setSnappingConfig: setSnappingConfig
})(SnappingSupport);
