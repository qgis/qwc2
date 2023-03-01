import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Icon from '../Icon';
import PopupMenu from '../PopupMenu';
import './style/MenuButton.css';

export default class MenuButton extends React.Component {
    static propTypes = {
        active: PropTypes.string,
        children: PropTypes.array,
        className: PropTypes.string,
        menuClassName: PropTypes.string,
        onActivate: PropTypes.func,
        readOnly: PropTypes.bool
    };
    state = {
        popup: false,
        selected: null
    };
    static defaultProps = {
        readOnly: false
    };
    constructor(props) {
        super(props);
        this.el = null;
        this.state.selected = this.props.active ?? props.children.length > 0 ? props.children[0].props.value : null;
    }
    componentDidUpdate(prevProps) {
        if (this.props.active !== prevProps.active && this.props.active && this.props.active !== this.state.selected) {
            this.setState({selected: this.props.active});
        }
    }
    render() {
        const children = React.Children.toArray(this.props.children);
        const rect = this.el ? this.el.getBoundingClientRect() : null;
        const selectedOption = children.filter((child) => child.props.value === this.state.selected);
        const buttonClassnames = classnames({
            "menubutton-button": true,
            "menubutton-button-active": !!this.props.active,
            "menubutton-button-hover": this.state.popup
        });
        return (
            <div className={"menubutton " + (this.props.className || "")} ref={el => { this.el = el; }}>
                <div className={buttonClassnames}>
                    <span className="menubutton-button-content" onClick={this.onButtonClicked}>
                        {selectedOption}
                    </span>
                    <span className="menubotton-combo-arrow" onClick={this.props.readOnly ? null : () => this.setState({popup: true})}>
                        <Icon icon="chevron-down" />
                    </span>
                </div>
                {this.el && this.state.popup ? (
                    <PopupMenu className={"menubutton-menu" + (this.props.menuClassName ? " " + this.props.menuClassName : "")} onClose={() => this.setState({popup: false})} width={rect.width} x={rect.left} y={rect.bottom}>
                        {children.map(child => {
                            const classNames = classnames({
                                "menubutton-menu-active": child.props.value === this.state.selected && !child.props.disabled,
                                "menubutton-menu-disabled": child.props.disabled
                            });
                            return (
                                <div className={classNames} key={child.props.value} onClickCapture={() => this.onChildClicked(child)}>
                                    {child}
                                </div>
                            );
                        })}
                    </PopupMenu>
                ) : null}
            </div>
        );
    }
    onButtonClicked = () => {
        this.props.onActivate(this.state.selected);
    };
    onChildClicked = (child) => {
        if (!child.props.disabled) {
            this.setState({selected: child.props.value});
            this.props.onActivate(child.props.value);
        }
    };
}
