#!/usr/bin/python3

# Automatically generates a QWC2 WMTS background layer configuration, to be added to themesConfig.json
#
# Usage: wmts_config_generator.py <WMTS Capabilities URL> <LayerName> <Projection> [<format>]
#
# Example: wmts_config_generator.py https://www.wmts.nrw.de/geobasis/wmts_nw_dop/1.0.0/WMTSCapabilities.xml nw_dop EPSG:25832

import json
import re
import sys
import urllib.request
from xml.dom.minidom import parseString

if len(sys.argv) < 4:
    print("Usage: %s WMTS_Capabilities_URL LayerName Projection [format=png] [style=default]" % sys.argv[0], file=sys.stderr)
    sys.exit(1)

url = sys.argv[1]
layername = sys.argv[2]
projection = sys.argv[3]
fmt = sys.argv[4] if len(sys.argv) > 4 else "png"
style = sys.argv[5] if len(sys.argv) > 5 else "default"

try:
    response = urllib.request.urlopen(sys.argv[1])
except:
    print("Error: failed to download %s" % url, file=sys.stderr)

try:
    capabilities = parseString(response.read())
    contents = capabilities.getElementsByTagName("Contents")[0]
except:
    print("Error: failed to parse %s" % url, file=sys.stderr)

# Search for layer
layer = None
try:
    for l in contents.getElementsByTagName("Layer"):
        ident = l.getElementsByTagName("ows:Identifier")[0]
        if ident.firstChild.nodeValue == layername:
            layer = l
            break
except:
    pass

if not layer:
    print("Error: failed to find layer %s" % layername, file=sys.stderr)

# Scan all tile matrix sets
tilematrixsets = {}
for tms in contents.getElementsByTagName("TileMatrixSet"):
    if not tms.parentNode == contents:
        continue
    ident = tms.getElementsByTagName("ows:Identifier")[0].firstChild.nodeValue
    crs = tms.getElementsByTagName("ows:SupportedCRS")[0].firstChild.nodeValue
    matrices = tms.getElementsByTagName("TileMatrix")
    origin = list(map(float, matrices[0].getElementsByTagName("TopLeftCorner")[0].firstChild.nodeValue.split(" ")))
    tilesize = [
        int(matrices[0].getElementsByTagName("TileWidth")[0].firstChild.nodeValue),
        int(matrices[0].getElementsByTagName("TileHeight")[0].firstChild.nodeValue)
    ]
    resolutions = []
    for matrix in matrices:
        sd = matrix.getElementsByTagName("ScaleDenominator")[0]
        # 0.00028: assumed pixel width in meters, as per WMTS standard
        resolutions.append(float(sd.firstChild.nodeValue) * 0.00028)

    tilematrixsets[ident] = {
        "crs": crs,
        "origin": origin,
        "tilesize": tilesize,
        "resolutions": resolutions
    }

# Look for a matching tile matrix set
matrixconfig = None
for tmsl in layer.getElementsByTagName("TileMatrixSetLink"):
    ident = tmsl.getElementsByTagName("TileMatrixSet")[0].firstChild.nodeValue

    if ident in tilematrixsets and tilematrixsets[ident]["crs"] == projection:
        matrixconfig = tilematrixsets[ident]
        break

if not matrixconfig:
    print("Error: failed to find file matrix for projection %s" % projection, file=sys.stderr)
    print("Available tile matrix sets:")
    print(json.dumps(tilematrixsets, indent=2))
    sys.exit(1)

# Generate config
resurl = re.sub("\.\w+$", '', layer.getElementsByTagName("ResourceURL")[0].getAttribute("template")) + "." + fmt
resurl = resurl.replace("{Style}", style)
config = {
    "type": "wmts",
    "url": resurl,
    "title": layer.getElementsByTagName("ows:Title")[0].firstChild.nodeValue,
    "name": layername,
    "originX": matrixconfig["origin"][0],
    "originY": matrixconfig["origin"][1],
    "tileMatrixPrefix": "",
    "tileMatrixSet": ident,
    "projection:": projection,
    "tileSize": matrixconfig["tilesize"],
    "thumbnail": "img/mapthumbs/" + layername + ".jpg",
    "resolutions": matrixconfig["resolutions"]
}
print(json.dumps(config, indent=2))
