// backend/tests/unit/pathResolver.test.js - borderline nonsense
const pathResolver = require('../../services/appPathResolver');

// Mock dependencies
jest.mock('@stdlib/fs-resolve-parent-path', () => ({
  sync: jest.fn(),
}));

describe('getProjectRoot()', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  test('should return the correct project root when package.json is found', () => {
    const fakePath = '/project/root/package.json';
    require('@stdlib/fs-resolve-parent-path').sync.mockReturnValue(fakePath);

    const projectRoot = pathResolver.getProjectRoot();
    expect(projectRoot).toBe('/project/root');
  });
});
