/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import PluginStore from './PluginStore';

class ConfigUtils extends React.Component {
    static defaultConfig = {
        assetsPath: "assets",
        translationsPath: "translations",
        measurementPrecision: 2,
        defaultFeatureStyle: {
            strokeColor: [0, 0, 255, 1],
            strokeWidth: 2,
            strokeDash: [4],
            fillColor: [0, 0, 255, 0.33],
            circleRadius: 10,
            textFill: 'black',
            textStroke: 'white'
        },
        customPlugins: [],
        startupParams: {},
        startupState: {},
        colorScheme: 'default'
    };
    static config = {};
    static sessionConfig = {};
    static propTypes = {
        config: PropTypes.object
    };
    componentDidUpdate() {
        ConfigUtils.config = this.props.config;
    }
    static setConfig(config) {
        ConfigUtils.config = config;
    }
    static reset() {
        ConfigUtils.config = {};
        ConfigUtils.sessionConfig = {};
    }
    static isMobile() {
        return ConfigUtils.config.isMobile;
    }
    static getConfigProp(prop, theme, defval = undefined) {
        const config = ConfigUtils.config;
        const section = config.isMobile ? "mobile" : "desktop";
        const themeProp = theme?.config?.[section]?.[prop] ?? theme?.config?.[prop];
        return themeProp ?? config[section]?.[prop] ?? config[prop] ?? defval;
    }
    static getAssetsPath() {
        return ConfigUtils.config.assetsPath.replace(/\/$/g, "");
    }
    static getTranslationsPath() {
        return ConfigUtils.config.translationsPath.replace(/\/$/g, "");
    }
    static havePlugin(name) {
        const config = ConfigUtils.config;
        return config.plugins[config.isMobile ? "mobile" : "desktop"].find(entry => entry.name === name);
    }
    static getPluginConfig(name) {
        const config = ConfigUtils.config;
        const pluginConfig = {
            ...config.plugins[config.isMobile ? "mobile" : "desktop"].find(entry => entry.name === name) || {}
        };
        pluginConfig.cfg = {
            ...PluginStore.getDefaultProps(name),
            ...pluginConfig.cfg
        };
        return pluginConfig;
    }
    static setSessionConfig(name, value) {
        ConfigUtils.sessionConfig[name] = value;
    }
    static getSessionConfig(name) {
        return ConfigUtils.sessionConfig[name];
    }
    render() {
        return null;
    }
}

export default connect(state => ({
    config: state.localConfig
}))(ConfigUtils);
