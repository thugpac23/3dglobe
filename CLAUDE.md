# Claude Code Instructions

## Git Workflow

After every `git push` to a feature branch, always merge that branch into `main` and push main:

```bash
git checkout main
git merge <feature-branch> --no-ff
git push -u origin main
git checkout <feature-branch>
```
