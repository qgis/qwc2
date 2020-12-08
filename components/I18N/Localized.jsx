/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');

const {IntlProvider} = require('react-intl');

class Localized extends React.Component {
    static propTypes = {
        children: PropTypes.node,
        locale: PropTypes.string,
        messages: PropTypes.object
    }
    static childContextTypes = {
        locale: PropTypes.string,
        messages: PropTypes.object
    }
    getChildContext = () => {
        return {
            locale: this.props.locale,
            messages: this.props.messages
        };
    }
    render() {
        if (this.props.messages && this.props.locale) {
            return (
                <IntlProvider key={this.props.locale} locale={this.props.locale} messages={this.props.messages}>
                    {this.props.children}
                </IntlProvider>
            );
        }
        return null;
    }
}

module.exports = connect((state) => ({
    locale: state.locale.current,
    messages: state.locale.messages
}), {})(Localized);
