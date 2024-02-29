import React from 'react';

import classnames from 'classnames';
import PropTypes from 'prop-types';

import Icon from '../Icon';
import PopupMenu from '../PopupMenu';

import './style/MenuButton.css';

export default class MenuButton extends React.Component {
    static propTypes = {
        active: PropTypes.string,
        children: PropTypes.array,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        menuClassName: PropTypes.string,
        menuIcon: PropTypes.string,
        menuLabel: PropTypes.string,
        onActivate: PropTypes.func
    };
    state = {
        popup: false,
        selected: null
    };
    constructor(props) {
        super(props);
        this.el = null;
        if (!props.menuIcon && !props.menuLabel) {
            this.state.selected = this.props.active ?? props.children.length > 0 ? props.children[0].props.value : null;
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.active !== prevProps.active && this.props.active && this.props.active !== this.state.selected) {
            this.setState({selected: this.props.active});
        }
    }
    render() {
        const children = React.Children.toArray(this.props.children);
        const rect = this.el ? this.el.getBoundingClientRect() : null;
        let buttonContents = null;
        if (this.props.menuIcon || this.props.menuLabel) {
            buttonContents = [
                this.props.menuIcon ? (<Icon icon={this.props.menuIcon} key="icon" />) : null,
                this.props.menuLabel ? (<span>{this.props.menuLabel}</span>) : null
            ];
        } else {
            buttonContents = children.filter((child) => child.props.value === this.state.selected);
        }
        const classes = classnames({
            "menubutton": true,
            "menubutton-disabled": this.props.disabled,
            [this.props.className]: !!this.props.className
        });
        const buttonClassnames = classnames({
            "menubutton-button": true,
            "menubutton-togglebutton": !this.props.menuIcon && !this.props.menuLabel,
            "menubutton-menubutton": this.props.menuIcon || this.props.menuLabel,
            "menubutton-button-active": !!this.props.active,
            "menubutton-button-hover": this.state.popup
        });
        return (
            <div className={classes} ref={el => { this.el = el; }}>
                <div className={buttonClassnames} onClick={this.onMenuClicked}>
                    <span className="menubutton-button-content" onClick={this.onButtonClicked}>
                        {buttonContents}
                    </span>
                    <span className="menubotton-button-arrow">
                        <Icon icon="chevron-down" />
                    </span>
                </div>
                {this.el && this.state.popup ? (
                    <PopupMenu className={"menubutton-menu" + (this.props.menuClassName ? " " + this.props.menuClassName : "")} onClose={() => this.setState({popup: false})} width={rect.width} x={rect.left} y={rect.bottom}>
                        {children.map(child => {
                            const classNames = classnames({
                                "menubutton-menu-active": child.props.value === this.state.selected && !child.props.disabled,
                                "menubutton-menu-disabled": child.props.disabled,
                                [child.props.className]: !!child.props.className
                            });
                            return React.cloneElement(child, {
                                className: classNames,
                                onClickCapture: () => this.onChildClicked(child)
                            });
                        })}
                    </PopupMenu>
                ) : null}
            </div>
        );
    }
    onMenuClicked = () => {
        if (!this.props.disabled) {
            this.setState({popup: true});
        }
    };
    onButtonClicked = (ev) => {
        ev.stopPropagation();
        if (this.state.selected) {
            this.props.onActivate(this.state.selected);
        } else {
            this.onMenuClicked();
        }
    };
    onChildClicked = (child) => {
        if (!child.props.disabled) {
            if (this.state.selected) {
                this.setState({selected: child.props.value});
            }
            this.props.onActivate(child.props.value);
        }
    };
}
