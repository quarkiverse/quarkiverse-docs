# PR previews

Pull requests are built into a preview of docs.quarkiverse.io and deployed to Surge.sh. The full site is over
600 MB, which is too big for Surge, so previews are trimmed:

* Only the latest version of each extension is built (the first entry of `branches`, and no `tags`).
  Sources that the PR adds or edits in `antora-playbook.yml` keep all their versions.
* Files over 1 MB that are identical (by size) to the published copy on docs.quarkiverse.io are removed, and the
  pages that use them load them from docs.quarkiverse.io instead. New or changed files are kept.

This gives a preview of around 170 MB.

| File                                   | Purpose                                                                 |
|----------------------------------------|-------------------------------------------------------------------------|
| `trim-playbook.js`                     | Writes `preview-playbook.yml`, the trimmed version of the playbook      |
| `offload-large-files.js`               | Swaps large files in the built site for links to production            |
| `build.sh`                             | Runs both of these plus Antora, into `build/site`                       |
| `.github/workflows/preview-build.yml`  | Builds the preview for a PR (no secrets)                                |
| `.github/workflows/preview-deploy.yml` | Publishes the preview to Surge, or tears it down when the PR is closed |

To build a preview locally, run `npm i` and then `preview/build.sh`.

## Previews for extension repositories

An extension repository can use the same workflows, so that a PR changing its docs gets a preview of the whole
docs.quarkiverse.io site, with that extension's docs built from the PR. Its entry in `antora-playbook.yml`
(`start_path` and so on) is reused. An extension that isn't in the playbook yet is added, with `start_path: docs`.

Add two workflows to the extension repository. The repository needs a `SURGE_TOKEN` secret.

`.github/workflows/docs-preview-build.yml`:

```yaml
name: Docs preview build

on:
  pull_request:
    types: [ opened, synchronize, reopened, closed ]
    paths:
      - 'docs/**'

jobs:
  preview:
    uses: quarkiverse/quarkiverse-docs/.github/workflows/preview-build.yml@main
```

`.github/workflows/docs-preview-deploy.yml`:

```yaml
name: Docs preview deploy

on:
  workflow_run:
    workflows: [ "Docs preview build" ]
    types:
      - completed
    branches-ignore:
      - 'main'

jobs:
  preview:
    uses: quarkiverse/quarkiverse-docs/.github/workflows/preview-deploy.yml@main
    permissions:
      actions: read
      pull-requests: write
    secrets:
      SURGE_TOKEN: ${{ secrets.SURGE_TOKEN }}
```

The preview is published at `https://<repository name>-docs-pr-<number>-preview.surge.sh`. If that name is longer
than 63 characters, pass a shorter `site-name` input to the deploy workflow. PRs opened from a fork's `main` branch
are not previewed.

The build and deploy are separate workflows, joined by `workflow_run`, so that PRs from forks never run with the
Surge token. This also avoids `pull_request_target`. The deploy identifies the PR from the `workflow_run` metadata
(looking it up by head branch for forks), never from anything the build uploads, since a fork controls the build.
