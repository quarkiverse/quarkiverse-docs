#!/usr/bin/env bash
# Builds a size-trimmed copy of the site for PR previews into build/site.
# Arguments are passed to trim-playbook.js, e.g.
#   preview/build.sh --base base-playbook.yml
#   preview/build.sh --component https://github.com/quarkiverse/quarkus-foo=../quarkus-foo
set -euo pipefail
cd "$(dirname "$0")/.."

node preview/trim-playbook.js --playbook antora-playbook.yml --output preview-playbook.yml "$@"
_SEARCH_SERVICE_HOST='https://search.quarkus.io' npx antora preview-playbook.yml
curl -sSLo build/site/_/js/vendor/search-wc.js https://search.quarkus.io/static/bundle/app.js
node preview/offload-large-files.js build/site
du -sh build/site
