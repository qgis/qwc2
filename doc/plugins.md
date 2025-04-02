Plugin reference
================

* [API](#api)
* [AttributeTable](#attributetable)
* [Authentication](#authentication)
* [BackgroundSwitcher](#backgroundswitcher)
* [Bookmark](#bookmark)
* [BottomBar](#bottombar)
* [CookiePopup](#cookiepopup)
* [Cyclomedia](#cyclomedia)
* [Editing](#editing)
* [FeatureForm](#featureform)
* [FeatureSearch](#featuresearch)
* [GeometryDigitizer](#geometrydigitizer)
* [HeightProfile](#heightprofile)
* [Help](#help)
* [HomeButton](#homebutton)
* [Identify](#identify)
* [LayerCatalog](#layercatalog)
* [LayerTree](#layertree)
* [LocateButton](#locatebutton)
* [MapPlugin](#mapplugin)
* [MapComparePlugin](#mapcompareplugin)
* [MapCopyright](#mapcopyright)
* [MapExport](#mapexport)
* [MapFilter](#mapfilter)
* [MapInfoTooltip](#mapinfotooltip)
* [MapLegend](#maplegend)
* [MapTip](#maptip)
* [Measure](#measure)
* [NewsPopup](#newspopup)
* [Panoramax](#panoramax)
* [Portal](#portal)
* [Print](#print)
* [ProcessNotifications](#processnotifications)
* [Redlining](#redlining)
* [Reports](#reports)
* [Routing](#routing)
* [ScratchDrawing](#scratchdrawing)
* [Settings](#settings)
* [Share](#share)
* [StartupMarker](#startupmarker)
* [TaskButton](#taskbutton)
* [ThemeSwitcher](#themeswitcher)
* [TimeManager](#timemanager)
* [TopBar](#topbar)
* [View3D](#view3d)
* [ZoomButton](#zoombutton)
* [EditingSupport](#editingsupport)
* [LocateSupport](#locatesupport)
* [MeasurementSupport](#measurementsupport)
* [OverviewMap](#overviewmap)
* [RedliningSupport](#redliningsupport)
* [ScaleBarSupport](#scalebarsupport)
* [SnappingSupport](#snappingsupport)

---
API<a name="api"></a>
----------------------------------------------------------------
Exposes an API for interacting with QWC2 via `window.qwc2`.

You can interact with the API as soon as the `QWC2ApiReady` event is dispatched.

For example:

```
window.addEventListener("QWC2ApiReady", () => {
     const {React} = window.qwc2.libs;

     class MyPlugin extends React.Component {
         render() {
             return React.createElement("div", {}, "Hello World");
         }
     }

     window.qwc2.addPlugin("MyPlugin", MyPlugin);
});
```

All following action functions are available:

- [display](https://github.com/qgis/qwc2/blob/master/actions/display.js)
- [editing](https://github.com/qgis/qwc2/blob/master/actions/editing.js)
- [layers](https://github.com/qgis/qwc2/blob/master/actions/layers.js)
- [locate](https://github.com/qgis/qwc2/blob/master/actions/locate.js)
- [map](https://github.com/qgis/qwc2/blob/master/actions/map.js)
- [task](https://github.com/qgis/qwc2/blob/master/actions/task.js)
- [theme](https://github.com/qgis/qwc2/blob/master/actions/theme.js)
- [windows](https://github.com/qgis/qwc2/blob/master/actions/windows.js)

I.e. `setCurrentTask` is available via `window.qwc2.setCurrentTask`.

Some of the core libraries (React, axios, ol, ...) are accessible via `window.qwc2.libs`.

In addition, the following methods are available on `window.qwc2`:

**addPlugin(name,plugin,translations)**

Add custom plugin

* `name`: An identifier
* `plugin`: The plugin component class
* `translations`: The plugin translation messages: `{"<lang>": {<messages>}, ...}`

**removePlugin(name)**

Remove custom plugin

* `name`: The identifier

**addIdentifyAttributeCalculator(name,calcFunc)**

Add custom attribute calculator
(i.e. computed attributes which are added to GetFeatureInfo responses).

* `name`: An identifier
* `calcFunc`: The calculator function with signature `function(layer, feature)`

The `calcFunc` should return either a two-enty `[name, value]` pair or a one-value `[value]` array.

**removeIdentifyAttributeCalculator(name)**

Remove custom identify attribute calculator

* `name`: The identifier

**addIdentifyExporter(name,exporterConfig)**

Add custom identify exporter

* `name`: An identifier
* `exporterFunc`: The exporter configuration

The exporter configuration is an object of the shape

```
{
   id: "<id>",
   title: "<title>",
   allowClipboard: <true|false>,
   export: (features, callback) => {
     callback({
       data: <blob>, type: "<mimeType>", filename: "<filename>"
     });
   }
 }
```

**removeIdentifyExporter(name)**

Remove identify exporter

* `name`: The identifier

**drawScratch(geomType,message,drawMultiple,callback,style)**

Deprecated, use `window.qwc2.drawGeometry` instead.

**drawGeometry(geomType,message,callback,options)**

Draw geometries, and return these as GeoJSON to the calling application.

* `geomType`: `Point`, `LineString`, `Polygon`, `Circle` or `Box`.
* `message`: A descriptive string to display in the tool taskbar.
* `callback`: A `function(result, crs)`, the `result` being an array of GeoJSON features, and `crs` the projection of the feature coordinates.
* `options`: Optional configuration:
  * `drawMultiple`: Whether to allow drawing multiple geometries (default: `false`).
  * `style`: A custom style object to use for the drawn features, in the same format as `DEFAULT_FEATURE_STYLE` in `qwc2/utils/FeatureStyles.js`.
  * `initialFeatures`: Array of initial geometries.
  * `snapping`: Whether snapping is available while drawing (default: `false`).
  * `snappingActive`: Whether snapping is initially active (default: `false`)

**getState()**

Return the current application state.

AttributeTable<a name="attributetable"></a>
----------------------------------------------------------------
Displaying the attribute table of layers in a dialog.

To make a layer available in the attribute table, create a a data resource and matching permissions for it in the `qwc-admin-gui`.

The attribute table works for both read-only as well as read-write data resources.

This plugin queries the dataset via the editing service specified by
`editServiceUrl` in `config.json` (by default the `qwc-data-service`).

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| allowAddForGeometryLayers | `bool` | Whether to allow adding records for datasets which have a geometry column. | `undefined` |
| showEditFormButton | `bool` | Whether to show a button to open the edit form for selected layer. Requires the Editing plugin to be enabled. | `true` |
| showLimitToExtent | `bool` | Whether to show the "Limit to extent" checkbox | `undefined` |
| zoomLevel | `number` | The zoom level for zooming to point features. | `1000` |

Authentication<a name="authentication"></a>
----------------------------------------------------------------
Handles authentication

Invokes the the authentication service specified by `authServiceUrl` in `config.json`.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| clearLayerParam | `bool` | Whether to clear the layer parameter from the URL on login. | `undefined` |
| idleTimeout | `number` | An idle timeout in seconds after which the user is automatically logged of. | `undefined` |
| logoutTargetUrl | `string` | An URL to redirect to on logout, instead of the viewer URL. | `undefined` |
| requireLogin | `bool` | Whether authentication is required, i.e. the viewer automatically redirects to the login page if no user is authenticated. | `undefined` |
| showLoginUser | `bool` | Whether to display the currently logged in user below the application menu button. | `undefined` |

BackgroundSwitcher<a name="backgroundswitcher"></a>
----------------------------------------------------------------
Map button for switching the background layer.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| position | `number` | The position slot index of the map button, from the bottom (0: bottom slot). | `0` |

Bookmark<a name="bookmark"></a>
----------------------------------------------------------------
Allows managing user bookmarks.

Bookmarks are only allowed for authenticated users.

Requires `permalinkServiceUrl` to point to a `qwc-permalink-service`.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |

BottomBar<a name="bottombar"></a>
----------------------------------------------------------------
Bottom bar, displaying mouse coordinate, scale, etc.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| additionalBottomBarLinks | `[{`<br />`  label: string,`<br />`  labelMsgId: string,`<br />`  url: string,`<br />`  urlTarget: string,`<br />`  icon: string,`<br />`}]` | Additional bottombar links | `undefined` |
| displayCoordinates | `bool` | Whether to display the coordinates in the bottom bar. | `true` |
| displayScales | `bool` | Whether to display the scale in the bottom bar. | `true` |
| termsUrl | `string` | The URL of the terms label anchor. | `undefined` |
| termsUrlIcon | `string` | Icon of the terms inline window. Relevant only when `termsUrlTarget` is `iframe`. | `undefined` |
| termsUrlTarget | `string` | The target where to open the terms URL. If `iframe`, it will be displayed in an inline window, otherwise in a new tab. You can also use the `:iframedialog:<dialogname>:<options>` syntax to set up the inline window. | `undefined` |
| viewertitleUrl | `string` | The URL of the viewer title label anchor. | `undefined` |
| viewertitleUrlIcon | `string` | Icon of the viewer title inline window. Relevant only when `viewertitleUrl` is `iframe`. | `undefined` |
| viewertitleUrlTarget | `string` | The target where to open the viewer title URL. If `iframe`, it will be displayed in an inline window, otherwise in a new tab. You can also use the `:iframedialog:<dialogname>:<options>` syntax to set up the inline window. | `undefined` |

CookiePopup<a name="cookiepopup"></a>
----------------------------------------------------------------
A simple popup to notify that cookies are used.

Cyclomedia<a name="cyclomedia"></a>
----------------------------------------------------------------
Cyclomedia integration for QWC2.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| apikey | `string` | The Cyclomedia API key | `undefined` |
| clientId | `string` | OAuth client ID. | `undefined` |
| credentialUserInfoFields | `{`<br />`  username: string,`<br />`  password: string,`<br />`}` | Fields from user_infos which contain username and password which will be pre-inserted into the login form. | `undefined` |
| cyclomediaVersion | `string` | The cyclomedia version. | `'24.1'` |
| displayMeasurements | `bool` | Whether to display Cyclomedia measurement geometries on the map. | `true` |
| geometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`  side: string,`<br />`}` | Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). | `{`<br />`    initialWidth: 480,`<br />`    initialHeight: 640,`<br />`    initialX: 0,`<br />`    initialY: 0,`<br />`    initiallyDocked: false,`<br />`    side: 'left'`<br />`}` |
| loginRedirectUri | `string` | The relative path to the redirect login handling of oauth. | `undefined` |
| logoutRedirectUri | `string` | The relative path to the redirect logout handling of oauth. | `undefined` |
| maxMapScale | `number` | The maximum map scale above which the recordings WFS won't be displayed. | `5000` |
| projection | `string` | The projection to use for Cyclomedia. | `'EPSG:3857'` |

Editing<a name="editing"></a>
----------------------------------------------------------------
Allows editing geometries and attributes of datasets.

The attribute form is generated from the QGIS attribute form configuration.

This plugin queries the dataset via the editing service specified by
`editServiceUrl` in `config.json` (by default the `qwc-data-service`).

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| allowCloneGeometry | `bool` | Whether to enable the "Clone existing geometry" functionality. | `true` |
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |
| snapping | `bool` | Whether snapping is available when editing. | `true` |
| snappingActive | `{bool, string}` | Whether snapping is enabled by default when editing.<br /> Either `false`, `edge`, `vertex` or `true` (i.e. both vertex and edge). | `true` |
| width | `string` | The default width of the editing sidebar, as a CSS width string. | `"30em"` |

FeatureForm<a name="featureform"></a>
----------------------------------------------------------------
Displays queried feature attributes in a form.

The attribute form is generated from the QGIS attribute form configuration.

This plugin queries the feature via the editing service specified by
`editServiceUrl` in `config.json` (by default the `qwc-data-service`), rather than over WMS
GetFeatureInfo like the `Identify` plugin.

You need to create and permit `Data` resources for datasets which should be queryable via `FeatureForm`.
If the dataset it editable, the feature attributes can be edited directly in the displayed form.

Can be used as default identify tool by setting `"identifyTool": "FeatureForm"` in `config.json`.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| exitTaskOnResultsClose | `bool` | Whether to clear the task when the results window is closed. | `undefined` |
| geometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`  side: string,`<br />`}` | Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). | `{`<br />`    initialWidth: 320,`<br />`    initialHeight: 480,`<br />`    initialX: 0,`<br />`    initialY: 0,`<br />`    initiallyDocked: false,`<br />`    side: 'left'`<br />`}` |

FeatureSearch<a name="featuresearch"></a>
----------------------------------------------------------------
Displays a dialog with a search form for configured QGIS feature searches with one or more input fields.

See [Configuring the QGIS feature search](../../topics/Search/#configuring-the-qgis-feature-search).

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |

GeometryDigitizer<a name="geometrydigitizer"></a>
----------------------------------------------------------------
Allows digitizing geometries to send to configured applications.

Configure the available target applications in `themesConfig.json`:
```
{
  "themes": {
    "items": [{
      ...
      "pluginData": {
        "geometryLinks": ["<geomLinkName>", "<geomLinkName>", ...]
      }
    }],
  },
  "pluginData": {
    "geometryLinks": [
      {
        "name": "<geomLinkName>",                // Link name referenced in theme item
        "title": "<geomLinkTitle>",              // Link title, displayed in the selection combo
        "geomType": ["<geomType>", "<geomType>"] // Supported geometry types (Point, LineString, Polygon)
        "url": "<targetApplicationUrl>",         // Application target URL, receiving the POST submit
        "params": {"<key>": "<value>", ...}      // Optional: additional form parameters to post to URL
        "target": "<target>" | {                 // Optional: form POST target which to display the result
          "iframedialog": true,                  // Use an iframe dialog
          "w": <dialogWidth>,                    // Dialog width
          "h": <dialogHeight>                    // Dialog height
        }
      }
    ]
  }
}
```

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| styleActive | `{`<br />`  strokeColor: array,`<br />`  strokeWidth: number,`<br />`  strokeDash: array,`<br />`  fillColor: array,`<br />`}` | The style of active geometries (i.e. supported by the selected application) | `{`<br />`    strokeColor: [0, 160, 0, 1],`<br />`    fillColor: [0, 160, 0, 0.33]`<br />`}` |
| styleInactive | `{`<br />`  strokeColor: array,`<br />`  strokeWidth: number,`<br />`  strokeDash: array,`<br />`  fillColor: array,`<br />`}` | The style of inactive (i.e. not supported by the selected application) | `{`<br />`    strokeColor: [127, 127, 127, 1],`<br />`    fillColor: [127, 127, 127, 0.33]`<br />`}` |

HeightProfile<a name="heightprofile"></a>
----------------------------------------------------------------
Displays a height profile along a measured line.

Triggered automatically when a line is measured via the `Measure` plugin.

Requires `elevationServiceUrl` in `config.json` to point to a `qwc-elevation-service`.

The print height profile functionality requires a template located by default at `assets/templates/heightprofileprint.html`
with containing a container element with `id=heightprofilecontainer`.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| height | `number` | The height of the height profile widget in pixels. | `150` |
| heightProfilePrecision | `number` | The precision of displayed and exported values (0: no decimals, 1: 1 decimal position, etc). | `0` |
| samples | `number` | The number of elevation samples to query. | `500` |
| templatePath | `string` | Template location for the height profile print functionality | `":/templates/heightprofileprint.html"` |

Help<a name="help"></a>
----------------------------------------------------------------
Displays a custom help dialog in a sidebar.

Define the help contents by specifying the `bodyContentsFragmentUrl` prop.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| bodyContentsFragmentUrl | `string` | URL to a document containing a HTML fragment to display in the Help sidebar. | `undefined` |
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |

HomeButton<a name="homebutton"></a>
----------------------------------------------------------------
Map button for reverting to the home extent of the theme.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| position | `number` | The position slot index of the map button, from the bottom (0: bottom slot). | `5` |
| themeFlagBlacklist | `[string]` | Omit the button in themes matching one of these flags. | `undefined` |
| themeFlagWhitelist | `[string]` | Only show the button in themes matching one of these flags. | `undefined` |

Identify<a name="identify"></a>
----------------------------------------------------------------
Displays queried feature attributes.

Uses WMS GetFeatureInfo to query features and displays the result in
table, as a HTML fragment or as plain text based on the supported GetFeatureInfo
format.

Extendable in combination with the `qwc-feature-info-service`, which provides support
for customized queries and templates for the result presentation.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| attributeCalculator | `func` | Optional function for computing derived attributes. See js/IdentifyExtensions.js for details. This prop can be specified in the appConfig.js cfg section. | `undefined` |
| attributeTransform | `func` | Optional function for transforming attribute values. See js/IdentifyExtensions.js for details. This prop can be specified in the appConfig.js cfg section. | `undefined` |
| clearResultsOnClose | `bool` | Whether to clear the identify results when exiting the identify tool. | `true` |
| customExporters | `array` | Optional list of custom exporters to offer along with the built-in exporters. See js/IdentifyExtensions.js for details. This prop can be specified in the appConfig.js cfg section. | `[]` |
| displayResultTree | `bool` | Whether to display a tree overview of results (as opposed to a flat list of results). | `true` |
| enableExport | `{bool, array}` | Whether to enable the export functionality. Either `true|false` or a list of single allowed formats (builtin formats: `json`, `geojson`, `csv`, `csvzip`) | `true` |
| exitTaskOnResultsClose | `bool` | Whether to clear the task when the results window is closed. | `undefined` |
| exportGeometry | `bool` | Whether to include the geometry in exported features. Default: `true`. | `true` |
| featureInfoReturnsLayerName | `bool` | Whether to assume that XML GetFeatureInfo responses specify the technical layer name in the `name` attribute, rather than the layer title. | `true` |
| geometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`  side: string,`<br />`}` | Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). | `{`<br />`    initialWidth: 240,`<br />`    initialHeight: 320,`<br />`    initialX: 0,`<br />`    initialY: 0,`<br />`    initiallyDocked: false,`<br />`    side: 'left'`<br />`}` |
| highlightAllResults | `bool` | Whether to highlight all results if no result is hovered | `true` |
| initialRadiusUnits | `string` | The initial radius units of the identify dialog in radius mode. One of 'm', 'ft', 'km', 'mi'. | `'m'` |
| params | `object` | Extra params to append to the GetFeatureInfo request (i.e. `FI_POINT_TOLERANCE`, `FI_LINE_TOLERANCE`, `feature_count`, ...). Additionally, `region_feature_count` and `radius_feature_count` are supported. | `undefined` |
| replaceImageUrls | `bool` | Whether to replace an attribute value containing an URL to an image with an inline image. | `true` |
| showLayerSelector | `bool` | Whether to show a layer selector to filter the identify results by layer. | `true` |

LayerCatalog<a name="layercatalog"></a>
----------------------------------------------------------------
Displays a pre-configured catalog of external layers in a window.

Configured through a catalog JSON containing a tree of external layer identifiers.

For `wms` layers, `sublayers: false` denotes that the sublayer structure of the added layer should not
be exposed in the layer tree.

Example:
```json
{
  "catalog": [
    {
      "title": "Öffentlicher Verkehr swissTLMRegio",
      "resource": "wms:http://wms.geo.admin.ch#ch.swisstopo.vec200-transportation-oeffentliche-verkehr",
      "sublayers": false
    },
    {
      "title": "Gewässerschutz",
       "resource": "wms:https://geo.so.ch/api/wms#ch.so.afu.gewaesserschutz[50]"
    },
    {
      "title": "Landeskarten",
      "sublayers": [
        {
          "title": "Landeskarte 1:1 Million | LK1000",
          "resource": "wms:http://wms.geo.admin.ch#ch.swisstopo.pixelkarte-farbe-pk1000.noscale"
        },
        {
          "title": "Landeskarte 1:100`000 | LK100",
          "resource": "wms:http://wms.geo.admin.ch#ch.swisstopo.pixelkarte-farbe-pk100.noscale"
        }
      ]
    }
  ]
}
```

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| catalogUrl | `string` | The URL to the catalog JSON file. | `undefined` |
| geometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`  side: string,`<br />`}` | Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). | `{`<br />`    initialWidth: 320,`<br />`    initialHeight: 320,`<br />`    initialX: 0,`<br />`    initialY: 0,`<br />`    initiallyDocked: false,`<br />`    side: 'left'`<br />`}` |
| levelBasedIndentSize | `bool` | Whether to increase the indent size dynamically according to the current level (`true`) or keep the indent size constant (`false`). | `true` |

LayerTree<a name="layertree"></a>
----------------------------------------------------------------
Displays the map layer tree in a sidebar.

The print legend functionality requires a template located by default at assets/templates/legendprint.html
with containing a container element with id=legendcontainer.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| addLayerSeparator | `func` | Whether to allow adding separator entries in the layer tree, useful for organizing the tree. | `undefined` |
| allowCompare | `bool` | Whether to enable the compare function. Requires the `MapCompare` plugin. | `true` |
| allowImport | `bool` | Whether to allow importing external layers. | `true` |
| allowMapTips | `bool` | Whether to allow enabling map tips. | `true` |
| allowSelectIdentifyableLayers | `bool` | Whether to allow selection of identifyable layers. The `showQueryableIcon` property should be `true` to be able to select identifyable layers. | `false` |
| bboxDependentLegend | `{bool, string}` | Whether to display a BBOX dependent legend. Can be `true|false|"theme"`, latter means only for theme layers. | `false` |
| enableLegendPrint | `bool` | Whether to enable the legend print functionality. | `true` |
| enableServiceInfo | `bool` | Whether to display a service info button to display the WMS service metadata. | `true` |
| enableVisibleFilter | `bool` | Whether to display a button to filter invisible layers from the layertree. | `true` |
| extraLegendParameters | `string` | Additional parameters to pass to the GetLegendGraphics request. | `undefined` |
| fallbackDrag | `bool` | Whether to use the fallback logic for drag-and-drop. | `undefined` |
| flattenGroups | `bool` | Whether to display a flat layer tree, omitting any groups. | `false` |
| grayUnchecked | `bool` | Whether to display unchecked layers gray in the layertree. | `true` |
| groupTogglesSublayers | `bool` | Whether toggling a group also toggles all sublayers. | `false` |
| infoInSettings | `bool` | Whether to display the layer info button inside the layer settings menu rather than next to the layer title. | `true` |
| layerInfoGeometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`}` | Default layer info window geometry with size, position and docking status. | `{`<br />`    initialWidth: 480,`<br />`    initialHeight: 480,`<br />`    initialX: null,`<br />`    initialY: null,`<br />`    initiallyDocked: false`<br />`}` |
| onlyGroups | `bool` | Whether to only display layer groups but not individual layers in layertree. | `false` |
| scaleDependentLegend | `{bool, string}` | Whether to display a scale dependent legend. Can be `true|false|"theme"`, latter means only for theme layers. | `undefined` |
| showAttributeTableLink | `bool` | Whether to display an icon linking to the layer attribute table in the layer options menu. | `undefined` |
| showLegendIcons | `bool` | Whether to display legend icons. | `true` |
| showQueryableIcon | `bool` | Whether to display the queryable icon to indicate that a layer is identifyable. | `true` |
| showRootEntry | `bool` | Whether to display the root entry of the layertree. | `true` |
| showToggleAllLayersCheckbox | `bool` | Whether to display a checkbox to toggle all layers. | `true` |
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |
| templatePath | `string` | Template location for the legend print functionality | `":/templates/legendprint.html"` |
| width | `string` | The initial width of the layertree, as a CSS width string. | `"25em"` |

LocateButton<a name="locatebutton"></a>
----------------------------------------------------------------
Map button for controling the locate (GPS) state.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| position | `number` | The position slot index of the map button, from the bottom (0: bottom slot). | `2` |
| themeFlagBlacklist | `[string]` | Omit the button in themes matching one of these flags. | `undefined` |
| themeFlagWhitelist | `[string]` | Only show the button in themes matching one of these flags. | `undefined` |

MapPlugin<a name="mapplugin"></a>
----------------------------------------------------------------
The main map component.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| mapOptions | `{`<br />`  zoomDuration: number,`<br />`  enableRotation: bool,`<br />`  rotation: number,`<br />`  panStepSize: number,`<br />`  panPageSize: number,`<br />`  constrainExtent: bool,`<br />`  kineticPanParams: object,`<br />`}` | Zoom duration in ms, rotation in degrees, panStepSize and panPageSize as fraction of map width/height. | `{}` |
| showLoading | `bool` | Whether to display the loading spinner when layers are loading. | `true` |
| swipeGeometryTypeBlacklist | `[string]` | A list of layer geometry types to ignore when determining the top-most layer to compare. | `[]` |
| swipeLayerNameBlacklist | `[string]` | A list of layer names to ignore when determining the top-most layer to compare. You can use `*` as a whildcard character. | `[]` |
| toolsOptions | `object` | Map tool configuraiton options. Refer to the sample config.json. | `{}` |

MapComparePlugin<a name="mapcompareplugin"></a>
----------------------------------------------------------------
Allows comparing the top layer with the rest of the map.

Activated through a checkbox in the LayerTree.

MapCopyright<a name="mapcopyright"></a>
----------------------------------------------------------------
Displays layer attributions in the bottom right corner of the map.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| prefixCopyrightsWithLayerNames | `bool` | Whether to prepend the layer name to the attribution string. | `undefined` |
| showThemeCopyrightOnly | `bool` | Whether to only display the attribution of the theme, omitting external layers. | `undefined` |

MapExport<a name="mapexport"></a>
----------------------------------------------------------------
Allows exporting a selected portion of the map to a variety of formats.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| allowedFormats | `[string]` | Whitelist of allowed export format mimetypes. If empty, supported formats are listed. | `undefined` |
| allowedScales | `{[number], bool}` | List of scales at which to export the map. If empty, scale can be freely specified. If `false`, the map can only be exported at the current scale. | `undefined` |
| defaultFormat | `string` | Default export format mimetype. If empty, first available format is used. | `undefined` |
| defaultScaleFactor | `number` | The factor to apply to the map scale to determine the initial export map scale (if `allowedScales` is not `false`). | `1` |
| dpis | `[number]` | List of dpis at which to export the map. If empty, the default server dpi is used. | `undefined` |
| exportExternalLayers | `bool` | Whether to include external layers in the image. Requires QGIS Server 3.x! | `true` |
| fileNameTemplate | `string` | Template for the name of the generated files when downloading. | `'{theme}_{timestamp}'` |
| formatConfiguration | `{`<br />`  format: [{`<br />`  name: string,`<br />`  extraQuery: string,`<br />`  formatOptions: string,`<br />`  baseLayer: string,`<br />`}],`<br />`}` | Custom export configuration per format.<br /> If more than one configuration per format is provided, a selection combo will be displayed.<br /> `extraQuery` will be appended to the query string (replacing any existing parameters).<br /> `formatOptions` will be passed as FORMAT_OPTIONS.<br /> `baseLayer` will be appended to the LAYERS instead of the background layer. | `undefined` |
| pageSizes | `[{`<br />`  name: string,`<br />`  width: number,`<br />`  height: number,`<br />`}]` | List of image sizes to offer, in addition to the free-hand selection. The width and height are in millimeters. | `[]` |
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |

MapFilter<a name="mapfilter"></a>
----------------------------------------------------------------
Allows filtering the map content via QGIS Server WMS FILTER.

See [Map filtering](../../topics/MapFilter).

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| allowCustomFilters | `bool` | Whether to allow custom filters. | `undefined` |
| allowFilterByGeom | `bool` | Whether to allow filter by geometry. Requires the filter_geom plugin from qwc-qgis-server-plugins, and the filter will only be applied to postgis layers. | `undefined` |
| allowFilterByTime | `bool` | Whether to display the temporal filter if temporal dimensions are found. | `true` |
| highlightStyle | `{`<br />`  strokeColor: array,`<br />`  strokeWidth: number,`<br />`  strokeDash: array,`<br />`  fillColor: array,`<br />`}` | The style used for highlighting filter geometries. | `{`<br />`    strokeColor: [0, 0, 0],`<br />`    fillColor: [255, 255, 0, 0.25]`<br />`}` |
| position | `number` | The position slot index of the map button, from the bottom (0: bottom slot). Set to -1 to hide the button. | `5` |
| side | `string` | The side of the application on which to display the sidebar. | `undefined` |

MapInfoTooltip<a name="mapinfotooltip"></a>
----------------------------------------------------------------
Provides map context information when right-clicking on the map.

Displays the coordinates at the picked position by default.

If `elevationServiceUrl` in `config.json` to points to a `qwc-elevation-service`,
the height at the picked position is also displayed.

If `mapInfoService` in `config.json` points to a `qwc-mapinfo-service`, additional
custom information according to the `qwc-mapinfo-service` configuration is returned.

You can pass additional plugin components to the `MapInfoTooltip` in `appConfig.js`:
```json
MapInfoTooltipPlugin: MapInfoTooltipPlugin([FirstPlugin, SecondPlugin])
```
where a Plugin is a React component of the form
```jsx
class MapInfoTooltipPlugin extends React.Component {
  static propTypes = {
    point: PropTypes.object,
    closePopup: PropTypes.func
  }
  render() { return ...; }
};
```

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| elevationPrecision | `number` | The number of decimal places to display for elevation values. | `0` |
| plugins | `array` | Additional plugin components for the map info tooltip. | `[]` |

MapLegend<a name="maplegend"></a>
----------------------------------------------------------------
Displays the map legend in a floating dialog.

The user can toggle whether to display only layers which are enabled, visible in the current extent and/or visible at the current scale.

See https://docs.qgis.org/3.28/en/docs/server_manual/services/wms.html#wms-getlegendgraphic for supported extra legend params.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| addGroupTitles | `bool` | Whether to add group titles to the legend. | `false` |
| addLayerTitles | `bool` | Whether to add layer titles to the legend. Note that often the legend image itself already contains the layer title. | `false` |
| bboxDependentLegend | `bool` | Whether to display a BBOX-dependent legend by default. | `false` |
| excludeLayers | `array` | List of layernames to exclude from the legend. | `[]` |
| extraLegendParameters | `string` | Extra parameters to add to the GetLegendGraphics request. | `undefined` |
| geometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`  side: string,`<br />`}` | Default window geometry with size, position and docking status. A locked window is not closeable and not resizeable. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). | `{`<br />`    initialWidth: 320,`<br />`    initialHeight: 320,`<br />`    initialX: 0,`<br />`    initialY: 0,`<br />`    initiallyDocked: false,`<br />`    side: 'left'`<br />`}` |
| lockedWindow | `bool` | Whether the legend window is locked (always visible, not moveable or closeable). Set position and size via `geometry`. | `undefined` |
| onlyVisibleLegend | `bool` | Whether to only include enabled layers in the legend by default. | `false` |
| scaleDependentLegend | `bool` | Whether to display a scale-dependent legend by default. | `false` |

MapTip<a name="maptip"></a>
----------------------------------------------------------------
Displays maptips by hovering over features on the map.

Queries the map tips configured in the QGIS layer properites over GetFeatureInfo.

The map tip needs to be configured in QGIS Layer Properties &rarr; Display.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| layerFeatureCount | `number` | The maximum number of feature maptips to display for a single layer. | `5` |
| maxHeight | `string` | The maximum height of the maptip popop bubble, as a CSS string. | `"15em"` |
| maxWidth | `string` | The maximum height of the maptip popop bubble, as a CSS string. | `"20em"` |
| showFeatureSelection | `bool` | Whether to show the maptip feature selection on the map or not | `true` |

Measure<a name="measure"></a>
----------------------------------------------------------------
Allows measuring points/lines/areas on the map.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| showMeasureModeSwitcher | `bool` | Whether to show the widget to switch between measure modes. | `true` |
| snapping | `bool` | Whether snapping is available when editing. | `true` |
| snappingActive | `{bool, string}` | Whether snapping is enabled by default when editing.<br /> Either `false`, `edge`, `vertex` or `true` (i.e. both vertex and edge). | `true` |

NewsPopup<a name="newspopup"></a>
----------------------------------------------------------------
Displays a newsletter in a popup dialog.

The popup won't be dispayed anymore, if the user chooses so, until a newer
revision is published (specified via newsRev prop).

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| newsDocument | `string` | URL to the news HTML document to display in the popup. | `undefined` |
| newsRev | `string` | Revision of the document. | `undefined` |
| showInSidebar | `bool` | Whether to show the news in a sidebar instead of a popup. | `undefined` |
| side | `string` | The side of the application on which to display the sidebar. | `undefined` |
| sidebarWidth | `string` | The default width of the sidebar, as a CSS width string. | `undefined` |

Panoramax<a name="panoramax"></a>
----------------------------------------------------------------
Panoramax Integration for QWC2.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| loadSequencesTiles | `bool` | Whether or not to load the layer containing the image sequences. | `true` |
| panoramaxInstance | `string` | URL of the Panoramax instance. | `'api.panoramax.xyz'` |
| tileMode | `string` | Mode for the image sequences layer: either WMS (Require a custom URL) or MVT(EPSG:3857 only). | `'mvt'` |
| wmsUrl | `string` | URL of the WMS image sequences layer. | `undefined` |

Portal<a name="portal"></a>
----------------------------------------------------------------
Displays a landing lage, consisting of a full-screen theme switcher and a configurable menu.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| bottomBarLinks | `[{`<br />`  href: string,`<br />`  label: string,`<br />`  labelmsgid: string,`<br />`  target: string,`<br />`}]` | Links to show in the portal bottom bar | `undefined` |
| collapsibleGroups | `bool` | Whether to allow collapsing groups in the theme switcher. | `true` |
| logo | `string` | Name of a logo image below assets/img. | `undefined` |
| menuItems | `array` | Portal menu items, in the same format as the TopBar menu items. | `[]` |
| showMenuOnStartup | `bool` | Whether the menu should be visible on startup. | `undefined` |
| topBarText | `string` | Portal title text to show in the top bar. | `undefined` |

Print<a name="print"></a>
----------------------------------------------------------------
Invokes QGIS Server WMS GetPrint to print the map to PDF.

Uses the print layouts defined in the QGIS project.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| allowGeoPdfExport | `bool` | Whether to allow GeoPDF export. Requires QGIS Server 3.32 or newer. | `undefined` |
| defaultDpi | `number` | The default print dpi. | `300` |
| defaultScaleFactor | `number` | The factor to apply to the map scale to determine the initial print map scale. | `0.5` |
| displayPrintSeries | `bool` | Show an option to print a series of extents. | `false` |
| displayRotation | `bool` | Whether to display the printing rotation control. | `true` |
| fileNameTemplate | `string` | Template for the name of the generated files when downloading. | `'{theme}_{timestamp}'` |
| formats | `[string]` | Export layout format mimetypes. If format is not supported by QGIS Server, print will fail. | `['application/pdf', 'image/jpeg', 'image/png', 'image/svg']` |
| gridInitiallyEnabled | `bool` | Whether the grid is enabled by default. | `false` |
| hideAutopopulatedFields | `bool` | Whether to hide form fields which contain autopopulated values (i.e. search result label). | `undefined` |
| inlinePrintOutput | `bool` | Whether to display the print output in an inline dialog instead triggering a download. | `false` |
| printExternalLayers | `bool` | Whether to print external layers. Requires QGIS Server 3.x! | `true` |
| scaleFactor | `number` | Scale factor to apply to line widths, font sizes, ... of redlining drawings passed to GetPrint. | `1.9` |
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |

ProcessNotifications<a name="processnotifications"></a>
----------------------------------------------------------------
Adds support for displaying notifications of background processes.

Only useful for third-party plugins which use this functionality.

Redlining<a name="redlining"></a>
----------------------------------------------------------------
Allows drawing figures and text labels on the map.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| allowGeometryLabels | `bool` | Whether to allow labeling geometric figures. | `true` |
| defaultAreaUnit | `string` | Default area unit. Options: metric, imperial, sqm, ha, sqkm, sqft, acre, sqmi | `'metric'` |
| defaultBorderColor | `array` | Default border color. In format [r, g, b, a]. | `[255, 0, 0, 1]` |
| defaultFillColor | `array` | Default fill color. In format [r, g, b, a]. | `[255, 255, 255, 1]` |
| defaultLengthUnit | `string` | Default length unit. Options: metric, imperial, m, km, ft, mi | `'metric'` |
| defaultTextFillColor | `array` | Default text fill color. In format [r, g, b, a]. | `[0, 0, 0, 1]` |
| defaultTextOutlineColor | `array` | Default text outline color. In format [r, g, b, a]. | `[255, 255, 255, 1]` |
| hiddenTools | `array` | Tools to hide. Available tools: Circle, Ellipse, Square, Box, HandDrawing, Transform, NumericInput, Buffer, Export. | `[]` |
| predefinedBorderColors | `[array]` | Predefined border colors. In format [[r, g, b, a], ...]. | `undefined` |
| predefinedFillColors | `[array]` | Predefined fill colors. In format [[r, g, b, a], ...]. | `undefined` |
| snapping | `bool` | Whether snapping is available when editing. | `true` |
| snappingActive | `{bool, string}` | Whether snapping is enabled by default when editing.<br /> Either `false`, `edge`, `vertex` or `true` (i.e. both vertex and edge). | `true` |

Reports<a name="reports"></a>
----------------------------------------------------------------
Allow generating reports for selected features.

This plugin displays all available reports for the current theme,
allows selecting one or more or all features of the layer, and finally generating
an aggregated report for all selected features.

Requires `documentServiceUrl` in `config.json` to point to a `qwc-document-service`.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| side | `string` | The side of the application on which to display the sidebar. | `undefined` |

Routing<a name="routing"></a>
----------------------------------------------------------------
Compute routes and isochrones.

Requites `routingServiceUrl` in `config.json` pointing to a Valhalla routing service.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| enabledModes | `[string]` | List of enabled routing modes. | `["auto", "heavyvehicle", "transit", "bicycle", "pedestrian"]` |
| enabledProviders | `[string]` | List of search providers to use for routing location search. | `["coordinates", "nominatim"]` |
| geometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`  side: string,`<br />`}` | Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). | `{`<br />`    initialWidth: 320,`<br />`    initialHeight: 640,`<br />`    initialX: 0,`<br />`    initialY: 0,`<br />`    initiallyDocked: true,`<br />`    side: 'left'`<br />`}` |
| showPinLabels | `bool` | Whether to label the routing waypoint pins with the route point number. | `true` |
| zoomAuto | `bool` | Automatically zoom to the extent of the route | `true` |

ScratchDrawing<a name="scratchdrawing"></a>
----------------------------------------------------------------
Task which which can be invoked by other tools to draw a geometry and pass it to a callback.

Only useful for third-party code, i.e. over the JavaScript API.

Invoke as `setCurrentTask("ScratchDrawing", null, null, {callback: <function(features, crs)>});`

Settings<a name="settings"></a>
----------------------------------------------------------------
Settings panel.

Allows configuring language and color scheme.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| colorSchemes | `[{`<br />`  title: string,`<br />`  titleMsgId: string,`<br />`  value: string,`<br />`}]` | List of available color schemes. Value is the css class name, title/titleMsgId the display name. | `[]` |
| languages | `[{`<br />`  title: string,`<br />`  titleMsgId: string,`<br />`  value: string,`<br />`}]` | List of available languages. Value is the lang code, title/titleMsgId the display name. | `[]` |
| showDefaultThemeSelector | `bool` | Whether to show a selector to set the default theme/bookmark (of a logged in user). | `true` |
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |

Share<a name="share"></a>
----------------------------------------------------------------
Share the current map as a URL/permalink.

Compact permalinks will be generated if `permalinkServiceUrl` in `config.json` points to a `qwc-permalink-service`.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| showLink | `bool` | Show the map URL. | `true` |
| showQRCode | `bool` | Show the QR code of the map URL. | `true` |
| showSocials | `{bool, [string]}` | Show the social buttons. Either `true` or `false`to enable/disable all, or an array of specific buttons to display (possible choices: `email`, `facebook`, `twitter`, `linkedin`, `whatsapp`). | `true` |
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |

StartupMarker<a name="startupmarker"></a>
----------------------------------------------------------------
Displays a marker when starting up the viewer.

The marked is displayed in the center of the map if `c=<x>,<y>&hc=1` is set in the URL.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| removeMode | `string` | When to remove the marker. Possible choices: onpan, onzoom, onclickonmarker. | `'onpan'` |

TaskButton<a name="taskbutton"></a>
----------------------------------------------------------------
Generic map button to launch a task.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| icon | `string` | The icon name. | `undefined` |
| mode | `string` | The task mode. | `undefined` |
| position | `number` | The position slot index of the map button, from the bottom (0: bottom slot). | `1` |
| task | `string` | The task name. | `undefined` |
| themeFlagBlacklist | `[string]` | Omit the button in themes matching one of these flags. | `undefined` |
| themeFlagWhitelist | `[string]` | Only show the button in themes matching one of these flags. | `undefined` |

ThemeSwitcher<a name="themeswitcher"></a>
----------------------------------------------------------------
Theme switcher panel.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| collapsibleGroups | `bool` | Whether to allow collapsing theme groups. | `undefined` |
| hideAddThemeButton | `bool` | Whether to hide the add theme button. Note: the button will also be hidden if the global option `allowAddingOtherThemes` is `false`. | `undefined` |
| hideAddThemeLayersButton | `bool` | Whether to hide the add theme layers button. Note: the button will also be hidden if the global option `allowAddingOtherThemes` is `false`. | `undefined` |
| showDefaultThemeSelector | `bool` | Whether to show an icon to select the default theme/bookmark (of a logged in user). | `true` |
| showLayerAfterChangeTheme | `bool` | Whether to show the LayerTree by default after switching the theme. | `false` |
| showThemeFilter | `bool` | Wether to show the theme filter field in the top bar. | `true` |
| side | `string` | The side of the application on which to display the sidebar. | `'right'` |
| themeLayersListWindowSize | `{`<br />`  width: number,`<br />`  height: number,`<br />`}` | The default window size for the theme layers dialog. | `{width: 400, height: 300}` |
| width | `string` | Default width as a CSS string. | `"50%"` |

TimeManager<a name="timemanager"></a>
----------------------------------------------------------------
Allows controling the time dimension of temporal WMS layers.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| cursorFormat | `string` | The format of the time cursor label. Either `date`, `time` or `datetime`. | `"datetime"` |
| dateFormat | `string` | The date format in the time controls, i.e. YYYY-MM-DD. | `"YYYY-MM-DD[\n]HH:mm:ss"` |
| defaultAnimationInterval | `number` | The default interval for the temporal animation, in seconds. | `1` |
| defaultEnabled | `bool` | Default for TimeManager enabled when loading application. `true` or `false` | `false` |
| defaultFeatureCount | `number` | The default number of features that will be requested. | `100` |
| defaultStepSize | `number` | The default step size for the temporal animation, in step units. | `1` |
| defaultStepUnit | `string` | The default step unit for the temporal animation, one of `ms`, `s`, `m`, `d`, `M`, `y`, `10y`, `100y` | `"d"` |
| defaultTimelineDisplay | `string` | The default timeline display mode. One of `hidden`, `minimal`, `features`, `layers`. | `undefined` |
| defaultTimelineMode | `string` | The default timeline mode. One of `fixed`, `infinite`. | `"fixed"` |
| geometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`}` | Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). | `{`<br />`    initialWidth: 800,`<br />`    initialHeight: 320,`<br />`    initiallyDocked: true`<br />`}` |
| markerConfiguration | `{`<br />`  markersAvailable: bool,`<br />`  gradient: [string],`<br />`  markerOffset: array,`<br />`  markerPins: bool,`<br />`}` | The feature marker configuration. | `{`<br />`    markersAvailable: true,`<br />`    gradient: ["#f7af7d", "#eacc6e", "#fef89a", "#c5e09b", "#a3d29c", "#7cc096", "#79c8c5", "#34afce"],`<br />`    markerOffset: [0, 0],`<br />`    markerPins: true`<br />`}` |
| stepUnits | `[string]` | The available temporal animation step units. | `["s", "m", "h", "d", "M", "y"]` |

TopBar<a name="topbar"></a>
----------------------------------------------------------------
Top bar, containing the logo, searchbar, task buttons and app menu.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| appMenuClearsTask | `bool` | Whether opening the app menu clears the active task. | `undefined` |
| appMenuCompact | `bool` | Whether show an appMenu compact (menu visible on icons hover) - Only available for desktop client. | `undefined` |
| appMenuFilterField | `bool` | Whether to display the filter field in the app menu. | `undefined` |
| appMenuHidden | `bool` | Whether to hide the app menu (useful primarely as a theme specific setting). | `undefined` |
| appMenuShortcut | `string` | The shortcut for tiggering the app menu, i.e. alt+shift+m. | `undefined` |
| appMenuVisibleOnStartup | `bool` | Whether to open the app menu on application startup. | `undefined` |
| logoFormat | `string` | The logo file format. | `"svg"` |
| logoSrc | `string` | The logo image URL if a different source than the default assets/img/logo.<ext> and assets/img/logo-mobile.<ext> is desired. | `undefined` |
| logoUrl | `string` | The hyperlink to open when the logo is clicked. | `undefined` |
| menuItems | `array` | The menu items. Refer to the corresponding chapter of the viewer documentation and the sample config.json. | `[]` |
| searchOptions | `{`<br />`  allowSearchFilters: bool,`<br />`  hideResultLabels: bool,`<br />`  highlightStyle: {`<br />`  strokeColor: array,`<br />`  strokeWidth: number,`<br />`  strokeDash: array,`<br />`  fillColor: array,`<br />`},`<br />`  minScaleDenom: number,`<br />`  resultLimit: number,`<br />`  sectionsDefaultCollapsed: bool,`<br />`  showLayerAfterChangeTheme: bool,`<br />`  showLayerResultsBeforePlaces: bool,`<br />`  showResultInSearchText: bool,`<br />`  zoomToLayers: bool,`<br />`}` | Options passed down to the search component. | `{`<br />`    showResultInSearchText: true`<br />`}` |
| toolbarItems | `array` | The toolbar. Refer to the corresponding chapter of the viewer documentation and the sample config.json. | `[]` |
| toolbarItemsShortcutPrefix | `string` | The keyboard shortcut prefix for triggering toolbar tasks. I.e. alt+shift. The task are then triggered by <prefix>+{1,2,3,...} for the 1st, 2nd, 3rd... toolbar icon. | `undefined` |

View3D<a name="view3d"></a>
----------------------------------------------------------------
Displays a 3D map view.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| buttonPosition | `number` | The position slot index of the 3d switch map button, from the bottom (0: bottom slot). | `6` |
| geometry | `{`<br />`  initialWidth: number,`<br />`  initialHeight: number,`<br />`  initialX: number,`<br />`  initialY: number,`<br />`  initiallyDocked: bool,`<br />`}` | Default window geometry. | `{`<br />`    initialWidth: 600,`<br />`    initialHeight: 800,`<br />`    initialX: 0,`<br />`    initialY: 0,`<br />`    initiallyDocked: true`<br />`}` |
| options | `{`<br />`  searchMinScaleDenom: number,`<br />`}` | Various configuration options | `{`<br />`    searchMinScaleDenom: 1000`<br />`}` |

ZoomButton<a name="zoombutton"></a>
----------------------------------------------------------------
Map button for zooming the map.

Two specific plugins exist: ZoomInPlugin and ZoomOutPlugin, which are instances of ZoomButton for the respective zoom directions.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| enableZoomByBoxSelection | `bool` | Enable zoom in or out by box selection. | `undefined` |
| position | `number` | The position slot index of the map button, from the bottom (0: bottom slot). | `undefined` |
| themeFlagBlacklist | `[string]` | Omit the button in themes matching one of these flags. | `undefined` |
| themeFlagWhitelist | `[string]` | Only show the button in themes matching one of these flags. | `undefined` |

EditingSupport<a name="editingsupport"></a>
----------------------------------------------------------------
Editing support for the map component.

LocateSupport<a name="locatesupport"></a>
----------------------------------------------------------------
GPS locate support for the map component.

MeasurementSupport<a name="measurementsupport"></a>
----------------------------------------------------------------
Measurement support for the map component.

OverviewMap<a name="overviewmap"></a>
----------------------------------------------------------------
Overview map support for the map component.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| options | `object` | See [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_control_OverviewMap-OverviewMap.html) for general options.<br /> Additionally, you can specify:<br /> - `layer`: Custom overview layer, in the same form as background layer definitions (`{type: "<wms|wmts>", "url": ...}`).<br /> - `viewOptions`: Options for the OverviewMap View, see [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_View.html). | `{}` |

RedliningSupport<a name="redliningsupport"></a>
----------------------------------------------------------------
Redlining support for the map component.

ScaleBarSupport<a name="scalebarsupport"></a>
----------------------------------------------------------------
Scalebar support for the map component.

| Property | Type | Description | Default value |
|----------|------|-------------|---------------|
| options | `object` | See [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_control_ScaleLine-ScaleLine.html) | `undefined` |

SnappingSupport<a name="snappingsupport"></a>
----------------------------------------------------------------
Snapping support for the map component.

