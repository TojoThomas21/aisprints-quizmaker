import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

Element.prototype.getBoundingClientRect = () => ({
	width: 120,
	height: 32,
	top: 0,
	left: 0,
	bottom: 32,
	right: 120,
	x: 0,
	y: 0,
	toJSON: () => ({}),
});

Element.prototype.scrollIntoView = () => {};
