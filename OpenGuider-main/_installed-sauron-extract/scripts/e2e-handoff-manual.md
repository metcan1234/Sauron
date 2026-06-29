# E2E Handoff Manual Checklist

## Prerequisites
- VS Code with `code` CLI on PATH
- Cline extension (`saoudrizwan.claude-dev`)
- Sauron Bridge VSIX installed (Settings → Bridge'i kur / yenile or `scripts/install-sauron-stack.ps1`)

## Steps
1. Open Sauron Core → Settings → Workspace → select project folder.
2. In panel chat, describe a coding task and click **Çalışma Kısmı** (⌘).
3. Confirm VS Code opens the workspace; wait for handoff status banner (consumed / timeout / rejected).
4. Open panel workspace banner → verify **Handoff geçmişi** lists the new entry as `pending` then `consumed` after Bridge processes it.
5. Create a second handoff while one is still pending; confirm confirm dialog appears.
6. Reject a pending handoff from history panel → file becomes `.rejected`; badge on ⌘ clears when no pending remain.
7. Settings → Sistem tanısı → all critical checks pass (doctor).

## Expected artifacts
- `.sauron/handoff-<id>.json` (pending) or `.consumed` / `.rejected` terminal files
- `.sauron/finops-config.json` after saving FinOps settings
