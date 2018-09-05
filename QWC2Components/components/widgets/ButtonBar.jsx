/**
* Copyright 2017, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const classnames = require('classnames');
const Icon = require('../Icon');
const Message = require('../../../MapStore2Components/components/I18N/Message');
require('./style/ButtonBar.css');


class ButtonBar extends React.Component {
    static PropTypes = {
        buttons: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string,
            label: PropTypes.string,
            icon: PropTypes.string,
            data: PropTypes.object,
            extraClasses: PropTypes.string,
            type: PropTypes.string,
        })),
        active: PropTypes.string,
        onClick: PropTypes.func,
        mobile: PropTypes.bool,
        disabled: PropTypes.bool
    }
    static defaultProps = {
        disabled: false
    }
    render() {
        return (
            <div className="ButtonBar">
                {this.props.buttons.map(button => {
                    let classes = classnames({
                        "button": true,
                        "pressed": this.props.active === button.key
                    });
                    classes += button.extraClasses ? ' ' + button.extraClasses : '';
                    return (
                        <button type={button.type || "button"} key={button.key} className={classes} onClick={button.type !== "submit" ? (ev) => this.props.onClick(button.key, button.data) : null}>
                            {button.icon ? (<Icon icon={button.icon} />) : null}
                            {button.label && (!this.props.mobile || !button.icon) ? (<Message msgId={button.label} />) : null}
                        </button>
                    );
                })}
                {this.props.disabled ? (<div className="buttonbar-disabled"></div>) : null}
            </div>
        )
    }
};

const selector = (state) => ({
    mobile: state.browser ? state.browser.mobile : false,
});

module.exports = connect(selector, {})(ButtonBar);
