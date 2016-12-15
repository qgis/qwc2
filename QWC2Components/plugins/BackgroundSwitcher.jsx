/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const classnames = require('classnames');
const {Button, Glyphicon} = require('react-bootstrap');
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const {changeLayerProperties} = require('../actions/layers');
const {setCurrentTask} = require('../actions/task');
require('./style/BackgroundSwitcher.css');

const BackgroundSwitcher = React.createClass({
    propTypes: {
        visible: React.PropTypes.bool,
        layers: React.PropTypes.array,
        toggleBackgroundswitcher: React.PropTypes.func,
        changeLayerProperties: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            visible: false
        };
    },
    render() {
        let activeClass = this.props.visible ? 'active' : '';
        return (
            <div>
                <Button id="BackgroundSwitcherBtn" className={activeClass} onClick={this.buttonClicked}>
                    <Glyphicon glyph="book"/>
                </Button>
                <div id="BackgroundSwitcher" className={activeClass}>
                    {this.props.layers.map(layer => this.renderLayerItem(layer))}
                </div>
            </div>
        );
    },
    renderLayerItem(layer) {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let itemclasses = classnames({
            "background-layer-item": true,
            "background-layer-item-active": layer.visibility === true
        });
        return (
            <div key={layer.name} className={itemclasses} onClick={() => this.backgroudLayerClicked(layer)}>
                <div className="background-layer-title">
                    {layer.title}
                </div>
                <div className="background-layer-thumbnail">
                    <img src={assetsPath + "/" + layer.thumbnail} />
                </div>
            </div>
        );
    },
    buttonClicked() {
        this.props.setCurrentTask(this.props.visible ? null : 'BackgroundSwitcher');
    },
    backgroudLayerClicked(layer) {
        this.props.changeLayerProperties(layer.id, {visibility: true});
        this.props.setCurrentTask(null);
    }
});

const selector = (state) => ({
    visible: state.task ? state.task.current === 'BackgroundSwitcher' : false,
    layers: state.layers && state.layers.flat && state.layers.flat.filter((layer) => layer.group === "background") || []
});

module.exports = {
    BackgroundSwitcherPlugin: connect(selector, {
      setCurrentTask: setCurrentTask,
      changeLayerProperties: changeLayerProperties
    })(BackgroundSwitcher),
    reducers: {
    }
};
