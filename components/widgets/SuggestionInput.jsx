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
require('./style/SuggestionInput.css');


class SuggestionInput extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        loadSuggestions: PropTypes.func,
        onBlur: PropTypes.func,
        onChange: PropTypes.func,
        value: PropTypes.string
    }
    state = {
        suggestions: []
    }
    constructor(props) {
        super(props);
        this.datalistid = uuid.v1();
    }
    render() {
        return (
            <span className={"suggestion-input " + (this.props.className || "")}>
                <input list={this.datalistid} onBlur={this.onBlur} onChange={this.props.onChange} onFocus={this.onFocus} type="text" value={this.props.value} />
                <datalist id={this.datalistid}>
                    {this.state.suggestions.map((entry, idx) => (
                        <option key={"e" + idx} value={entry} />
                    ))}
                </datalist>
            </span>
        );
    }
    onFocus = () => {
        this.props.loadSuggestions(result => {
            this.setState({suggestions: result});
        });
    }
    onBlur = (ev) => {
        this.setState({suggestions: []});
        this.props.onBlur(ev);
    }
}

module.exports = SuggestionInput;
