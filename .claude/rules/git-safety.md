# Git Safety Rules

## Destructive Commands (BLOCKED)
- `git reset --hard` -- loses uncommitted changes
- `git push --force` / `git push -f` -- overwrites remote history
- `git clean -fd` -- deletes untracked files permanently
- `git checkout -- .` -- discards all local changes
- `rm -rf` with wildcards

## Risky Commands (ASK FIRST)
- `git rebase` -- can rewrite history
- `git commit --amend` -- only if not pushed
- `git branch -D` -- force delete branch

## Safe Patterns

### Before Making Changes
```bash
git status
git stash list
git log --oneline -5
```

### Saving Work
```bash
git stash push -m "before risky operation"
```

### Branch Management
- `main` is protected -- never force push
- Use `--force-with-lease` instead of `--force` after rebases
- Always `git fetch origin main && git rebase origin/main` before PRs

## Recovery
```bash
git reflog                    # See all recent operations
git checkout <commit-hash>    # Recover deleted commit
```
