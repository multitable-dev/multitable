# Contributing to MultiTable

Thanks for your interest in contributing! MultiTable is fully open source and we welcome contributions of all kinds.

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- Git

### Setup

```bash
git clone https://github.com/multitable-dev/multitable.git
cd multitable
npm install
```

### Development

```bash
npm run dev        # Start daemon + frontend in dev mode
```

## Project Structure

```
packages/
  daemon/          # Node.js backend — PTY management, REST API, WebSockets
  web/             # React frontend — terminal UI, dashboard, panels
  cli/             # CLI wrapper — mt start, mt stop, etc.
```

## How to Contribute

### Reporting Bugs

Open an issue using the bug template. Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your OS and Node.js version

### Suggesting Features

Open a Discussion in the Ideas category. Describe:
- The problem you're trying to solve
- How you imagine the solution working
- Any alternatives you considered

### Submitting Code

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run lint: `npm run lint`
6. Commit using conventional commits:
   - `feat: add session timeline panel`
   - `fix: terminal resize not propagating`
   - `chore: update dependencies`
   - `docs: add Tailscale setup guide`
7. Push and open a PR

### Good First Issues

Look for issues labeled `good first issue` — these are specifically scoped for newcomers.

## Code Style

- TypeScript everywhere
- Prettier for formatting
- ESLint for linting
- Run `npm run lint` before committing

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
