# Contributing to EasyShopAI

This document describes how the team works on this repository. Follow it so our history stays
clean, `main` stays deployable, and nothing gets lost in chat.

## Ground rules

1. **The owner works on `main`; everyone else uses a PR.** Teammates and AI agents must open a pull
   request that passes CI and gets at least one approval. Only the repository owner may push or
   merge directly to `main`, and only with an explicit decision to do so.
2. **Teammates: one feature/one task per branch and per PR.** Small PRs get reviewed fast; giant PRs
   rot.
3. **Never commit secrets.** API keys, tokens and `.env` files stay out of the repo. Use
   `.env.example` as the template for what a developer needs locally.
4. **CI must be green before merge.** If CI is red, fix it — do not merge around it.

## Day-to-day workflow (teammates and AI agents)

```bash
# 1. Start from an up-to-date main
git switch main
git pull

# 2. Create a branch (see naming below)
git switch -c feat/product-catalog

# 3. Work in small commits (see commit convention)
git add -p
git commit -m "feat(api): add product list endpoint"

# 4. Push and open a PR
git push -u origin feat/product-catalog
#    then open a PR on GitHub (template will guide you)

# 5. Address review comments by adding commits (do not force-push while under review)

# 6. After approval + green CI, squash-merge, delete the branch
```

## Branch naming

`type/short-description` using the same types as commits:

- `feat/…` new functionality (e.g. `feat/ai-bargaining`)
- `fix/…` bug fix (e.g. `fix/cart-total-rounding`)
- `chore/…` tooling, deps, config (e.g. `chore/ci-cache`)
- `docs/…` documentation only
- `refactor/…` internal changes with no behavior change

## Commit messages — Conventional Commits

Format: `type(scope): summary` — e.g. `fix(api): validate phone number on order create`

- **scope** is the area: `web`, `mobile`, `api`, `shared`, `ci`, `docs`
- Write the summary in the imperative, present tense ("add", not "added")
- Explain _why_ in the commit body when it is not obvious

## Pull requests

- Fill in the PR template: what, why, how it was tested.
- Link the issue/requirement it addresses (e.g. `Closes #12`, `FR-04`).
- Keep the diff focused; unrelated cleanups go in a separate PR.
- **Author:** respond to every review comment (fix it, or reply and resolve).
- **Reviewer:** review within a day; approve only when you understand the change.
- Merging: **squash merge** (keeps one clean commit per feature on `main`). Delete the branch.

## What CI does

Every PR and every push to `main` runs `.github/workflows/ci.yml`:

1. `pnpm install --frozen-lockfile` — lockfile must be committed and in sync
2. `pnpm format:check` — Prettier must be clean (`pnpm format` to fix locally)
3. `pnpm turbo run lint typecheck test build` — across all packages, cached by Turborepo

A red CI is a blocker, not a suggestion. Open the failing job in the PR checks tab, fix, push.

## Keeping your branch up to date

If `main` moved while your PR is open:

```bash
git switch main && git pull
git switch feat/my-branch
git merge main          # merge, not rebase, while the branch is pushed/shared
# resolve conflicts, run pnpm run ci, push
git push
```

## Reviewing a teammate's code

- Read the diff before the summary; check behavior against the spec (`SPEC.md`).
- Check for: secrets committed, missing tests, broken multi-tenant isolation (`shop_id`
  filtering), AI answers that are not grounded in tool results.
- Be specific and kind: "this breaks when stock is 0" beats "this is wrong".
- Use GitHub review states: **Comment**, **Approve**, or **Request changes**.

## Rules that protect us (set up in repo settings)

- Teammates need a PR, 1 approval, passing CI, and resolved conversations before `main`.
- The repository owner can bypass review for direct `main` work; admin enforcement is off.
- Force-pushes and branch deletion on `main` are blocked.
- Only the repo owner manages collaborators and settings.

## Where things live

| Area           | Path                                     | Owner (per proposal) |
| -------------- | ---------------------------------------- | -------------------- |
| Backend + data | `apps/api`, `packages/shared`            | Sakibur              |
| Mobile app     | `apps/mobile`                            | Nowrin               |
| AI assistant   | `apps/api` (AI module), shared contracts | Nizam                |
| Web frontend   | `apps/web`                               | Ajoy                 |
