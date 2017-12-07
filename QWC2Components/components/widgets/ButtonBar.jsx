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
const {Glyphicon} = require('react-bootstrap');
const Message = require('../../../MapStore2Components/components/I18N/Message');
const ConfigUtils = require('../../../MapStore2Components/utils/ConfigUtils');
require('./style/ButtonBar.css');


class ButtonBar extends React.Component {
    static PropTypes = {
        buttons: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string,
            label: PropTypes.string,
            icon: PropTypes.string,
            data: PropTypes.object,
            glyph: PropTypes.string,
            extraClasses: PropTypes.string
        })),
        active: PropTypes.string,
        onClick: PropTypes.func,
        mobile: PropTypes.bool,
    }
    render() {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        return (
            <div className="ButtonBar">
                {this.props.buttons.map(button => {
                    let classes = (this.props.active === button.key ? 'active' : '');
                    classes += button.extraClasses ? ' ' + button.extraClasses : '';
                    return (
                        <span key={button.key} className={classes} onClick={(ev) => this.props.onClick(button.key, button.data)}>
                            {button.icon ? (<img src={assetsPath + '/img/' + button.icon} />) : null}
                            {button.glyph ? (<Glyphicon glyph={button.glyph} />) : null}
                            {this.props.mobile && button.icon ? null : (<Message msgId={button.label} />)}
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
