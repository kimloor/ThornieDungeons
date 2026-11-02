# Build-only GitHub Actions Workflow

Status: documented from the verified PR #196 Build-only run on 2026-11-02.

## Purpose

The isolated Build-only workflow runs the frontend generator and stores the generated `index.html` as a downloadable GitHub Actions artifact. It is intended for a build step when running the repository's broader test/CI workflows is not part of the approved task.

Workflow file:

`.github/workflows/build-only.yml`

Workflow run:

https://github.com/kimloor/ThornieDungeons/actions/runs/41404081209

## What it does

The workflow performs only these steps:

1. Checks out the PR #196 feature branch.
2. Sets up Node.js 22.
3. Runs `node build.js`.
4. Verifies that `index.html` exists and is not empty.
5. Uploads `index.html` as artifact `pr-196-generated-index`.

It does not run tests, perform D1 operations, apply migrations, deploy a Worker, or commit generated files back to the branch.

## How to retrieve the generated file

1. Open the relevant GitHub Actions run.
2. Scroll to the **Artifacts** section at the bottom of the run summary.
3. Download `pr-196-generated-index`.
4. Extract the ZIP and inspect the generated `index.html`.
5. If the generated file is approved for the PR, add it to the feature branch through the normal reviewed source-control process. The workflow itself does not update the branch.

For PR #196's verified run:

- Run ID: `41404081209`
- Source commit: `68e82d24bf11b2f2aeb18bf18beb880ec256fe77`
- Result: success
- Artifact: `pr-196-generated-index`
- Artifact SHA-256: `ee3fc229ac5eb55085ef292bf4c75262409723a198e7c59e74b44e5e34cbb8bf`
- Artifact expiration: 2027-01-31

## Trigger limitation — read before reuse

The current PR #196 workflow is intentionally branch-specific. Its `push` trigger is restricted to changes to `.github/workflows/build-only.yml` on branch `fix/p0-battle-victory-authority-rebased-20261102`.

Therefore, changing application source files alone will **not** trigger another Build-only run. The current workflow does not define `workflow_dispatch`. Do not assume it is a reusable manual build button or change its trigger without reviewing the expected branch and workflow side effects first.

To reuse this pattern for another branch or future task, create or update a separately approved workflow with an explicit branch allowlist and narrowly scoped path filters or a supported manual trigger. Review all other push/PR workflows that the same commit could activate before publishing the change.

## Separation from tests, QA, and deployment

A successful Build-only run proves only that `node build.js` completed and a non-empty `index.html` was uploaded for the exact source commit shown in the run.

It is not evidence that:

- unit, integration, or regression tests passed;
- Battle Core parity or Admin V2 QA passed;
- Actual D1 security QA passed;
- migrations were applied safely;
- the API Worker or frontend was deployed;
- Production behavior was verified.

Run those checks only when separately authorized and required by the task's release gates.

## Safety notes

- Never hand-edit generated `index.html`; use `node build.js`.
- Always tie the artifact to its exact source commit and run ID.
- Do not treat an artifact from an older commit as proof for a newer PR head.
- Do not merge or deploy solely because the Build-only workflow succeeded.
