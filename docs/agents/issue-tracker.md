# Issue tracker: GitHub

Use `gh` with `--repo Shaderx/openvault` explicitly: this checkout also has upstream configured, and automatic selection can target upstream.

Read issues using `gh issue view NUMBER --repo Shaderx/openvault --comments`. List current state using `gh issue list --repo Shaderx/openvault --state open --limit 100 --json number,title,body,labels,comments`.

For multiline PowerShell text, write a UTF-8 file and pass it as data:

```powershell
@'
Implementation details and validation results.
'@ | Set-Content -Encoding utf8 issue-comment.md
gh issue comment NUMBER --repo Shaderx/openvault --body-file issue-comment.md
```

Use `--body-file` with `gh issue create` or `gh issue edit` too. Apply labels using `gh issue edit NUMBER --repo Shaderx/openvault --add-label ready-for-agent`. Post completion evidence before `gh issue close NUMBER --repo Shaderx/openvault`.

Publishing issues/comments or changing tracker state requires authorization from the user's task. A skill's publishing instruction does not independently provide authorization. Close completed issues with evidence and leave unresolved acceptance criteria explicit.

PRs are not a request/triage surface here. GitHub shares their number space with issues; resolve ambiguous references before acting.

For wayfinding, the map is labelled `wayfinder:map`; use native sub-issues or task-list links for children, and native dependencies or a `Blocked by:` line for blockers. Claim only open, unblocked work within the authorized task. Resolve with evidence and update the map's context pointer.
