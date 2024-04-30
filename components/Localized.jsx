/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

class Localized extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        locale: PropTypes.string,
        messages: PropTypes.object
    };
    render() {
        if (this.props.messages && this.props.locale) {
            return this.props.children;
        }
        return null;
    }
}

export default connect((state) => ({
    locale: state.locale.current,
    messages: state.locale.messages
}), {})(Localized);
