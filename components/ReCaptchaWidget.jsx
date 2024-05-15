import React from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

import PropTypes from 'prop-types';

import LocaleUtils from '../utils/LocaleUtils';


export default class ReCaptchaWidget extends React.Component {
    static propTypes = {
        onChange: PropTypes.func,
        sitekey: PropTypes.string
    };
    componentWillUnmount() {
        this.props.onChange(null);
    }
    render() {
        return (
            <ReCAPTCHA hl={LocaleUtils.lang()} isolated 
                onChange={value => this.props.onChange(value)}
                onErrored={() => this.props.onChange(null)}
                onExpired={() => this.props.onChange(null)}
                sitekey={this.props.sitekey}
            />
        );
    }
}
