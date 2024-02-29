/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {IntlProvider} from 'react-intl';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

class Localized extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        locale: PropTypes.string,
        messages: PropTypes.object
    };
    static childContextTypes = {
        locale: PropTypes.string,
        messages: PropTypes.object
    };
    getChildContext = () => {
        return {
            locale: this.props.locale,
            messages: this.props.messages
        };
    };
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

export default connect((state) => ({
    locale: state.locale.current,
    messages: state.locale.messages
}), {})(Localized);
