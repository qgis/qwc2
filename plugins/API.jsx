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

import * as displayActions from '../actions/display';
import * as editingActions from '../actions/editing';
import {LayerRole} from '../actions/layers';
import * as layerActions from '../actions/layers';
import {registerCustomPlugin, unregisterCustomPlugin} from '../actions/localConfig';
import * as locateActions from '../actions/locate';
import * as mapActions from '../actions/map';
import * as taskActions from '../actions/task';
import * as themeActions from '../actions/theme';
import * as windowsActions from '../actions/windows';
import AppMenu from '../components/AppMenu.jsx';
import AttributeForm from '../components/AttributeForm.jsx';
import AutoEditForm from '../components/AutoEditForm.jsx';
import CoordinateDisplayer from '../components/CoordinateDisplayer.jsx';
import EditComboField from '../components/EditComboField.jsx';
import EditUploadField from '../components/EditUploadField.jsx';
import FullscreenSwitcher from '../components/FullscreenSwitcher.jsx';
import Icon from '../components/Icon.jsx';
import IdentifyViewer from '../components/IdentifyViewer.jsx';
import ImportLayer from '../components/ImportLayer.jsx';
import InputContainer from '../components/InputContainer.jsx';
import LayerInfoWindow from '../components/LayerInfoWindow.jsx';
import LinkFeatureForm from '../components/LinkFeatureForm.jsx';
import MapSelection from '../components/MapSelection.jsx';
import MessageBar from '../components/MessageBar.jsx';
import ModalDialog from '../components/ModalDialog.jsx';
import NumericInputWindow from '../components/NumericInputWindow.jsx';
import PickFeature from '../components/PickFeature.jsx';
import PluginsContainer from '../components/PluginsContainer.jsx';
import PopupMenu from '../components/PopupMenu.jsx';
import PrintFrame from '../components/PrintFrame.jsx';
import QtDesignerForm from '../components/QtDesignerForm.jsx';
import ResizeableWindow from '../components/ResizeableWindow.jsx';
import Search from '../components/Search.jsx';
import SearchBox from '../components/SearchBox.jsx';
import ServiceInfoWindow from '../components/ServiceInfoWindow.jsx';
import SideBar from '../components/SideBar.jsx';
import Spinner from '../components/Spinner.jsx';
import {Swipeable} from '../components/Swipeable.jsx';
import TaskBar from '../components/TaskBar.jsx';
import ThemeLayersListWindow from '../components/ThemeLayersListWindow.jsx';
import ThemeList from '../components/ThemeList.jsx';
import Toolbar from '../components/Toolbar.jsx';
import ShareLink from '../components/share/ShareLink.jsx';
import ShareQRCode from '../components/share/ShareQRCode.jsx';
import ShareSocials from '../components/share/ShareSocials.jsx';
import FixedTimeline from '../components/timeline/FixedTimeline.jsx';
import InfiniteTimeline from '../components/timeline/InfiniteTimeline.jsx';
import TimelineFeaturesSlider from '../components/timeline/TimelineFeaturesSlider.jsx';
import AccordeonWidget from '../components/widgets/AccordeonWidget.jsx';
import ButtonBar from '../components/widgets/ButtonBar.jsx';
import ColorButton from '../components/widgets/ColorButton.jsx';
import ComboBox from '../components/widgets/ComboBox.jsx';
import CopyButton from '../components/widgets/CopyButton.jsx';
import DateTimeInput from '../components/widgets/DateTimeInput.jsx';
import EditableSelect from '../components/widgets/EditableSelect.jsx';
import FileSelector from '../components/widgets/FileSelector.jsx';
import Input from '../components/widgets/Input.jsx';
import LayerCatalogWidget from '../components/widgets/LayerCatalogWidget.jsx';
import MenuButton from '../components/widgets/MenuButton.jsx';
import NavBar from '../components/widgets/NavBar.jsx';
import NumberInput from '../components/widgets/NumberInput.jsx';
import {Image} from '../components/widgets/Primitives.jsx';
import SearchWidget from '../components/widgets/SearchWidget.jsx';
import SuggestionInput from '../components/widgets/SuggestionInput.jsx';
import TextInput from '../components/widgets/TextInput.jsx';
import ToggleSwitch from '../components/widgets/ToggleSwitch.jsx';
import VectorLayerPicker from '../components/widgets/VectorLayerPicker.jsx';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import EditingInterface from '../utils/EditingInterface';
import * as EditingUtils from '../utils/EditingUtils';
import LayerUtils from '../utils/LayerUtils';
import * as PermaLinkUtils from '../utils/PermaLinkUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

