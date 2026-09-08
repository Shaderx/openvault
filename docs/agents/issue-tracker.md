# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>`.
- **List external PRs for triage**: use `gh pr list`, retaining external contributors.
- **Comment / label / close**: use `gh pr comment`, `gh pr edit`, and `gh pr close`.

GitHub shares one number space across issues and PRs. Resolve an ambiguous number using `gh pr view`, falling back to `gh issue view`.

## When a skill says “publish to the issue tracker”

Create a GitHub issue.

## When a skill says “fetch the relevant ticket”

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The map is a single issue with child issues as tickets.

- **Map**: an issue labelled `wayfinder:map`, holding Notes, Decisions-so-far, and Fog.
- **Child ticket**: a GitHub sub-issue, falling back to a task-list link when sub-issues are unavailable.
- **Blocking**: GitHub's native issue dependencies, falling back to a `Blocked by:` line.
- **Frontier query**: select the first open, unblocked, unassigned child in map order.
- **Claim**: assign the issue to the current user.
- **Resolve**: comment with the answer, close the ticket, and add its context pointer to the map.
