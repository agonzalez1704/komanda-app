let inMemoryStorage: Record<string, string> = {};

const mockAsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(inMemoryStorage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    inMemoryStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete inMemoryStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    inMemoryStorage = {};
    return Promise.resolve();
  }),
};

export default mockAsyncStorage;
