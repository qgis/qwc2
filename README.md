![Logo](https://raw.githubusercontent.com/qgis/qwc2/refs/heads/master/static/assets/img/qwc-logo.svg) QGIS Web Client 2
=================

## Introduction
QGIS Web Client 2 (QWC2) is a modular next generation responsive web client for QGIS Server, built with ReactJS and OpenLayers.

This repository contains the QWC2 web application, which you can run as a static application on top of QGIS Server.

Alternatively, you can run QWC2 as part of the **[qwc-services Docker application](https://github.com/qwc-services/qwc-docker)**, which extends QWC2 with functionalities such as authentication, user management and  editing.

![Screenshot](https://github.com/qgis/qwc2/blob/gh-pages/Screenshot.jpg?raw=true)

### Main Features

- Modular and easily configurable and extensible
- Responsive, separately configurable for desktop and mobile devices
- Theme switcher
- Search with configurable search providers
- Layer tree
  * Toggle layers and groups
  * Change layer order and opacity
  * Import external WMS/WFS/WMTS/GeoJSON/KML layers
  * Compare layers
- Feature info
- Printing using QGIS print layouts
- Share permalinks
- Bookmarks
- Measuring tools
- Height profile
- Redlining
- Editing and attribute table
- Attribute table
- Export map (raster images, DXF)
- Time manager for temporal layers
- Themeable with color schemes
- [Additional plugins!](https://qwc-services.github.io/master/references/qwc2_plugins/)

## Quick start

See [qwc-services.github.io/master/QuickStart/](https://qwc-services.github.io/master/QuickStart/)

## Documentation

* [qwc-services.github.io](https://qwc-services.github.io/)
* [ChangeLog](https://qwc-services.github.io/master/release_notes/ChangeLog/)

## Help

* [Issues tracker](https://github.com/qgis/qwc2/issues)
* [Mailing list](https://lists.osgeo.org/mailman/listinfo/qgis-qwc2)

## Examples

Some examples of QWC2 production deployments:

- [QWC2 demo instance](http://qwc2.sourcepole.ch)
- [GeoViewer Kanton Glarus](https://map.geo.gl.ch/)
- [Web GIS Client Kanton Solothurn](https://geo.so.ch/map/)

## License

QWC2 is released under the terms of the [BSD license](https://github.com/qgis/qwc2/blob/master/LICENSE).

## Building a custom application

This repository contains the stock QWC2 application.

If you want to extend QWC2 with custom plugins etc, you can use this repository as a submodule and build your custom application on top, see [https://github.com/qgis/qwc2-demo-app](qwc2-demo-app) for an example.
