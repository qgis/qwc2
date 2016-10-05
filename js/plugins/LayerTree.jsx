/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {Glyphicon} = require('react-bootstrap');
const assign = require('object-assign');
import classnames from 'classnames';
const {setCurrentTheme} = require('../actions/theme');
require('./style/LayerTree.css');


const LayerTree = React.createClass({
    propTypes: {
        theme: React.PropTypes.shape({
            id: React.PropTypes.string,
            name: React.PropTypes.string,
            keywords: React.PropTypes.string,
            layers: React.PropTypes.array,
            activelayers: React.PropTypes.array,
            thumbnail: React.PropTypes.string,
            url: React.PropTypes.string,
        }),
        visible: React.PropTypes.bool,
        updateTheme: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            visible: false,
        };
    },
    getInitialState: function() {
        return {activemenu: null};
    },
    getLegendGraphicURL(theme, layer) {
        return theme.url + "?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=" + layer;
    },
    render() {
        var layerTreeContents = null;
        var theme = this.props.theme;
        if(theme) {
            layerTreeContents = (
                <ul>
                    <li>{theme.name}</li>
                    <ul>
                        {theme.layers.map((layer) => {
                            let liclasses = classnames({
                                "layertree-item": true,
                                "layertree-item-queryable": layer.queryable
                            });
                            let checkclasses = classnames({
                                "layertree-item-checkbox": true,
                                "layertree-item-checkbox-unchecked": !theme.activelayers.includes(layer.name),
                                "layertree-item-checkbox-checked": theme.activelayers.includes(layer.name),
                            });
                            let editclasses = classnames({
                                "layertree-item-edit": true,
                                "layertree-item-edit-active": this.state.activemenu === layer.name
                            })
                            return (
                                <li className="layertree-item" key={layer.name}>
                                    <span className={checkclasses} onClick={() => this.layerToggled(layer.name)}></span>
                                    <span className="layertree-item-legend">
                                        <img className="layertree-item-legend-tooltip" src={this.getLegendGraphicURL(theme, layer.name)} />
                                        <img className="layertree-item-legend-thumbnail" src={this.getLegendGraphicURL(theme, layer.name)} />
                                    </span>
                                    <span>{layer.name}</span>
                                    {layer.queryable ? (<Glyphicon className="layertree-item-queryable" glyph="info-sign" />) : null}
                                    <span className={editclasses}>
                                        <Glyphicon glyph="cog" onClick={() => this.layerMenuToggled(layer.name)}/>
                                        <ul className="layertree-item-edit-menu">
                                            <li>
                                                <span>Transparency</span>
                                                <input type="range" min="0" max="100" step="1" value={theme.transparencies && theme.transparencies[layer.name] != undefined ? theme.transparencies[layer.name] : 0} onChange={(ev) => this.layerTransparencyChanged(layer.name, ev.target.value)} />
                                            </li>
                                        </ul>
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                </ul>
            )
        }
        return (
            <div id="LayerTree">{layerTreeContents}</div>
        );
    },
    layerToggled(name) {
        var activelayers;
        var theme = this.props.theme;
        if(theme.activelayers.includes(name)) {
            let idx = theme.activelayers.indexOf(name);
            activelayers = [...theme.activelayers.slice(0, idx),
                            ...theme.activelayers.slice(idx+1)]
        } else {
            activelayers = [...theme.activelayers, name];
        }
        this.props.updateTheme(assign({}, theme, {activelayers: activelayers}));
    },
    layerMenuToggled(name) {
        this.setState({activemenu: this.state.activemenu === name ? null : name});
    },
    layerTransparencyChanged(layer, value) {
        var diff = {};
        diff[layer] = value;
        var transparencies = assign({}, this.props.theme.transparencies, diff);
        this.props.updateTheme(assign({}, this.props.theme, {transparencies: transparencies}));
    }
});

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
});

module.exports = {
    LayerTreePlugin: connect(selector, {
        updateTheme: setCurrentTheme
    })(LayerTree),
    reducers: {
        theme: require('../reducers/theme')
    }
};
