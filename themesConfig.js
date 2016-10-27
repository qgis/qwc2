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

// load thumbnail from file or GetMap
function getThumbnail(configItem, resultItem, layer, resolve) {
    if (configItem.thumbnail !== undefined) {
        // read thumbnail file
        try {
            var data = fs.readFileSync("./assets/img/mapthumbs/" + configItem.thumbnail);
            resultItem.thumbnail = Buffer.from(data).toString('base64');
            // finish task
            resolve(true);
            return;
        } catch(error) {
            console.error("ERROR: Could not read thumbnail " + configItem.thumbnail + ". Using WMS GetMap instead.");
        }
    }

    // WMS GetMap request
    var parsedUrl = urlUtil.parse(configItem.url, true);
    parsedUrl.search = '';
    parsedUrl.query.SERVICE = "WMS";
    parsedUrl.query.VERSION = "1.1.1";
    parsedUrl.query.REQUEST = "GetMap";
    parsedUrl.query.FORMAT = "image/png; mode=8bit";
    parsedUrl.query.TRANSPARENT = "TRUE";
    parsedUrl.query.STYLES = "";
    parsedUrl.query.WIDTH = 128;
    parsedUrl.query.HEIGHT = 96;
    parsedUrl.query.CRS = resultItem.crs;
    parsedUrl.query.BBOX = resultItem.extent.join(',');
    parsedUrl.query.LAYERS = layer;
    const getMapUrl = urlUtil.format(parsedUrl);

    axios.get(getMapUrl, {responseType: "arraybuffer"}).then((response) => {
        resultItem.thumbnail = Buffer.from(response.data).toString('base64');
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
function getLayerTree(layer, resultLayers) {
    var layerEntry = {
        name: layer.Name,
        title: layer.Title
    };
    if (layer.Layer === undefined) {
        // layer
        layerEntry.visibility = true;
        layerEntry.queryable = layer.$.queryable === '1';
        if (layer.Attribution !== undefined) {
            layerEntry.attribution = layer.Attribution.Title;
        }
        layerEntry.opacity = 255;
    } else {
        // group
        layerEntry.sublayers = [];
        for (var subLayer of toArray(layer.Layer)) {
            getLayerTree(subLayer, layerEntry.sublayers);
        }
    }
    resultLayers.push(layerEntry);
}

// parse GetCapabilities for theme
function getTheme(configItem, resultItem) {
    resultItem.url = configItem.url;

    var parsedUrl = urlUtil.parse(configItem.url, true);
    parsedUrl.search = '';
    parsedUrl.query.SERVICE = "WMS";
    parsedUrl.query.VERSION = "1.3.0";
    parsedUrl.query.REQUEST = "GetCapabilities";
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

            console.log("Parsing WMS GetCapabilities of " + configItem.url);

            const topLayer = capabilities.Capability.Layer;

            // unique id
            const themeId = topLayer.Name + "_" + Date.now().toString();

            // use name from config or fallback to WMS title
            const wmsTitle = configItem.title || capabilities.Service.Title || topLayer.Title;

            // keywords
            var keywords = [];
            toArray(capabilities.Service.KeywordList.Keyword).map((entry) => {
                var value = (typeof entry === 'object') ? entry._ : entry;
                if (value !== "infoMapAccessService") {
                    keywords.push(value);
                }
            });

            // use first SRS
            const srs = toArray(topLayer.CRS)[0];
            var extent = [];
            for (var bbox of toArray(topLayer.BoundingBox)) {
                if (bbox.$.CRS === srs) {
                    extent = [
                        parseFloat(bbox.$.minx),
                        parseFloat(bbox.$.miny),
                        parseFloat(bbox.$.maxx),
                        parseFloat(bbox.$.maxy)
                    ];
                    break;
                }
            }

            // layer tree
            var layerTree = [];
            getLayerTree(topLayer, layerTree);

            // update theme config
            resultItem.id = themeId;
            resultItem.name = topLayer.Name;
            resultItem.title = wmsTitle;
            resultItem.keywords = keywords.join(', ');
            resultItem.crs = srs;
            resultItem.extent = extent;
            // NOTE: skip root WMS layer
            resultItem.sublayers = layerTree[0].sublayers;

            // get thumbnail asynchronously
            getThumbnail(configItem, resultItem, topLayer.Name, resolve);
        }).catch((error) => {
            console.error("ERROR reading WMS GetCapabilities of " + configItem.url + ":\n", error);
            resultItem.error = "Could not read GetCapabilities";
            resultItem.name = "Error";
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
          "thumbnail": "<theme.png>"                  // optional image file in assets/img/mapthumbs/, use WMS GetMap if not set
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
      ]
    }
  }
*/
console.log("Reading themesConfig.json");
var config = require('./themesConfig.json');

var result = {
    themes:
    {
        title: "root",
        subdirs: [],
        items: []
    }
};
getGroupThemes(config.themes, result.themes);

Promise.all(tasks).then(() => {
    // write config file
    fs.writeFile('./themes.json', JSON.stringify(result, null, 2), (error) => {
        if (error) {
            console.error("ERROR:", error);
        } else {
            console.log("\nCreated themes.json\n\n");
        }
    });
}).catch((error) => {
    console.error("ERROR:", error);
});
