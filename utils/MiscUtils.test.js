import MiscUtils from './MiscUtils';

describe('addLinkAnchors', () => {
    it("should do nothing if text already contains tags", () => {
        const text = (
            '<p>Test string with a link to https://www.google.com</p>'
        );
        expect(MiscUtils.addLinkAnchors(text)).toBe(text);
    });

    it("should only deal with anchors", () => {
        const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
        expect(MiscUtils.addLinkAnchors(text)).toBe(text);
    });

    it('should return text with anchor tags', () => {
        expect(MiscUtils.addLinkAnchors(
            'Test string with a link to https://www.google.com'
        )).toBe(
            'Test string with a link to ' +
            '<a href="https://www.google.com" target="_blank">' +
            'https://www.google.com' +
            '</a>'
        );
    });
});


describe('htmlEncode', () => {
    it('should return text with HTML special characters encoded', () => {
        expect(MiscUtils.htmlEncode(
            '<p>Test string</p>'
        )).toBe(
            '&lt;p&gt;Test string&lt;/p&gt;'
        );
        expect(MiscUtils.htmlEncode(
            '"Test string"'
        )).toBe(
            '&quot;Test string&quot;'
        );
        expect(MiscUtils.htmlEncode(
            "'Test string'"
        )).toBe(
            '&#039;Test string&#039;'
        );
        expect(MiscUtils.htmlEncode(
            "a & b < c > d \" e ' f"
        )).toBe(
            'a &amp; b &lt; c &gt; d &quot; e &#039; f'
        );
    });
});


describe('getCsrfToken', () => {
    describe('if there is a token', () => {
        it('should find it', () => {
            document.getElementsByTagName = jest.fn().mockReturnValue([
                {
                    getAttribute: (name) => {
                        if (name === "name") {
                            return "csrf-token";
                        } else if (name === "content") {
                            return "test";
                        }
                    }
                }
            ]);
            expect(MiscUtils.getCsrfToken()).toBe("test");
        });
    });
    describe('if there no token', () => {
        it('should return an empty string', () => {
            document.getElementsByTagName = jest.fn().mockReturnValue([
                {
                    getAttribute: (name) => {
                        if (name === "name") {
                            return "xxx";
                        } else if (name === "content") {
                            return "test";
                        }
                    }
                }
            ]);
            expect(MiscUtils.getCsrfToken()).toBe("");
        });
    });
});


describe('setupKillTouchEvents', () => {
    it('should install a touchmove handler', () => {
        const el = {
            addEventListener: jest.fn()
        };
        MiscUtils.setupKillTouchEvents(el);
        expect(el.addEventListener).toHaveBeenCalledWith(
            'touchmove', expect.anything(), { passive: false }
        );
    });
    it('should do nothing if element is null', () => {
        MiscUtils.setupKillTouchEvents(null);
    });
});


describe('killEvent', () => {
    it('should stop event propagation and prevent default action', () => {
        const ev = {
            cancelable: true,
            stopPropagation: jest.fn(),
            preventDefault: jest.fn()
        };
        MiscUtils.killEvent(ev);
        expect(ev.stopPropagation).toHaveBeenCalled();
        expect(ev.preventDefault).toHaveBeenCalled();
    });
    it('should do nothing if event is not cancelable', () => {
        const ev = {
            cancelable: false,
            stopPropagation: jest.fn(),
            preventDefault: jest.fn()
        };
        MiscUtils.killEvent(ev);
        expect(ev.stopPropagation).not.toHaveBeenCalled();
        expect(ev.preventDefault).not.toHaveBeenCalled();
    });
});


describe('blendColors', () => {
    it('should blend two colors', () => {
        expect(
            MiscUtils.blendColors("#000000", "#ffffff", 0.5)
        ).toBe("#808080");
        expect(
            MiscUtils.blendColors("#000000", "#ffffff", 0)
        ).toBe("#000000");
        expect(
            MiscUtils.blendColors("#000000", "#ffffff", 1)
        ).toBe("#ffffff");
    });
});


describe('ensureArray', () => {
    it('should create an empty array for undefined', () => {
        expect(
            MiscUtils.ensureArray(undefined)
        ).toBeDeepCloseTo([]);

    });
    it('should create an array for a number', () => {
        expect(
            MiscUtils.ensureArray(1)
        ).toBeDeepCloseTo([1]);
    });
    it('should return the array', () => {
        const ary = [1, 2, 3];
        expect(
            MiscUtils.ensureArray(ary)
        ).toBe(ary);
    });
});


describe('capitalizeFirst', () => {
    it('should capitalize the first letter', () => {
        expect(
            MiscUtils.capitalizeFirst("test")
        ).toBe("Test");
    });
    it('should do nothing if already capitalized', () => {
        expect(
            MiscUtils.capitalizeFirst("Test")
        ).toBe("Test");
    });
    it('should do nothing if empty', () => {
        expect(
            MiscUtils.capitalizeFirst("")
        ).toBe("");
    });
});


describe('isBrightColor', () => {
    it('should return true for bright colors', () => {
        expect(
            MiscUtils.isBrightColor("#ffffff")
        ).toBe(true);
        expect(
            MiscUtils.isBrightColor("#ff0000")
        ).toBe(true);
        expect(
            MiscUtils.isBrightColor("#00ff00")
        ).toBe(true);
    });
    it('should return false for dark colors', () => {
        expect(
            MiscUtils.isBrightColor("#0000ff")
        ).toBe(false);
        expect(
            MiscUtils.isBrightColor("#000000")
        ).toBe(false);
        expect(
            MiscUtils.isBrightColor("#800000")
        ).toBe(false);
        expect(
            MiscUtils.isBrightColor("#008000")
        ).toBe(false);
        expect(
            MiscUtils.isBrightColor("#000080")
        ).toBe(false);
    });
});

describe('adjustProtocol', () => {
    it('should return the URL unchanged if it has no protocol', () => {
        expect(
            MiscUtils.adjustProtocol("test")
        ).toBe("test");
    });
    it('should return the URL unchanged if it has the same protocol', () => {
        location.protocol = 'http:';
        expect(
            MiscUtils.adjustProtocol("http://test")
        ).toBe("http://test");
    });
    it('should return the URL with the current protocol', () => {
        location.protocol = 'https:';
        expect(
            MiscUtils.adjustProtocol("http://test")
        ).toBe("https://test");
    });
});
