import { showImageEditor } from "./ImageEditor";

let mockPainterroShow;
let mockPainterro;

jest.mock("painterro", () => ({
    __esModule: true,
    default: (args) => mockPainterro(args),
}));

jest.mock('../stores/StandardStore', () => ({
    get: jest.fn(() => ({
        getState: jest.fn(() => ({
            locale: {
                current: "xy",
                messages: {
                    lorem: "ipsum"
                }
            }
        })),
    })),
}));


describe("showImageEditor", () => {
    beforeEach(() => {
        mockPainterroShow = jest.fn();
        mockPainterro = jest.fn(() => ({
            show: mockPainterroShow
        }));
    })
    it("should construct the image editor", () => {
        const callback = jest.fn();
        showImageEditor("imageData", callback);
        expect(mockPainterro).toHaveBeenCalled();
        expect(mockPainterroShow).toHaveBeenCalledWith("imageData");
    });
});
