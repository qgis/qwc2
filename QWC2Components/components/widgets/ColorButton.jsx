/**
* Copyright 2018, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
require('./style/ColorButton.css');

const defaultColors = [
    // [r, g, b, a]
    [255, 105,   0, 1],
    [252, 185,   0, 1],
    [123, 220, 181, 1],
    [  0, 208, 132, 1],
    [142, 209, 252, 1],
    [  6, 147, 227, 1],
    [171, 184, 195, 1],
    [235,  20,  76, 1],
    [247, 141, 167, 1]
];


class ColorButton extends React.Component {
    static propTypes = {
        defaultColor: PropTypes.array,
        onColorChanged: PropTypes.func
    }
    static defaultProps = {
        defaultColor: [255, 255, 255, 1],
        onColorChanged: (color) => {}
    }
    constructor(props) {
        super(props);
        this.state = {
            colors: [props.defaultColor, ...defaultColors],
            curColor: 0,
            pickerVisible: false,
            hexStr: null
        };
        this.pickerEl = null;
    }
    render() {
        let pickerStyle = {
            visibility: this.state.pickerVisible ? 'visible' : 'hidden'
        };
        let curColor = this.state.colors[this.state.curColor];
        return (
            <span className="ColorButton">
                <span className="colorbutton-icon" onClick={this.togglePicker}>
                    <span style={{backgroundColor: this.cssColor(curColor)}}></span>
                </span>
                <div ref={el => this.pickerEl = el} className="colorbutton-picker" style={pickerStyle}>
                    {this.state.colors.map((color, idx) => (
                        <span onClick={() => this.selectColor(idx)} className={"colorbutton-icon" + (idx == this.state.curColor ? " colorbutton-icon-selected" : "")} key={"color" + idx}>
                            <span style={{backgroundColor: this.cssColor(color)}}></span>
                        </span>
                    ))}
                    <div className="colorbutton-picker-input">
                        <span className="colorbutton-icon">
                            <span style={{backgroundColor: this.cssColor(curColor)}}></span>
                        </span>
                        <input value={this.state.hexStr || this.hexColor(curColor)} type="text" onChange={ev => this.changeColor(ev.target.value)} />
                        <span className="colorbutton-picker-alpha">
                            <span>
                                <input value={curColor[3]} type="range" min="0" max="1" step="0.1" onChange={ev => this.changeColorAlpha(ev.target.value)}/>
                            </span>
                        </span>
                    </div>
                </div>
            </span>
        )
    }
    cssColor(color) {
        return "rgba(" + color.join(",") + ")";
    }
    hexColor(color) {
        return (0x1000000 + (color[2] | (color[1] << 8) | (color[0] << 16))).toString(16).slice(1).toUpperCase();
    }
    togglePicker = () => {
        if(!this.state.pickerVisible) {
            document.addEventListener('click', this.checkClosePicker);
        } else {
            document.removeEventListener('click', this.checkClosePicker);
        }
        this.setState({hexStr: null, pickerVisible: !this.state.pickerVisible});
    }
    checkClosePicker = (ev) => {
        if(this.pickerEl && !this.pickerEl.contains(ev.target)) {
            this.togglePicker();
        }
    }
    selectColor = (idx) => {
        this.setState({hexStr: null, curColor: idx});
        this.props.onColorChanged(this.state.colors[idx]);
    }
    changeColor = (hexStr) => {
        let match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);
        if(match) {
            let curColor = this.state.colors[this.state.curColor];
            let newColor = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16), curColor[3]];
            this.setState({hexStr: null, colors: [...this.state.colors.slice(0, this.state.curColor), newColor, ...this.state.colors.slice(this.state.curColor + 1)]});
            this.props.onColorChanged(newColor);
        } else {
            this.setState({hexStr: hexStr});
        }
    }
    changeColorAlpha = (alpha) => {
        let curColor = this.state.colors[this.state.curColor];
        let newColor = [...curColor.slice(0, 3), parseFloat(alpha)];
        this.setState({colors: [...this.state.colors.slice(0, this.state.curColor), newColor, ...this.state.colors.slice(this.state.curColor + 1)]});
        this.props.onColorChanged(newColor);
    }
};

module.exports = ColorButton;
