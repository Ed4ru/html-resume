// Pull requests are squash-merged: the title becomes the commit message on main, and package.json must hold the
// version that title implies, raised once from the version of main.

const TYPES = ['feat', 'fix', 'perf', 'refactor', 'revert', 'docs', 'test', 'ci', 'build', 'chore', 'style'];

// From the weakest.
const LEVELS = ['patch', 'minor', 'major'] as const;

export type Level = (typeof LEVELS)[number];

export interface Commit {
  sha: string;
  message: string;
}

const HEADER = /^(?<type>[a-z]+)(?:\([^()\s]+\))?(?<breaking>!)?: \S/;
// Conventional Commits 1.0.0: a breaking change can be part of commits of any type.
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /m;

export const levelOf = (message: string): Level | undefined => {
  const header = HEADER.exec(message)?.groups;
  if (!header?.type || !TYPES.includes(header.type)) return undefined;
  if (header.breaking || BREAKING_FOOTER.test(message)) return 'major';
  return header.type === 'feat' ? 'minor' : 'patch';
};

export const nextVersion = (version: string, level: Level) => {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!parts) throw new Error(`version ${version} is not X.Y.Z`);
  const [major, minor, patch] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const label = ({ sha, message }: Commit) => `${sha.slice(0, 7)} "${message.split('\n', 1)[0]}"`;

export const checkPullRequest = ({
  title,
  commits,
  baseVersion,
  headVersion,
}: {
  title: string;
  commits: Commit[];
  baseVersion: string;
  headVersion: string;
}) => {
  const errors: string[] = [];

  const titleLevel = levelOf(title);
  if (!titleLevel) errors.push(`title "${title}" is not "<type>: <description>" with a type of ${TYPES.join(', ')}`);

  let strongest: { commit: Commit; level: Level } | undefined;
  for (const commit of commits) {
    const level = levelOf(commit.message);
    if (!level) errors.push(`commit ${label(commit)} is not "<type>: <description>"`);
    else if (!strongest || LEVELS.indexOf(level) > LEVELS.indexOf(strongest.level)) strongest = { commit, level };
  }
  if (titleLevel && strongest && titleLevel !== strongest.level) {
    errors.push(
      `title gives a ${titleLevel} version, but commit ${label(strongest.commit)} gives a ${strongest.level}`,
    );
  }

  if (titleLevel) {
    const expected = nextVersion(baseVersion, titleLevel);
    if (headVersion !== expected) {
      errors.push(
        `package.json: version ${headVersion}, expected ${expected} (${titleLevel} from ${baseVersion} on main)`,
      );
    }
  }
  return errors;
};
