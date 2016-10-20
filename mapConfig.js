/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*eslint no-console: 0, vars-on-top: 0, camelcase: 0 */

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

// complete WMS layer config with data from WMS GetCapabilities
function updateWmsLayerConfig(wmsLayer) {
    var parsedUrl = urlUtil.parse(wmsLayer.url, true);
    parsedUrl.search = '';
    parsedUrl.query.SERVICE = "WMS";
    parsedUrl.query.VERSION = "1.1.1";
    parsedUrl.query.REQUEST = "GetCapabilities";
    const getCapabilitiesUrl = urlUtil.format(parsedUrl);

    return new Promise((resolve) => {
        resolve(
            axios.get(getCapabilitiesUrl).then((response) => {
                var capabilities;
                try {
                    capabilities = unmarshaller.unmarshalString(response.data);
                } catch(error) {
                    // show response data on parse error
                    throw (response.data + "\n" + error);
                }

                console.log("Updating layer '" + wmsLayer.title + "'");
                const topLayer = capabilities.value.capability.layer;

                var subLayers = [];
                var queryLayers = [];
                topLayer.layer.map((entry) => {
                    subLayers.push(entry.name);
                    if (entry.queryable === '1') {
                        queryLayers.push(entry.name);
                    }
                });

                // update layer config
                wmsLayer.name = wmsLayer.name || wmsLayer.title;
                wmsLayer.opacities = wmsLayer.opacities || [];
                wmsLayer.params = wmsLayer.params || {};
                wmsLayer.params.LAYERS = wmsLayer.params.LAYERS || subLayers.slice(0).reverse().join(',');
                wmsLayer.subLayers = subLayers;
                wmsLayer.queryLayers = queryLayers;

                return true;
            }).catch((error) => {
                console.error("Error in layer '" + wmsLayer.title + "':\n", error);
                wmsLayer.error = "Could not read GetCapabilities";
                return false;
            })
        );
    });
}

/* load config.json:
  {
    "map": {
        ...
        "layers": [
            {
                "type": "wms",
                "title": "<WMS Layer Title>",
                "url": "<http://localhost/wms/topic>",
                "opacities": [],                          // optional, keep if present
                "params": {                               // optional, keep if present
                  "LAYERS": "<layers>"                    // optional, keep if present
                },
                "visibility": true
            }
        ]
    }
  }
*/
console.log("Reading config.json");
var config = require('./config.json');

// update WMS layers
var tasks = [];
for (var layer of config.map.layers) {
    if (layer.type === 'wms') {
        tasks.push(updateWmsLayerConfig(layer));
    }
}
Promise.all(tasks).then(() => {
    // write config file
    fs.writeFile('./mapConfig.json', JSON.stringify(config, null, 2), (error) => {
        if (error) {
            console.error("ERROR:", error);
        } else {
            console.log("\nCreated mapConfig.json\n\n");
        }
    });
}).catch((error) => {
    console.error("ERROR:", error);
});
