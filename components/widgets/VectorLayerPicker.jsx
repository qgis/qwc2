/**
 * Copyright 2019-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import Icon from '../../components/Icon';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/VectorLayerPicker.css';


export default class VectorLayerPicker extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        layers: PropTypes.array,
        onChange: PropTypes.func,
        showNone: PropTypes.bool,
        value: PropTypes.string
    };
    render() {
        return (
            <div className="VectorLayerPicker">
                <select onChange={ev => this.props.onChange(this.props.layers.find(layer => layer.id === ev.target.value))} value={this.props.value}>
                    {this.props.showNone ? (<option value="">{LocaleUtils.tr("vectorlayerpicker.none")}</option>) : null}
                    {this.props.layers.map(layer => (<option key={layer.id} value={layer.id}>{layer.title}</option>))}
                </select>
                {this.props.addLayer ? (
                    <button className="button" onClick={this.addLayer} style={{borderLeftWidth: 0}}><Icon icon="plus" /></button>
                ) : null}
            </div>
        );
    }
    addLayer = () => {
        const message = LocaleUtils.tr("vectorlayerpicker.prompt");
        // eslint-disable-next-line
        const name = prompt(message);
        if (name) {
            const layer = {
                id: uuidv4(),
                title: name,
                type: 'vector'
            };
            this.props.addLayer(layer);
            this.props.onChange(layer);
        }
    };
}
