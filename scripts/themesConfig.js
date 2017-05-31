/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*eslint no-console: 0, vars-on-top: 0, camelcase: 0*/

const urlUtil = require('url');
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');

let usedThemeIds = [];

// load thumbnail from file or GetMap
function getThumbnail(configItem, resultItem, layers, crs, extent, resolve) {
    if (configItem.thumbnail !== undefined) {
        // check if thumbnail can be read
        if(fs.existsSync("./assets/img/mapthumbs/" + configItem.thumbnail)) {
            resultItem.thumbnail = "img/mapthumbs/" + configItem.thumbnail;
            // finish task
            resolve(true);
            return;
        }
    }

    console.error("Using WMS GetMap to generate thumbnail for " + configItem.url);

    // WMS GetMap request
    var parsedUrl = urlUtil.parse(configItem.url, true);
    parsedUrl.search = '';
    parsedUrl.query.SERVICE = "WMS";
    parsedUrl.query.VERSION = "1.3.0";
    parsedUrl.query.REQUEST = "GetMap";
    parsedUrl.query.FORMAT = "image/png";
    parsedUrl.query.TRANSPARENT = "TRUE";
    parsedUrl.query.STYLES = "";
    parsedUrl.query.WIDTH = 200;
    parsedUrl.query.HEIGHT = 100;
    parsedUrl.query.CRS = crs;
    let bboxw = extent[2] - extent[0];
    let bboxh = extent[3] - extent[1];
    let bboxcx = 0.5 * (extent[0] + extent[2]);
    let bboxcy = 0.5 * (extent[1] + extent[3]);
    let imgratio = 200./100.;
    if(bboxw > bboxh) {
        let bboxratio = bboxw/bboxh;
        if(bboxratio > imgratio) {
            bboxh = bboxw / imgratio;
        } else {
            bboxw = bboxh * imgratio;
        }
    } else {
        bboxw = bboxh * imgratio;
    }
    let adjustedExtent = [bboxcx - 0.5 * bboxw, bboxcy - 0.5 * bboxh,
                          bboxcx + 0.5 * bboxw, bboxcy + 0.5 * bboxh];
    parsedUrl.query.BBOX = adjustedExtent.join(',');
    parsedUrl.query.LAYERS = layers.join(',');
    const getMapUrl = urlUtil.format(parsedUrl);

    axios.get(getMapUrl, {responseType: "arraybuffer"}).then((response) => {
        let basename = configItem.url.replace(/.*\//, "") + ".png";
        fs.writeFileSync("./assets/img/mapthumbs/" + basename, response.data);
        resultItem.thumbnail = "img/mapthumbs/" + basename;
        // finish task
        resolve(true);
    }).catch((error) => {
        console.error("ERROR for WMS " + configItem.url + ":\n", error);
        resultItem.error = "Could not get thumbnail";
        // finish task
        resolve(false);
    });
}

// convert non-array object to array containing the object
// used to restore arrays lost by 'explicitArray: false' xml2js option
function toArray(obj) {
    if (!Array.isArray(obj)) {
        return [obj];
    }
    return obj;
}

// recursively get layer tree
function getLayerTree(layer, resultLayers, visibleLayers, printLayers, level, collapseBelowLevel, titleNameMap) {
    if (printLayers.indexOf(layer.Name) !== -1) {
        // skip print layers
        return;
    }

    var layerEntry = {
        name: layer.Name,
        title: layer.Title
    };
    if (layer.Layer === undefined) {
        if (layer.$.geometryType == "WKBNoGeometry") {
            // skip layers without geometry
            return;
        }

        // layer
        layerEntry.visibility = layer.$.visible === '1';
        if (layerEntry.visibility) {
            // collect visible layers
            visibleLayers.push(layer.Name);
        }
        layerEntry.queryable = layer.$.queryable === '1';
        if (layerEntry.queryable) {
            layerEntry.displayField = layer.$.displayField;
        }
        if (layer.Attribution !== undefined) {
            layerEntry.attribution = layer.Attribution.Title;
            if (layer.Attribution.OnlineResource !== undefined) {
                layerEntry.attributionUrl = layer.Attribution.OnlineResource.$['xlink:href'];
            }
        }
        if (layer.Abstract) {
            layerEntry.abstract = layer.Abstract;
        }
        if(layer.DataURL && layer.DataURL.OnlineResource) {
            layerEntry.dataUrl = layer.DataURL.OnlineResource.$['xlink:href'];
        }
        if(layer.MetadataURL && layer.MetadataURL.OnlineResource) {
            layerEntry.metadataUrl = layer.MetadataURL.OnlineResource.$['xlink:href'];
        }
        if(layer.$.transparency) {
            layerEntry.opacity = 255 - Math.floor(parseFloat(layer.$.transparency) / 100 * 255)
        } else {
            layerEntry.opacity = 255;
        }
        if(layer.KeywordList) {
            var keywords = [];
            toArray(layer.KeywordList.Keyword).map((entry) => {
                keywords.push((typeof entry === 'object') ? entry._ : entry);
            });
            layerEntry.keywords = keywords.join(",");
        }
        if (layer.MinScaleDenominator !== undefined) {
            layerEntry.minScale = parseInt(layer.MinScaleDenominator, 10);
            layerEntry.maxScale = parseInt(layer.MaxScaleDenominator, 10);
        }
        // use geographic bounding box, as default CRS may have inverted axis order with WMS 1.3.0
        if(layer.EX_GeographicBoundingBox) {
            layerEntry.bbox = {
                "crs": "EPSG:4326",
                "bounds": [
                    parseFloat(layer.EX_GeographicBoundingBox.westBoundLongitude),
                    parseFloat(layer.EX_GeographicBoundingBox.southBoundLatitude),
                    parseFloat(layer.EX_GeographicBoundingBox.eastBoundLongitude),
                    parseFloat(layer.EX_GeographicBoundingBox.northBoundLatitude)
                ]
            };
        }
    } else {
        // group
        layerEntry.sublayers = [];
        layerEntry.expanded = collapseBelowLevel >= 0 && level >= collapseBelowLevel ? false : true;
        for (var subLayer of toArray(layer.Layer)) {
            getLayerTree(subLayer, layerEntry.sublayers, visibleLayers, printLayers, level, collapseBelowLevel, titleNameMap);
        }
        if (layerEntry.sublayers.length === 0) {
            // skip empty groups
            return;
        }
    }
    resultLayers.push(layerEntry);
    titleNameMap[layer.Title] = layer.Name;
}

// parse GetCapabilities for theme
function getTheme(configItem, resultItem) {
    resultItem.url = configItem.url;

    var parsedUrl = urlUtil.parse(configItem.url, true);
    parsedUrl.search = '';
    parsedUrl.query.SERVICE = "WMS";
    parsedUrl.query.VERSION = "1.3.0";
    parsedUrl.query.REQUEST = "GetProjectSettings";
    const getCapabilitiesUrl = urlUtil.format(parsedUrl);

    return new Promise((resolve) => {
        axios.get(getCapabilitiesUrl).then((response) => {
            // parse capabilities
            var capabilities;
            xml2js.parseString(response.data, {
                tagNameProcessors: [xml2js.processors.stripPrefix],
                explicitArray: false
            },
            (ignore, result) => {
                if (result === undefined || result.WMS_Capabilities === undefined) {
                    // show response data on parse error
                    throw new Error(response.data);
                } else {
                    capabilities = result.WMS_Capabilities;
                }
            });

            console.log("Parsing WMS GetProjectSettings of " + configItem.url);

            const topLayer = capabilities.Capability.Layer;

            let themeId = topLayer.Name;
            if(usedThemeIds.includes(themeId)) {
                let i = 0;
                for(; usedThemeIds.includes(themeId + i); ++i);
                themeId = themeId + i;
            }
            usedThemeIds.push(themeId);

            // use name from config or fallback to WMS title
            const wmsTitle = configItem.title || capabilities.Service.Title || topLayer.Title;

            // keywords
            var keywords = [];
            if(capabilities.Service.KeywordList) {
              toArray(capabilities.Service.KeywordList.Keyword).map((entry) => {
                  var value = (typeof entry === 'object') ? entry._ : entry;
                  if (value !== "infoMapAccessService") {
                      keywords.push(value);
                  }
              });
            }

            // use first CRS for thumbnail request
            const crs = toArray(topLayer.CRS).filter(item => item != 'CRS:84')[0];
            var extent = [];
            for (var bbox of toArray(topLayer.BoundingBox)) {
                if (bbox.$.CRS === crs) {
                    extent = [
                        parseFloat(bbox.$.minx),
                        parseFloat(bbox.$.miny),
                        parseFloat(bbox.$.maxx),
                        parseFloat(bbox.$.maxy)
                    ];
                    break;
                }
            }

            // collect WMS layers for printing
            var printLayers = [];
            if (configItem.backgroundLayers !== undefined) {
                printLayers = configItem.backgroundLayers.map((entry) => {
                    return entry.printLayer;
                });
            }

            // layer tree and visible layers
            collapseLayerGroupsBelowLevel = configItem.collapseLayerGroupsBelowLevel || -1
            var layerTree = [];
            var visibleLayers = [];
            var titleNameMap = {};
            getLayerTree(topLayer, layerTree, visibleLayers, printLayers, 1, collapseLayerGroupsBelowLevel, titleNameMap);
            visibleLayers.reverse();

            // print templates
            var printTemplates = [];
            if (capabilities.Capability.ComposerTemplates !== undefined) {
                let templates = capabilities.Capability.ComposerTemplates.ComposerTemplate;
                if(!templates.length) {
                    templates = [templates];
                }
                for (var composerTemplate of templates) {
                    var printTemplate = {
                        name: composerTemplate.$.name
                    };
                    if (composerTemplate.ComposerMap !== undefined) {
                        // use first map from GetProjectSettings
                        var composerMap = toArray(composerTemplate.ComposerMap)[0];
                        printTemplate.map = {
                            name: composerMap.$.name,
                            width: parseFloat(composerMap.$.width),
                            height: parseFloat(composerMap.$.height)
                        };
                    }
                    if (composerTemplate.ComposerLabel !== undefined) {
                        printTemplate.labels = toArray(composerTemplate.ComposerLabel).map((entry) => {
                            return entry.$.name;
                        });
                    }
                    printTemplates.push(printTemplate);
                }
            }

            // drawing order
            let drawingOrder = capabilities.Capability.LayerDrawingOrder.split(",").map(title => title in titleNameMap ? titleNameMap[title] : title);

            // update theme config
            resultItem.id = themeId;
            resultItem.name = topLayer.Name;
            resultItem.title = wmsTitle;
            resultItem.attribution = configItem.attribution;
            resultItem.attributionUrl = configItem.attributionUrl;
            resultItem.keywords = keywords.join(', ');
            resultItem.format = configItem.format;
            resultItem.availableFormats = capabilities.Capability.Request.GetMap.Format;
            resultItem.tiled = configItem.tiled;
            // use geographic bounding box for theme, as default CRS may have inverted axis order with WMS 1.3.0
            let bounds = [
                parseFloat(topLayer.EX_GeographicBoundingBox.westBoundLongitude),
                parseFloat(topLayer.EX_GeographicBoundingBox.southBoundLatitude),
                parseFloat(topLayer.EX_GeographicBoundingBox.eastBoundLongitude),
                parseFloat(topLayer.EX_GeographicBoundingBox.northBoundLatitude)
            ];
            resultItem.bbox = {
                "crs": "EPSG:4326",
                "bounds": bounds
            };
            resultItem.initialBbox = {
                "crs": "EPSG:4326",
                "bounds": configItem.extent || bounds
            };
            resultItem.scales = configItem.scales;
            resultItem.printScales = configItem.printScales;
            resultItem.printResolutions = configItem.printResolutions;
            resultItem.printGrid = configItem.printGrid;
            // NOTE: skip root WMS layer
            resultItem.sublayers = layerTree[0].sublayers;
            resultItem.expanded = true;
            resultItem.backgroundLayers = configItem.backgroundLayers;
            resultItem.searchProviders = configItem.searchProviders;
            resultItem.additionalMouseCrs = configItem.additionalMouseCrs;
            resultItem.mapCrs = configItem.mapCrs || 'EPSG:3857';
            if (printTemplates.length > 0) {
                resultItem.print = printTemplates;
            }
            resultItem.drawingOrder = drawingOrder;
            if(configItem.printLabelForSearchResult) {
                resultItem.printLabelForSearchResult = configItem.printLabelForSearchResult;
            }
            if(configItem.printLabelConfig) {
                resultItem.printLabelConfig = configItem.printLabelConfig;
            }
            if(configItem.watermark) {
                resultItem.watermark = configItem.watermark;
            }

            resultItem.skipEmptyFeatureAttributes = configItem.skipEmptyFeatureAttributes

            // set default theme
            if (configItem.default || !result.themes.defaultTheme) {
                result.themes.defaultTheme = resultItem.id;
            }

            // get thumbnail asynchronously
            getThumbnail(configItem, resultItem, visibleLayers, crs, extent, resolve);
        }).catch((error) => {
            console.error("ERROR reading WMS GetProjectSettings of " + configItem.url + ":\n", error);
            resultItem.error = "Could not read GetProjectSettings";
            resultItem.title = "Error";
            // finish task
            resolve(false);
        });
    });
}

// asynchronous tasks
var tasks = [];

// recursively get themes for groups
function getGroupThemes(configGroup, resultGroup) {
    for (var item of configGroup.items) {
        var itemEntry = {};
        tasks.push(getTheme(item, itemEntry));
        resultGroup.items.push(itemEntry);
    }

    if (configGroup.groups !== undefined) {
        for (var group of configGroup.groups) {
            var groupEntry = {
                title: group.title,
                items: [],
                subdirs: []
            };
            getGroupThemes(group, groupEntry);
            resultGroup.subdirs.push(groupEntry);
        }
    }
}

/* load themesConfig.json:
{
  "themes": {
    "items": [
      {
        "url": "<http://localhost/wms/theme>",
        "title": "<Custom theme title>",            // optional, use WMS title if not set
        "thumbnail": "<filename>",                  // optional image file in assets/img/mapthumbs, if not set uses WMS GetMap to generate the thumbnail and stores it in assets/img/mapthumbs
        "attribution": "<Attribution>",             // optional theme attribution
        "attributionUrl": "<attribution URL>",      // optional theme attribution URL
        "default": true,                            // optional, set this as the initial theme
        "scales": [25000, 10000, 5000, 2500],       // optional, custom map scales, defaults to defaultScales (see below)
        "printScales": [25000, 10000, 5000, 2500],  // optional, confined list of available print scales, defaults to defaultPrintScales (see below)
        "printResolutions": [150, 300, 600],        // optional, confined list of abailable print resolutions, defaults to defaultPrintResolutions (see below)
        "printGrid": [                              // optional, list of grid intervals to use for various scales when printing.
            {"s": 10000, x: 1000, y: 1000},         //   Keep this list sorted in descending order by scale (s)
            {"s": 1000, x: 100, y: 100},            //   In this example, {x: 100, y: 100} will be used for 1000 <= scale < 10000
            ...                                     //   If not specified, defaultPrintGrid will be usd (see below)
        ],
        "printLabelForSearchResult": "<labelid>"    // optional, a labelid in the print composition where to insert the label of the selected search result
        "printLabelConfig": {                       // optional, configuration of input textareas for print composition labels.
            "labelId": {
                "rows": 4,
                "maxLength: "40"
              },
              ...
        }
        "extent": [xmin, ymin, xmax, ymax],         // optional custom extent which overrides extent from WMS capabilities
        "tiled": true,                              // optional, use tiled WMS (default is false)
        "format": "image/png",                      // optional, the image format to use in the WMS request, defaults to image/png
        "backgroundLayers": [                       // optional background layers
          {
            "name": "<background layer name>",      // background layer name from list below
            "printLayer": "<qgis layer name>",      // optional, name of a qgis layer to use as equivalent background layer when printing
            "visibility": true                      // optional initial visibility on topic selection
          }
        ],
        "searchProviders": ["<search provider>"],   // optional search providers
        "mapCrs: "EPSG:3857",                       // optional, the map projection, defaults to EPSG:3857
        "additionalMouseCrs": ["<epsg code>"]       // optional list of additional CRS for mouse position (map projection and WGS84 are listed by default). Make sure proj defs are loaded in js/appConfig.js.
        "watermark": {                              // optional, configuration of watermark to place on raster-export images
          "text": "<watermark text>",
          "texpadding": "1",                        // optional, padding between text and frame, in points
          "fontsize": "14",                         // optional, font size
          "fontfamily": "sans",                     // optional, font family
          "fontcolor": "#0000FF",                   // optional, font color
          "backgroundcolor": "#FFFFFF",             // optional, background color of the frame
          "framecolor": "#000000",                  // optional, color of the frame border
          "framewidth": 1                           // optional, width of the frame border, in pixels
        },
        "collapseLayerGroupsBelowLevel": <level>    // optional, layer tree level below which to initially collapse groups. If unspecified, groups are not initially collapsed.
        "skipEmptyFeatureAttributes": true          // optional, whether to skip empty feature attributes in the identify results. Default is false.
      }
    ],
    "groups": [                                     // optional, nested groups
      {
        "title": "<Group title>",
        "items": [
          {
            "url": "<http://localhost/wms/group_theme>"
          }
        ]
        "groups": [
          // subgroups
        ]
      }
    ],
    "backgroundLayers": [                           // optional list of background layers for themes
      {
        "name": "<background layer name>",          // referenced by themes
        "title": "<Background layer title>",
        "thumbnail": "<filename>",                  // optional image file in assets/img/mapthumbs, use default.jpg if not set
        ...                                         // layer params (excluding "group" and "visibility")
      }
    ]
  },
  "defaultScales": [50000, 25000, 10000, 5000],     // required, default map scales
  "defaultPrintScales": [50000, 25000, 10000, 5000],// optional, confined list of available print scales. If not specified, scale is freely choosable.
  "defaultPrintResolutions": [150, 300, 600],       // optional, confined list of abailable print resolutions. If not specified, resolution is freely choosable.
  "defaultPrintGrid": [<as printGrid above>]        // optional, list of grid intervals to use for various scales when printing, no grid is primted if omitted
}
*/
console.log("Reading themesConfig.json");
var config = require(process.cwd() + '/themesConfig.json');

var result = {
    themes: {
        title: "root",
        subdirs: [],
        items: [],
        defaultTheme: undefined,
        defaultScales: config.defaultScales,
        defaultPrintScales: config.defaultPrintScales,
        defaultPrintResolutions: config.defaultPrintResolutions,
        defaultPrintGrid: config.defaultPrintGrid,
        backgroundLayers: config.themes.backgroundLayers
    }
};
getGroupThemes(config.themes, result.themes);

if (result.themes.backgroundLayers !== undefined) {
    // get thumbnails for background layers
    result.themes.backgroundLayers.map((backgroundLayer) => {
        let imgPath = "img/mapthumbs/" + backgroundLayer.thumbnail;
        if (!fs.existsSync("./assets/" + imgPath)) {
            imgPath = "img/mapthumbs/default.jpg";
        }
        backgroundLayer.thumbnail = imgPath;
    });
}

Promise.all(tasks).then(() => {
    // write config file
    fs.writeFile(process.cwd() + '/themes.json', JSON.stringify(result, null, 2), (error) => {
        if (error) {
            console.error("ERROR:", error);
        } else {
            console.log("\nCreated themes.json\n\n");
        }
    });
}).catch((error) => {
    console.error("ERROR:", error);
});
