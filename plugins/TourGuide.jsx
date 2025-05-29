import React from "react";
import { connect } from "react-redux";

import { driver } from "driver.js";
import PropTypes from "prop-types";

import { setCurrentTask } from "../actions/task";
import LocaleUtils from '../utils/LocaleUtils';

import "driver.js/dist/driver.css";
import './style/TourGuide.css';

class TourGuide extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        /** Url of the Tourguide JSON configuration. */
        tourGuideUrl: PropTypes.string
    };
    static defaultProps = {
        tourGuideUrl: "/tourguide.json"
    };
    state = {
        tourSteps: [],
        driverObj: null,
        currentStepIndex: 0,
        rawStepData: []
    };
    componentDidMount() {
        this.props.setCurrentTask(null);
        fetch(this.props.tourGuideUrl)
            .then((response) => response.json())
            .then((data) => {
                const steps = data.map((step) => ({
                    element: step.selector,
                    popover: {
                        title: "",
                        description: step.content,
                        side: step.side,
                        align: step.align
                    }
                }));
                const driverObj = driver({
                    popoverClass: 'driverjs-theme',
                    nextBtnText: LocaleUtils.tr("tourguide.next") + ' →',
                    prevBtnText: '← ' + LocaleUtils.tr("tourguide.previous"),
                    doneBtnText: LocaleUtils.tr("tourguide.done"),
                    progressText: `{{current}} / {{total}}`,
                    showProgress: true,
                    steps,
                    onNextClick: () => this.handleClick(driverObj, "next"),
                    onPrevClick: () => this.handleClick(driverObj, "prev"),
                    onDestroyed: () => {
                        document.querySelectorAll(".AppMenu .appmenu-submenu").forEach(submenu => submenu.classList.remove("appmenu-submenu-expanded"));
                        document.querySelector(".AppMenu")?.classList.remove("appmenu-visible");
                        this.props.setCurrentTask(null);
                    },
                    onHighlightStarted: (_, step) => {
                        const index = steps.findIndex((s) => s.element === step.element);
                        this.setState({ currentStepIndex: index });
                    }
                });
                this.setState(
                    { tourSteps: steps, driverObj, rawStepData: data },
                    () => {
                        if (this.props.active) {
                            this.startTour();
                        }
                    },
                );
            })
            .catch((err) => {
                /* eslint-disable-next-line */
                console.error("Failed to load tour guide:", err);
            });
    }
    componentDidUpdate(prevProps) {
        if (this.props.active && !prevProps.active && this.state.driverObj) {
            this.props.setCurrentTask(null);
            this.startTour();
        }
    }
    handleClick = (driverObj, direction) => {
        const { currentStepIndex, rawStepData } = this.state;
        const currentRawStep = rawStepData[currentStepIndex];
        const actionNames =
          direction === "next"
              ? currentRawStep?.onNextClick
              : currentRawStep?.onPrevClick;
        if (Array.isArray(actionNames)) {
            actionNames.forEach(actionName => this.runCustomAction(actionName));
        } else if (actionNames) {
            this.runCustomAction(actionNames);
        }
        this.setState(
            (prevState) => ({
                currentStepIndex:
              direction === "next"
                  ? prevState.currentStepIndex + 1
                  : Math.max(prevState.currentStepIndex - 1, 0)
            }),
            () => {
                direction === "next" ? driverObj.moveNext() : driverObj.movePrevious();
            },
        );
    };
    runCustomAction = (actionName) => {
        if (actionName.startsWith("setTask:")) {
            this.props.setCurrentTask(actionName.replace("setTask:", "").trim());
            return;
        }
        if (actionName.startsWith("openSubMenu:")) {
            const submenuName = actionName.replace("openSubMenu:", "").trim();
            const submenu = Array.from(document.querySelectorAll(".appmenu-submenu")).find(el =>
                el.querySelector(`span.icon-${submenuName}`)
            );
            if (submenu) {
                submenu.classList.add("appmenu-submenu-expanded");
            } else {
                /* eslint-disable-next-line */
                console.warn(`Submenu with icon-${submenuName} not found.`);
            }
            return;
        }
        if (actionName.startsWith("closeSubMenu:")) {
            const submenuName = actionName.replace("closeSubMenu:", "").trim();
            const submenu = Array.from(document.querySelectorAll(".appmenu-submenu")).find(el =>
                el.querySelector(`span.icon-${submenuName}`)
            );
            if (submenu) {
                submenu.classList.remove("appmenu-submenu-expanded");
            } else {
                /* eslint-disable-next-line */
                console.warn(`Submenu with icon-${submenuName} not found.`);
            }
            return;
        }
        switch (actionName) {
        case "openMenu":
            document.querySelector(".AppMenu")?.classList.add("appmenu-visible");
            break;
        case "closeMenu":
            document.querySelector(".AppMenu")?.classList.remove("appmenu-visible");
            break;
        default:
            /* eslint-disable-next-line */
            console.warn("Unknown action:", actionName);
        }
    };
    startTour = () => {
        this.state.driverObj?.drive();
    };
    render() {
        return null;
    }
}

export default connect((state) => ({active: state.task.id === "TourGuide"}), {setCurrentTask: setCurrentTask})(TourGuide);
