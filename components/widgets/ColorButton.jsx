/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import './style/ColorButton.css';

const defaultColors = [
    // [r, g, b, a]
    [255, 255, 255, 1],
    [0, 0, 0, 1],
    [255, 105,   0, 1],
    [252, 185,   0, 1],
    [  0, 208, 132, 1],
    [142, 209, 252, 1],
    [  6, 147, 227, 1],
    [171, 184, 195, 1],
    [235,  20,  76, 1],
    [247, 141, 167, 1]
];


export default class ColorButton extends React.Component {
    static propTypes = {
        color: PropTypes.array,
        onColorChanged: PropTypes.func
    };
    static defaultProps = {
        color: [255, 255, 255, 1],
        onColorChanged: (/* color */) => {}
    };
    constructor(props) {
        super(props);
        this.state = {
            pickerVisible: false,
            hexStr: null
        };
        this.pickerEl = null;
    }
    render() {
        const pickerStyle = {
            visibility: this.state.pickerVisible ? 'visible' : 'hidden'
        };
        const curColor = this.props.color;
        return (
            <span className="ColorButton">
                <span className="colorbutton-icon" onClick={this.togglePicker}>
                    <span style={{backgroundColor: this.cssColor(curColor)}} />
                </span>
                <div className="colorbutton-picker" ref={el => { this.pickerEl = el; }} style={pickerStyle}>
                    <div className="colorbutton-picker-icons">
                        {defaultColors.map((color, idx) => (
                            <span className="colorbutton-icon" key={"color" + idx} onClick={() => this.selectColor(idx)} onContextMenu={ev => this.replaceDefaultColor(ev, idx)}>
                                <span style={{backgroundColor: this.cssColor(color)}} />
                            </span>
                        ))}
                    </div>
                    <div className="colorbutton-picker-input">
                        <span className="colorbutton-icon">
                            <span style={{backgroundColor: this.cssColor(curColor)}} />
                        </span>
                        <input onChange={ev => this.changeColor(ev.target.value)} type="text" value={this.state.hexStr || this.hexColor(curColor)} />
                        <span className="colorbutton-picker-alpha">
                            <span>
                                <input max="1" min="0" onChange={ev => this.changeColorAlpha(ev.target.value)} step="0.1" type="range" value={curColor[3]}/>
                            </span>
                        </span>
                    </div>
                </div>
            </span>
        );
    }
    cssColor(color) {
        return "rgba(" + color.join(",") + ")";
    }
    hexColor(color) {
        return (0x1000000 + (color[2] | (color[1] << 8) | (color[0] << 16))).toString(16).slice(1).toUpperCase();
    }
    togglePicker = (ev) => {
        if (!this.state.pickerVisible) {
            document.addEventListener('click', this.checkClosePicker);
        } else {
            document.removeEventListener('click', this.checkClosePicker);
        }
        ev.stopPropagation();
        this.setState((state) => ({hexStr: null, pickerVisible: !state.pickerVisible}));
    };
    checkClosePicker = (ev) => {
        if (this.pickerEl && !this.pickerEl.contains(ev.target)) {
            this.togglePicker(ev);
        }
    };
    selectColor = (idx) => {
        this.setState({hexStr: null});
        this.props.onColorChanged([...defaultColors[idx]]);
    };
    replaceDefaultColor = (ev, idx) => {
        defaultColors[idx] = [...this.props.color];
        this.forceUpdate();
        ev.preventDefault();
    };
    changeColor = (hexStr) => {
        const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);
        if (match) {
            const newColor = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16), this.props.color[3]];
            this.setState({hexStr: null});
            this.props.onColorChanged(newColor);
        } else {
            this.setState({hexStr: hexStr});
        }
    };
    changeColorAlpha = (alpha) => {
        const newColor = [...this.props.color.slice(0, 3), parseFloat(alpha)];
        this.props.onColorChanged(newColor);
    };
}
