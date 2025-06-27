/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import AppMenu from './components/AppMenu';
import FullscreenSwitcher from './components/FullscreenSwitcher';
import SearchBox from './components/SearchBox';
import Toolbar from './components/Toolbar';
import APIPlugin from './plugins/API';
import AttributeTablePlugin from './plugins/AttributeTable';
import AuthenticationPlugin from './plugins/Authentication';
import BackgroundSwitcherPlugin from './plugins/BackgroundSwitcher';
import BookmarkPlugin from './plugins/Bookmark';
import BottomBarPlugin from './plugins/BottomBar';
import CookiePopupPlugin from './plugins/CookiePopup';
import CyclomediaPlugin from './plugins/Cyclomedia';
import EditingPlugin from './plugins/Editing';
import FeatureFormPlugin from './plugins/FeatureForm';
import FeatureSearchPlugin from './plugins/FeatureSearch';
import GeometryDigitizerPlugin from './plugins/GeometryDigitizer';
import HeightProfilePlugin from './plugins/HeightProfile';
import HelpPlugin from './plugins/Help';
import HomeButtonPlugin from './plugins/HomeButton';
import IdentifyPlugin from './plugins/Identify';
import LayerCatalogPlugin from './plugins/LayerCatalog';
import LayerTreePlugin from './plugins/LayerTree';
import LocateButtonPlugin from './plugins/LocateButton';
import MapPlugin from './plugins/Map';
import MapComparePlugin from './plugins/MapCompare';
import MapCopyrightPlugin from './plugins/MapCopyright';
import MapExportPlugin from './plugins/MapExport';
import MapFilterPlugin from './plugins/MapFilter';
import MapInfoTooltipPlugin from './plugins/MapInfoTooltip';
import MapLegendPlugin from './plugins/MapLegend';
import MapTipPlugin from './plugins/MapTip';
import MeasurePlugin from './plugins/Measure';
import NewsPopupPlugin from './plugins/NewsPopup';
import OverviewMapPlugin from './plugins/OverviewMap';
import PanoramaxPlugin from './plugins/Panoramax';
import PortalPlugin from './plugins/Portal';
import PrintPlugin from './plugins/Print';
import ProcessNotificationsPlugin from './plugins/ProcessNotifications';
import RedliningPlugin from './plugins/Redlining';
import ReportsPlugin from './plugins/Reports';
import RoutingPlugin from './plugins/Routing';
import ScratchDrawingPlugin from './plugins/ScratchDrawing';
import SettingsPlugin from './plugins/Settings';
import SharePlugin from './plugins/Share';
import StartupMarkerPlugin from './plugins/StartupMarker';
import TaskButtonPlugin from './plugins/TaskButton';
import ThemeSwitcherPlugin from './plugins/ThemeSwitcher';
import TimeManagerPlugin from './plugins/TimeManager';
import TopBarPlugin from './plugins/TopBar';
import TourGuidePlugin from './plugins/TourGuide';
import ValueToolPlugin from './plugins/ValueTool';
import View3DPlugin from './plugins/View3D';
import {ZoomInPlugin, ZoomOutPlugin} from './plugins/ZoomButtons';
import EditingSupport from './plugins/map/EditingSupport';
import LocateSupport from './plugins/map/LocateSupport';
import MeasurementSupport from './plugins/map/MeasurementSupport';
import RedliningSupport from './plugins/map/RedliningSupport';
import SnappingSupport from './plugins/map/SnappingSupport';
import BufferSupport from './plugins/redlining/RedliningBufferSupport';
import defaultLocaleData from './static/translations/en-US.json';

