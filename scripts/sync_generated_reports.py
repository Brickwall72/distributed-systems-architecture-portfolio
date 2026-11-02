#!/usr/bin/env python3

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any


TOOL_VERSIONS_FILENAME = "tool-versions.json"
HTML_EXTENSION = ".html"


def read_json(path: Path) -> dict[str, Any]:
    try:
        content = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read generated report metadata at {path}: {error}") from error
    if not isinstance(content, dict):
        raise ValueError(f"Generated report metadata must be a JSON object: {path}")
    return content


def image_identity(sbom_path: Path) -> str:
    sbom = read_json(sbom_path)
    metadata = sbom.get("metadata")
    component = metadata.get("component") if isinstance(metadata, dict) else None
    properties = component.get("properties") if isinstance(component, dict) else None
    if isinstance(properties, list):
        for prop in properties:
            if (
                isinstance(prop, dict)
                and prop.get("name") == "aquasecurity:trivy:ImageID"
                and isinstance(prop.get("value"), str)
                and prop["value"]
            ):
                return prop["value"]
    raise ValueError(f"Trivy SBOM is missing the image identity property: {sbom_path}")


def copy_if_changed(source: Path, destination: Path) -> None:
    if not destination.is_file() or source.read_bytes() != destination.read_bytes():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)


def _tooling_changed(source_sboms: Path, destination_sboms: Path) -> bool:
    source = source_sboms / TOOL_VERSIONS_FILENAME
    destination = destination_sboms / TOOL_VERSIONS_FILENAME
    return not destination.is_file() or read_json(source) != read_json(destination)


def _sync_sbom_image(
    source_sbom: Path, destination_sboms: Path, tooling_changed: bool
) -> set[str]:
    image_name = source_sbom.name.removesuffix(".cdx.json")
    source_html = source_sbom.parent / f"{image_name}{HTML_EXTENSION}"
    destination_sbom = destination_sboms / source_sbom.name
    destination_html = destination_sboms / source_html.name
    if not source_html.is_file():
        raise ValueError(f"Generated HTML report is missing for image {image_name}")

    unchanged_image = (
        destination_sbom.is_file()
        and destination_html.is_file()
        and not tooling_changed
        and image_identity(source_sbom) == image_identity(destination_sbom)
    )
    if not unchanged_image:
        copy_if_changed(source_sbom, destination_sbom)
        copy_if_changed(source_html, destination_html)
    return {source_sbom.name, source_html.name}


def _remove_unexpected_sbom_reports(destination_sboms: Path, expected_names: set[str]) -> None:
    for old_report in destination_sboms.iterdir():
        is_report = old_report.name.endswith(".cdx.json") or old_report.suffix == HTML_EXTENSION
        if (
            old_report.is_file()
            and not old_report.is_symlink()
            and is_report
            and old_report.name not in expected_names
        ):
            old_report.unlink()


def _sync_sbom_reports(source_sboms: Path, destination_sboms: Path) -> None:
    tooling_changed = _tooling_changed(source_sboms, destination_sboms)
    expected_names = {"index.md", TOOL_VERSIONS_FILENAME}
    for source_sbom in sorted(source_sboms.glob("*.cdx.json")):
        expected_names.update(_sync_sbom_image(source_sbom, destination_sboms, tooling_changed))

    for name in ("index.md", TOOL_VERSIONS_FILENAME):
        source = source_sboms / name
        if not source.is_file():
            raise ValueError(f"Generated SBOM inventory file is missing: {source}")
        copy_if_changed(source, destination_sboms / name)

    _remove_unexpected_sbom_reports(destination_sboms, expected_names)


def _sync_architecture_reports(source: Path, destination: Path) -> None:
    if not source.is_dir():
        raise ValueError(f"Generated architecture reports are missing: {source}")
    destination.mkdir(parents=True, exist_ok=True)
    expected_names = set()
    for report in source.iterdir():
        if report.is_file() and report.suffix in {".md", HTML_EXTENSION}:
            expected_names.add(report.name)
            copy_if_changed(report, destination / report.name)
    if not expected_names:
        raise ValueError("No generated architecture reports were found")

    for old_report in destination.iterdir():
        is_report = old_report.suffix in {".md", HTML_EXTENSION}
        if (
            old_report.is_file()
            and not old_report.is_symlink()
            and is_report
            and old_report.name not in expected_names
        ):
            old_report.unlink()


def sync_reports(source_root: Path, destination_root: Path) -> None:
    _sync_sbom_reports(source_root / "sbom", destination_root / "sbom")
    _sync_architecture_reports(
        source_root / "architecture", destination_root / "architecture"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish only changed generated documentation reports.")
    parser.add_argument("--source", type=Path, required=True, help="Downloaded CI report artifact directory")
    parser.add_argument("--destination", type=Path, required=True, help="Checked-out report directory")
    args = parser.parse_args()

    try:
        sync_reports(args.source.resolve(), args.destination.resolve())
    except (OSError, ValueError) as error:
        print(f"Generated report synchronization failed: {error}", file=sys.stderr)
        return 1

    print(f"Synchronized generated reports from {args.source} to {args.destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
