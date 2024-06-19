import LocaleUtils from "../utils/LocaleUtils";
import MapUtils from "../utils/MapUtils";
import MockMap from "./mocks/MockMap";

import '@testing-library/jest-dom';

// Mock translation function, just return the message key
LocaleUtils.tr = (key) => key;
LocaleUtils.lang = () => 'en';

// Mock the Map object globally
MapUtils.registerHook(MapUtils.GET_MAP, new MockMap());
