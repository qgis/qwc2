/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');

const {connect} = require('react-redux');

const url = require('url');
const urlQuery = url.parse(window.location.href, true).query;

const ConfigUtils = require('../utils/ConfigUtils');

const PluginsContainer = connect((state) => ({
    pluginsConfig: state.plugins || ConfigUtils.getConfigProp('plugins') || null,
    mode: (urlQuery.mode || (state.browser && state.browser.mobile ? 'mobile' : 'desktop')),
    pluginsState: state && state.controls || {}
}))(require('../components/plugins/PluginsContainer'));

class MapViewer extends React.Component{
    static propTypes = {
        params: PropTypes.object,
        loadMapConfig: PropTypes.func,
        plugins: PropTypes.object
    }
    static defaultProps = {
        mode: 'desktop',
        loadMapConfig: () => {}
    }
    constructor(props) {
        super(props);

        props.loadMapConfig();
    }
    render() {
        return (<PluginsContainer key="viewer" id="viewer" className="viewer"
            plugins={this.props.plugins}
            params={this.props.params}
            />);
    }
};

module.exports = MapViewer;
