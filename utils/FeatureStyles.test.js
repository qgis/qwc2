import { Point } from 'ol/geom';
import { Feature } from 'ol';
import { Style } from 'ol/style';

import FeatureStyles from './FeatureStyles';


let mockDefaultFeatureStyle = {
    "foo": "bar",
};
jest.mock("./ConfigUtils", () => ({
    __esModule: true,
    default: {
        getConfigProp: (name) => {
            if (name === 'defaultFeatureStyle') {
                return mockDefaultFeatureStyle;
            }
        },
    },
}));

let mockFeatureProps = {};
const getPropertiesMock = jest
    .spyOn(Feature.prototype, 'getProperties')
    .mockImplementation(() => mockFeatureProps);


describe("default", () => {
    it('returns default style', () => {
        const feature = new Feature(new Point([1, 2]));
        const styles = FeatureStyles.default(feature);
        expect(styles.length).toBe(1);
        expect(styles[0]).toBeInstanceOf(Style);
    });
    it('adds a layer style', () => {
        const feature = new Feature(new Point([1, 2]));
        feature.set("geometry", new Point([1, 2]));
        mockFeatureProps = {
            label: "abcd",
        }
        const styles = FeatureStyles.default(feature);
        expect(styles.length).toBe(2);
        expect(styles[0]).toBeInstanceOf(Style);
        expect(styles[1]).toBeInstanceOf(Style);
    });
    it('adds a segment labels style', () => {
        const feature = new Feature(new Point([1, 2]));
        mockFeatureProps = {
            segment_labels: [
                "abcd",
                "def"
            ]
        }
        const styles = FeatureStyles.default(feature);
        expect(styles.length).toBe(2);
        expect(styles[0]).toBeInstanceOf(Style);
        expect(styles[1]).toBeInstanceOf(Style);
    });
    it('adds both', () => {
        const feature = new Feature(new Point([1, 2]));
        mockFeatureProps = {
            label: "abcd",
            segment_labels: [
                "abcd",
                "def"
            ]
        }
        const styles = FeatureStyles.default(feature);
        expect(styles.length).toBe(3);
        expect(styles[0]).toBeInstanceOf(Style);
        expect(styles[1]).toBeInstanceOf(Style);
        expect(styles[2]).toBeInstanceOf(Style);
    });
});

describe("image", () => {
    it("returns default style", () => {
        const feature = new Feature(new Point([1, 2]));
        const style = FeatureStyles.image(feature, {
            img: new Image(),
            rotation: 0,
            size: 10,
        });
        expect(style).toBeInstanceOf(Style);
    });
});

describe("interaction", () => {
    it('returns the style', () => {
        const feature = new Feature(new Point([1, 2]));
        const style = FeatureStyles.interaction(feature, false);
        expect(style).toBeInstanceOf(Style);
    });
});

describe("interactionVertex", () => {
    it('returns the style', () => {
        const style = FeatureStyles.interactionVertex({}, false);
        expect(style).toBeInstanceOf(Style);
    });
});

describe("marker", () => {
    it('returns the style', () => {
        const feature = new Feature(new Point([1, 2]));
        const styles = FeatureStyles.marker(feature);
        expect(styles.length).toBe(1);
        expect(styles[0]).toBeInstanceOf(Style);
    });
});

describe("measureInteraction", () => {
    it('returns the style', () => {
        const feature = new Feature(new Point([1, 2]));
        const styles = FeatureStyles.measureInteraction(feature);
        expect(styles.length).toBe(3);
        expect(styles[0]).toBeInstanceOf(Style);
        expect(styles[1]).toBeInstanceOf(Style);
        expect(styles[2]).toBeInstanceOf(Style);
    });
});


describe("measureInteractionVertex", () => {
    it('returns the style', () => {
        const style = FeatureStyles.measureInteractionVertex({});
        expect(style).toBeInstanceOf(Style);
    });
});

describe("sketchInteraction", () => {
    it('returns the style', () => {
        const style = FeatureStyles.sketchInteraction({});
        expect(style).toBeInstanceOf(Style);
    });
});

describe("text", () => {
    it('returns the style', () => {
        const feature = new Feature(new Point([1, 2]));
        const styles = FeatureStyles.measureInteraction(feature);
        expect(styles.length).toBe(3);
        expect(styles[0]).toBeInstanceOf(Style);
    });
});

