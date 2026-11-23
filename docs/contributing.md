# Configuration management and quality gate workflow

To maintain strict configuration control, absolute traceability, and compliance
with our **Strict-Main-Gate Ruleset**, direct pushes to the `master` branch are
blocked by repository protection rules. Every change must pass through the
integration workflow below.

## 1. Branch naming conventions

All adjustments must occur on sandboxed feature branches using the following
prefix taxonomy:

*   `feat/`  - New microservice logic, endpoint contracts, or UI widgets (e.g., `feat/topology-graph-schema`).
*   `fix/`   - Patches, security remediations, or logical bug fixes.
*   `chore/` - Build tooling, Kubernetes manifests, or infrastructure adjustments.
*   `docs/`  - Systems engineering updates to the `/docs/` directory, ADRs, or ICDs.

## 2. The development lifecycle (standard operating procedure)

Execute this path via your workspace terminal for all development tasks:

```bash
# Step A: Align local environment with the verified golden production state
git checkout master
git pull origin master

# Step B: Initialize an isolated branch for your specific task
git checkout -b <prefix>/<short-description>

# Step C: Stage and commit changes using Conventional Commit patterns
git add .
git commit -m "<type>(<scope>): <imperative_description>"

# Step D: Push the local branch up to the remote repository
git push --set-upstream origin <prefix>/<short-description>
```

## 3. Commit message standards (Conventional Commits)

Commit logs serve as the software history ledger for system audits. Messages
must use structured prefixes to clearly define technical intent:

*   `feat(scope):` Adds a new capability (e.g., `feat(audit-ledger): implement event consumer for settlement`).
*   `fix(scope):` Corrects a system asset (e.g., `fix(pdf-generator): repair stream buffer leak during rendering`).
*   `chore(scope):` Alters configuration scripts (e.g., `chore(k8s): scaffold initial deployment ingress rules`).
*   `docs(scope):` Modifies engineering documentation or design records (e.g., `docs(adr): commit architecture design baseline for service mesh`).

## 4. Verification and integration (the code gate)

Once a feature branch is pushed, the integration phase must execute via the
GitHub web portal to satisfy configuration controls:

1. Navigate to the repository page on GitHub.
2. Click the green **Compare & pull request** button.
3. Title the Pull Request using conventional commit syntax, and populate the
   description with a bulleted list detailing **what changed** and **why it
   changed**.
4. Click **Create pull request** to submit the branch for integration.
5. Review the automated code diff to verify strict environment isolation and
   zero credential leakage.
6. Click **Merge pull request**, then **Confirm merge** to fold the verified
   code into the production baseline.

## 5. Workspace cleanup

To prevent local workspace pollution and configuration drift following a
successful merge, execute the following commands in your terminal:

```bash
# Step A: Return to your local master branch
git checkout master

# Step B: Fetch the freshly integrated production code from the remote server
git pull origin master

# Step C: Delete the local temporary branch now that its lifecycle is complete
git branch -d <prefix>/<short-description>
```
