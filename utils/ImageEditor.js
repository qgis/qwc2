/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Painterro from 'painterro';

import StandardStore from '../stores/StandardStore';
import LocaleUtils from '../utils/LocaleUtils';

import '../components/style/ModalDialog.css';

export function showImageEditor(imageData, imageDataCallback) {
    // Do old-school JS rather than react portal as portal event bubbling messes up Painterro
    const modalDialogContainer = document.createElement("div");
    modalDialogContainer.className = "modal-dialog-container";

    const modalDialog = document.createElement("div");
    modalDialog.className = "modal-dialog";
    modalDialog.style.width = '80%';

    const modalDialogTitle = document.createElement("div");
    modalDialogTitle.className = "modal-dialog-title";

    const titleIcon = document.createElement("span");
    titleIcon.className = "icon icon-paint";
    modalDialogTitle.appendChild(titleIcon);

    const titleLabel = document.createElement("span");
    titleLabel.innerText = LocaleUtils.tr("imageeditor.title");
    modalDialogTitle.appendChild(titleLabel);

    const closeIcon = document.createElement("span");
    closeIcon.className = "icon icon_clickable icon-remove";
    modalDialogTitle.appendChild(closeIcon);

    modalDialog.appendChild(modalDialogTitle);

    const modalDialogBody = document.createElement("div");
    modalDialogBody.className = "modal-dialog-body";
    modalDialogBody.id = 'painterro';
    modalDialogBody.addEventListener('keypress', (ev) => {
        // Prevent i.e. +/- from triggering map zoom
        ev.stopPropagation();
    });
    modalDialog.appendChild(modalDialogBody);

    modalDialogContainer.appendChild(modalDialog);

    document.body.appendChild(modalDialogContainer);

    // eslint-disable-next-line
    window.ptro = Painterro({
        id: 'painterro',
        hiddenTools: ['open'],
        language: StandardStore.get().getState().locale.current.slice(0, 2).toLowerCase(),
        onBeforeClose: (hasUnsaved, doClose) => {
            if (hasUnsaved) {
                // eslint-disable-next-line
                if (confirm(LocaleUtils.tr("imageeditor.confirmclose"))) {
                    doClose();
                }
            }
        },
        onClose: () => {
            window.ptro.hide();
            delete window.ptro;
            document.body.removeChild(modalDialogContainer);
        },
        saveHandler: (image, done) => {
            imageDataCallback(image.asDataURL('image/jpeg'));
            done(true);
            window.ptro.hide();
            delete window.ptro;
            document.body.removeChild(modalDialogContainer);
        }
    }).show(imageData);

    closeIcon.addEventListener('click', () => {
        // eslint-disable-next-line
        if (confirm(LocaleUtils.tr("imageeditor.confirmclose"))) {
            window.ptro.hide();
            delete window.ptro;
            document.body.removeChild(modalDialogContainer);
        }
    });
}
