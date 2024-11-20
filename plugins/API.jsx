/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import ol from 'openlayers';
import PropTypes from 'prop-types';
import * as uuid from 'uuid';

import * as displayActions from '../actions/display';
import * as editingActions from '../actions/editing';
import {LayerRole} from '../actions/layers';
import * as layerActions from '../actions/layers';
import {registerCustomPlugin, unregisterCustomPlugin} from '../actions/localConfig';
import * as localeActions from '../actions/locale';
import * as locateActions from '../actions/locate';
import * as mapActions from '../actions/map';
import * as taskActions from '../actions/task';
import * as themeActions from '../actions/theme';
import * as windowsActions from '../actions/windows';
import AppMenu from '../components/AppMenu';
import AttributeForm from '../components/AttributeForm';
import AutoEditForm from '../components/AutoEditForm';
import CoordinateDisplayer from '../components/CoordinateDisplayer';
import EditComboField from '../components/EditComboField';
import EditUploadField from '../components/EditUploadField';
import FullscreenSwitcher from '../components/FullscreenSwitcher';
import Icon from '../components/Icon';
import IdentifyViewer from '../components/IdentifyViewer';
import ImportLayer from '../components/ImportLayer';
import LayerInfoWindow from '../components/LayerInfoWindow';
import LinkFeatureForm from '../components/LinkFeatureForm';
import MapSelection from '../components/MapSelection';
import MessageBar from '../components/MessageBar';
import NumericInputWindow from '../components/NumericInputWindow';
import PickFeature from '../components/PickFeature';
import PluginsContainer from '../components/PluginsContainer';
import PrintSelection from '../components/PrintSelection';
import QtDesignerForm from '../components/QtDesignerForm';
import ResizeableWindow from '../components/ResizeableWindow';
import Search from '../components/Search';
import SearchBox from '../components/SearchBox';
import ServiceInfoWindow from '../components/ServiceInfoWindow';
import SideBar from '../components/SideBar';
import {Swipeable} from '../components/Swipeable';
import TaskBar from '../components/TaskBar';
import ThemeLayersListWindow from '../components/ThemeLayersListWindow';
import ThemeList from '../components/ThemeList';
import Toolbar from '../components/Toolbar';
import ShareLink from '../components/share/ShareLink';
import ShareQRCode from '../components/share/ShareQRCode';
import ShareSocials from '../components/share/ShareSocials';
import FixedTimeline from '../components/timeline/FixedTimeline';
import InfiniteTimeline from '../components/timeline/InfiniteTimeline';
import TimelineFeaturesSlider from '../components/timeline/TimelineFeaturesSlider';
import AccordeonWidget from '../components/widgets/AccordeonWidget';
import ButtonBar from '../components/widgets/ButtonBar';
import ColorButton from '../components/widgets/ColorButton';
import ComboBox from '../components/widgets/ComboBox';
import CopyButton from '../components/widgets/CopyButton';
import DateTimeInput from '../components/widgets/DateTimeInput';
import EditableSelect from '../components/widgets/EditableSelect';
import FileSelector from '../components/widgets/FileSelector';
import Input from '../components/widgets/Input';
import InputContainer from '../components/widgets/InputContainer';
import LayerCatalogWidget from '../components/widgets/LayerCatalogWidget';
import MenuButton from '../components/widgets/MenuButton';
import ModalDialog from '../components/widgets/ModalDialog';
import NavBar from '../components/widgets/NavBar';
import NumberInput from '../components/widgets/NumberInput';
import PopupMenu from '../components/widgets/PopupMenu';
import {Image} from '../components/widgets/Primitives';
import SearchWidget from '../components/widgets/SearchWidget';
import Spinner from '../components/widgets/Spinner';
import SuggestionInput from '../components/widgets/SuggestionInput';
import TextInput from '../components/widgets/TextInput';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import VectorLayerPicker from '../components/widgets/VectorLayerPicker';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import EditingInterface from '../utils/EditingInterface';
import * as EditingUtils from '../utils/EditingUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import * as PermaLinkUtils from '../utils/PermaLinkUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

