#!/usr/bin/env python3
"""Synchronize the validated source-based report bundle without content churn."""

import argparse
import json
from pathlib import Path
import shutil
import sys


REPORT_FILES = (
    "dependencies/dependencies.json", "dependencies/index.md",
    "dependencies/dependencies.html",
    "architecture/architecture.md", "architecture/architecture.html",
)


def copy_if_changed(source, destination):
    if not destination.is_file() or source.read_bytes() != destination.read_bytes():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)


def validate_report_paths(source_root, destination_root):
    for name in REPORT_FILES:
        path = source_root / name
        if path.is_symlink() or not path.is_file() or not path.stat().st_size:
            raise ValueError(f"Generated report is missing, empty, or a symlink: {name}")
        if not path.resolve().is_relative_to(source_root.resolve()):
            raise ValueError(f"Generated report escapes the source directory: {name}")
        destination = destination_root / name
        if destination.is_symlink() or not destination.resolve().is_relative_to(destination_root.resolve()):
            raise ValueError(f"Generated report destination is a symlink: {name}")


def _validate_graph_schema(graph):
    graph_lists = ("components", "dependencies", "boundaryCalls", "compositions", "slices", "gaps")
    if not isinstance(graph, dict) or graph.get("schemaVersion") != 1 or any(
            not isinstance(graph.get(name), list) for name in graph_lists):
        raise ValueError("Generated internal dependency graph has an invalid schema.")


def _validate_graph_elements(graph):
    malformed_component = any(
        not isinstance(component, dict) or not isinstance(component.get("id"), str)
        for component in graph["components"]
    )
    malformed_connection = any(
        not isinstance(edge, dict) or not isinstance(edge.get("from"), str)
        or not isinstance(edge.get("to"), str)
        for edge in graph["dependencies"]
    )
    if malformed_component or malformed_connection:
        raise ValueError("Generated internal dependency graph has malformed components or connections.")


def _validate_graph_references(graph):
    identifiers = [component["id"] for component in graph["components"]]
    dangling_connection = any(
        edge["from"] not in identifiers or edge["to"] not in identifiers
        for edge in graph["dependencies"]
    )
    if len(identifiers) != len(set(identifiers)) or dangling_connection:
        raise ValueError("Generated internal dependency graph has duplicate or dangling references.")
    for composition in graph["compositions"]:
        if (not isinstance(composition, dict)
                or f"workspace:{composition.get('shell')}" not in identifiers
                or not isinstance(composition.get("widgets"), list)):
            raise ValueError("Generated composition has a dangling shell or malformed widgets.")
        for widget in composition["widgets"]:
            if (not isinstance(widget, dict)
                    or f"widget:{widget.get('image')}:{widget.get('module')}" not in identifiers):
                raise ValueError("Generated composition has a dangling widget reference.")
    return identifiers


def _validate_boundary_calls(graph, identifiers):
    call_ids = set()
    for call in graph["boundaryCalls"]:
        if (not isinstance(call, dict) or not isinstance(call.get("id"), str)
                or call["id"] in call_ids
                or f"workspace:{call.get('component')}" not in identifiers):
            raise ValueError("Generated boundary calls have duplicate or dangling references.")
        call_ids.add(call["id"])


def _valid_dependent_path(dependent, root, identifiers):
    if not isinstance(dependent, dict) or dependent.get("component") not in identifiers:
        return False
    path = dependent.get("path")
    return (isinstance(path, list) and bool(path)
            and path[0] == root
            and path[-1] == dependent["component"]
            and all(node in identifiers for node in path))


def _validate_impact_slices(graph, identifiers):
    for item in graph["slices"]:
        if (not isinstance(item, dict) or item.get("root") not in identifiers
                or not isinstance(item.get("dependents"), list)):
            raise ValueError("Generated impact slice has a dangling root or malformed dependents.")
        if any(not _valid_dependent_path(dependent, item["root"], identifiers)
               for dependent in item["dependents"]):
            raise ValueError("Generated impact slice has dangling or contradictory paths.")


def validate_dependency_graph(graph):
    _validate_graph_schema(graph)
    _validate_graph_elements(graph)
    identifiers = _validate_graph_references(graph)
    _validate_boundary_calls(graph, identifiers)
    _validate_impact_slices(graph, identifiers)


def sync_reports(source_root, destination_root):
    validate_report_paths(source_root, destination_root)
    graph = json.loads((source_root / REPORT_FILES[0]).read_text())
    validate_dependency_graph(graph)
    for name in REPORT_FILES:
        copy_if_changed(source_root / name, destination_root / name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    try:
        sync_reports(args.source.resolve(), args.destination.resolve())
    except (OSError, ValueError) as error:
        print(f"Generated report synchronization failed: {error}", file=sys.stderr)
        return 1
    print(f"Synchronized source-based reports to {args.destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
