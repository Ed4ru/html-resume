import { describe, expect, it } from 'vite-plus/test';
import { checkPullRequest, levelOf, nextVersion } from './pr-version.ts';

describe('levelOf', () => {
  it.each([
    ['feat: add a section', 'minor'],
    ['feat(pdf): add a section', 'minor'],
    ['feat!: drop a field', 'major'],
    ['chore!: drop Node 22', 'major'],
    ['refactor(schema)!: rename a field', 'major'],
    ['fix: rename a field\n\nBREAKING CHANGE: the field is renamed', 'major'],
    ['fix: rename a field\n\nBREAKING-CHANGE: the field is renamed', 'major'],
  ])('%j gives a %s version', (message, level) => {
    expect(levelOf(message)).toBe(level);
  });

  it.each(['fix', 'perf', 'refactor', 'revert', 'docs', 'test', 'ci', 'build', 'chore', 'style'])(
    '%s gives a patch version',
    (type) => {
      expect(levelOf(`${type}: change something`)).toBe('patch');
    },
  );

  it.each([
    'Add a section',
    'Feat: add a section',
    'wip: add a section',
    'feat:add a section',
    'feat: ',
    'feat(): add a section',
    'BREAKING CHANGE: the field is renamed',
  ])('rejects %j', (message) => {
    expect(levelOf(message)).toBeUndefined();
  });
});

describe('nextVersion', () => {
  it.each([
    ['patch', '2.0.8'],
    ['minor', '2.1.0'],
    ['major', '3.0.0'],
  ] as const)('raises 2.0.7 by a %s to %s', (level, version) => {
    expect(nextVersion('2.0.7', level)).toBe(version);
  });

  it.each(['2.0', '2.0.7-beta.1', 'v2.0.7'])('rejects %j', (version) => {
    expect(() => nextVersion(version, 'patch')).toThrow(`version ${version} is not X.Y.Z`);
  });
});

describe('checkPullRequest', () => {
  const commit = (sha: string, message: string) => ({ sha, message });
  const feature = commit('a1b2c3d4e5f6', 'feat: add a section');
  const pullRequest = {
    title: 'feat: add a section',
    // Newest first, as git log lists them: the strongest commit is not the first one.
    commits: [commit('c3d4e5f6a1b2', 'test: cover it'), commit('b2c3d4e5f6a1', 'fix: align it'), feature],
    baseVersion: '2.0.7',
    headVersion: '2.1.0',
  };

  it('accepts a title at the level of its strongest commit, with the next version', () => {
    expect(checkPullRequest(pullRequest)).toEqual([]);
  });

  it.each([
    [
      'a title weaker than a commit',
      { title: 'fix: add a section' },
      /^title gives a patch version, but commit a1b2c3d "feat: add a section" gives a minor$/,
    ],
    [
      'a title stronger than every commit',
      { title: 'feat!: add a section' },
      /^title gives a major version, but commit a1b2c3d "feat: add a section" gives a minor$/,
    ],
    [
      'a breaking footer under a title without !',
      { commits: [commit('a1b2c3d4e5f6', 'feat: add a section\n\nBREAKING CHANGE: a field is renamed')] },
      /^title gives a minor version, but commit a1b2c3d "feat: add a section" gives a major$/,
    ],
    [
      'a title that is not conventional',
      { title: 'Add a section' },
      /^title "Add a section" is not "<type>: <description>"/,
    ],
    [
      'a commit that is not conventional',
      { commits: [commit('d4e5f6a1b2c3', 'wip'), feature] },
      /^commit d4e5f6a "wip" is not/,
    ],
    [
      'a version left unchanged',
      { headVersion: '2.0.7' },
      /^package\.json: version 2\.0\.7, expected 2\.1\.0 \(minor from 2\.0\.7 on main\)$/,
    ],
    [
      'a version raised at the wrong level',
      { headVersion: '2.0.8' },
      /^package\.json: version 2\.0\.8, expected 2\.1\.0/,
    ],
    ['a version raised twice', { headVersion: '2.2.0' }, /^package\.json: version 2\.2\.0, expected 2\.1\.0/],
  ])('reports %s', (_, overrides, error) => {
    expect(checkPullRequest({ ...pullRequest, ...overrides })).toContainEqual(expect.stringMatching(error));
  });
});
