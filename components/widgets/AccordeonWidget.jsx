/**
* Copyright 2019, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const Message = require("qwc2/components/I18N/Message");
const Icon = require("qwc2/components/Icon");
require('./style/AccordeonWidget.css');

class AccordeonWidget extends React.Component {
    static propTypes = {
        sections: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string,
            widget: PropTypes.function,
            title: PropTypes.string
        })),
        className: PropTypes.string,
        allowMultiple: PropTypes.bool
    }
    static defaultProps = {
      allowMultiple: false
    }
    state = {
        currentSections: []
    }
    renderSection = (section) => {
        return (
            <div className="accordeon-section" key={section.key}>
                <div className="accordeon-section-header" onClick={() => this.toggleSection(section.key)}>
                    <Message msgId={section.title} />
                    <Icon icon={this.state.currentSections.includes(section.key) ? 'collapse' : 'expand'} />
                </div>
                {this.state.currentSections.includes(section.key) ? (
                    <div className="accordeon-section-body">
                        <section.widget />
                    </div>
                ) : null}
            </div>
        );
    }
    toggleSection = (key) => {
        let currentSections = [];
        if(this.props.allowMultiple) {
            if(this.state.currentSections.includes(key)) {
                currentSections = this.state.currentSections.filter(entry => entry !== key);
            } else {
                currentSections = [...this.state.currentSections, key];
            }
        } else {
            currentSections = this.state.currentSections.includes(key) ? [] : [key];
        }
        this.setState({currentSections});
    }
    render() {
        return (
            <div role="body" className={this.props.className}>
                {this.props.sections.map(section => this.renderSection(section))}
            </div>
        )
    }
};

module.exports = AccordeonWidget;
