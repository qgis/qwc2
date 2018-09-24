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
        value: PropTypes.number,
        onChange: PropTypes.func,
        min: PropTypes.number,
        max: PropTypes.number
    }
    state = {
        curValue: ""
    }
    componentDidMount() {
        this.setState({curValue: this.props.value});
    }
    componentWillReceiveProps(newProps) {
        this.setState({curValue: newProps.value});
    }
    render() {
        return (<input type="number" min={this.props.min} max={this.props.max} value={this.state.curValue} onChange={this.onChange} onBlur={this.onBlur}/>);
    }
    onChange = (ev) => {
        let value = parseInt(ev.target.value);
        if(Number.isInteger(value)) {
            this.props.onChange(value);
        } else {
            this.setState({curValue: ""});
        }
    }
    onBlur = () => {
        this.setState({curValue: this.props.value});
    }
};

module.exports = NumberInput;
