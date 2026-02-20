/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import isEqual from 'lodash.isequal';
import ol from 'openlayers';
import PropTypes from 'prop-types';

import {setViewMode, ViewMode} from '../actions/display';
import {zoomToExtent} from '../actions/map';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import OlLayer from '../components/map/OlLayer';
import OverviewMapButton from '../components/OverviewMapButton';
import ResizeableWindow from '../components/ResizeableWindow';
import InputContainer from '../components/widgets/InputContainer';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/ObliqueView.css';


/**
 * Display oblique satellite imagery.
 *
 * See [Oblique View](../../topics/ObliqueView).
 */
class ObliqueView extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        /** The initial map scale. */
        initialScale: PropTypes.number,
        map: PropTypes.object,
        projection: PropTypes.string,
        /** A list of allowed map scales, in decreasing order. */
        scales: PropTypes.arrayOf(PropTypes.number),
        setCurrentTask: PropTypes.func,
        setViewMode: PropTypes.func,
        startupParams: PropTypes.object,
        theme: PropTypes.object,
        themes: PropTypes.object,
        viewMode: PropTypes.number,
        zoomToExtent: PropTypes.func
    };
    static defaultProps = {
        geometry: {
            initialWidth: 480,
            initialHeight: 640,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true,
            side: 'left'
        },
        initialScale: 1000,
        scales: [20000, 10000, 5000, 2500, 1000, 500, 250]
    };
    static defaultState = {
        selectedDataset: null,
        datasetConfig: null,
        currentDirection: null,
        currentZoom: 0,
        currentCenter: null,
        viewsLocked: false
    };
    constructor(props) {
        super(props);
        const controls = ol.control.defaults({
            zoom: false,
            attribution: false,
            rotate: false
        });
        const interactions = ol.interaction.defaults({
            onFocusOnly: false
        });
        this.map = new ol.Map({controls, interactions});
        this.map.on('rotateend', this.searchClosestImage);
        this.map.on('moveend', () => {
            this.searchClosestImage();
            this.setState(state => {
                const newZoom = this.map.getView().getZoom();
                const newCenter = this.map.getView().getCenter();
                if (newZoom !== state.currentZoom || !isEqual(newCenter, state.currentCenter)) {
                    return {currentZoom: newZoom, currentCenter: newCenter};
                }
                return null;
            });
        });
        this.obliqueImageryLayer = new ol.layer.Tile();
        this.map.addLayer(this.obliqueImageryLayer);
        this.closestImage = null;
        this.state = ObliqueView.defaultState;
        this.focusedMap = null;
    }
    componentDidMount() {
        window.addEventListener('focus', this.trackFocus, true);
        if (this.props.startupParams.v === "oblique") {
            this.props.setViewMode(ViewMode._Oblique);
        }
    }
    componentWillUnmount() {
        window.removeEventListener('focus', this.trackFocus);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.active && !prevProps.active) {
            this.props.setViewMode(ViewMode._Oblique);
            this.props.setCurrentTask(null);
        }
        // Honour theme startupView on theme change unless first loaded theme and startupParams.v is set
        if (this.props.theme !== prevProps.theme && this.props.theme.startupView === "oblique" && (prevProps.theme !== null || !this.props.startupParams.v)) {
            this.props.setViewMode(ViewMode._Oblique);
        }
        if (
            this.props.viewMode === ViewMode._Oblique && this.props.theme &&
            (this.props.theme !== prevProps.theme || prevProps.viewMode !== ViewMode._Oblique)
        ) {
            const datasets = this.props.theme.obliqueDatasets || [];
            const defaultDataset = datasets.find(entry => entry.default)?.dataset ?? datasets[0]?.dataset;
            this.setState({selectedDataset: defaultDataset, datasetConfig: null, currentDirection: null});
        }
        if (this.state.selectedDataset !== prevState.selectedDataset) {
            this.queryDatasetConfig();
        }
        if (this.state.datasetConfig && this.state.datasetConfig !== prevState.datasetConfig) {
            this.setupLayer();
        }
        if (this.state.datasetConfig && this.state.currentDirection !== prevState.currentDirection) {
            this.obliqueImageryLayer?.getSource?.()?.refresh?.();
            this.map.getView()?.setRotation?.(this.getRotation() / 180 * Math.PI);
        }
        if (this.state.datasetConfig && this.state.currentZoom !== prevState.currentZoom) {
            this.map.getView()?.setZoom?.(this.state.currentZoom);
        }
        if (this.state.viewsLocked && this.state.datasetConfig) {
            if (this.focusedMap === "map" && this.props.map.bbox !== prevProps.map.bbox) {
                this.sync2DExtent();
            } else if (this.focusedMap === "mapOblique" && (this.state.currentCenter !== prevState.currentCenter || this.state.currentZoom !== prevState.currentZoom)) {
                this.props.zoomToExtent(this.map.getView().calculateExtent(), this.state.datasetConfig.crs);
            }
        }
    }
    onClose = () => {
        this.props.setViewMode(ViewMode._2D);
        this.setState(ObliqueView.defaultState);
    };
    render() {
        if (this.props.viewMode !== ViewMode._Oblique || !this.props.themes) {
            return null;
        }
        const rot = this.getRotation();
        const extraControls = [{
            icon: "sync",
            callback: this.sync2DExtent,
            title: LocaleUtils.tr("common.sync2dview")
        }, {
            icon: "lock",
            callback: () => this.setState(state => ({viewsLocked: !state.viewsLocked})),
            title: LocaleUtils.tr("common.lock2dview"),
            active: this.state.viewsLocked
        }];
        const obliqueConfig = this.props.theme?.obliqueDatasets?.find?.(entry => entry.dataset === this.state.selectedDataset);
        const basemap = this.props.themes?.backgroundLayers?.find?.(entry => entry.name === obliqueConfig?.backgroundLayer);
        return (
            <ResizeableWindow dockable={this.props.geometry.side} extraControls={extraControls} icon="oblique"
                initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={this.onClose} splitScreenWhenDocked splitTopAndBottomBar title={LocaleUtils.tr("obliqueview.title")}
            >
                <div className="obliqueview-body">
                    <div className="obliqueview-map" ref={el => this.map.setTarget(el)} tabIndex={0} />
                    {!this.state.selectedDataset && (
                        <div className="obliqueview-empty-overlay">
                            {LocaleUtils.tr("obliqueview.nodataset")}
                        </div>
                    )}
                    <div className="obliqueview-nav-rotate" style={{transform: `rotate(${rot}deg)`}}>
                        <span />
                        <span className="obliqueview-nav-dir" onClick={() => this.setState({currentDirection: "n"})} onKeyDown={MiscUtils.checkKeyActivate} style={{transform: `rotate(${-rot}deg)`}} tabIndex={0}>N</span>
                        <span />
                        <span className="obliqueview-nav-dir" onClick={() => this.setState({currentDirection: "w"})} onKeyDown={MiscUtils.checkKeyActivate} style={{transform: `rotate(${-rot}deg)`}} tabIndex={0}>W</span>
                        <span />
                        <span className="obliqueview-nav-dir" onClick={() => this.setState({currentDirection: "e"})} onKeyDown={MiscUtils.checkKeyActivate} style={{transform: `rotate(${-rot}deg)`}} tabIndex={0}>E</span>
                        <span />
                        <span className="obliqueview-nav-dir" onClick={() => this.setState({currentDirection: "s"})} onKeyDown={MiscUtils.checkKeyActivate} style={{transform: `rotate(${-rot}deg)`}} tabIndex={0}>S</span>
                        <span />
                        <div className="obliqueview-nav-circle" />
                    </div>
                    <div className="obliqueview-nav-zoom">
                        <Icon icon="plus" onClick={() => this.changeZoom(+1)} />
                        <Icon icon="minus" onClick={() => this.changeZoom(-1)} />
                    </div>
                    {basemap && this.state.datasetConfig ? (
                        <OlLayer map={this.map} options={{...basemap, opacity: obliqueConfig.backgroundOpacity ?? 127}} projection={this.state.datasetConfig.crs} zIndex={-1} />
                    ) : null}
                    <div className="obliqueview-bottombar">
                        <select onChange={ev => this.setState({selectedDataset: ev.target.value})} value={this.state.selectedDataset ?? ""}>
                            {(this.props.theme?.obliqueDatasets || []).map(entry => (
                                <option key={entry.dataset} value={entry.dataset}>{LocaleUtils.trWithFallback(entry.titleMsgId, entry.title ?? entry.dataset)}</option>
                            ))}
                        </select>
                        <span className="obliqueview-bottombar-spacer" />
                        {this.renderScaleChooser()}
                        <span className="obliqueview-bottombar-spacer" />
                        {basemap && this.state.datasetConfig ? (
                            <OverviewMapButton
                                center={this.state.currentCenter} coneRotation={-this.getRotation() / 180 * Math.PI}
                                layer={basemap} projection={this.state.datasetConfig.crs}
                                resolution={MapUtils.computeForZoom(this.state.datasetConfig.resolutions, this.state.currentZoom) * 0.25}
                            />
                        ) : null}
                    </div>
                </div>
            </ResizeableWindow>
        );
    }
    renderScaleChooser = () => {
        return (
            <div className="obliqueview-scalechooser">
                <span>{LocaleUtils.tr("bottombar.scale_label")}:&nbsp;</span>
                <InputContainer>
                    <span role="prefix"> 1 : </span>
                    <select onChange={ev => this.setState({currentZoom: parseInt(ev.target.value, 10)})} role="input" value={this.state.currentZoom}>
                        {this.props.scales.map((item, index) =>
                            (<option key={index} value={index}>{LocaleUtils.toLocaleFixed(item, 0)}</option>)
                        )}
                    </select>
                </InputContainer>
            </div>
        );
    };
    changeZoom = (delta) => {
        this.setState(state => ({currentZoom: Math.max(0, Math.min(state.currentZoom + delta, this.props.scales.length - 1))}));
    };
    queryDatasetConfig = () => {
        const obliqueImageryServiceUrl = ConfigUtils.getConfigProp('obliqueImageryServiceUrl');
        if (this.state.selectedDataset && obliqueImageryServiceUrl) {
            const reqUrl = obliqueImageryServiceUrl.replace(/\/$/, '') + `/${this.state.selectedDataset}/config`;
            axios.get(reqUrl).then(response => {
                const datasetConfig = response.data;
                const direction = 'n' in datasetConfig.image_centers ? 'n' : Object.keys(datasetConfig.image_centers)[0];
                this.setState({datasetConfig: datasetConfig, currentDirection: direction});
            }).catch(() => {
                /* eslint-disable-next-line */
                console.warn("Failed to load dataset config");
            });
        } else {
            this.obliqueImageryLayer.setSource(null);
            this.closestImage = null;
        }
    };
    setupLayer = () => {
        const datasetConfig = this.state.datasetConfig;

        const projection = new ol.proj.Projection({
            code: datasetConfig.crs,
            extent: datasetConfig.extent,
            units: "m"
        });
        const targetScale = this.props.initialScale;
        const zoom = this.props.scales.reduce((best, v, i) =>
            Math.abs(v - targetScale) < Math.abs(this.props.scales[best] - targetScale) ? i : best, 0
        );
        this.map.setView(new ol.View({
            projection: projection,
            center: ol.extent.getCenter(datasetConfig.extent),
            rotation: this.getRotation() / 180 * Math.PI,
            zoom: zoom,
            resolutions: MapUtils.getResolutionsForScales(this.props.scales, datasetConfig.crs),
            constrainResolution: true
            // showFullExtent: true
        }));
        this.setState({currentZoom: zoom});
        this.obliqueImageryLayer.setSource(new ol.source.XYZ({
            projection: projection,
            tileGrid: new ol.tilegrid.TileGrid({
                extent: datasetConfig.extent,
                resolutions: datasetConfig.resolutions,
                tileSize: datasetConfig.tileSize,
                origin: datasetConfig.origin
            }),
            url: datasetConfig.url,
            crossOrigin: "anonymous",
            tileLoadFunction: (tile, src) => {
                if ((this.closestImage ?? null) !== null) {
                    src += "?img=" + this.closestImage;
                }
                tile.getImage().src = src.replace('{direction}', this.state.currentDirection);
            }
        }));
        this.searchClosestImage();
    };
    searchClosestImage = () => {
        let best = null;
        const imageCenters = this.state.datasetConfig?.image_centers?.[this.state.currentDirection];
        if (imageCenters) {
            const center = this.map.getView().getCenter();
            const dsqr = (p, q) => (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]);
            best = 0;
            let bestDist = dsqr(center, imageCenters[0]);
            for (let i = 1; i < imageCenters.length; ++i) {
                const dist = dsqr(center, imageCenters[i]);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = i;
                }
            }
        }
        if (best !== this.closestImage) {
            if (this.obliqueImageryLayer) {
                this.obliqueImageryLayer.getSource().refresh();
            }
            this.closestImage = best;
        }
    };
    getRotation = () => {
        return {n: 0, w: 90, e: -90, s: 180}[this.state.currentDirection];
    };
    sync2DExtent = () => {
        if (!this.state.datasetConfig) {
            return;
        }
        this.setState(state => {
            const center = CoordinatesUtils.reproject(this.props.map.center, this.props.map.projection, state.datasetConfig.crs);
            const resolution = MapUtils.computeForZoom(this.props.map.resolutions, this.props.map.zoom);
            this.map.getView().setCenter(center);
            this.map.getView().setResolution(resolution);
            return {currentCenter: center, currentZoom: this.map.getView().getZoom()};
        });
    };
    trackFocus = (ev) => {
        const mapEl = document.getElementById("map");
        const mapObliqueEl = this.map?.getTargetElement?.();
        if (mapEl?.contains?.(document.activeElement)) {
            this.focusedMap = "map";
        } else if (mapObliqueEl?.contains?.(document.activeElement)) {
            this.focusedMap = "mapOblique";
        } else {
            this.focusedMap = null;
        }
    };
}


export default connect((state) => ({
    active: state.task.id === "ObliqueView",
    map: state.map,
    startupParams: state.localConfig.startupParams,
    viewMode: state.display.viewMode,
    theme: state.theme.current,
    themes: state.theme.themes
}), {
    setCurrentTask: setCurrentTask,
    setViewMode: setViewMode,
    zoomToExtent: zoomToExtent
})(ObliqueView);