export default {
    defaultLocaleData: defaultLocaleData,
    initialState: {
        defaultState: {},
        mobile: {}
    },
    pluginsDef: {
        plugins: {
            MapPlugin: MapPlugin({
                EditingSupport: EditingSupport,
                MeasurementSupport: MeasurementSupport,
                LocateSupport: LocateSupport,
                RedliningSupport: RedliningSupport,
                SnappingSupport: SnappingSupport
            }),
            APIPlugin: APIPlugin,
            AttributeTablePlugin: AttributeTablePlugin(/* CustomEditingInterface */),
            AuthenticationPlugin: AuthenticationPlugin,
            BackgroundSwitcherPlugin: BackgroundSwitcherPlugin,
            BookmarkPlugin: BookmarkPlugin,
            BottomBarPlugin: BottomBarPlugin,
            CookiePopupPlugin: CookiePopupPlugin,
            CyclomediaPlugin: CyclomediaPlugin,
            EditingPlugin: EditingPlugin(/* CustomEditingInterface */),
            FeatureFormPlugin: FeatureFormPlugin(/* CustomEditingInterface */),
            GeometryDigitizerPlugin: GeometryDigitizerPlugin,
            HeightProfilePlugin: HeightProfilePlugin,
            HelpPlugin: HelpPlugin(),
            HomeButtonPlugin: HomeButtonPlugin,
            IdentifyPlugin: IdentifyPlugin,
            LayerCatalogPlugin: LayerCatalogPlugin,
            LayerTreePlugin: LayerTreePlugin,
            LocateButtonPlugin: LocateButtonPlugin,
            MapComparePlugin: MapComparePlugin,
            MapCopyrightPlugin: MapCopyrightPlugin,
            MapExportPlugin: MapExportPlugin,
            MapFilterPlugin: MapFilterPlugin,
            MapInfoTooltipPlugin: MapInfoTooltipPlugin(),
            MapLegendPlugin: MapLegendPlugin,
            MapTipPlugin: MapTipPlugin,
            MeasurePlugin: MeasurePlugin,
            NewsPopupPlugin: NewsPopupPlugin,
            OverviewMapPlugin: OverviewMapPlugin,
            PanoramaxPlugin: PanoramaxPlugin,
            PortalPlugin: PortalPlugin,
            PrintPlugin: PrintPlugin,
            ProcessNotificationsPlugin: ProcessNotificationsPlugin,
            RedliningPlugin: RedliningPlugin({
                BufferSupport: BufferSupport
            }),
            ReportsPlugin: ReportsPlugin,
            RoutingPlugin: RoutingPlugin,
            FeatureSearchPlugin: FeatureSearchPlugin,
            ScratchDrawingPlugin: ScratchDrawingPlugin,
            SettingsPlugin: SettingsPlugin,
            SharePlugin: SharePlugin,
            StartupMarkerPlugin: StartupMarkerPlugin,
            TaskButtonPlugin: TaskButtonPlugin,
            ThemeSwitcherPlugin: ThemeSwitcherPlugin,
            TimeManagerPlugin: TimeManagerPlugin,
            TopBarPlugin: TopBarPlugin({
                AppMenu: AppMenu,
                Search: SearchBox,
                Toolbar: Toolbar,
                FullscreenSwitcher: FullscreenSwitcher
            }),
            TourGuidePlugin: TourGuidePlugin,
            ValueToolPlugin: ValueToolPlugin,
            View3DPlugin: View3DPlugin,
            ZoomInPlugin: ZoomInPlugin,
            ZoomOutPlugin: ZoomOutPlugin
        },
        cfg: {
        }
    },
    actionLogger: (action) => {
        /* Do something with action, i.e. Piwik/Mamoto event tracking */
    }
    /*
    themeLayerRestorer: (missingLayers, theme, callback) => {
        // Invoked for layers specified in the l url parameter which are missing in the specified theme
        // Could be used to query a search provider for the missing theme layers

        // A list of theme layers to merge into the theme
        const newLayers = [];

        // A dictionary mapping the name of the searched layer name with the resulting layer name(s) as an array, i.e.
        // {searchlayername: ["resultlayername1", "resultlayername2"], ...}
        const newLayerNames = {};

        callback(newLayers, newLayerNames);
    }*/
    /* externalLayerRestorer: (externalLayers, themes, callback) => {
        // Optional function to handle restoring of external layers from the l URL parameter
        // If omitted, the default handler is used which downloads capabilities for each service to restore the layer
    }*/
};
