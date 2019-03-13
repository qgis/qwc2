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
const Message = require('../../components/I18N/Message');
require('./style/ButtonBar.css');


class ButtonBar extends React.Component {
    static propTypes = {
        buttons: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string,
            label: PropTypes.string,
            tooltip: PropTypes.string,
            icon: PropTypes.string,
            data: PropTypes.object,
            extraClasses: PropTypes.string,
            type: PropTypes.string,
            disabled: PropTypes.bool
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
            <div className={"ButtonBar" + (this.props.disabled ? " buttonbar-disabled" : "")}>
                {this.props.buttons.map(button => {
                    let classes = classnames({
                        "button": true,
                        "pressed": this.props.active === button.key
                    });
                    classes += button.extraClasses ? ' ' + button.extraClasses : '';
                    return (
                        <span className="buttonbar-button-container"  key={button.key}>
                            <button type={button.type || "button"} disabled={button.disabled} className={classes} onClick={button.type !== "submit" ? (ev) => this.props.onClick(button.key, button.data) : null}>
                                {button.icon ? (<Icon icon={button.icon} />) : null}
                                {button.label && (!this.props.mobile || !button.icon) ? (<Message msgId={button.label} />) : null}
                            </button>
                            {button.tooltip ? (<span className="buttonbar-button-tooltip">
                                <Message msgId={button.tooltip} />
                            </span>) : null}
                        </span>
                    );
                })}
            </div>
        )
    }
};

const selector = (state) => ({
    mobile: state.browser ? state.browser.mobile : false,
});

module.exports = connect(selector, {})(ButtonBar);
