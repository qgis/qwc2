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
import PropTypes from 'prop-types';

import {LayerRole, removeLayer, addLayerFeatures, removeLayerFeatures, clearLayer} from '../actions/layers';
import {changeRedliningState, resetRedliningState} from '../actions/redlining';
import PickFeature from '../components/PickFeature';
import ResizeableWindow from '../components/ResizeableWindow';
import TaskBar from '../components/TaskBar';
import ButtonBar from '../components/widgets/ButtonBar';
import NumberInput from '../components/widgets/NumberInput';
import Spinner from '../components/widgets/Spinner';
import ConfigUtils from '../utils/ConfigUtils';
import {EXCLUDE_ATTRS, EXCLUDE_PROPS} from '../utils/IdentifyUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/GeometryDigitizer.css';
import './style/Redlining.css';


/**
 * Allows digitizing geometries to send to configured applications.
 *
 * Configure the available target applications in `themesConfig.json`:
 * ```
 * {
 *   "themes": {
 *     "items": [{
 *       ...
 *       "pluginData": {
 *         "geometryLinks": ["<geomLinkName>", "<geomLinkName>", ...]
 *       }
 *     }],
 *   },
 *   "pluginData": {
 *     "geometryLinks": [
 *       {
 *         "name": "<geomLinkName>",                 // Link name referenced in theme item
 *         "title": "<geomLinkTitle>",               // Link title, displayed in the selection combo
 *         "geomType": ["<geomType>", "<geomType>"], // Supported geometry types (Point, LineString, Polygon)
 *         "format": "wkt|geojson",                  // Format of data to send to application
 *         "url": "<targetApplicationUrl>",          // Application target URL, receiving the POST submit. Can contain the $username$ placeholder parameter.
 *         "params": {"<key>": "<value>", ...}       // Optional: additional form parameters to post to URL
 *         "target": "<target>" | {                  // Optional: form POST target which to display the result
 *           "iframedialog": true,                   // Use an iframe dialog
 *           "w": <dialogWidth>,                     // Dialog width
 *           "h": <dialogHeight>                     // Dialog height
 *         }
 *       }
 *     ]
 *   }
 * }
 * ```
 * If you are using `qwc-services`, you will need to explicitly permit the geometry links in the `qwc-admin-gui` as follows:
 *
 * * Create and permit a `Plugin` resource with name `geometryLinks`
 * * Create and permit `Plugin data` resources with name equal to `<geomLinkName>`
 */
