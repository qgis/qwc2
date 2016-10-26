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
const Jsonix = require('jsonix').Jsonix;
const fs = require('fs');

// setup WMS GetCapabilities parser
const OWS_1_0_0 = require('ogc-schemas').OWS_1_0_0;
const WMS_1_0_0 = require('ogc-schemas').WMS_1_0_0;
const WMS_1_1_0 = require('ogc-schemas').WMS_1_1_0;
const WMS_1_1_1 = require('ogc-schemas').WMS_1_1_1;
const WMS_1_3_0 = require('ogc-schemas').WMS_1_3_0;
const XLink_1_0 = require('w3c-schemas').XLink_1_0;

const context = new Jsonix.Context([
    OWS_1_0_0,
    XLink_1_0,
    WMS_1_0_0,
    WMS_1_1_0,
    WMS_1_1_1,
    WMS_1_3_0
    ], {
    namespacePrefixes: {
        "http://www.opengis.net/ogc": 'ogc',
        "http://www.opengis.net/wms": "wms",
        "http://purl.org/dc/elements/1.1/": "dc",
        "http://www.opengis.net/ows": "ows",
        "http://inspire.ec.europa.eu/schemas/inspire_vs/1.0": "inspire_vs",
        "http://inspire.ec.europa.eu/schemas/common/1.0": "inspire_common"
    }
});
const unmarshaller = context.createUnmarshaller();

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

// recursively get layer tree
function getLayerTree(layer, resultLayers) {
    var layerEntry = {
        name: layer.name,
        title: layer.title
    };
    if (layer.layer === undefined) {
        // layer
        layerEntry.visibility = true;
        layerEntry.queryable = layer.queryable === '1';
        if (layer.attribution !== undefined) {
            layerEntry.attribution = layer.attribution.title;
        }
        layerEntry.opacity = 255;
    } else {
        // group
        layerEntry.sublayers = [];
        for (var subLayer of layer.layer) {
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
    parsedUrl.query.VERSION = "1.1.1";
    parsedUrl.query.REQUEST = "GetCapabilities";
    const getCapabilitiesUrl = urlUtil.format(parsedUrl);

    return new Promise((resolve) => {
        axios.get(getCapabilitiesUrl).then((response) => {
            var capabilities;
            try {
                capabilities = unmarshaller.unmarshalString(response.data);
            } catch(error) {
                // show response data on parse error
                throw (response.data + "\n" + error);
            }

            console.log("Parsing WMS GetCapabilities of " + configItem.url);

            const topLayer = capabilities.value.capability.layer;

            // unique id
            const themeId = topLayer.name + "_" + Date.now().toString();

            // use name from config or fallback to WMS title
            const wmsTitle = configItem.title || capabilities.value.service.title || topLayer.title;

            // keywords
            var keywords = [];
            capabilities.value.service.keywordList.keyword.map((entry) => {
                if (entry.value !== "infoMapAccessService") {
                    keywords.push(entry.value);
                }
            });

            // use first SRS
            const srs = topLayer.srs[0].value;
            var extent = [];
            for (var bbox of topLayer.boundingBox) {
                if (bbox.srs === srs) {
                    extent = [
                        parseFloat(bbox.minx),
                        parseFloat(bbox.miny),
                        parseFloat(bbox.maxx),
                        parseFloat(bbox.maxy)
                    ];
                    break;
                }
            }

            // layer tree
            var layerTree = [];
            getLayerTree(topLayer, layerTree);

            // update theme config
            resultItem.id = themeId;
            resultItem.name = topLayer.name;
            resultItem.title = wmsTitle;
            resultItem.keywords = keywords.join(', ');
            resultItem.crs = srs;
            resultItem.extent = extent;
            // NOTE: skip root WMS layer
            resultItem.sublayers = layerTree[0].sublayers;

            // get thumbnail asynchronously
            getThumbnail(configItem, resultItem, topLayer.name, resolve);
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
