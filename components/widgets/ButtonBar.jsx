/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import classnames from 'classnames';
import Icon from '../Icon';
import Message from '../../components/I18N/Message';
import './style/ButtonBar.css';


class ButtonBar extends React.Component {
    static propTypes = {
        active: PropTypes.string,
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
        disabled: PropTypes.bool,
        mobile: PropTypes.bool,
        onClick: PropTypes.func
    }
    render() {
        return (
            <div className={"ButtonBar" + (this.props.disabled ? " buttonbar-disabled" : "")}>
                {this.props.buttons.map(button => {
                    let classes = classnames({
                        button: true,
                        pressed: this.props.active === button.key
                    });
                    classes += button.extraClasses ? ' ' + button.extraClasses : '';
                    return (
                        <span className="buttonbar-button-container"  key={button.key}>
                            <button
                                className={classes} disabled={button.disabled}
                                onClick={button.type !== "submit" ? () => this.props.onClick(button.key, button.data) : null}
                                type={button.type || "button"}
                            >
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
        );
    }
}

const selector = (state) => ({
    mobile: state.browser.mobile
});

export default connect(selector, {})(ButtonBar);
