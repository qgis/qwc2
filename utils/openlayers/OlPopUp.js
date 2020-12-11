/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

require('./olPopUp.css');

const popUp = function() {
    const pop = document.createElement('div');
    pop.setAttribute("class", "ol-popup");
    const popDismis = document.createElement('a');
    popDismis.setAttribute("class", "ol-popup-close-btn");
    popDismis.setAttribute("href", "#close");
    popDismis.innerHTML = "x";
    const popCntWrap = document.createElement('div');
    popCntWrap.setAttribute("class", "ol-popup-cnt-wrapper");
    const popCnt = document.createElement('div');
    popCnt.setAttribute("class", "ol-popup-cnt");
    popCntWrap.appendChild(popCnt);
    const popTipWrap = document.createElement('div');
    popTipWrap.setAttribute("class", "ol-popup-tip-wrapper");
    const popTip = document.createElement('div');
    popTip.setAttribute("class", "ol-popup-tip");
    popTipWrap.appendChild(popTip);
    pop.appendChild(popDismis);
    pop.appendChild(popCntWrap);
    pop.appendChild(popTipWrap);
    return pop;
};
module.exports = popUp;
