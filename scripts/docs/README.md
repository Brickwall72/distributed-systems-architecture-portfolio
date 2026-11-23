# Documentation report generators

Generate the committed reference documentation under
[docs/generated/](../../docs/generated/). Generation requires Git, Python 3,
and Node with the declared parser dependencies; it does not build images,
start services, or download tooling.

| Script | Responsibility | Invoked by / when |
| --- | --- | --- |
| `generate_doc_reports.sh` | Orchestrator: runs the generators below in order. | `pnpm docs:generate`; CI report-generation job. Run after changing service relationships or federation composition. |
| `generate_architecture.py` | Renders the service composition and interaction view (`docs/generated/architecture/architecture.md`) from the curated [architecture model](../../docs/architecture/model.json). Keep that model current when storage or service relationships change. | `generate_doc_reports.sh`. |
| `generate_dependency_reports.py` | Builds the internal dependency reference (workspaces, contracts, storage, widgets, shell pages) in Markdown, HTML, and JSON under `docs/generated/dependencies/`. | `generate_doc_reports.sh`. |
| `extract_boundary_calls.mjs` | TypeScript/TSX-capable parser that extracts federation composition and connection-boundary calls from tracked runtime source. | Invoked by `generate_dependency_reports.py`; tested by `scripts/tests/boundary-calls.test.mjs`. |
| `sync_generated_reports.py` | Synchronizes CI-generated report artifacts into `docs/generated/` for the automated documentation pull request. | CI publication job after successful verification and generation on `master`. |

To test the generators directly:

```bash
python3 -m unittest scripts.tests.test_documentation_reports -v
node --test scripts/tests/boundary-calls.test.mjs
```
