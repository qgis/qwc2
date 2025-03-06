![Logo](https://raw.githubusercontent.com/qgis/qwc2/refs/heads/master/static/assets/img/qwc-logo.svg) QGIS Web Client 2
=================

QGIS Web Client 2 (QWC2) is a modular next generation responsive web client for QGIS Server, built with ReactJS and OpenLayers.

Some examples of QWC2 production deployments:

- [QWC2 demo instance](http://qwc2.sourcepole.ch)
- [GeoViewer Kanton Glarus](https://map.geo.gl.ch/)
- [Web GIS Client Kanton Solothurn](https://geo.so.ch/map/)

## [Quick start](https://qwc-services.github.io/master/QuickStart/)
## [qwc-docker: QWC2 extended with microservices](https://github.com/qwc-services/qwc-docker)
## [Documentation](https://qwc-services.github.io/)
## [ChangeLog](https://qwc-services.github.io/master/release_notes/ChangeLog/)
## [Upgrade notes](https://qwc-services.github.io/master/release_notes/QWC2UpgradeNotes/)
## [Mailing list](https://lists.osgeo.org/mailman/listinfo/qgis-qwc2)

![Screenshot](https://github.com/qgis/qwc2-demo-app/blob/gh-pages/Screenshot.jpg?raw=true)

# Main Features

- Modular and easily configurable and extensible
- Responsive, separately configurable for desktop and mobile devices
- Theme switcher
- Arbitrarily configurable search providers
- Layer tree
  * Toggle layers and groups
  * Change layer order and opacity
  - Import external WMS/WFS/WMTS/GeoJSON/KML layers
- Feature info
- Compare layers
- Share permalinks
- Bookmarks
- Measuring tools
- Height profile
- Redlining
- Editing
- Attribute table
- DXF export
- Raster export
- Printing
- Time manager for temporal layers
- Themeable with color schemes

# License

QWC2 is released under the terms of the [BSD license](https://github.com/qgis/qwc2-demo-app/blob/master/LICENSE).

# Issues

Please report QWC2 issues at [issues](https://github.com/qgis/qwc2/issues).

# Custom application

This repository contains the stock QWC2 application, which you can run stand-alone.

If you want to extend QWC2 with custom plugins etc, you can use this repository as a submodule and build your custom application on top, see [https://github.com/qgis/qwc2-demo-app](qwc2-demo-app) for an example.
