import { canAccessPath, resolvePostLoginPath, safeNext } from './redirect';

describe('safeNext', () => {
  it.each([
    ['/student', '/student'],
    ['/settings/account?tab=security', '/settings/account?tab=security'],
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['https://evil.example', null],
    ['student', null],
    [undefined, null],
  ])('%s -> %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe('canAccessPath', () => {
  it('allows the role area and shared settings', () => {
    expect(canAccessPath('student', '/student')).toBe(true);
    expect(canAccessPath('admin', '/admin/users')).toBe(true);
    expect(canAccessPath('parent', '/settings/account')).toBe(true);
  });

  it('rejects other role areas and lookalike prefixes', () => {
    expect(canAccessPath('student', '/admin')).toBe(false);
    expect(canAccessPath('student', '/studentish')).toBe(false);
    expect(canAccessPath('unknown', '/student')).toBe(false);
  });
});

describe('resolvePostLoginPath', () => {
  const student = { role: 'student' };

  it('returns an allowed next path', () => {
    expect(resolvePostLoginPath(student, '/student')).toBe('/student');
  });

  it('falls back to the role home for disallowed or unsafe paths', () => {
    expect(resolvePostLoginPath(student, '/admin/users')).toBe('/student');
    expect(resolvePostLoginPath(student, '//evil.example')).toBe('/student');
    expect(resolvePostLoginPath({ role: 'teacher' }, null)).toBe('/teacher');
  });
});
