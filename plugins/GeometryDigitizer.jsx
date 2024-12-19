/**
* Copyright 2020, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

import React from 'react';
import {connect} from 'react-redux';

import polySelfIntersections from 'geojson-polygon-self-intersections';
import isEmpty from 'lodash.isempty';
import Mousetrap from 'mousetrap';
import PropTypes from 'prop-types';

import {LayerRole, addLayer, removeLayer, addLayerFeatures, removeLayerFeatures, clearLayer} from '../actions/layers';
import {changeRedliningState} from '../actions/redlining';
import PickFeature from '../components/PickFeature';
import ResizeableWindow from '../components/ResizeableWindow';
import TaskBar from '../components/TaskBar';
import ButtonBar from '../components/widgets/ButtonBar';
import InputContainer from '../components/widgets/InputContainer';
import NumberInput from '../components/widgets/NumberInput';
import Spinner from '../components/widgets/Spinner';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/GeometryDigitizer.css';
import './style/Redlining.css';


/**
 * Allows digitizing geometries to send to configured applications.
 */
class GeometryDigitizer extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        changeRedliningState: PropTypes.func,
        clearLayer: PropTypes.func,
        layers: PropTypes.array,
        map: PropTypes.object,
        mobile: PropTypes.bool,
        projection: PropTypes.string,
        redlining: PropTypes.object,
        removeLayer: PropTypes.func,
        removeLayerFeatures: PropTypes.func,
        setCurrentTask: PropTypes.func,
        /** The style of active geometries (i.e. supported by the selected application) */
        styleActive: PropTypes.shape({
            /* Stroke color rgba array, i.e. [255, 0, 0, 0.5] */
            strokeColor: PropTypes.array,
            /* Stroke width */
            strokeWidth: PropTypes.number,
            /* Stroke dash/gap pattern array. Empty for solid line. */
            strokeDash: PropTypes.array,
            /* Fill color rgba array, i.e. [255, 0, 0, 0.33] */
            fillColor: PropTypes.array
        }),
        /** The style of inactive (i.e. not supported by the selected application) */
        styleInactive: PropTypes.shape({
            /* Stroke color rgba array, i.e. [255, 0, 0, 0.5] */
            strokeColor: PropTypes.array,
            /* Stroke width */
            strokeWidth: PropTypes.number,
            /* Stroke dash/gap pattern array. Empty for solid line. */
            strokeDash: PropTypes.array,
            /* Fill color rgba array, i.e. [255, 0, 0, 0.33] */
            fillColor: PropTypes.array
        }),
        theme: PropTypes.object,
        themes: PropTypes.object
    };
    state = {
        bufferDistance: 0,
        geomLink: "",
        outputWindowVisible: false,
        outputLoaded: false,
        outputWindowTitle: "",
        outputWindowSize: null,
        pickGeomType: null
    };
    constructor(props) {
        super(props);
        this.prevstyle = null;
        const defaultStyle = {...ConfigUtils.getConfigProp("defaultFeatureStyle"), strokeDash: []};
        this.styleActive = {...defaultStyle, ...props.styleActive};
        this.styleInactive = {...defaultStyle, ...props.styleInactive};
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevProps.redlining.layer === "__geomdigitizer") {
            // Refresh buffer when layer features changed
            const newLayer = this.props.layers.find(layer => layer.id === "__geomdigitizer");
            const oldLayer = prevProps.layers.find(layer => layer.id === "__geomdigitizer");
            if (newLayer && newLayer.features !== (oldLayer ? oldLayer.features : [])) {
                this.computeBuffer(this.state.bufferDistance);
            }
            if (this.props.redlining.selectedFeature && this.props.redlining.selectedFeature !== prevProps.redlining.selectedFeature) {
                this.updateFeatureBuffer(this.props.redlining.selectedFeature);
            }
        }
        if (this.state.geomLink !== prevState.geomLink) {
            // Commit when changing application and set style so that feature is commited with correct style
            const geomLinkData = this.geometryLinkData(this.state.geomLink);
            const supportedGeomType = this.state.geomLink ? (geomLinkData.geomType || ["Point", "LineString", "Polygon"]) : [];
            const featureStyle = supportedGeomType.includes(this.props.redlining.geomType) && this.state.bufferDistance === 0 ? this.styleActive : this.styleInactive;
            const style = {
                borderColor: featureStyle.strokeColor,
                size: featureStyle.strokeWidth,
                fillColor: featureStyle.fillColor
            };
            this.updateRedliningState({action: "Commit", style: style});
            // Update feature styles according to permissible geometry types
            ["__geomdigitizer", "__geomdigitizerbuffer"].forEach(layerId => {
                const layer = this.props.layers.find(l => l.id === layerId);
                if (layer && layer.features) {
                    const newFeatures = layer.features.map(feature => {
                        let newFeature = feature;
                        if (this.props.redlining.selectedFeature && this.props.redlining.selectedFeature.id === feature.id) {
                            newFeature = this.props.redlining.selectedFeature;
                        }
                        return {
                            ...newFeature,
                            styleOptions: this.featureStyleOptions(feature.geometry.type, layerId, this.state.bufferDistance !== 0)
                        };
                    });
                    this.props.addLayerFeatures(layer, newFeatures, true);
                }
            });
        }
        if ((this.state.bufferDistance !== 0) !== (prevState.bufferDistance !== 0)) {
            // Mark base geometries as inactive or active depending on whether buffering is active
            const layer = this.props.layers.find(l => l.id === "__geomdigitizer");
            if (layer && layer.features) {
                const newFeatures = layer.features.map(feature => {
                    return {
                        ...feature,
                        styleOptions: this.featureStyleOptions(feature.geometry.type, "__geomdigitizer", this.state.bufferDistance !== 0)
                    };
                });
                this.props.addLayerFeatures(layer, newFeatures, true);
            }
        }
    }
    renderOutputWindow = () => {
        if (!this.state.outputWindowTitle) {
            return null;
        }
        const controls = [{
            icon: 'print',
            callback: () => {
                window.frames['geomdigitizer-output-window'].focus();
                window.frames['geomdigitizer-output-window'].print();
            }
        }];
        return (
            <ResizeableWindow dockable={false} extraControls={controls}
                initialHeight={this.state.outputWindowSize.h > 0 ? this.state.outputWindowSize.h : 0.75 * window.innerHeight}
                initialWidth={this.state.outputWindowSize.w > 0 ? this.state.outputWindowSize.w : 320}
                initialX={0} initialY={0}
                key="OutputWindow" onClose={() => this.setState({outputWindowVisible: false, outputLoaded: false})}
                title={this.state.outputWindowTitle} visible={this.state.outputWindowVisible}
            >
                <div className="geomdigitizer-output-window-body" role="body">
                    {!this.state.outputLoaded ? (
                        <span className="geomdigitizer-output-window-wait">
                            <Spinner /> <span>{LocaleUtils.tr("geomdigitizer.wait")}</span>
                        </span>
                    ) : null}
                    <iframe name="geomdigitizer-output-window" onLoad={() => this.setState({outputLoaded: true})}/>
                </div>
            </ResizeableWindow>
        );
    };
    onShow = (mode) => {
        this.prevstyle = this.props.redlining.style;
        let layer = this.props.layers.find(l => l.id === "__geomdigitizer");
        if (!layer) {
            layer = {
                id: "__geomdigitizer",
                title: LocaleUtils.tr("geomdigitizer.layername"),
                role: LayerRole.USERLAYER,
                type: 'vector',
                readonly: true
            };
            this.props.addLayer(layer);
        }
        this.props.changeRedliningState({action: mode || 'Pick', geomType: null, layer: '__geomdigitizer', layerTitle: 'Geometry digitizer'});
        Mousetrap.bind('del', this.triggerDelete);
    };
    onHide = () => {
        this.setState({geomLink: "", outputWindowVisible: false, outputLoaded: false, outputWindowSize: null, outputWindowTitle: "", pickGeomType: null});
        this.props.changeRedliningState({action: null, geomType: null, layer: null, layerTitle: null, style: this.prevstyle || this.props.redlining.style});
        this.prevstyle = null;
        Mousetrap.unbind('del', this.triggerDelete);
    };
    updateRedliningState = (diff) => {
        const newState = {...this.props.redlining, ...diff};
        this.props.changeRedliningState(newState);
    };
    renderBody = () => {
        const geomLinkData = this.geometryLinkData(this.state.geomLink);
        let activeButton = null;
        if (this.state.pickGeomType) {
            activeButton = "Select" + this.state.pickGeomType;
        } else {
            activeButton = this.props.redlining.action === "Draw" ? this.props.redlining.geomType : this.props.redlining.action;
        }
        const supportedGeomType = geomLinkData.geomType || ["Point", "LineString", "Polygon"];
        const drawButtons = [
            (supportedGeomType.includes("Polygon") && !supportedGeomType.includes("Point")) ?
                {key: "Point", tooltip: LocaleUtils.tr("geomdigitizer.point_buffer"), icon: "point_buffer", data: {action: "Draw", geomType: "Point", text: ""}} :
                {key: "Point", tooltip: LocaleUtils.tr("redlining.point"), icon: "point", data: {action: "Draw", geomType: "Point", text: ""}, disabled: !supportedGeomType.includes("Point")},
            (supportedGeomType.includes("Polygon") && !supportedGeomType.includes("LineString")) ?
                {key: "LineString", tooltip: LocaleUtils.tr("geomdigitizer.line_buffer"), icon: "line_buffer", data: {action: "Draw", geomType: "LineString", text: ""}} :
                {key: "LineString", tooltip: LocaleUtils.tr("redlining.line"), icon: "line", data: {action: "Draw", geomType: "LineString", text: ""}, disabled: !supportedGeomType.includes("LineString")},
            {key: "Polygon", tooltip: LocaleUtils.tr("redlining.polygon"), icon: "polygon", data: {action: "Draw", geomType: "Polygon", text: ""}, disabled: !supportedGeomType.includes("Polygon")}
        ];
        const editButtons = [
            {key: "Pick", tooltip: LocaleUtils.tr("redlining.pick"), icon: "pick", data: {action: "Pick", geomType: null, text: ""}},
            {key: "Delete", tooltip: LocaleUtils.tr("redlining.delete"), icon: "trash", data: {action: "Delete", geomType: null}, disabled: !this.props.redlining.selectedFeature},
            {key: "Clear", tooltip: LocaleUtils.tr("geomdigitizer.clear"), icon: "clear", data: {action: "Clear"}}
        ];
        const pickButtons = [
            {key: "SelectPoint", tooltip: LocaleUtils.tr("geomdigitizer.identifypick"), icon: "pick_point", data: {action: "SelectPoint", geomType: "Point"}},
            {key: "SelectPolygon", tooltip: LocaleUtils.tr("geomdigitizer.identifypickregion"), icon: "pick_region", data: {action: "SelectPolygon", geomType: "Polygon"}}
        ];

        const featureLayer = this.state.bufferDistance ? "__geomdigitizerbuffer" : "__geomdigitizer";
        const haveFeatures = !isEmpty(((this.props.layers.find(layer => layer.id === featureLayer) || {}).features || []).filter(feature => supportedGeomType.includes(feature.geometry.type.replace(/^Multi/, ''))));
        const target = typeof geomLinkData.target === "object" && geomLinkData.target.iframedialog ? "geomdigitizer-output-window" : (geomLinkData.target || "_blank");

        return (
            <div>
                <div className="redlining-buttongroups">
                    <div className="redlining-group">
                        <div>{LocaleUtils.tr("redlining.draw")}</div>
                        <ButtonBar active={activeButton} buttons={drawButtons} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                    <div className="redlining-group">
                        <div>{LocaleUtils.tr("redlining.edit")}</div>
                        <ButtonBar active={activeButton} buttons={editButtons} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                    <div className="redlining-group">
                        <div>{LocaleUtils.tr("redlining.pick")}</div>
                        <ButtonBar active={activeButton} buttons={pickButtons} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                    <div className="redlining-group">
                        <div>{LocaleUtils.tr("redlining.buffer")}</div>
                        <div>
                            <InputContainer>
                                <NumberInput max={99999} min={-99999} mobile onChange={this.computeBuffer}
                                    precision={0} role="input" step={1} value={this.state.bufferDistance}
                                />
                                <span role="suffix">m</span>
                            </InputContainer>
                        </div>
                    </div>
                    <div className="redlining-group">
                        <div>{LocaleUtils.tr("geomdigitizer.applink")}</div>
                        <div className="geometry-digitizer-applink">
                            <select onChange={ev => this.setState({geomLink: ev.target.value})} value={this.state.geomLink}>
                                <option value="">{LocaleUtils.tr("geomdigitizer.chooselink")}</option>
                                {(!this.props.theme.pluginData || !this.props.theme.pluginData.geometryLinks) ? null : this.props.theme.pluginData.geometryLinks.map(entry => (
                                    <option key={entry} value={entry}>{this.geometryLinkData(entry).title}</option>
                                ))}
                            </select>
                            <form action={geomLinkData.url} method="post" onSubmit={this.submitGeometryLink} target={target}>
                                <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
                                <input name="GEOMETRIES" type="hidden" />
                                <input name="GEOMCOUNT" type="hidden" />
                                <input name="BUFFERDIST" type="hidden" />
                                {Object.entries(geomLinkData.params || {}).map(([key, value]) => (
                                    <input key={key} name={key} type="hidden" value={value} />
                                ))}
                                <button disabled={!geomLinkData.url || !haveFeatures} type="submit">{LocaleUtils.tr("geomdigitizer.send")}</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    render() {
        return [
            (
                <TaskBar key="GeometryDigitizer" onHide={this.onHide} onShow={this.onShow} task="GeometryDigitizer">
                    {() => ({
                        body: this.renderBody()
                    })}
                </TaskBar>
            ),
            this.renderOutputWindow(),
            this.state.pickGeomType ? (
                <PickFeature featurePicked={this.selectFeature} key="FeaturePicker" pickGeomType={this.state.pickGeomType} />
            ) : null
        ];
    }
    triggerDelete = () => {
        this.updateRedliningState({action: "Delete", geomType: null});
        if (this.props.redlining.selectedFeature) {
            this.props.removeLayerFeatures("__geomdigitizerbuffer", [this.props.redlining.selectedFeature.id]);
        }
    };
    actionChanged = (data) => {
        if (data.action === "Clear") {
            this.props.changeRedliningState({action: "Delete", geomType: null});
            this.setState({pickGeomType: null});
            this.props.clearLayer("__geomdigitizer");
            this.props.clearLayer("__geomdigitizerbuffer");
        } else if (data.action.startsWith("Select")) {
            this.props.changeRedliningState({action: null, geomType: null});
            this.setState({pickGeomType: data.geomType});
        } else if (data.action === "Delete") {
            this.triggerDelete();
        } else {
            const geomLinkData = this.geometryLinkData(this.state.geomLink);
            const supportedGeomType = geomLinkData.geomType || [];
            const featureStyle = supportedGeomType.includes(data.geomType) && this.state.bufferDistance === 0 ? this.styleActive : this.styleInactive;
            const style = {
                borderColor: featureStyle.strokeColor,
                size: featureStyle.strokeWidth,
                fillColor: featureStyle.fillColor
            };
            this.updateRedliningState({...data, style: style});
            this.setState({pickGeomType: null});
        }
    };
    computeBuffer = (distance) => {
        import("@turf/buffer").then(bufferMod => {
            const buffer = bufferMod.default;
            const layer = this.props.layers.find(l => l.id === "__geomdigitizer");
            if (!layer || distance === 0) {
                this.props.removeLayer("__geomdigitizerbuffer");
                return;
            }
            const bufferfeatures = [];

            (layer.features || []).forEach(feature => {
                if (this.props.redlining.selectedFeature && this.props.redlining.selectedFeature.id === feature.id) {
                    feature = this.props.redlining.selectedFeature;
                }
                const wgsGeometry = VectorLayerUtils.reprojectGeometry(feature.geometry, this.props.projection, "EPSG:4326");
                const wgsFeature = {...feature, geometry: wgsGeometry};
                const output = buffer(wgsFeature, distance, {units: 'meters'});
                if (output && output.geometry) {
                    output.geometry = VectorLayerUtils.reprojectGeometry(output.geometry, "EPSG:4326", this.props.projection);
                    output.id = feature.id;
                    output.styleName = 'default';
                    output.styleOptions = this.featureStyleOptions(output.geometry.type, "__geomdigitizerbuffer", true);
                    bufferfeatures.push(output);
                }
            });
            if (!isEmpty(bufferfeatures)) {
                const bufferlayer = {
                    id: "__geomdigitizerbuffer",
                    title: LocaleUtils.tr("geomdigitizer.bufferlayername"),
                    role: LayerRole.USERLAYER,
                    type: 'vector',
                    readonly: true
                };
                this.props.addLayerFeatures(bufferlayer, bufferfeatures, true);
            }
        });
    };
    updateFeatureBuffer = (feature) => {
        if (this.state.bufferDistance === 0) {
            return;
        }
        import("@turf/buffer").then(bufferMod {
            const buffer = bufferMod.default;
            this.props.removeLayerFeatures("__geomdigitizerbuffer", [feature.id]);
            const bufferlayer = {
                id: "__geomdigitizerbuffer",
                title: LocaleUtils.tr("geomdigitizer.bufferlayername"),
                role: LayerRole.USERLAYER,
                type: 'vector',
                readonly: true
            };
            const wgsGeometry = VectorLayerUtils.reprojectGeometry(feature.geometry, this.props.projection, "EPSG:4326");
            const wgsFeature = {...feature, geometry: wgsGeometry};
            const output = buffer(wgsFeature, this.state.bufferDistance, {units: 'meters'});
            if (output && output.geometry) {
                output.geometry = VectorLayerUtils.reprojectGeometry(output.geometry, "EPSG:4326", this.props.projection);
                output.id = feature.id;
                output.styleName = 'default';
                output.styleOptions = this.featureStyleOptions(output.geometry.type, "__geomdigitizerbuffer", true);
                this.props.addLayerFeatures(bufferlayer, [output]);
            }
        });
    };
    featureStyleOptions = (geometryType, layerId, bufferActive) => {
        const geomLinkData = this.geometryLinkData(this.state.geomLink);
        const supportedGeomType = geomLinkData.geomType || [];
        if (layerId === "__geomdigitizer" && bufferActive) {
            return this.styleInactive;
        }
        return supportedGeomType.includes(geometryType.replace(/^Multi/, '')) ? this.styleActive : this.styleInactive;
    };
    geometryLinkData = (name) => {
        if (!this.props.themes.pluginData || !this.props.themes.pluginData.geometryLinks) {
            return {};
        }
        return this.props.themes.pluginData.geometryLinks.find(entry => entry.name === name) || {};
    };
    submitGeometryLink = (ev) => {
        let features = [];
        const layer = this.props.layers.find(l => l.id === "__geomdigitizer");
        features = (layer || {}).features || [];
        if (this.props.redlining.selectedFeature) {
            features = features.filter(feature => feature.id !== this.props.redlining.selectedFeature.id);
            features.push(this.props.redlining.selectedFeature);
        }

        const invalidPoly = features.find(feature => feature.geometry.type === "Polygon" && !isEmpty(polySelfIntersections(feature).geometry.coordinates));
        if (invalidPoly) {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("geomdigitizer.selfinter"));
            ev.preventDefault();
            return;
        }
        const data = this.geometryLinkData(this.state.geomLink);
        const supportedGeomType = data.geomType || [];
        const geometries = features.filter(
            feature => supportedGeomType.includes(this.state.bufferDistance > 0 ? "Polygon" : feature.geometry.type.replace(/^Multi/, ''))
        ).map(
            feature => VectorLayerUtils.geoJSONGeomToWkt(feature.geometry)
        );
        if (isEmpty(geometries)) {
            ev.preventDefault();
            return;
        } else {
            ev.target.GEOMETRIES.value = geometries.join(";");
            ev.target.GEOMCOUNT.value = geometries.length;
            ev.target.BUFFERDIST.value = this.state.bufferDistance;
        }
        if (ev.target.target === "geomdigitizer-output-window") {
            this.setState({outputWindowVisible: true, outputLoaded: false, outputWindowSize: {w: data.target.w, h: data.target.h}, outputWindowTitle: data.target.iframedialog});
        } else {
            this.setState({outputWindowVisible: false, outputLoaded: false, outputWindowSize: null, outputWindowTitle: ""});
        }
    };
    selectFeature = (layername, feature) => {
        const geomdigitizerlayer = {
            id: "__geomdigitizer",
            title: LocaleUtils.tr("geomdigitizer.layername"),
            role: LayerRole.USERLAYER,
            type: 'vector',
            readonly: true
        };
        const addFeature = {
            ...feature,
            styleName: "default",
            styleOptions: this.featureStyleOptions(feature.geometry.type, "__geomdigitizer", this.state.bufferDistance !== 0)
        };
        this.props.addLayerFeatures(geomdigitizerlayer, [addFeature]);
    };
}

export default connect((state) => ({
    active: state.task.id === "GeometryDigitizer",
    layers: state.layers.flat,
    redlining: state.redlining,
    map: state.map,
    mobile: state.browser.mobile,
    projection: state.map.projection,
    theme: state.theme.current,
    themes: state.theme.themes
}), {
    changeRedliningState: changeRedliningState,
    addLayer: addLayer,
    removeLayer: removeLayer,
    addLayerFeatures: addLayerFeatures,
    removeLayerFeatures: removeLayerFeatures,
    clearLayer: clearLayer
})(GeometryDigitizer);
