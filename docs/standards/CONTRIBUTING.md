# Contributing Guide

## Getting Started

1. Clone the repository
2. Run `./infrastructure/scripts/setup.sh`
3. Create a feature branch from `develop`
4. Make your changes
5. Open a Pull Request

---

## Git Workflow

We follow a **GitFlow**-based branching strategy.

### Branches

| Branch        | Purpose                              |
| ------------- | ------------------------------------ |
| `main`        | Production-ready code                |
| `develop`     | Integration branch for features      |
| `feature/*`   | New features                         |
| `bugfix/*`    | Bug fixes                            |
| `hotfix/*`    | Urgent production fixes              |
| `release/*`   | Release preparation                  |

### Branch Naming

```
feature/short-description
bugfix/issue-number-description
hotfix/critical-fix-description
release/v1.0.0
```

Examples:
- `feature/student-portal`
- `bugfix/123-login-redirect`
- `hotfix/fix-db-connection`

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | When to use                          |
| ---------- | ------------------------------------ |
| `feat`     | New feature                          |
| `fix`      | Bug fix                              |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs`     | Documentation only                   |
| `test`     | Adding or updating tests             |
| `chore`    | Build process, tooling, dependencies |
| `style`    | Formatting, whitespace (no logic)    |
| `perf`     | Performance improvement              |
| `ci`       | CI/CD configuration                  |

### Scope

Use the affected area: `frontend`, `backend`, `docker`, `docs`, `ci`.

### Examples

```
feat(backend): add user registration endpoint
fix(frontend): resolve navbar z-index on mobile
docs(setup): add Docker troubleshooting section
chore(ci): update Node.js version in workflow
refactor(backend): extract user service from controller
```

---

## Pull Request Process

### Before Opening a PR

- [ ] Code builds without errors
- [ ] All existing tests pass
- [ ] New code has appropriate tests
- [ ] Code follows the project's coding standards
- [ ] Documentation is updated if needed

### PR Title Format

Same as commit convention:
```
feat(backend): add health check endpoint
```

### PR Description Template

```markdown
## What
Brief description of changes.

## Why
Motivation and context.

## How
Technical approach.

## Testing
How was this tested?

## Screenshots (if UI changes)
```

---

## Code Review Checklist

Reviewers should verify:

- [ ] Code is readable and well-organized
- [ ] No hardcoded secrets or credentials
- [ ] Error handling is appropriate
- [ ] No unnecessary console.log / print statements
- [ ] API changes are backward compatible
- [ ] Database migrations are reversible
- [ ] Performance impact is considered

---

## Release Process

1. Create `release/vX.Y.Z` branch from `develop`
2. Update version numbers and changelog
3. Open PR to `main`
4. After merge, tag the release: `git tag vX.Y.Z`
5. Merge `main` back into `develop`
