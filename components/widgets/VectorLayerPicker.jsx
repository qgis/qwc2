/**
* Copyright 2019, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const uuid = require('uuid');
const Icon = require('../../components/Icon');
const LocaleUtils = require('../../utils/LocaleUtils');

require('./style/VectorLayerPicker.css');


class VectorLayerPicker extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        layers: PropTypes.array,
        onChange: PropTypes.func,
        value: PropTypes.string
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        return (
            <div className="VectorLayerPicker">
                <select className="combo" onChange={ev => this.props.onChange(this.props.layers.find(layer => layer.id === ev.target.value))} value={this.props.value}>
                    {this.props.layers.map(layer => (<option key={layer.id} value={layer.id}>{layer.title}</option>))}
                </select>
                <button className="button" onClick={this.addLayer} style={{borderLeftWidth: 0}}><Icon icon="plus" /></button>
            </div>
        );
    }
    addLayer = () => {
        const message = LocaleUtils.getMessageById(this.context.messages, "vectorlayerpicker.prompt");
        const name = prompt(message);
        if (name) {
            const layer = {
                id: uuid.v4(),
                title: name,
                type: 'vector'
            };
            this.props.addLayer(layer);
            this.props.onChange(layer);
        }
    }
}

module.exports = VectorLayerPicker;
