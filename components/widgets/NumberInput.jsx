/**
* Copyright 2018, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');

class NumberInput extends React.Component {
    static propTypes = {
        max: PropTypes.number,
        min: PropTypes.number,
        onChange: PropTypes.func,
        value: PropTypes.number
    }
    state = {
        curValue: ""
    }
    constructor(props) {
        super(props);
        this.state.curValue = props.value;
    }
    static getDerivedStateFromProps(nextProps) {
        return {curValue: nextProps.value};
    }
    render() {
        return (<input max={this.props.max} min={this.props.min} onBlur={this.onBlur} onChange={this.onChange} type="number" value={this.state.curValue} />);
    }
    onChange = (ev) => {
        const value = parseInt(ev.target.value, 10);
        if (Number.isInteger(value)) {
            this.props.onChange(value);
        } else {
            this.setState({curValue: ""});
        }
    }
    onBlur = () => {
        this.setState({curValue: this.props.value});
    }
}

module.exports = NumberInput;
