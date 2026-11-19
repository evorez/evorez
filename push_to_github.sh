#!/usr/bin/env bash
# One-shot: create the GitHub repo, push both branches, open the first PR.
#
#   GH_TOKEN=github_pat_xxx ./push_to_github.sh            # private repo
#   GH_TOKEN=github_pat_xxx ./push_to_github.sh public     # public repo
#
# Token needs: Contents = Read and write, Pull requests = Read and write.
# (Classic token works too: `repo` scope.)
set -euo pipefail

: "${GH_TOKEN:?export GH_TOKEN first (github.com/settings/tokens)}"
VISIBILITY="${1:-private}"
REPO="evorez"
API="https://api.github.com"

say() { printf '\033[1;32m›\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null || die "git missing"
command -v curl >/dev/null || die "curl missing"

body() { python3 -c 'import json,sys;print(json.load(sys.stdin).get(sys.argv[1],""))' "$1"; }

say "who am I"
ME_JSON=$(curl -fsS -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "$API/user") \
  || die "token rejected by GitHub"
LOGIN=$(printf '%s' "$ME_JSON" | body login)
[ -n "$LOGIN" ] || die "could not read the login from /user"
say "user: $LOGIN"

say "does $LOGIN/$REPO already exist?"
if curl -fsS -H "Authorization: Bearer $GH_TOKEN" "$API/repos/$LOGIN/$REPO" >/dev/null 2>&1; then
  say "repo exists — pushing into it as-is"
else
  say "creating $LOGIN/$REPO ($VISIBILITY)"
  PAYLOAD=$(python3 - "$REPO" "$VISIBILITY" <<'PY'
import json, sys
name, vis = sys.argv[1], sys.argv[2]
print(json.dumps({
    "name": name,
    "private": vis != "public",
    "description": "Evorez — alive, building. Single-file terminal site: iOS dock, island popovers, embedded soundtrack.",
    "has_issues": True,
    "has_wiki": False,
    "has_projects": False,
    "auto_init": False,
}))
PY
)
  curl -fsS -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
    -d "$PAYLOAD" "$API/user/repos" >/dev/null || die "repo creation failed"
fi

cd "$(dirname "$0")"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git repo: $(pwd)"
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$LOGIN/$REPO.git"

say "pushing main + ci/build-check (token goes in the push URL, never into .git/config)"
git push "https://x-access-token:$GH_TOKEN@github.com/$LOGIN/$REPO.git" main:main --force-with-lease \
  || git push "https://x-access-token:$GH_TOKEN@github.com/$LOGIN/$REPO.git" main:main
git push "https://x-access-token:$GH_TOKEN@github.com/$LOGIN/$REPO.git" ci/build-check:ci/build-check

say "opening the pull request"
PR_PAYLOAD=$(python3 - <<'PY'
import json
print(json.dumps({
    "title": "ci: rebuild and verify the single file",
    "head": "ci/build-check",
    "base": "main",
    "body": """Adds `.github/workflows/site.yml`, which on every push and PR:

- rebuilds `index.html` from the archived source (`build_stripped.py`)
- fails if the committed `index.html` drifts from that build
- asserts the page stays self-contained: no external `<script src>` / stylesheet
- guards the invariants: `#musicBtn`, `#trackPop`, `#scrim`, `#appearPop`, `.rome`, `#dock` present,
  and the removed features (NEON NAGAR, matrix_run, snake, cityLayer) stay gone
- keeps a 900 KB size ceiling so the embedded audio cannot grow unnoticed

Merge karo to `main` hi production branch ban jati hai; Vercel ko repo se connect karne par
har push par preview + production deploy automatic ho jayega.""",
}))
PY
)
PR_URL=$(curl -fsS -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  -d "$PR_PAYLOAD" "$API/repos/$LOGIN/$REPO/pulls" | body html_url) \
  || die "PR creation failed (maybe it already exists — check the repo)"

printf '\n'
say "repo   https://github.com/$LOGIN/$REPO"
say "PR     $PR_URL"
say "done — ab token revoke kar dena: https://github.com/settings/tokens"
