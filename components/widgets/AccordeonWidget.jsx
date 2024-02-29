/**
 * Copyright 2019-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';

import './style/AccordeonWidget.css';

export default class AccordeonWidget extends React.Component {
    static propTypes = {
        allowMultiple: PropTypes.bool,
        className: PropTypes.string,
        sections: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string,
            widget: PropTypes.function,
            title: PropTypes.string
        }))
    };
    state = {
        currentSections: []
    };
    renderSection = (section) => {
        return (
            <div className="accordeon-section" key={section.key}>
                <div className="accordeon-section-header" onClick={() => this.toggleSection(section.key)}>
                    {LocaleUtils.tr(section.title)}
                    <Icon icon={this.state.currentSections.includes(section.key) ? 'collapse' : 'expand'} />
                </div>
                {this.state.currentSections.includes(section.key) ? (
                    <div className="accordeon-section-body">
                        <section.widget {...(section.params || {})}/>
                    </div>
                ) : null}
            </div>
        );
    };
    toggleSection = (key) => {
        let currentSections = [];
        if (this.props.allowMultiple) {
            if (this.state.currentSections.includes(key)) {
                currentSections = this.state.currentSections.filter(entry => entry !== key);
            } else {
                currentSections = [...this.state.currentSections, key];
            }
        } else {
            currentSections = this.state.currentSections.includes(key) ? [] : [key];
        }
        this.setState({currentSections});
    };
    render() {
        return (
            <div className={this.props.className} role="body">
                {this.props.sections.map(section => this.renderSection(section))}
            </div>
        );
    }
}
