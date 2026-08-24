/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


import React from 'react';

import axios from 'axios';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import LocaleUtils from '../../utils/LocaleUtils';
import {SearchResultType} from '../../utils/SearchProviders';
import SearchWidgetBase from './SearchWidgetBase';

import './style/SearchWidget.css';

class SearchTitleWidget extends React.Component {
    static propTypes = {
        group: PropTypes.object,
        titlemsgid: PropTypes.string
    };
    constructor(props) {
        super(props);
    }
    render() {
        return (
            <div className="search-widget-results-group-title" disabled key={this.props.group.id}>
                <span>{this.props.group.title ?? LocaleUtils.tr(this.props.group.titlemsgid)}</span>
            </div>
        )
    }
}

class SearchItemWidget extends React.Component {
    static propTypes = {
        group: PropTypes.object,
        item: PropTypes.object,
        onClick: PropTypes.func
    };
    constructor(props) {
        super(props);
    }
    render() {
        return (
            <div
                className="search-widget-results-item"
                key={this.props.group.d + ":" + this.props.item.id}
                onClick={() => this.props.onClick(this.props.group, this.props.item)}
                title={this.props.item.text}>
                {this.props.item.text}
            </div>
        )
    }
}

export default class SearchWidget extends SearchWidgetBase {
    static propTypes = {
        className: PropTypes.string,
        placeholder: PropTypes.string,
        queryGeometries: PropTypes.bool,
        resultSelected: PropTypes.func.isRequired,
        resultTypeFilter: PropTypes.array,
        searchParams: PropTypes.shape({
            mapcrs: PropTypes.string.isRequired,
            displaycrs: PropTypes.string.isRequired
        }),
        searchProviders: PropTypes.array,
        value: PropTypes.string
    };
    static defaultProps = {
        resultTypeFilter: [SearchResultType.PLACE],
        searchParams: {},
        searchProviders: []
    };
    constructor(props) {
        props.titleWidget = SearchTitleWidget
        props.itemWidget = SearchItemWidget
        super(props);
    }
}
