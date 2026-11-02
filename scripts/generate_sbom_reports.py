#!/usr/bin/env python3

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "docs/generated/sbom"
IMAGE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
IMAGE_TAG_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/:@-]*$")


def image_id(image_name: str) -> str:
    name = image_name.rsplit("/", 1)[-1]
    if ":" in name:
        name = name.rsplit(":", 1)[0]
    if not IMAGE_ID_PATTERN.fullmatch(name):
        raise ValueError(f"Image name cannot be used as an SBOM filename: {image_name}")
    return name


def load_builds(artifact_file: Path) -> list[tuple[str, str]]:
    if artifact_file.suffix != ".json" or not artifact_file.is_file():
        raise ValueError(f"Skaffold build output must be an existing .json file: {artifact_file}")
    try:
        content = json.loads(artifact_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read Skaffold build output at {artifact_file}: {error}") from error

    if not isinstance(content, dict):
        raise ValueError("Skaffold build output must be a JSON object")
    builds = content.get("builds")
    if not isinstance(builds, list) or not builds:
        raise ValueError("Skaffold build output must contain a non-empty 'builds' list")

    result: list[tuple[str, str]] = []
    for build in builds:
        if not isinstance(build, dict):
            raise ValueError("Every Skaffold build entry must be an object")
        name = build.get("imageName")
        tag = build.get("tag")
        if not isinstance(name, str) or not name or not isinstance(tag, str) or not tag:
            raise ValueError("Every Skaffold build entry must include imageName and tag")
        if not IMAGE_TAG_PATTERN.fullmatch(tag):
            raise ValueError(f"Image tag contains unsupported characters: {tag}")
        result.append((image_id(name), tag))

    if len({name for name, _tag in result}) != len(result):
        raise ValueError("Skaffold image names must map to unique SBOM filenames")
    return sorted(result)


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def get_trivy_version(trivy: str) -> str:
    result = subprocess.run(
        [trivy, "--version"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    output = result.stdout + result.stderr
    version = re.search(r"^Version:\s*(\S+)", output, re.MULTILINE)
    if not version:
        raise ValueError("Could not determine Trivy version from its --version output")
    return version.group(1)


def remove_stale_reports(output_dir: Path, expected_names: set[str]) -> None:
    for generated_file in output_dir.iterdir():
        if (
            generated_file.is_file()
            and not generated_file.is_symlink()
            and generated_file.suffix in {".json", ".html"}
            and generated_file.name not in expected_names
            and (generated_file.name.endswith(".cdx.json") or generated_file.suffix == ".html")
        ):
            generated_file.unlink()


def generate_reports(
    builds: list[tuple[str, str]],
    trivy: str,
    sunshine: Path,
    output_dir: Path,
    sunshine_revision: str,
) -> None:
    if sunshine.name != "sunshine.py" or not sunshine.is_file():
        raise ValueError(f"CycloneDX Sunshine CLI was not found: {sunshine}")
    output_dir.mkdir(parents=True, exist_ok=True)

    trivy_version = get_trivy_version(trivy)
    tool_versions = {
        "trivy": trivy_version,
        "cyclonedxSunshineRevision": sunshine_revision,
    }
    expected_names: set[str] = {"index.md", "tool-versions.json"}
    index_rows: list[str] = []
    for image_name, image_tag in builds:
        sbom_path = output_dir / f"{image_name}.cdx.json"
        html_path = output_dir / f"{image_name}.html"
        expected_names.update({sbom_path.name, html_path.name})
        index_rows.append(
            f"| `{image_tag}` | [CycloneDX JSON]({sbom_path.name}) | [HTML report]({html_path.name}) |"
        )

        print(f"Generating CycloneDX SBOM for {image_name} ({image_tag})")
        run([
            trivy,
            "image",
            "--scanners",
            "license",
            "--format",
            "cyclonedx",
            "--output",
            str(sbom_path),
            image_tag,
        ])

        try:
            sbom: Any = json.loads(sbom_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"Trivy did not produce valid JSON for {image_name}: {error}") from error
        if not isinstance(sbom, dict) or sbom.get("bomFormat") != "CycloneDX":
            raise ValueError(f"Trivy output for {image_name} is not a CycloneDX SBOM")

        print(f"Generating HTML report for {image_name}")
        run([
            sys.executable,
            str(sunshine),
            "--input",
            str(sbom_path),
            "--output",
            str(html_path),
        ])
        if not html_path.is_file() or html_path.stat().st_size == 0:
            raise ValueError(f"CycloneDX Sunshine did not create an HTML report for {image_name}")

    (output_dir / "index.md").write_text(
        "# Generated image SBOMs\n\n"
        "Each CycloneDX JSON document and HTML report describes the corresponding image tag.\n\n"
        f"Generated with Trivy `{trivy_version}` and CycloneDX Sunshine revision "
        f"`{sunshine_revision}`.\n\n"
        "| Image | SBOM | Visual report |\n"
        "| --- | --- | --- |\n"
        + "\n".join(index_rows)
        + "\n",
        encoding="utf-8",
    )
    (output_dir / "tool-versions.json").write_text(
        json.dumps(tool_versions, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    remove_stale_reports(output_dir, expected_names)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate SBOM JSON and HTML for Skaffold-built images.")
    parser.add_argument("--artifacts", type=Path, required=True, help="Skaffold build output JSON file")
    parser.add_argument("--sunshine", type=Path, required=True, help="Path to CycloneDX Sunshine's sunshine.py")
    parser.add_argument(
        "--sunshine-revision",
        default=os.environ.get("SUNSHINE_REVISION", "unknown"),
        help="CycloneDX Sunshine source revision (default: SUNSHINE_REVISION or 'unknown')",
    )
    args = parser.parse_args()

    try:
        trivy = shutil.which("trivy")
        if trivy is None:
            raise ValueError("Trivy was not found on PATH")
        builds = load_builds(args.artifacts.resolve())
        generate_reports(
            builds,
            trivy,
            args.sunshine.resolve(),
            OUTPUT_DIR,
            args.sunshine_revision,
        )
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"SBOM report generation failed: {error}", file=sys.stderr)
        return 1

    print(f"Generated {len(builds)} JSON SBOMs and HTML reports in {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