class GeometryDigitizer extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayerFeatures: PropTypes.func,
        changeRedliningState: PropTypes.func,
        clearLayer: PropTypes.func,
        layers: PropTypes.array,
        redlining: PropTypes.object,
        removeLayer: PropTypes.func,
        removeLayerFeatures: PropTypes.func,
        resetRedliningState: PropTypes.func,
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
    static defaultState = {
        bufferDistance: 0,
        geomLink: "",
        outputWindowVisible: false,
        outputLoaded: false,
        outputWindowTitle: "",
        outputWindowSize: null,
        pickGeomType: null
    };
    static defaultProps = {
        styleInactive: {
            strokeColor: [127, 127, 127, 1],
            fillColor: [127, 127, 127, 0.33]
        },
        styleActive: {
            strokeColor: [0, 160, 0, 1],
            fillColor: [0, 160, 0, 0.33]
        }
    };
    constructor(props) {
        super(props);
        const defaultStyle = {...ConfigUtils.getConfigProp("defaultFeatureStyle"), strokeDash: []};
        this.styleActive = {...defaultStyle, ...props.styleActive};
        this.styleInactive = {...defaultStyle, ...props.styleInactive};
        this.state = GeometryDigitizer.defaultState;
    }
    componentDidUpdate(prevProps, prevState) {
        if (!this.props.active) {
            return;
        }
        // Refresh buffer when layer features changed
        const newLayer = this.props.layers.find(layer => layer.id === "__geomdigitizer");
        const oldLayer = prevProps.layers.find(layer => layer.id === "__geomdigitizer");
        if (newLayer?.features !== oldLayer?.features) {
            this.computeBuffer(this.state.bufferDistance);
        }
        // Recompute buffer feature when selected feature changes and buffering is active
        if (this.state.bufferDistance !== 0 && this.props.redlining.selectedFeature && this.props.redlining.selectedFeature !== prevProps.redlining.selectedFeature) {
            this.updateFeatureBuffer(this.props.redlining.selectedFeature);
        }
        // Update feature styles according to permissible geometry types
        if (this.state.geomLink !== prevState.geomLink) {
            this.props.changeRedliningState({style: this.redliningStyle(this.props.redlining.geomType)});
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
        // Mark base geometries as inactive or active depending on whether buffering is active
        if ((this.state.bufferDistance !== 0) !== (prevState.bufferDistance !== 0)) {
            this.props.changeRedliningState({style: this.redliningStyle(this.props.redlining.geomType)});
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
    onShow = (mode) => {
        const layer = {
            id: "__geomdigitizer",
            title: LocaleUtils.tr("geomdigitizer.layername"),
            role: LayerRole.USERLAYER,
            type: 'vector',
            readonly: true
        };
        this.props.addLayerFeatures(layer, [], true);
        this.props.changeRedliningState({action: mode || 'Pick', geomType: null, layer: '__geomdigitizer', layerTitle: 'Geometry digitizer'});
    };
    onHide = () => {
        this.props.removeLayer("__geomdigitizer");
        this.props.removeLayer("__geomdigitizerbuffer");
        this.setState(GeometryDigitizer.defaultState);
        this.props.resetRedliningState();
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
                {key: "Point", tooltip: LocaleUtils.tr("common.point"), icon: "point", data: {action: "Draw", geomType: "Point", text: ""}, disabled: !supportedGeomType.includes("Point")},
            (supportedGeomType.includes("Polygon") && !supportedGeomType.includes("LineString")) ?
                {key: "LineString", tooltip: LocaleUtils.tr("geomdigitizer.line_buffer"), icon: "line_buffer", data: {action: "Draw", geomType: "LineString", text: ""}} :
                {key: "LineString", tooltip: LocaleUtils.tr("common.line"), icon: "line", data: {action: "Draw", geomType: "LineString", text: ""}, disabled: !supportedGeomType.includes("LineString")},
            {key: "Polygon", tooltip: LocaleUtils.tr("common.polygon"), icon: "polygon", data: {action: "Draw", geomType: "Polygon", text: ""}, disabled: !supportedGeomType.includes("Polygon")}
        ];
        const editButtons = [
            {key: "Pick", tooltip: LocaleUtils.tr("common.pick"), icon: "pick", data: {action: "Pick", geomType: null, text: ""}},
            {key: "Delete", tooltip: LocaleUtils.tr("common.delete"), icon: "trash", data: {action: "Delete", geomType: null}, disabled: !this.props.redlining.selectedFeature},
            {key: "Clear", tooltip: LocaleUtils.tr("geomdigitizer.clear"), icon: "clear", data: {action: "Clear"}}
        ];
        const pickButtons = [
            {key: "SelectPoint", tooltip: LocaleUtils.tr("geomdigitizer.identifypick"), icon: "pick_point", data: {action: "SelectPoint", geomType: "Point"}},
            {key: "SelectPolygon", tooltip: LocaleUtils.tr("geomdigitizer.identifypickregion"), icon: "pick_region", data: {action: "SelectPolygon", geomType: "Polygon"}}
        ];

        const featureLayer = this.state.bufferDistance ? "__geomdigitizerbuffer" : "__geomdigitizer";
        const haveFeatures = !isEmpty((this.props.layers.find(layer => layer.id === featureLayer)?.features || []).filter(feature => supportedGeomType.includes(feature.geometry.type.replace(/^Multi/, ''))));
        const target = geomLinkData.target?.iframedialog ? "geomdigitizer-output-window" : (geomLinkData.target ?? "_blank");

        return (
            <div className="redlining-controlsbar">
                <div className="redlining-groupcontrol">
                    <div>{LocaleUtils.tr("redlining.draw")}</div>
                    <ButtonBar active={activeButton} buttons={drawButtons} onClick={(key, data) => this.actionChanged(data)} />
                </div>
                <div className="redlining-groupcontrol">
                    <div>{LocaleUtils.tr("redlining.edit")}</div>
                    <ButtonBar active={activeButton} buttons={editButtons} onClick={(key, data) => this.actionChanged(data)} />
                </div>
                <div className="redlining-groupcontrol">
                    <div>{LocaleUtils.tr("common.pick")}</div>
                    <ButtonBar active={activeButton} buttons={pickButtons} onClick={(key, data) => this.actionChanged(data)} />
                </div>
                <div className="redlining-groupcontrol">
                    <div>{LocaleUtils.tr("redlining.buffer")}</div>
                    <div>
                        <NumberInput max={99999} min={-99999} mobile onChange={this.computeBuffer}
                            suffix=" m" value={this.state.bufferDistance}
                        />
                    </div>
                </div>
                <div className="redlining-groupcontrol">
                    <div>{LocaleUtils.tr("geomdigitizer.applink")}</div>
                    <div className="controlgroup">
                        <select onChange={ev => this.setState({geomLink: ev.target.value})} value={this.state.geomLink}>
                            <option value="">{LocaleUtils.tr("geomdigitizer.chooselink")}</option>
                            {(this.props.theme.pluginData?.geometryLinks || []).map(entry => (
                                <option key={entry} value={entry}>{this.geometryLinkData(entry).title}</option>
                            ))}
                        </select>
                        <form action={geomLinkData.url?.replace('$username$', ConfigUtils.getConfigProp("username") || "")} method="post" onSubmit={this.submitGeometryLink} target={target}>
                            <input name="csrf_token" type="hidden" value={MiscUtils.getCsrfToken()} />
                            <input name="GEOMETRIES" type="hidden" />
                            <input name="GEOMCOUNT" type="hidden" />
                            <input name="BUFFERDIST" type="hidden" />
                            {Object.entries(geomLinkData.params || {}).map(([key, value]) => (
                                <input key={key} name={key} type="hidden" value={value} />
                            ))}
                            <button className="button" disabled={!geomLinkData.url || !haveFeatures} type="submit">{LocaleUtils.tr("geomdigitizer.send")}</button>
                        </form>
                    </div>
                </div>
            </div>
        );
    };
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
                <div className="geomdigitizer-output-window-body">
                    {!this.state.outputLoaded ? (
                        <span className="geomdigitizer-output-window-wait">
                            <Spinner /> <span>{LocaleUtils.tr("common.loading")}</span>
                        </span>
                    ) : null}
                    <iframe name="geomdigitizer-output-window" onLoad={() => this.setState({outputLoaded: true})}/>
                </div>
            </ResizeableWindow>
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
                <PickFeature
                    featurePicked={this.selectFeature} key="FeaturePicker"
                    layerFilterFunc={(layer) => !layer.id.startsWith("__geomdigitizer")}
                    pickGeomType={this.state.pickGeomType} />
            ) : null
        ];
    }
    actionChanged = (data) => {
        if (data.action === "Clear") {
            this.props.changeRedliningState({action: "Delete"});
            this.setState({pickGeomType: null});
            this.props.clearLayer("__geomdigitizer");
            this.props.clearLayer("__geomdigitizerbuffer");
        } else if (data.action.startsWith("Select")) {
            this.props.changeRedliningState({action: null, geomType: null});
            this.setState({pickGeomType: data.geomType});
        } else if (data.action === "Delete") {
            this.props.changeRedliningState({action: "Delete"});
            if (this.props.redlining.selectedFeature) {
                this.props.removeLayerFeatures("__geomdigitizerbuffer", [this.props.redlining.selectedFeature.id]);
            }
        } else {
            this.props.changeRedliningState({...data, style: this.redliningStyle(data.geomType)});
            this.setState({pickGeomType: null});
        }
    };
    computeBuffer = (distance) => {
        distance = distance || 0;
        this.setState({bufferDistance: distance});
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
                const wgsGeometry = VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs, "EPSG:4326");
                const wgsFeature = {...feature, geometry: wgsGeometry};
                const output = buffer(wgsFeature, distance, {units: 'meters'});
                if (output && output.geometry) {
                    output.geometry = VectorLayerUtils.reprojectGeometry(output.geometry, "EPSG:4326", feature.crs);
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
        import("@turf/buffer").then(bufferMod => {
            const buffer = bufferMod.default;
            const wgsGeometry = VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs, "EPSG:4326");
            const wgsFeature = {...feature, geometry: wgsGeometry};
            const output = buffer(wgsFeature, this.state.bufferDistance, {units: 'meters'});
            if (output && output.geometry) {
                output.geometry = VectorLayerUtils.reprojectGeometry(output.geometry, "EPSG:4326", feature.crs);
                output.id = feature.id;
                output.styleName = 'default';
                output.styleOptions = this.featureStyleOptions(output.geometry.type, "__geomdigitizerbuffer", true);
                this.props.addLayerFeatures({id: "__geomdigitizerbuffer"}, [output]);
            }
        });
    };
    redliningStyle = (geomType) => {
        const geomLinkData = this.geometryLinkData(this.state.geomLink);
        const supportedGeomType = this.state.geomLink ? (geomLinkData.geomType || ["Point", "LineString", "Polygon"]) : [];
        const featureStyle = supportedGeomType.includes(geomType) && this.state.bufferDistance === 0 ? this.styleActive : this.styleInactive;
        return {
            borderColor: featureStyle.strokeColor,
            size: featureStyle.strokeWidth,
            fillColor: featureStyle.fillColor
        };
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
        return (this.props.themes.pluginData?.geometryLinks || []).find(entry => entry.name === name) || {};
    };
    submitGeometryLink = (ev) => {
        let features = [];
        const layer = this.props.layers.find(l => l.id === "__geomdigitizer");
        features = (layer || {}).features || [];
        if (this.props.redlining.selectedFeature) {
            features = features.filter(feature => feature.id !== this.props.redlining.selectedFeature.id);
            features.push(this.props.redlining.selectedFeature);
        }

        const invalidPoly = features.find(feature => feature.geometry.type === "Polygon" && !isEmpty(polySelfIntersections(feature)));
        if (invalidPoly) {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("geomdigitizer.selfinter"));
            ev.preventDefault();
            return;
        }
        const data = this.geometryLinkData(this.state.geomLink);
        const supportedGeomType = data.geomType || [];
        const supportedFeatures = features.filter(
            feature => supportedGeomType.includes(this.state.bufferDistance > 0 ? "Polygon" : feature.geometry.type.replace(/^Multi/, ''))
        );
        if (isEmpty(supportedFeatures)) {
            ev.preventDefault();
            return;
        }
        const geometries = (data.format || "wkt").toLowerCase() === "wkt" ? supportedFeatures.map(
            feature => VectorLayerUtils.geoJSONGeomToWkt(feature.geometry)
        ).join(";") : JSON.stringify({
            type: "FeatureCollection",
            features: supportedFeatures.map(feature => {
                const newFeature = MiscUtils.objectOmit(feature, EXCLUDE_PROPS);
                newFeature.properties = MiscUtils.objectOmit(newFeature.properties, EXCLUDE_ATTRS);
                return newFeature;
            })
        });
        ev.target.GEOMETRIES.value = geometries;
        ev.target.GEOMCOUNT.value = supportedFeatures.length;
        ev.target.BUFFERDIST.value = this.state.bufferDistance;
        if (ev.target.target === "geomdigitizer-output-window") {
            this.setState({outputWindowVisible: true, outputLoaded: false, outputWindowSize: {w: data.target.w, h: data.target.h}, outputWindowTitle: data.target.iframedialog});
        } else {
            this.setState({outputWindowVisible: false, outputLoaded: false, outputWindowSize: null, outputWindowTitle: ""});
        }
    };
    selectFeature = (layername, feature) => {
        const geomdigitizerlayer = {id: "__geomdigitizer"};
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
    theme: state.theme.current,
    themes: state.theme.themes
}), {
    addLayerFeatures: addLayerFeatures,
    changeRedliningState: changeRedliningState,
    clearLayer: clearLayer,
    removeLayer: removeLayer,
    removeLayerFeatures: removeLayerFeatures,
    resetRedliningState: resetRedliningState
})(GeometryDigitizer);
