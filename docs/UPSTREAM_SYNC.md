# Syncing Kanata upstream

```bash
git remote add upstream https://github.com/jtroo/kanata.git
git fetch upstream main
git switch main
git merge --ff-only upstream/main
```

If Studio commits make fast-forward impossible, create a dedicated sync branch and merge upstream there. Never rewrite published `main`. Resolve conflicts in upstream-owned `src/`, `parser/`, `keyberon/` and `tcp_protocol/` by preserving upstream behavior first; adapt Studio adapters afterward.
