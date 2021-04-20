/**
 * Copyright 2020-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import ConfigUtils from '../utils/ConfigUtils';
import BookmarkWindow from '../components/BookmarkWindow';
 
class Bookmark extends React.Component {
    static propTypes = {
        windowSize: PropTypes.object,
        task: PropTypes.string
    }
    static defaultProps = {
        bookmarkWindowSize: {width: 400, height: 300}
    }
    render() {
        if (this.props.task !== "Bookmark" || !ConfigUtils.getConfigProp("username")) {
            return null;
        }
        return (
            <BookmarkWindow windowSize={this.props.bookmarkWindowSize} />
        );
    }     
}

const selector = state => ({
    task: state.task.id
});
 
export default connect(selector)(Bookmark);