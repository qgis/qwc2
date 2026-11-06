/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import htmlReactParser, {domToReact} from 'html-react-parser';
import React from "react";
import {useDispatch} from 'react-redux';

import PropTypes from "prop-types";

import {openExternalUrl} from '../actions/windows';
import ConfigUtils from '../utils/ConfigUtils';
import MiscUtils from "../utils/MiscUtils";

function renderIdentifyAttribute({attrName, attrValue, layer, feature}) {
    let result = attrValue;
    if (typeof result === 'object') {
        result = JSON.stringify(result);
    }
    const replaceImageUrls = ConfigUtils.getPluginConfig("Identify")?.cfg?.replaceImageUrls;
    if (replaceImageUrls && /^https?:\/\/.*\.(jpg|jpeg|png|bmp)$/i.exec(result)) {
        return (<a href={result} rel="noreferrer" target="_blank"><img src={result} /></a>);
    }
    result = "" + result; // Ensure text is a string
    for (const formatter of Object.values(window.qwc2?.__attributeFormatters || {})) {
        result = formatter(attrName, result, layer, feature);
        if (React.isValidElement(result)) {
            return result;
        }
    }
    result = MiscUtils.addLinkAnchors(result);
    if (/^<\w[^>]*>/.test(result)) {
        const dispatch = useDispatch();
        const attributeLinkClicked = (ev) => {
            dispatch(openExternalUrl(ev.currentTarget.href, ev.currentTarget.target));
            ev.preventDefault();
        };
        result = MiscUtils.sanitizeHtml(result).replace('&#10;', '<br />');
        const options = {replace: (node) => {
            if (node.name === "a") {
                return (
                    <a href={node.attribs.href} onClick={attributeLinkClicked} target={node.attribs.target || "_blank"}>
                        {domToReact(node.children, options)}
                    </a>
                );
            }
            return undefined;
        }};
        return htmlReactParser(result, options);
    } else {
        return result;
    }
}

renderIdentifyAttribute.propTypes = {
    attrName: PropTypes.string,
    attrValue: PropTypes.string,
    feature: PropTypes.object,
    layer: PropTypes.string
};

export default React.memo(renderIdentifyAttribute);