/**
 * Exposes an API for interacting with QWC2 via `window.qwc2`.
 *
 * You can interact with the API as soon as the `QWC2ApiReady` event is dispatched.
 *
 * For example:
 *
 * ```
 * window.addEventListener("QWC2ApiReady", () => {
 *      const {React} = window.qwc2.libs;
 *
 *      class MyPlugin extends React.Component {
 *          render() {
 *              return React.createElement("div", {}, "Hello World");
 *          }
 *      }
 *
 *      window.qwc2.addPlugin("MyPlugin", MyPlugin);
 * });
 * ```
 *
 * All following action functions are available:
 *
 * - [display](https://github.com/qgis/qwc2/blob/master/actions/display.js)
 * - [editing](https://github.com/qgis/qwc2/blob/master/actions/editing.js)
 * - [layers](https://github.com/qgis/qwc2/blob/master/actions/layers.js)
 * - [locate](https://github.com/qgis/qwc2/blob/master/actions/locate.js)
 * - [map](https://github.com/qgis/qwc2/blob/master/actions/map.js)
 * - [task](https://github.com/qgis/qwc2/blob/master/actions/task.js)
 * - [theme](https://github.com/qgis/qwc2/blob/master/actions/theme.js)
 * - [windows](https://github.com/qgis/qwc2/blob/master/actions/windows.js)
 *
 * I.e. `setCurrentTask` is available via `window.qwc2.setCurrentTask`.
 *
 * Some of the core libraries (React, axios, ol, ...) are accessible via `window.qwc2.libs`.
 *
 * In addition, the following methods are available on `window.qwc2`:
 */
