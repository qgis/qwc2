import MiscUtils from "./MiscUtils";

export default function withTooltip(tooltipContents, props = {}, align = 'center', delay = 500) {
    if (!tooltipContents) {
        return props;
    }
    const updateTooltip = (target) => {
        const tooltip = target.popoverTargetElement;
        if (!tooltip.isConnected) {
            return;
        }
        const appRect = MiscUtils.appContainer(target).getBoundingClientRect();
        tooltip.innerHTML = MiscUtils.sanitizeHtml(tooltipContents);
        tooltip.showPopover();
        const height = tooltip.getBoundingClientRect().height;
        const rect = target.getBoundingClientRect();
        if (align === 'center') {
            tooltip.style.transform = 'translateX(-50%)';
            if (rect.bottom + height > appRect.bottom && rect.top > window.innerHeight - rect.bottom) {
                tooltip.style.bottom = `${Math.round(window.innerHeight - rect.top + 5)}px`;
                tooltip.style.maxHeight = `${rect.top - 5}px`;
            } else {
                tooltip.style.top = `${Math.round(rect.bottom + 5)}px`;
                tooltip.style.maxHeight = `${window.innerHeight - rect.bottom - 5}px`;
            }
        } else if (align === 'left') {
            tooltip.style.transform = 'translateY(-50%)';
            tooltip.style.top = `${Math.round(0.5 * (rect.top + rect.bottom))}px`;
        } else if (align === 'pointer') {
            if (tooltip.srcPos.y + 5 + height > appRect.bottom && rect.top > window.innerHeight - rect.bottom) {
                tooltip.style.bottom = `${Math.round(window.innerHeight - tooltip.srcPos.y + 5)}px`;
                tooltip.style.maxHeight = `${tooltip.srcPos.y - 5}px`;
            } else {
                tooltip.style.top = `${Math.round(tooltip.srcPos.y + 5)}px`;
                tooltip.style.maxHeight = `${window.innerHeight - tooltip.srcPos.y - 5}px`;
            }
        }
        const width = tooltip.getBoundingClientRect().width;
        if (align === 'center') {
            const left = Math.min(
                Math.max(appRect.left + 0.5 * width + 5, 0.5 * (rect.left + rect.right)),
                appRect.right - 0.5 * width - 5
            );
            tooltip.style.left = `${left}px`;
        } else if (align === 'left') {
            tooltip.style.left = `${rect.left - 5 - width}px`;
        } else if (align === 'pointer') {
            tooltip.style.left = `${Math.min(tooltip.srcPos.x + 5, appRect.right - width - 5)}px`;
        }
    };
    const scheduleShowTooltip = (ev) => {
        props.onMouseMove?.(ev);
        if (!tooltipContents) {
            return;
        }
        const target = ev.currentTarget;
        if (target.popoverTargetElement) {
            if (
                align !== 'pointer' || (
                    Math.abs(ev.clientX - target.popoverTargetElement.srcPos.x) < 10 &&
                    Math.abs(ev.clientY - target.popoverTargetElement.srcPos.y) < 10
                )
            ) {
                return;
            }
            target.popoverTargetElement.remove();
        }
        clearTimeout(target.tooltipTimeout);
        const srcPos = {x: ev.clientX, y: ev.clientY};
        target.tooltipTimeout = setTimeout(() => {
            if (target.isConnected) {
                const tooltip = ev.view.document.createElement("div");
                tooltip.className = "tooltip";
                tooltip.popover = "manual";
                tooltip.srcPos = srcPos;
                target.popoverTargetElement = tooltip;
                target.popoverTargetAction = 'show';
                MiscUtils.appContainer(target).appendChild(tooltip);
                updateTooltip(target);
            }
            target.tooltipTimeout = null;
        }, delay);
    };
    const hideTooltip = (ev) => {
        props.onMouseLeave?.(ev);
        clearTimeout(ev.currentTarget.tooltipTimeout);
        const tooltip = ev.currentTarget.popoverTargetElement;
        if (tooltip) {
            tooltip.hidePopover();
            tooltip.remove();
            ev.currentTarget.popoverTargetElement = null;
        }
    };
    const onRef = (el) => {
        props.ref?.(el);
        if (el?.popoverTargetElement) {
            updateTooltip(el);
        }
    };

    return {
        ...props,
        onMouseMove: scheduleShowTooltip,
        onMouseLeave: hideTooltip,
        ref: onRef
    };
}