/**
 * Exposes an API for interacting with QWC2 via `window.qwc2`.
 *
 * All following action functions are available:
 *
 * - [display](https://github.com/qgis/qwc2/blob/master/actions/display.js)
 * - [layers](https://github.com/qgis/qwc2/blob/master/actions/layers.js)
 * - [locate](https://github.com/qgis/qwc2/blob/master/actions/locate.js)
 * - [map](https://github.com/qgis/qwc2/blob/master/actions/map.js)
 * - [task](https://github.com/qgis/qwc2/blob/master/actions/task.js)
 * - [theme](https://github.com/qgis/qwc2/blob/master/actions/theme.js)
 * - [windows](https://github.com/qgis/qwc2/blob/master/actions/windows.js)
 *
 * I.e. `setCurrentTask` is available via `window.qwc2.setCurrentTask`.
 *
 * Additionally, the following functions are available:
 *
 * ---
 *
 * `window.qwc2.addExternalLayer(resource, beforeLayerName = null)`
 *
 * Convenience method for adding an external layer.
 *
 *   * `resource`: An external resource of the form `wms:<service_url>#<layername>` or `wmts:<capabilities_url>#<layername>`.
 *   * `beforeLayerName`: Insert the new layer before the layer with the specified name. If `null` or the layer does not exist, the layer is inserted on top.
 *
 * ---
 *
 * `window.qwc2.drawScratch(geomType, message, drawMultiple, callback, style = null)`
 *
 *  Deprecated, use `window.qwc2.drawGeometry` instead.
 *
 * ---
 *
 * `window.qwc2.drawGeometry(geomType, message, callback, options)`
 *
 *  Draw geometries, and return these as GeoJSON to the calling application.
 *
 *   * `geomType`: `Point`, `LineString`, `Polygon`, `Circle` or `Box`.
 *   * `message`: A descriptive string to display in the tool taskbar.
 *   * `callback`: A `function(result, crs)`, the `result` being an array of GeoJSON features, and `crs` the projection of the feature coordinates.
 *   * `options`: Optional configuration:
 *         `drawMultiple`: Whether to allow drawing multiple geometries (default: `false`).
 *         `style`: A custom style object to use for the drawn features, in the same format as `DEFAULT_FEATURE_STYLE` in `qwc2/utils/FeatureStyles.js`.
 *         `initialFeatures`: Array of initial geometries.
 *         `snapping`: Whether snapping is available while drawing (default: `false`).
 *         `snappingActive`: Whether snapping is initially active (default: `false`)
 *
 * ---
 *
 * `window.qwc2.getState()`
 *
 * Return the current application state.
 */
class API extends React.Component {
    componentDidMount() {
        window.qwc2 = {};
        window.qwc2.customPlugins = {};
        // Auto-binded functions
        for (const prop of Object.keys(this.props)) {
            window.qwc2[prop] = this.props[prop];
        }
        // Additional exports
        window.qwc2.LayerRole = LayerRole;
        window.qwc2.addPlugin = this.addPlugin;
        window.qwc2.removePlugin = this.removePlugin;
        window.qwc2.addExternalLayer = this.addExternalLayer;
        window.qwc2.drawScratch = this.drawScratch;
        window.qwc2.drawGeometry = this.drawGeometry;
        window.qwc2.getState = this.getState;
        window.qwc2.CoordinatesUtils = CoordinatesUtils;
        window.qwc2.EditingInterface = EditingInterface;
        window.qwc2.EditingUtils = EditingUtils;
        window.qwc2.PermaLinkUtils = PermaLinkUtils;
        window.qwc2.VectorLayerUtils = VectorLayerUtils;

        window.qwc2.libs = {};
        window.qwc2.libs.axios = axios;
        window.qwc2.libs.React = React;
        window.qwc2.libs.PropTypes = PropTypes;
        window.qwc2.libs.connect = connect;
        window.qwc2.libs.ol = ol;

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
        window.qwc2.components.PrintFrame = PrintFrame;
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
    addPlugin = (name, plugin) => {
        window.qwc2.customPlugins[name] = plugin;
        this.props.registerCustomPlugin(name);
    };
    removePlugin = (name) => {
        this.props.unregisterCustomPlugin(name);
        delete window.qwc2.customPlugins[name];
    };
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
    drawScratch = (geomType, message, drawMultiple, callback, style = null) => {
        /* eslint-disable-next-line */
        console.warn("window.qwc2.drawScratch is deprecated, use window.qwc2.drawGeometry instead");
        this.props.setCurrentTask("ScratchDrawing", null, null, {geomType, message, drawMultiple, callback, style});
    };
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
    ...extractFunctions(locateActions),
    ...extractFunctions(mapActions),
    ...extractFunctions(taskActions),
    ...extractFunctions(themeActions),
    ...extractFunctions(windowsActions)
})(API);
