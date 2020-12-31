/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ConfigUtils from './ConfigUtils';

const LocaleUtils = {
    getMessageById(messages, msgId) {
        return messages ? messages[msgId] || msgId : msgId;
    },
    toLocaleFixed(number, digits) {
        if (ConfigUtils.getConfigProp("localeAwareNumbers")) {
            return number.toLocaleString(LocaleUtils.getUserLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
        } else {
            return number.toFixed(digits);
        }
    }
};

export default LocaleUtils;