class API extends React.Component {
    componentDidMount() {
        window.qwc2 = {
            __customPlugins: {},
            __attributeCalculators: {},
            __identifyExportes: {}
        };
        // Auto-binded functions
        for (const prop of Object.keys(this.props)) {
            window.qwc2[prop] = this.props[prop];
        }
        // Additional exports
        window.qwc2.LayerRole = LayerRole;
        window.qwc2.addPlugin = this.addPlugin;
        window.qwc2.removePlugin = this.removePlugin;
        window.qwc2.addIdentifyAttributeCalculator = this.addIdentifyAttributeCalculator;
        window.qwc2.removeIdentifyAttributeCalculator = this.removeIdentifyAttributeCalculator;
        window.qwc2.addIdentifyExporter = this.addIdentifyExporter;
        window.qwc2.removeIdentifyExporter = this.removeIdentifyExporter;
        window.qwc2.addExternalLayer = this.addExternalLayer;
        window.qwc2.drawScratch = this.drawScratch;
        window.qwc2.drawGeometry = this.drawGeometry;
        window.qwc2.getState = this.getState;
        window.qwc2.ConfigUtils = ConfigUtils;
        window.qwc2.CoordinatesUtils = CoordinatesUtils;
        window.qwc2.EditingInterface = EditingInterface;
        window.qwc2.EditingUtils = EditingUtils;
        window.qwc2.LocaleUtils = LocaleUtils;
        window.qwc2.MapUtils = MapUtils;
        window.qwc2.PermaLinkUtils = PermaLinkUtils;
        window.qwc2.VectorLayerUtils = VectorLayerUtils;

        window.qwc2.libs = {};
        window.qwc2.libs.axios = axios;
        window.qwc2.libs.React = React;
        window.qwc2.libs.PropTypes = PropTypes;
        window.qwc2.libs.connect = connect;
        window.qwc2.libs.ol = ol;
        window.qwc2.libs.uuid = uuid;

        window.qwc2.components = {};
        window.qwc2.components.AppMenu = AppMenu;
        window.qwc2.components.AttributeForm = AttributeForm;
        window.qwc2.components.AutoEditForm = AutoEditForm;
        window.qwc2.components.CoordinateDisplayer = CoordinateDisplayer;
        window.qwc2.components.EditComboField = EditComboField;
        window.qwc2.components.EditUploadField = EditUploadField;
        window.qwc2.components.FullscreenSwitcher = FullscreenSwitcher;
        window.qwc2.components.Icon = Icon;
        window.qwc2.components.IdentifyViewer = IdentifyViewer;
        window.qwc2.components.ImportLayer = ImportLayer;
        window.qwc2.components.InputContainer = InputContainer;
        window.qwc2.components.LayerInfoWindow = LayerInfoWindow;
        window.qwc2.components.LinkFeatureForm = LinkFeatureForm;
        window.qwc2.components.MapSelection = MapSelection;
        window.qwc2.components.MessageBar = MessageBar;
        window.qwc2.components.ModalDialog = ModalDialog;
        window.qwc2.components.NumericInputWindow = NumericInputWindow;
        window.qwc2.components.PickFeature = PickFeature;
        window.qwc2.components.PluginsContainer = PluginsContainer;
        window.qwc2.components.PopupMenu = PopupMenu;
        window.qwc2.components.PrintSelection = PrintSelection;
        window.qwc2.components.QtDesignerForm = QtDesignerForm;
        window.qwc2.components.ResizeableWindow = ResizeableWindow;
        window.qwc2.components.SearchBox = SearchBox;
        window.qwc2.components.Search = Search;
        window.qwc2.components.ServiceInfoWindow = ServiceInfoWindow;
        window.qwc2.components.ShareLink = ShareLink;
        window.qwc2.components.ShareQRCode = ShareQRCode;
        window.qwc2.components.ShareSocials = ShareSocials;
        window.qwc2.components.SideBar = SideBar;
        window.qwc2.components.Spinner = Spinner;
        window.qwc2.components.Swipeable = Swipeable;
        window.qwc2.components.TaskBar = TaskBar;
        window.qwc2.components.ThemeLayersListWindow = ThemeLayersListWindow;
        window.qwc2.components.ThemeList = ThemeList;
        window.qwc2.components.FixedTimeline = FixedTimeline;
        window.qwc2.components.InfiniteTimeline = InfiniteTimeline;
        window.qwc2.components.TimelineFeaturesSlider = TimelineFeaturesSlider;
        window.qwc2.components.Toolbar = Toolbar;
        window.qwc2.components.AccordeonWidget = AccordeonWidget;
        window.qwc2.components.ButtonBar = ButtonBar;
        window.qwc2.components.ColorButton = ColorButton;
        window.qwc2.components.ComboBox = ComboBox;
        window.qwc2.components.CopyButton = CopyButton;
        window.qwc2.components.DateTimeInput = DateTimeInput;
        window.qwc2.components.EditableSelect = EditableSelect;
        window.qwc2.components.FileSelector = FileSelector;
        window.qwc2.components.Input = Input;
        window.qwc2.components.LayerCatalogWidget = LayerCatalogWidget;
        window.qwc2.components.MenuButton = MenuButton;
        window.qwc2.components.NavBar = NavBar;
        window.qwc2.components.NumberInput = NumberInput;
        window.qwc2.components.Image = Image;
        window.qwc2.components.SearchWidget = SearchWidget;
        window.qwc2.components.SuggestionInput = SuggestionInput;
        window.qwc2.components.TextInput = TextInput;
        window.qwc2.components.ToggleSwitch = ToggleSwitch;
        window.qwc2.components.VectorLayerPicker = VectorLayerPicker;

        window.dispatchEvent(new Event("QWC2ApiReady"));
    }
    static propTypes = {
        addLayer: PropTypes.func,
        mapCrs: PropTypes.string,
        registerCustomPlugin: PropTypes.func,
        setCurrentTask: PropTypes.func,
        state: PropTypes.object,
        unregisterCustomPlugin: PropTypes.func
    };
    render() {
        return null;
    }
    /**
     * Add custom plugin
     *
     * * `name`: An identifier
     * * `plugin`: The plugin component class
     * * `translations`: The plugin translation messages: `{"<lang>": {<messages>}, ...}`
     */
    addPlugin = (name, plugin, translations = {}) => {
        window.qwc2.__customPlugins[name] = plugin;
        window.qwc2.addTranslations(translations);
        this.props.registerCustomPlugin(name);
    };
    /**
     * Remove custom plugin
     *
     * * `name`: The identifier
     */
    removePlugin = (name) => {
        this.props.unregisterCustomPlugin(name);
        delete window.qwc2.__customPlugins[name];
    };
    /**
     * Add custom attribute calculator
     * (i.e. computed attributes which are added to GetFeatureInfo responses).
     *
     * * `name`: An identifier
     * * `calcFunc`: The calculator function with signature `function(layer, feature)`
     *
     * The `calcFunc` should return either a two-enty `[name, value]` pair or a one-value `[value]` array.
     */
    addIdentifyAttributeCalculator = (name, calcFunc) => {
        window.qwc2.__attributeCalculators[name] = calcFunc;
    };
    /**
     * Remove custom identify attribute calculator
     *
     * * `name`: The identifier
     */
    removeIdentifyAttributeCalculator = (name) => {
        delete window.qwc2.__attributeCalculators[name];
    };
    /**
     * Add custom identify exporter
     *
     * * `name`: An identifier
     * * `exporterFunc`: The exporter configuration
     *
     * The exporter configuration is an object of the shape
     *
     * ```
     * {
     *    id: "<id>",
     *    title: "<title>",
     *    allowClipboard: <true|false>,
     *    export: (features, callback) => {
     *      callback({
     *        data: <blob>, type: "<mimeType>", filename: "<filename>"
     *      });
     *    }
     *  }
     * ```
     */
    addIdentifyExporter = (name, exporterConfig) => {
        window.qwc2.__identifyExportes[name] = exporterConfig;
    };
    /**
     * Remove identify exporter
     *
     * * `name`: The identifier
     */
    removeIdentifyExporter = (name) => {
        delete window.qwc2.__identifyExportes[name];
    };
    /*
     * Convenience method for adding an external layer.
     *
     * * `resource`: An external resource of the form `wms:<service_url>#<layername>` or `wmts:<capabilities_url>#<layername>`.
     * * `beforeLayerName`: Insert the new layer before the layer with the specified name. If `null` or the layer does not exist, the layer is inserted on top.
     * * `sublayers`: Whether to import the sublayer structure (`true`) or just a flat layer (`false`).
     */
    addExternalLayer = (resource, beforeLayerName = null, sublayers = true) => {
        const params = LayerUtils.splitLayerUrlParam(resource);
        ServiceLayerUtils.findLayers(params.type, params.url, [params], this.props.mapCrs, (id, layer) => {
            if (layer) {
                if (sublayers === false) {
                    layer.sublayers = null;
                }
                this.props.addLayer(layer, null, beforeLayerName);
            }
        });
    };
    /**
     * Deprecated, use `window.qwc2.drawGeometry` instead.
     */
    drawScratch = (geomType, message, drawMultiple, callback, style = null) => {
        /* eslint-disable-next-line */
        console.warn("window.qwc2.drawScratch is deprecated, use window.qwc2.drawGeometry instead");
        this.props.setCurrentTask("ScratchDrawing", null, null, {geomType, message, drawMultiple, callback, style});
    };
    /**
     *  Draw geometries, and return these as GeoJSON to the calling application.
     *
     * * `geomType`: `Point`, `LineString`, `Polygon`, `Circle` or `Box`.
     * * `message`: A descriptive string to display in the tool taskbar.
     * * `callback`: A `function(result, crs)`, the `result` being an array of GeoJSON features, and `crs` the projection of the feature coordinates.
     * * `options`: Optional configuration:
     *   * `drawMultiple`: Whether to allow drawing multiple geometries (default: `false`).
     *   * `style`: A custom style object to use for the drawn features, in the same format as `DEFAULT_FEATURE_STYLE` in `qwc2/utils/FeatureStyles.js`.
     *   * `initialFeatures`: Array of initial geometries.
     *   * `snapping`: Whether snapping is available while drawing (default: `false`).
     *   * `snappingActive`: Whether snapping is initially active (default: `false`)
     */
    drawGeometry = (geomType, message, callback, options = {}) => {
        this.props.setCurrentTask("ScratchDrawing", null, null, {
            callback: callback,
            geomType: geomType,
            message: message,
            drawMultiple: options.drawMultiple || false,
            style: options.style,
            snapping: options.snapping || false,
            snappingActive: options.snappingActive || false,
            initialFeatures: options.initialFeatures
        });
    };
    /**
     * Return the current application state.
     */
    getState = () => {
        return this.props.state;
    };
}

function extractFunctions(obj) {
    return Object.entries(obj).reduce((result, [key, value]) => {
        if (typeof value === "function") {
            result[key] = value;
        }
        return result;
    }, {});
}

export default connect(state => ({
    mapCrs: state.map.projection,
    state: state
}), {
    registerCustomPlugin: registerCustomPlugin,
    unregisterCustomPlugin: unregisterCustomPlugin,
    ...extractFunctions(displayActions),
    ...extractFunctions(editingActions),
    ...extractFunctions(layerActions),
    ...extractFunctions(localeActions),
    ...extractFunctions(locateActions),
    ...extractFunctions(mapActions),
    ...extractFunctions(taskActions),
    ...extractFunctions(themeActions),
    ...extractFunctions(windowsActions)
})(API);
