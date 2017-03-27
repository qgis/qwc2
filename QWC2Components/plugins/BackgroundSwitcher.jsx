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
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {changeLayerProperties} = require('../actions/layers');
const {setCurrentTask} = require('../actions/task');
require('./style/BackgroundSwitcher.css');

const BackgroundSwitcher = React.createClass({
    propTypes: {
        position: React.PropTypes.number,
        visible: React.PropTypes.bool,
        layers: React.PropTypes.array,
        toggleBackgroundswitcher: React.PropTypes.func,
        changeLayerProperties: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            visible: false,
            position: 0
        };
    },
    render() {
        let activeClass = this.props.visible ? 'active' : '';
        return (
            <div>
                <Button id="BackgroundSwitcherBtn" className={activeClass}
                    onClick={this.buttonClicked} style={{bottom: (5 + 4 * this.props.position) + 'em'}}>
                    <Glyphicon glyph="book"/>
                </Button>
                <div id="BackgroundSwitcher" className={activeClass}>
                    {this.renderLayerItem(null, this.props.layers.filter(layer => layer.visibility === true).length === 0)}
                    {this.props.layers.map(layer => this.renderLayerItem(layer, layer.visibility === true))}
                </div>
            </div>
        );
    },
    renderLayerItem(layer, visible) {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let itemclasses = classnames({
            "background-layer-item": true,
            "background-layer-item-active": visible
        });
        return (
            <div key={layer ? layer.name : "empty"} className={itemclasses} onClick={() => this.backgroudLayerClicked(layer)}>
                <div className="background-layer-title">
                    {layer ? layer.title : (<Message msgId={"bgswitcher.nobg"} />)}
                </div>
                <div className="background-layer-thumbnail">
                    <img src={layer ? assetsPath + "/" + layer.thumbnail : "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="} />
                </div>
            </div>
        );
    },
    buttonClicked() {
        this.props.setCurrentTask(this.props.visible ? null : 'BackgroundSwitcher');
    },
    backgroudLayerClicked(layer) {
        if(layer) {
            this.props.changeLayerProperties(layer.id, {visibility: true});
        } else {
            let visible = this.props.layers.find(layer => layer.visibility);
            if(visible) {
                this.props.changeLayerProperties(visible.id, {visibility: false});
            }
        }
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
