/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole} from '../actions/layers';
import {zoomToExtent} from '../actions/map';
import OlLayer from '../components/map/OlLayer';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/OverviewMap.css';

/**
 * Overview map support for the map component.
 *
 * Additionally to the standard OpenLayers OverviewMap behaviour, you can shift+select a target map extent in the OverviewMap.
 */
class OverviewMap extends React.Component {
    static propTypes = {
        backgroundLayer: PropTypes.object,
        center: PropTypes.array,
        defaultWMSVersion: PropTypes.object,
        /** A fixed center / scale (denominator) for the overview map. */
        fixedView: PropTypes.shape({
            /** The center of the fixed overview map. */
            center: PropTypes.array,
            /** The scale of the fixed overview map. */
            scale: PropTypes.number
        }),
        /** The height of the overview map, in pixels.  */
        height: PropTypes.number,
        /** See [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_control_OverviewMap-OverviewMap.html) for general options.
         *  Additionally, you can specify:
         *  - `layer`: Custom overview layer, in the same form as background layer definitions (`{type: "<wms|wmts>", "url": ...}`).
         *  - `viewOptions`: Options for the OverviewMap View, see [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_View.html).
         */
        options: PropTypes.object,
        projection: PropTypes.string,
        resolutions: PropTypes.array,
        viewConfigHash: PropTypes.number,
        /** The width of the overview map, in pixels.  */
        width: PropTypes.number,
        zoom: PropTypes.number,
        zoomToExtent: PropTypes.func
    };
    static defaultProps = {
        options: {},
        width: 200,
        height: 200
    };
    state = {
        overviewView: null,
        overviewLayer: null
    };
    componentWillUnmount = () => {
        if (this.overview) {
            MapUtils.getHook(MapUtils.GET_MAP)?.removeControl?.(this.overview);
        }
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.props.backgroundLayer !== prevProps.backgroundLayer && !this.props.options.layer) {
            this.setState({overviewLayer: this.props.backgroundLayer});
        }
    }
    initOverviewMap = (el) => {
        if (el) {
            let center = this.props.center;
            let resolutions = this.props.resolutions;
            let zoom = this.props.zoom * 0.8;
            let extent = undefined;
            if (this.props.fixedView) {
                center = this.props.fixedView.center;
                resolutions = MapUtils.getResolutionsForScales([this.props.fixedView.scale], this.props.projection);
                extent = [
                    center[0] - this.props.width * resolutions[0] * 0.5,
                    center[1] - this.props.height * resolutions[0] * 0.5,
                    center[0] + this.props.width * resolutions[0] * 0.5,
                    center[1] + this.props.height * resolutions[0] * 0.5
                ];
                zoom = 0;
            }
            const {layer, viewOptions, ...mapOptions} = this.props.options;
            const overviewView = new ol.View({
                projection: this.props.projection,
                resolutions: resolutions,
                center: center,
                extent: extent,
                zoom: zoom,
                ...viewOptions
            });
            this.overview = new ol.control.OverviewMap({
                view: overviewView,
                className: "overview-map",
                collapseLabel: '\u00BB',
                label: '\u00AB',
                collapsed: true,
                collapsible: true,
                ...mapOptions
            });
            this.overview.setTarget(el);
            MapUtils.getHook(MapUtils.GET_MAP).addControl(this.overview);
            const mapEl = el.querySelector('div.ol-overviewmap-map');
            if (mapEl) {
                mapEl.style.width = `${this.props.width}px`;
                mapEl.style.height = `${this.props.height}px`;
                mapEl.addEventListener('pointerdown', this.startOverviewDragbox);
            }

            let overviewLayer = null;
            if (layer) {
                overviewLayer = {
                    ...layer,
                    visibility: true,
                    id: uuidv4()
                };
                if (overviewLayer.type === 'wms') {
                    overviewLayer.version = overviewLayer.params.VERSION || overviewLayer.version || this.props.defaultWMSVersion;
                }
            } else {
                overviewLayer = this.props.backgroundLayer;
            }
            this.setState({overviewLayer: overviewLayer, overviewView: overviewView});
        } else if (this.overview) {
            this.setState({overviewLayer: null, overviewView: null});
            MapUtils.getHook(MapUtils.GET_MAP)?.removeControl?.(this.overview);
            this.overview = null;
        }
    };
    render() {
        return (
            <div key={this.props.viewConfigHash} ref={this.initOverviewMap}>
                {this.state.overviewLayer && this.state.overviewView ? (
                    <OlLayer key={this.state.overviewLayer.id} map={this.overview.getOverviewMap()} options={this.state.overviewLayer} projection={this.props.projection} />
                ) : null}
            </div>
        );
    }
    startOverviewDragbox = (ev) => {
        if (!ev.shiftKey) {
            return;
        }
        const target = ev.currentTarget;
        const bbox = target.getBoundingClientRect();
        const dragbox = {
            x1: ev.clientX - bbox.x, y1: ev.clientY - bbox.y,
            x2: ev.clientX - bbox.x, y2: ev.clientY - bbox.y
        };
        const selbox = ev.view.document.createElement('div');
        selbox.className = 'overviewmap-selbox';
        selbox.style.left = `${dragbox.x1}px`;
        selbox.style.top = `${dragbox.y1}px`;
        selbox.style.width = "0px";
        selbox.style.height = "0px";
        const extentbox = target.querySelector('div.ol-overviewmap-box');
        let moved = false;
        const resizeDragbox = (ev2) => {
            if (!moved) {
                moved = true;
                target.appendChild(selbox);
                extentbox.style.display = 'none';
            }
            dragbox.x2 = Math.max(0, Math.min(ev2.clientX - bbox.x, bbox.width));
            dragbox.y2 = Math.max(0, Math.min(ev2.clientY - bbox.y, bbox.height));
            selbox.style.left = `${Math.min(dragbox.x1, dragbox.x2)}px`;
            selbox.style.top = `${Math.min(dragbox.y1, dragbox.y2)}px`;
            selbox.style.width = `${Math.abs(dragbox.x1 - dragbox.x2)}px`;
            selbox.style.height = `${Math.abs(dragbox.y1 - dragbox.y2)}px`;
            MiscUtils.killEvent(ev2);
        };
        ev.view.addEventListener("pointermove", resizeDragbox);
        ev.view.addEventListener("pointerup", () => {
            if (!moved) {
                return;
            }
            ev.view.removeEventListener("pointermove", resizeDragbox);
            selbox.remove();
            extentbox.style.display = '';

            const p1 = this.overview.getOverviewMap().getCoordinateFromPixel([dragbox.x1, dragbox.y1]);
            const p2 = this.overview.getOverviewMap().getCoordinateFromPixel([dragbox.x2, dragbox.y2]);
            const extent = [
                Math.min(p1[0], p2[0]),
                Math.min(p1[1], p2[1]),
                Math.max(p1[0], p2[0]),
                Math.max(p1[1], p2[1])
            ];
            this.props.zoomToExtent(extent, this.props.projection);
        }, {once: true});
    };
}

export default connect((state) => {
    const ovName = (state.theme.current?.backgroundLayers || []).find(entry => entry.overview)?.name;
    const bgLayers = state.layers.flat.filter(
        l => l.role === LayerRole.BACKGROUND && l.type !== "placeholder"
    );
    const backgroundLayer = ovName ? bgLayers.find(l => l.name === ovName) : bgLayers.find(l => l.visibility);
    // Note: the overview map needs to be recreated if projection / resolutions change. So compute a hash of that state
    const viewConfig = {projection: state.map.projection, resolutions: state.map.resolutions};
    const viewConfigHash = JSON.stringify(viewConfig).split('').reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0);
    return {
        defaultWMSVersion: state.theme.themes?.defaultWMSVersion ?? "1.3.0",
        backgroundLayer: backgroundLayer,
        projection: state.map.projection,
        resolutions: state.map.resolutions,
        center: state.map.center,
        zoom: state.map.zoom,
        viewConfigHash
    };
}, {
    zoomToExtent: zoomToExtent
})(OverviewMap);
