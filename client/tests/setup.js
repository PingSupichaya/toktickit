import "@testing-library/jest-dom";
// Provide a deterministic localStorage mock for the jsdom test environment.
// (Node 22+ exposes an experimental global localStorage that can shadow the
// jsdom one; this ensures a clean in-memory implementation in tests.)
function createLocalStorageMock() {
    const map = new Map();
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => map.set(key, String(value)),
        removeItem: (key) => map.delete(key),
        clear: () => map.clear(),
        key: () => null,
        get length() {
            return map.size;
        },
    };
}
const localStorageMock = createLocalStorageMock();
Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
});
