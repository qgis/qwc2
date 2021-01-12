/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import url from 'url';
import ConfigUtils from '../utils/ConfigUtils';

class Authentication extends React.Component {
    static propTypes = {
        clearLayerParam: PropTypes.bool,
        task: PropTypes.string
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.task !== prevProps.task) {
            if (this.props.task === "Login") {
                const urlObj = url.parse(window.location.href, true);
                if (this.props.clearLayerParam) {
                    urlObj.query.l = undefined;
                }
                urlObj.search = undefined;
                window.location.href = ConfigUtils.getConfigProp("authServiceUrl") + "login?url=" + encodeURIComponent(url.format(urlObj));
            } else if (this.props.task === "Logout") {
                window.location.href = ConfigUtils.getConfigProp("authServiceUrl") + "logout?url=" + encodeURIComponent(window.location.href);
            }
        }
    }
    render() {
        return null;
    }
}

export default connect(state => ({
    task: state.task.id
}), {
})(Authentication);
