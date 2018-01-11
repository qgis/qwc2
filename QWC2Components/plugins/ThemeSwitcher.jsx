/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const assign = require('object-assign');
const {connect} = require('react-redux');
const axios = require('axios');
const Message = require('../../MapStore2Components/components/I18N/Message');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const LocaleUtils = require("../../MapStore2Components/utils/LocaleUtils");
const CoordinatesUtils = require("../../MapStore2Components/utils/CoordinatesUtils");
const {setCurrentTheme} = require("../actions/theme");
const {setCurrentTask} = require("../actions/task");
const {SideBar} = require('../components/SideBar');
const UrlParams = require("../utils/UrlParams");
const LayerUtils = require('../utils/LayerUtils');
require('./style/ThemeSwitcher.css');
const removeDiacritics = require('diacritics').remove;

class ThemeSwitcher extends React.Component {
    static propTypes = {
        activeTheme: PropTypes.object,
        haveMap: PropTypes.bool,
        layers: PropTypes.array,
        changeTheme: PropTypes.func,
        setCurrentTask: PropTypes.func,
        mapConfig: PropTypes.object,
        width: PropTypes.string
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    static defaultProps = {
        activeTheme: null,
        map: null,
        width: "50%"
    }
    state = {
        themes: null,
        filter: ""
    }
    componentWillReceiveProps(nextProps) {
        if(!this.props.haveMap && nextProps.haveMap || this.props.haveMap && !this.state.themes) {
            // As soon as map is set, fetch themes and restore initial theme
            // NOTE: set dummy themes state to fetch themes only once
            this.setState({themes: {}}, () => {
                axios.get("themes.json")
                .then(response => this.populateThemesList(response.data));
            });
        } else if(nextProps.haveMap && this.state.themes && this.state.themes.defaultTheme && !nextProps.activeTheme) {
            // Automatically restore default theme if no theme is set (see TopBar.jsx@clearTheme)
            let theme = this.getThemeById(this.state.themes, this.state.themes.defaultTheme);
            if(theme) {
                this.setTheme(theme, false);
            }
        }
    }
    populateThemesList = (object) => {
        var params = UrlParams.getParams();
        let theme = this.getThemeById(object.themes, params.t);
        if(!theme) {
            theme = this.getThemeById(object.themes, object.themes.defaultTheme);
            // Invalid params.t => clear it
            params.t = undefined;
        }
        UrlParams.updateParams({t: undefined, l: undefined});
        if(theme) {
            let layer = this.createLayerForTheme(theme, params.l ? params.l.split(",") : undefined);
            const scales = theme.scales || object.themes.defaultScales;
            // extent to which to zoom to
            let bbox = null;
            let centerZoom = null;
            if(params.t) {
                if(params.ic && params.is) {
                    let closestVal = Math.abs(params.is - scales[0]);
                    let closestIdx = 0;
                    for(let i = 1; i < scales.length; ++i) {
                        let currVal = Math.abs(params.is - scales[i]);
                        if(currVal < closestVal) {
                            closestVal = currVal;
                            closestIdx = i;
                        }
                    }
                    let coords = params.ic.split(";").map(x => parseFloat(x));
                    if(coords.length === 2) {
                        centerZoom = {
                            center: {x: coords[0], y: coords[1]},
                            zoom: closestIdx,
                            crs: params.icrs || theme.mapCrs
                        };
                    }
                } else if(params.ie) {
                    bbox = {
                        bounds: params.ie.split(";").map(x => parseFloat(x)),
                        crs: params.icrs || theme.mapCrs
                    };
                }
            }
            if(!centerZoom && (!bbox || bbox.bounds.length !== 4)) {
                bbox = theme.initialBbox;
            }
            const printScales = theme.printScales || object.themes.defaultPrintScales || undefined;
            const printResolutions = theme.printResolutions || object.themes.defaultPrintResolutions || undefined;
            const printGrid = theme.printGrid || object.themes.defaultPrintGrid || undefined;
            this.props.changeTheme(assign({}, theme, {printScales, printResolutions, printGrid, scales}), layer, this.createBackgroundLayersForTheme(theme, object.themes, params.bl), bbox, centerZoom);
        }
        UrlParams.updateParams({ie: undefined});
        UrlParams.updateParams({ic: undefined});
        UrlParams.updateParams({is: undefined});
        UrlParams.updateParams({icrs: undefined});
        this.setState({themes: object.themes});
    }
    getThemeById = (dir, id) => {
        for(let i = 0, n = dir.items.length; i < n; ++i) {
            if(dir.items[i].id === id) {
                return dir.items[i];
            }
        }
        for(let i = 0, n = dir.subdirs.length; i < n; ++i) {
            var theme = this.getThemeById(dir.subdirs[i], id);
            if(theme) {
                return theme;
            }
        }
        return null;
    }
    groupMatchesFilter = (group, filter) => {
        if(group && group.items) {
            for(let i = 0, n = group.items.length; i < n; ++i) {
                if(removeDiacritics(group.items[i].title).match(filter) ||
                   removeDiacritics(group.items[i].keywords).match(filter)) {
                    return true;
                }
            }
        }
        if(group && group.subdirs) {
            for(let i = 0, n = group.subdirs.length; i < n; ++i) {
                if(this.groupMatchesFilter(group.subdirs[i], filter)) {
                    return true;
                }
            }
        }
        return false;
    }
    renderThemeGroup = (group) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let filter = new RegExp(removeDiacritics(this.state.filter).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "i");
        let subdirs = (group && group.subdirs ? group.subdirs : []);
        if(filter !== "") {
            subdirs = subdirs.filter(subdir => this.groupMatchesFilter(subdir, filter));
        }
        let subtree = subdirs.map(subdir =>
            (<li key={subdir.title} className="theme-group"><span>{subdir.title}</span><ul>{this.renderThemeGroup(subdir)}</ul></li>)
        );
        let activeThemeId = this.props.activeTheme ? this.props.activeTheme.id : null;
        return (<ul role="body">
            {(group && group.items ? group.items : []).map(item => {
                return removeDiacritics(item.title).match(filter) || removeDiacritics(item.keywords).match(filter) ? (
                    <li key={item.id}
                        className={activeThemeId === item.id ? "theme-item theme-item-active" : "theme-item"}
                        onClick={(ev)=>{this.setTheme(item);}}
                        title={item.keywords}
                    >
                        <div className="theme-item-title" title={item.title}>{item.title}</div>
                        <img src={assetsPath + "/" + item.thumbnail} /><br />
                    </li>) : null;
            })}
            {subtree}
            </ul>);
    }
    render() {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let extraTitlebarContent = (
            <input className="themeswitcher-filter" type="text" value={this.state.filter} onChange={ev => this.setState({filter: ev.target.value})} placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")}/>
        );
        return (
            <SideBar id="ThemeSwitcher" minWidth="16em" width={this.props.width} title="appmenu.items.ThemeSwitcher"
                icon={assetsPath + "/img/themes.svg"} extraTitlebarContent={extraTitlebarContent}>
                {this.renderThemeGroup(this.state.themes)}
            </SideBar>
        );
    }
    createLayerForTheme = (theme, visiblelayers=undefined) => {
        let sublayers = theme.sublayers;
        if(visiblelayers !== undefined) {
            let layers = [];
            let opacities = [];
            let entryMatch = /([^\[]+)\[(\d+)]/;
            visiblelayers.map(entry => {
                let match = entryMatch.exec(entry);
                if(match) {
                    layers.push(match[1]);
                    opacities.push(Math.round(255 - parseFloat(match[2]) / 100 * 255));
                } else {
                    layers.push(entry);
                    opacities.push(255);
                }
            });
            if(ConfigUtils.getConfigProp("allowReorderingLayers") != true) {
                sublayers = LayerUtils.restoreVisibleLayers(sublayers, layers, opacities);
            } else {
                sublayers = LayerUtils.restoreReorderedVisibleLayers(sublayers, layers, opacities);
            }
        }
        let version = theme.version ? theme.version : this.state.themes.defaultWMSVersion ? this.state.themes.defaultWMSVersion : "1.3.0";
        // untiled WMS by default
        let singleTile = true;
        if (theme.tiled !== undefined) {
            singleTile = !theme.tiled;
        }
        let layer = {
            id: theme.name + Date.now().toString(),
            type: "wms",
            version: theme.version,
            url: theme.url,
            visibility: true,
            expanded: theme.expanded,
            name: theme.name,
            title: theme.title,
            boundingBox: theme.bbox,
            sublayers : sublayers,
            singleTile: singleTile,
            ratio: singleTile ? 1 : undefined,
            format: theme.format,
            priority: 1,
            isThemeLayer: true,
            attribution: theme.attribution,
            infoFormats: theme.infoFormats,
            uuid: theme.uuid
        };
        // Drawing order only makes sense if layer reordering is disabled
        if(ConfigUtils.getConfigProp("allowReorderingLayers") != true) {
            assign(layer, {drawingOrder: theme.drawingOrder});
        }
        return layer;
    }
    createBackgroundLayersForTheme = (theme, themes, visibleBackgroundLayer=undefined) => {
        let backgroundLayers = [];
        let visibleIdx = -1;
        let defaultVisibleIdx = -1;
        for (let themeBackgroundLayer of (theme.backgroundLayers || [])) {
            // lookup background layer
            const backgroundLayer = themes.backgroundLayers.find((layer) => layer.name === themeBackgroundLayer.name);
            if (backgroundLayer !== undefined) {
                if(themeBackgroundLayer.visibility === true) {
                    defaultVisibleIdx = backgroundLayers.length;
                }
                if (backgroundLayer.name === visibleBackgroundLayer) {
                    visibleIdx = backgroundLayers.length;
                }
                let newBackgroundLayer = assign({}, backgroundLayer, {
                    group: 'background',
                    visibility: false
                });
                backgroundLayers.push(newBackgroundLayer);
            } else {
                console.warn("Could not find background layer " + themeBackgroundLayer.name);
            }
        }
        if(visibleIdx >= 0) {
            backgroundLayers[visibleIdx].visibility = true;
        } else if(defaultVisibleIdx >= 0) {
            backgroundLayers[defaultVisibleIdx].visibility = true;
        }
        return backgroundLayers;
    }
    setTheme = (theme, allowpreserve = true) => {
        const scales = theme.scales || this.state.themes.defaultScales;
        const printScales = theme.printScales || this.state.themes.defaultPrintScales || undefined;
        const printResolutions = theme.printResolutions || this.state.themes.defaultPrintResolutions || undefined;
        const printGrid = theme.printGrid || this.state.themes.defaultPrintGrid || undefined;
        let zoomBBox = theme.initialBbox;
        if(allowpreserve && ConfigUtils.getConfigProp("preserveExtentOnThemeSwitch") === true) {
            // If crs and scales match and bounding boxes intersect, keep current extent
            if(this.props.mapConfig.projection === theme.mapCrs &&
               this.bboxOverlap(theme.bbox, this.props.mapConfig.bbox, theme.bbox.crs, this.props.mapConfig.projection))
            {
                zoomBBox = this.props.mapConfig.bbox;
            }
        }
        let activeBackgroudLayer = null;
        if(allowpreserve && ConfigUtils.getConfigProp("preserveBackgroundOnThemeSwitch") === true) {
            let activeBackgrounds = this.props.layers.filter(layer => layer.group === 'background' && layer.visibility === true);
            if(activeBackgrounds.length === 1) {
                activeBackgroudLayer = activeBackgrounds[0].name;
            }
        }
        this.props.changeTheme(assign({}, theme, {printScales, printGrid, printResolutions, scales}), this.createLayerForTheme(theme), this.createBackgroundLayersForTheme(theme, this.state.themes, activeBackgroudLayer), zoomBBox);
        this.props.setCurrentTask(null);
    }
    bboxOverlap = (bbox1, bbox2, crs1, crs2) => {
        let b1 = bbox1.bounds;
        let b2 = [bbox2.bounds.minx, bbox2.bounds.miny, bbox2.bounds.maxx, bbox2.bounds.maxy];
        if(crs1 !== crs2) {
            b1 = CoordinatesUtils.reprojectBbox(b1, crs1, crs2);
        }
        return b1[0] < b2[2] && b1[2] > b2[0] && b1[1] < b2[3] && b1[3] > b2[1];
    }
};

const selector = (state) => ({
    activeTheme: state.theme ? state.theme.current : null,
    haveMap: state.map ? true : false,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    mapConfig: state.map ? state.map : undefined
});


module.exports = {
    ThemeSwitcherPlugin: connect(selector, {
        changeTheme: setCurrentTheme,
        setCurrentTask: setCurrentTask
    })(ThemeSwitcher),
    reducers: {
        theme: require('../reducers/theme'),
        task: require('../reducers/task'),
        layers: require('../reducers/layers'),
    }
};
