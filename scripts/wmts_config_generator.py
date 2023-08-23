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


def getFirstElementByTagName(parent, name):
    try:
        return parent.getElementsByTagName(name)[0]
    except:
        return None

def getFirstElementValueByTagName(parent, name):
    try:
        return parent.getElementsByTagName(name)[0].firstChild.nodeValue
    except:
        return ""


if len(sys.argv) < 4:
    print("Usage: %s WMTS_Capabilities_URL LayerName Projection [style=default]" % sys.argv[0], file=sys.stderr)
    sys.exit(1)

capabilitiesUrl = sys.argv[1]
layerName = sys.argv[2]
crs = sys.argv[3]
styleIdentifier = sys.argv[4] if len(sys.argv) > 4 else ""


try:
    response = urllib.request.urlopen(capabilitiesUrl)
except:
    print("Failed to download capabilities", file=sys.stderr)
    sys.exit(1)

try:
    capabilities = parseString(response.read())
except:
    print("Failed to parse capabilities", file=sys.stderr)
    sys.exit(1)

contents = getFirstElementByTagName(capabilities, "Contents")

# Search for layer
targetLayer = None
for layer in contents.getElementsByTagName("Layer"):
    identifier = getFirstElementValueByTagName(layer, "ows:Identifier")
    if identifier == layerName:
        targetLayer = layer
        break

if not targetLayer:
    print("Could not find layer %s in capabilities" % layerName, file=sys.stderr)
    sys.exit(1)

# Get supported tile matrix
layerTileMatrixSet = []
for tileMatrixSetLink in targetLayer.getElementsByTagName("TileMatrixSetLink"):
    layerTileMatrixSet.append(getFirstElementValueByTagName(tileMatrixSetLink, "TileMatrixSet"))

# Get best tile matrix
tileMatrix = None
tileMatrixName = ""
for child in contents.childNodes:
    if child.nodeName == "TileMatrixSet":
        tileMatrixSet = child
        tileMatrixName = getFirstElementValueByTagName(tileMatrixSet, "ows:Identifier")
        supportedCrs = getFirstElementValueByTagName(tileMatrixSet, "ows:SupportedCRS")
        crsMatch = re.search(r'(EPSG).*:(\d+)', supportedCrs)
        if crsMatch and crs == "EPSG:" + crsMatch.group(2) and tileMatrixName in layerTileMatrixSet:
            tileMatrix = tileMatrixSet.getElementsByTagName("TileMatrix")
            break

if not tileMatrix:
    print("Could not find compatible tile matrix", file=sys.stderr)
    sys.exit(1)

# Boundingbox
bboxEl = getFirstElementByTagName(layer, "ows:WGS84BoundingBox")
bboxLower = list(map(float, getFirstElementValueByTagName(bboxEl, "ows:LowerCorner").split(" ")))
bboxUpper = list(map(float, getFirstElementValueByTagName(bboxEl, "ows:UpperCorner").split(" ")))
bbox = {
    "crs": "EPSG:4326",
    "bounds": [bboxLower[0], bboxLower[1], bboxUpper[0], bboxUpper[1]]
}

# Compute origin and resolutions
origin = list(map(float, filter(bool, getFirstElementValueByTagName(tileMatrix[0], "TopLeftCorner").split(" "))))
tileSize = [
    int(getFirstElementValueByTagName(tileMatrix[0], "TileWidth")),
    int(getFirstElementValueByTagName(tileMatrix[0], "TileHeight"))
]
resolutions = []
for entry in tileMatrix:
    scaleDenominator = getFirstElementValueByTagName(entry, "ScaleDenominator")
    # 0.00028: assumed pixel width in meters, as per WMTS standard
    resolutions.append(float(scaleDenominator) * 0.00028)

# Determine style
if not styleIdentifier:
    for style in targetLayer.getElementsByTagName("Style"):
        if style.getAttribute("isDefault") == "true":
            styleIdentifier = getFirstElementValueByTagName(style, "ows:Identifier")
            break

# Resource URL
tileUrl = None
for resourceURL in targetLayer.getElementsByTagName("ResourceURL"):
    if resourceURL.getAttribute("resourceType") == "tile":
        tileUrl = resourceURL.getAttribute("template")

# Dimensions
for dimension in targetLayer.getElementsByTagName("Dimension"):
    dimensionIdentifier = getFirstElementValueByTagName(dimension, "ows:Identifier")
    dimensionValue = getFirstElementValueByTagName(dimension, "Default")
    tileUrl = tileUrl.replace("{%s}" % dimensionIdentifier, dimensionValue)

# BBox
bounds = []
wgs84BoundingBox = getFirstElementByTagName(targetLayer, "ows:WGS84BoundingBox")
if wgs84BoundingBox is not None:
    lowerCorner = list(map(float, filter(bool, getFirstElementValueByTagName(wgs84BoundingBox,"ows:LowerCorner").split(" "))))
    upperCorner = list(map(float, filter(bool, getFirstElementValueByTagName(wgs84BoundingBox,"ows:UpperCorner").split(" "))))
    bounds = lowerCorner + upperCorner

# Format
format = getFirstElementValueByTagName(targetLayer, "Format")

# RequestEncoding
requestEncoding = ""
operationsMetadata = getFirstElementByTagName(capabilities, "ows:OperationsMetadata")
if operationsMetadata is not None:
    for operation in operationsMetadata.getElementsByTagName("ows:Operation"):
        if operation.getAttribute("name") == "GetCapabilities":
            constraint = getFirstElementByTagName(operation, "ows:Constraint")
            if constraint.getAttribute("name") == "GetEncoding":
                requestEncoding = getFirstElementValueByTagName(constraint, "ows:Value")

result = {
    "type": "wmts",
    "url": tileUrl,
    "name": layerName,
    "format": format,
    "requestEncoding": requestEncoding,
    "tileMatrixPrefix": "",
    "tileMatrixSet": tileMatrixName,
    "originX": origin[0],
    "originY": origin[1],
    "projection": crs,
    "tileSize": tileSize,
    "style": styleIdentifier,
    "bbox": {
        "crs": "EPSG:4326",
        "bounds": bounds
    },
    "resolutions": resolutions,
    "thumbnail": layerName + ".jpg",
}

print(json.dumps(result, indent=2))
