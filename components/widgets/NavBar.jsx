/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';

import './style/NavBar.css';


export default class NavBar extends React.Component {
    static propTypes = {
        currentPage: PropTypes.number,
        disabled: PropTypes.bool,
        nPages: PropTypes.number,
        pageChanged: PropTypes.func,
        pageSize: PropTypes.number,
        pageSizeChanged: PropTypes.func,
        pageSizes: PropTypes.array
    };
    static defaultProps = {
        pageSizes: [10, 25, 50, 100]
    };
    render() {
        const pages = [this.props.currentPage];
        const extraright = Math.max(0, 3 - this.props.currentPage);
        const extraleft = Math.max(0, this.props.currentPage - (this.props.nPages - 4));
        for (let i = 0; i < 2 + extraleft; ++i) {
            if (this.props.currentPage - i > 0) {
                pages.unshift(this.props.currentPage - i - 1);
            }
        }
        for (let i = 0; i < 2 + extraright; ++i) {
            if (this.props.currentPage + i < this.props.nPages - 1) {
                pages.push(this.props.currentPage + i + 1);
            }
        }
        if (pages.length > 1 && pages[0] > 1) {
            pages[0] = -1;
        }
        if (pages.length > 1 && pages[pages.length - 1] < this.props.nPages - 2) {
            pages[pages.length - 1] = -1;
        }
        return (
            <div className="navbar">
                <button className="button" disabled={this.props.currentPage <= 0 || this.props.disabled} onClick={() => this.props.pageChanged(this.props.currentPage - 1)}>
                    <Icon icon="chevron-left" />
                </button>
                {(pages[0] > 0 || pages[0] === -1) ? this.pageButton(0) : null}
                {pages.map(this.pageButton)}
                {pages[pages.length - 1] < this.props.nPages - 1 ? this.pageButton(this.props.nPages - 1) : null}
                <button className="button" disabled={this.props.currentPage >= this.props.nPages - 1 || this.props.disabled} onClick={() => this.props.pageChanged(this.props.currentPage + 1)}>
                    <Icon icon="chevron-right" />
                </button>
                <select disabled={this.props.disabled} onChange={ev => this.props.pageSizeChanged(parseInt(ev.target.value, 10))} value={this.props.pageSize}>
                    {this.props.pageSizes.map(pageSize => (
                        <option key={pageSize} value={pageSize}>{pageSize} {LocaleUtils.tr("navbar.perpage")}</option>
                    ))}
                </select>
            </div>
        );
    }
    pageButton = (page, idx) => {
        if (page === -1) {
            return <span className="navbar-dots" key={idx}>...</span>;
        }
        const className = "button" + (page === this.props.currentPage ? " pressed" : "");
        return (
            <button className={className} disabled={this.props.disabled} key={idx} onClick={() => this.props.pageChanged(page)}>
                {page + 1}
            </button>
        );
    };
}
