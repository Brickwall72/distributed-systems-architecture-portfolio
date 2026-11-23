#!/usr/bin/env python3
"""Generate a source-based first-party dependency and connection reference."""

import argparse
from collections import deque
import html
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import quote

if __package__:
    from . import generate_architecture
else:
    import generate_architecture


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "docs/generated/dependencies"
SKAFFOLD_PATH = "skaffold.yaml"
ARCHITECTURE_MODEL_PATH = "docs/architecture/model.json"


def tracked_files(root):
    output = subprocess.run(
        ["git", "ls-files", "-z"], cwd=root, check=True, stdout=subprocess.PIPE,
    ).stdout
    return [name.decode("utf-8") for name in output.split(b"\0") if name]


def source(path, line=1):
    return {"path": path, "line": line}


def workspace_inventory(root, files):
    inventory = {}
    for filename in files:
        if not filename.endswith("/package.json") or not filename.startswith(
                ("packages/", "services/", "ui-shells/")):
            continue
        manifest = json.loads((root / filename).read_text())
        name = manifest["name"]
        if name in inventory:
            raise ValueError(f"Duplicate workspace name: {name}")
        inventory[name] = {
            "id": f"workspace:{name}", "name": name,
            "kind": "contract" if filename.startswith("packages/contracts/") else "workspace",
            "path": filename.removesuffix("/package.json"), "source": source(filename),
            "manifest": manifest,
        }
    return inventory


def _validate_analysis_sections(analysis):
    for key in ("calls", "gaps"):
        if not isinstance(analysis.get(key), list):
            raise ValueError(f"Boundary analysis is missing {key}.")
    federation = analysis.get("federation")
    if not isinstance(federation, dict) or any(
            not isinstance(federation.get(key), list) for key in ("uses", "exposes")):
        raise ValueError("Boundary analysis is missing federation evidence.")
    return federation


def _validate_calls(calls, workspaces):
    identifiers = set()
    for call in calls:
        if call.get("component") not in workspaces:
            raise ValueError(f"Call belongs to an unknown workspace: {call.get('component')}")
        if not isinstance(call.get("id"), str) or call["id"] in identifiers:
            raise ValueError("Boundary calls must have unique identifiers.")
        identifiers.add(call["id"])
        if call.get("status") not in ("verified", "unresolved"):
            raise ValueError("Boundary calls must identify their verification status.")
        if call.get("role", "boundary") not in ("boundary", "wrapper"):
            raise ValueError("Boundary calls must distinguish boundaries from local wrappers.")


def _validate_evidence(record, root):
    evidence = record.get("source", {})
    path = evidence.get("path")
    if (not isinstance(path, str) or Path(path).is_absolute() or ".." in Path(path).parts
            or not isinstance(evidence.get("line"), int) or evidence["line"] < 1):
        raise ValueError("Boundary evidence must have a relative source path and positive line.")
    if not (root / path).is_file() or not (root / path).resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Boundary evidence does not identify a repository source file: {path}")


def _validate_exposures(exposes, root):
    for expose in exposes:
        implementation = expose.get("implementation")
        if (not isinstance(implementation, str) or Path(implementation).is_absolute()
                or ".." in Path(implementation).parts or not (root / implementation).is_file()
                or not (root / implementation).resolve().is_relative_to(root.resolve())):
            raise ValueError("Federation exposure must resolve to a repository implementation file.")


def validate_analysis(analysis, workspaces, root):
    if not isinstance(analysis, dict) or analysis.get("version") != 1:
        raise ValueError("Unsupported boundary-analysis format.")
    federation = _validate_analysis_sections(analysis)
    _validate_calls(analysis["calls"], workspaces)
    callers = [caller for call in analysis["calls"] for caller in call.get("callers", [])]
    records = analysis["calls"] + callers + federation["exposes"] + federation["uses"]
    for record in records:
        _validate_evidence(record, root)
    _validate_exposures(federation["exposes"], root)


def downstream(component, edges):
    reverse = {}
    for edge in edges:
        reverse.setdefault(edge["to"], []).append(edge)
    paths = {}
    relationships = {}
    queue = deque([(component, [component], [])])
    while queue:
        current, path, kinds = queue.popleft()
        for edge in sorted(reverse.get(current, []), key=lambda edge: (
                edge["from"], edge["type"], edge["label"])):
            dependent = edge["from"]
            if dependent == component or dependent in paths:
                continue
            paths[dependent] = path + [dependent]
            relationships[dependent] = kinds + [{"type": edge["type"], "status": edge["status"]}]
            queue.append((dependent, paths[dependent], relationships[dependent]))
    return [{"component": name, "path": paths[name], "relationships": relationships[name]}
            for name in sorted(paths)]


def add_dependency(edges, components, consumer, provider, kind, evidence, label="", status="verified"):
    if consumer not in components or provider not in components:
        raise ValueError(f"Dependency references unknown components: {consumer} -> {provider}")
    if consumer == provider:
        return
    key = (consumer, provider, kind, label)
    edge = edges.setdefault(key, {
        "from": consumer, "to": provider, "type": kind, "label": label,
        "status": status, "evidence": [],
    })
    if evidence not in edge["evidence"]:
        edge["evidence"].append(evidence)


def collect_components(model, inventory, images):
    components = {}
    aliases = {}
    for name, item in inventory.items():
        components[item["id"]] = {key: value for key, value in item.items() if key != "manifest"}
        aliases[name] = item["id"]
    for image in images:
        if image not in aliases:
            identifier = f"image:{image}"
            components[identifier] = {
                "id": identifier, "name": image, "kind": "deployment",
                "source": source(SKAFFOLD_PATH),
            }
            aliases[image] = identifier
    for node in model.get("externalNodes", []):
        identifier = f"infrastructure:{node['id']}"
        components[identifier] = {
            "id": identifier, "name": node["label"], "kind": node.get("kind", "broker"),
            "source": source(ARCHITECTURE_MODEL_PATH),
        }
        aliases[node["id"]] = identifier
    return components, aliases


def add_workspace_dependency(edges, components, item, dependency, version, field, inventory, aliases):
    if dependency in inventory:
        kind = "build-dependency" if field == "devDependencies" else "workspace-dependency"
        if inventory[dependency]["kind"] == "contract":
            kind = "contract-dependency"
        add_dependency(edges, components, item["id"], aliases[dependency], kind,
                       item["source"], field)
    elif isinstance(version, str) and version.startswith("workspace:"):
        raise ValueError(f"Unresolved internal workspace: {item['name']} -> {dependency}")


def add_workspace_dependencies(edges, components, inventory, aliases):
    fields = ("dependencies", "peerDependencies", "optionalDependencies", "devDependencies")
    for item in inventory.values():
        for field in fields:
            for dependency, version in item["manifest"].get(field, {}).items():
                add_workspace_dependency(edges, components, item, dependency, version,
                                         field, inventory, aliases)


def add_architecture_dependencies(edges, components, aliases, model):
    for interaction in model["interactions"]:
        consumer, provider = interaction["from"], interaction["to"]
        kind = interaction["type"]
        if kind == "nats-pub-sub":
            consumer = provider if consumer == "nats" else consumer
            provider = "nats"
            kind = "transport-dependency"
        add_dependency(edges, components, aliases[consumer], aliases[provider], kind,
                       source(ARCHITECTURE_MODEL_PATH), interaction["label"], "declared")


def add_federation_exposures(edges, components, aliases, analysis):
    exposures = {}
    for expose in analysis["federation"]["exposes"]:
        key = (expose["remote"], expose["module"])
        if expose["component"] not in aliases:
            raise ValueError(f"Exposure belongs to unknown workspace: {expose['component']}")
        if key in exposures and exposures[key] != expose:
            raise ValueError(f"Contradictory federation exposure: {key}")
        exposures[key] = expose
        identifier = f"widget:{expose['component']}:{expose['module']}"
        components[identifier] = {
            "id": identifier, "name": expose["module"], "kind": "widget",
            "path": expose["implementation"], "source": expose["source"],
        }
        add_dependency(edges, components, identifier, aliases[expose["component"]],
                       "implemented-by", expose["source"])
    return exposures


def add_federation_uses(edges, components, aliases, analysis, exposures, gaps):
    compositions = {}
    for use in analysis["federation"]["uses"]:
        key = (use["remote"], use["module"])
        expose = exposures.get(key)
        if expose is None:
            gaps.append({"source": use["source"],
                         "reason": f"Federation implementation not resolved: {'/'.join(key)}"})
            continue
        if use["component"] not in aliases:
            raise ValueError(f"Federation use belongs to unknown workspace: {use['component']}")
        page = f"page:{use['component']}:{use['source']['path']}"
        components[page] = {
            "id": page, "name": Path(use["source"]["path"]).stem, "kind": "shell-page",
            "path": use["source"]["path"], "source": use["source"],
        }
        widget = f"widget:{expose['component']}:{expose['module']}"
        add_dependency(edges, components, page, widget, "embeds", use["source"])
        add_dependency(edges, components, aliases[use["component"]], page,
                       "implements-page", use["source"])
        compositions.setdefault((use["component"], page), set()).add(
            (expose["component"], expose["module"]))
    return compositions


def add_call_dependencies(edges, components, aliases, analysis, gaps):
    for call in analysis["calls"]:
        consumer = aliases[call["component"]]
        if call.get("target") in aliases:
            add_dependency(edges, components, consumer, aliases[call["target"]], call["kind"],
                           call["source"], call["callee"], call["status"])
        elif call.get("target"):
            gaps.append({"source": call["source"],
                         "reason": f"Connection target not in component inventory: {call['target']}"})
        for contract in call.get("contracts", []):
            if contract in aliases:
                add_dependency(edges, components, consumer, aliases[contract], "contract-dependency",
                               call["source"], call["callee"])
            else:
                gaps.append({"source": call["source"],
                             "reason": f"Contract workspace not resolved: {contract}"})


def add_channel_dependency(edges, components, aliases, producer, consumer, channel):
    if producer["kind"] == "nats-publish" and consumer["kind"] == "nats-subscribe":
        add_dependency(edges, components, aliases[consumer["component"]],
                       aliases[producer["component"]], "event-payload",
                       producer["source"], channel)
        add_dependency(edges, components, aliases[consumer["component"]],
                       aliases[producer["component"]], "event-payload",
                       consumer["source"], channel)
    elif producer["kind"] == "nats-request" and consumer["kind"] == "nats-responder":
        add_dependency(edges, components, aliases[producer["component"]],
                       aliases[consumer["component"]], "request-contract",
                       producer["source"], channel)
        add_dependency(edges, components, aliases[producer["component"]],
                       aliases[consumer["component"]], "request-contract",
                       consumer["source"], channel)


def subject_matches(pattern, subject):
    if "*" in subject or ">" in subject:
        return False
    expected, actual = pattern.split("."), subject.split(".")
    for index, token in enumerate(expected):
        if token == ">":
            return index == len(expected) - 1 and index < len(actual)
        if index >= len(actual) or (token != "*" and token != actual[index]):
            return False
    return len(expected) == len(actual)


def add_channel_dependencies(edges, components, aliases, analysis):
    calls = [call for call in analysis["calls"] if call["status"] == "verified"
             and (call.get("channel") or {}).get("value")]
    for producer in calls:
        if producer["kind"] not in ("nats-publish", "nats-request"):
            continue
        channel = producer["channel"]["value"]
        for consumer in calls:
            if subject_matches(consumer["channel"]["value"], channel):
                add_channel_dependency(edges, components, aliases, producer, consumer, channel)


def build_report(root, model, analysis):
    files = tracked_files(root)
    inventory = workspace_inventory(root, files)
    images = generate_architecture.load_images(root / SKAFFOLD_PATH)
    generate_architecture.validate_model(images, model)
    validate_analysis(analysis, inventory, root)

    components, aliases = collect_components(model, inventory, images)
    edges = {}
    gaps = list(analysis["gaps"])

    add_workspace_dependencies(edges, components, inventory, aliases)
    add_architecture_dependencies(edges, components, aliases, model)
    exposures = add_federation_exposures(edges, components, aliases, analysis)
    compositions = add_federation_uses(edges, components, aliases, analysis, exposures, gaps)
    add_call_dependencies(edges, components, aliases, analysis, gaps)
    add_channel_dependencies(edges, components, aliases, analysis)

    if any(interaction["type"] == "nats-pub-sub" for interaction in model["interactions"]):
        gaps.append({
            "source": source(ARCHITECTURE_MODEL_PATH),
            "reason": "Model broker arrows describe transport, not payload impact. Only resolved "
                      "matching subjects establish automatic cross-service event dependencies.",
        })

    edge_list = sorted(edges.values(), key=lambda edge: (
        edge["from"], edge["to"], edge["type"], edge["label"]))
    for edge in edge_list:
        edge["evidence"].sort(key=lambda evidence: (evidence["path"], evidence["line"]))
    slices = [
        {"root": identifier, "dependents": downstream(identifier, edge_list)}
        for identifier, component in sorted(components.items())
        if component["kind"] in ("storage", "contract", "workspace", "widget")
    ]
    return {
        "schemaVersion": 1, "dependencyDirection": "consumer -> provider",
        "scope": "First-party components and managed infrastructure; potential static impact, "
                 "not a third-party SBOM or proof of a breaking change.",
        "components": [components[key] for key in sorted(components)],
        "dependencies": edge_list,
        "boundaryCalls": sorted(analysis["calls"], key=lambda call: (
            call["component"], call["source"]["path"], call["source"]["line"], call["id"])),
        "compositions": [
            {"shell": shell, "page": components[page]["name"],
             "widgets": [{"image": image, "module": module} for image, module in sorted(widgets)]}
            for (shell, page), widgets in sorted(compositions.items())
        ],
        "slices": slices,
        "gaps": sorted(gaps, key=lambda gap: (
            gap["source"]["path"], gap["source"]["line"], gap["reason"])),
    }


def source_link(evidence, html_output=False):
    path = evidence["path"]
    label = f"{path}:{evidence['line']}"
    if html_output:
        target = (
            "https://github.com/Brickwall72/distributed-systems-architecture-portfolio"
            f"/blob/master/{quote(path, safe='/')}#L{evidence['line']}"
        )
        return f'<a href="{html.escape(target, quote=True)}">{html.escape(label)}</a>'
    target = "../../../" + path + f"#L{evidence['line']}"
    return f"[{label}]({target})"


def _markdown_component_rows(components):
    return [f"| `{component['name']}` | {component['kind']} | "
            f"{source_link(component['source'])} |" for component in components]


def _markdown_dependency_rows(dependencies, names):
    return [f"| `{names[edge['from']]}` | `{names[edge['to']]}` | "
            f"{edge['type']} | {edge['status']} |" for edge in dependencies]


def _markdown_slice_rows(slices, names):
    lines = []
    for item in slices:
        lines += [f"### {names[item['root']]}", ""]
        for dependent in item["dependents"]:
            path = f"`{names[dependent['path'][0]]}`"
            for relationship, node in zip(dependent["relationships"], dependent["path"][1:]):
                path += f" -[{relationship['type']}, {relationship['status']}]-> `{names[node]}`"
            lines.append("- " + path)
        if not item["dependents"]:
            lines.append("No downstream relationship resolved.")
        lines.append("")
    return lines


def _markdown_boundary_rows(boundary_calls):
    lines = []
    grouped = {}
    for call in boundary_calls:
        grouped.setdefault(call["component"], []).append(call)
    for segment, calls in sorted(grouped.items()):
        lines += [f"### {segment}", "",
                  "| Function | Call | Role | Connection / target | Immediate callers | Source |",
                  "| --- | --- | --- | --- | --- | --- |"]
        for call in calls:
            callers = ", ".join(
                f"`{caller['function']}` {source_link(caller['source'])}"
                for caller in call["callers"]) or "-"
            target = call.get("target") or "unresolved"
            channel = call.get("channel") or {}
            label = channel.get("value") or channel.get("expression") or ""
            role = "local wrapper" if call.get("role") == "wrapper" else "boundary"
            lines.append(f"| `{call['function']}` | `{call['callee']}` | {role} | "
                         f"{call['kind']}: {target} {label} ({call['status']}) | "
                         f"{callers} | {source_link(call['source'])} |")
        lines.append("")
    return lines


def _markdown_gap_rows(gaps):
    lines = [f"- {gap['reason']} - {source_link(gap['source'])}" for gap in gaps]
    if not gaps:
        lines.append("No unresolved relationships were reported by the supported recognizers. "
                     "This does not prove complete runtime coverage.")
    return lines


def render_markdown(report):
    names = {item["id"]: item["name"] for item in report["components"]}
    lines = [
        "# Internal dependency and boundary-call reference", "", report["scope"], "",
        "Dependencies point from consumer to provider. Change impact follows the reverse "
        "direction. Paths are possibilities, not a claim that implementation changes break "
        "every downstream contract.", "",
        "[Architecture overview](../architecture/architecture.md) | "
        "[HTML reference](dependencies.html) | [Machine-readable graph](dependencies.json)", "",
        "## Components", "", "| Component | Kind | Source |", "| --- | --- | --- |",
    ]
    lines.extend(_markdown_component_rows(report["components"]))
    lines += ["", "## Dependency connections", "",
              "| Consumer | Provider | Relationship | Evidence status |",
              "| --- | --- | --- | --- |"]
    lines.extend(_markdown_dependency_rows(report["dependencies"], names))
    lines += ["", "## Potential downstream slices", ""]
    lines.extend(_markdown_slice_rows(report["slices"], names))
    lines += ["## Boundary functions by segment", ""]
    lines.extend(_markdown_boundary_rows(report["boundaryCalls"]))
    lines += ["## Coverage gaps and assumptions", ""]
    lines.extend(_markdown_gap_rows(report["gaps"]))
    return "\n".join(lines) + "\n"


def _html_slice_rows(slices, names):
    rows = []
    for item in slices:
        paths = []
        for dependent in item["dependents"]:
            path = names[dependent["path"][0]]
            for relationship, node in zip(dependent["relationships"], dependent["path"][1:]):
                path += f" -[{relationship['type']}, {relationship['status']}]-> {names[node]}"
            paths.append("<li>" + html.escape(path) + "</li>")
        rows.append(f"<details><summary>{html.escape(names[item['root']])}</summary>"
                    f"<ul>{''.join(paths)}</ul></details>")
    return rows


def _html_boundary_sections(boundary_calls):
    grouped = {}
    for call in boundary_calls:
        grouped.setdefault(call["component"], []).append(call)

    sections = []
    for segment, calls in sorted(grouped.items()):
        rows = []
        for call in calls:
            target = call.get("target") or "unresolved"
            channel = call.get("channel") or {}
            target += " " + (channel.get("value") or channel.get("expression") or "")
            callers = ", ".join(
                f"{html.escape(caller['function'])} {source_link(caller['source'], True)}"
                for caller in call["callers"]) or "-"
            role = "local wrapper" if call.get("role") == "wrapper" else "boundary"
            cells = [call["function"], call["callee"], role, call["kind"], target, call["status"]]
            rows.append("<tr>" + "".join(f"<td>{html.escape(value)}</td>" for value in cells)
                        + f"<td>{callers}</td><td>{source_link(call['source'], True)}</td></tr>")
        sections.append(f"<h2>{html.escape(segment)}</h2><div class=\"table\"><table>"
                        "<thead><tr><th>Function</th><th>Call</th><th>Role</th><th>Connection</th><th>Target</th>"
                        "<th>Status</th><th>Immediate callers</th><th>Source</th></tr></thead>"
                        f"<tbody>{''.join(rows)}</tbody></table></div>")
    return sections


def render_html(report):
    names = {item["id"]: item["name"] for item in report["components"]}
    component_rows = "".join(
        f"<tr><td>{html.escape(item['name'])}</td><td>{html.escape(item['kind'])}</td>"
        f"<td>{source_link(item['source'], True)}</td></tr>" for item in report["components"])
    dependency_rows = "".join(
        "<tr>" + "".join(f"<td>{html.escape(value)}</td>" for value in (
            names[edge["from"]], names[edge["to"]], edge["type"], edge["status"]))
        + "<td>" + ", ".join(source_link(evidence, True) for evidence in edge["evidence"])
        + "</td></tr>" for edge in report["dependencies"])
    slices = _html_slice_rows(report["slices"], names)
    sections = _html_boundary_sections(report["boundaryCalls"])
    gaps = "".join(f"<li>{html.escape(gap['reason'])} {source_link(gap['source'], True)}</li>"
                   for gap in report["gaps"])
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Internal dependency reference</title>
<style>body{{font-family:system-ui;margin:2rem;background:#0f172a;color:#e2e8f0}}
a{{color:#93c5fd}}table{{border-collapse:collapse;width:100%}}td,th{{padding:.6rem;border:1px solid #475569;text-align:left}}
.table{{overflow:auto}}details{{margin:1rem 0}}h2{{margin-top:2rem}}</style></head>
<body><h1>Internal dependency and boundary-call reference</h1><p>{html.escape(report['scope'])}</p>
<p>Dependency direction: consumer &rarr; provider. Potential impact follows the reverse direction;
an implementation change does not necessarily break its public contract.</p>
<p><a href="../architecture/architecture.html">Overview graphic</a> &middot;
<a href="index.md">Markdown reference</a> &middot; <a href="dependencies.json">JSON graph</a></p>
<h2>Components</h2><div class="table"><table><thead><tr><th>Component</th><th>Kind</th>
<th>Source</th></tr></thead><tbody>{component_rows}</tbody></table></div>
<h2>Dependency connections</h2><div class="table"><table><thead><tr><th>Consumer</th>
<th>Provider</th><th>Relationship</th><th>Status</th><th>Source</th></tr></thead>
<tbody>{dependency_rows}</tbody></table></div>
<h2>Potential downstream slices</h2>{''.join(slices)}
<h2>Boundary functions by segment</h2>{''.join(sections)}
<h2>Coverage gaps and assumptions</h2><ul>{gaps}</ul>
<p>Static analysis is limited to supported connection helpers and immediate local callers.
It is not a complete runtime call graph or a compatibility verdict.</p></body></html>
"""


def write_reports(report, output):
    contents = {
        "dependencies.json": json.dumps(report, indent=2, sort_keys=True) + "\n",
        "index.md": render_markdown(report),
        "dependencies.html": render_html(report),
    }
    output.mkdir(parents=True, exist_ok=True)
    for name, content in contents.items():
        (output / name).write_text(content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--model", type=Path, default=generate_architecture.MODEL_PATH)
    parser.add_argument("--analysis", type=Path, help="existing static-analyzer JSON")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--architecture-output", type=Path, default=generate_architecture.OUTPUT_DIR)
    args = parser.parse_args()
    try:
        with tempfile.TemporaryDirectory(prefix="dsap-dependencies-") as temporary:
            analysis_path = args.analysis or Path(temporary) / "boundaries.json"
            if args.analysis is None:
                subprocess.run([
                    "node", str(ROOT / "scripts/docs/extract_boundary_calls.mjs"),
                    "--root", str(args.root), "--output", str(analysis_path),
                ], check=True)
            model = json.loads(args.model.read_text())
            report = build_report(args.root, model, json.loads(analysis_path.read_text()))
            model = {**model, "compositions": report["compositions"]}
            diagram = generate_architecture.render_mermaid(
                generate_architecture.load_images(args.root / SKAFFOLD_PATH), model)
            write_reports(report, args.output_dir)
            args.architecture_output.mkdir(parents=True, exist_ok=True)
            (args.architecture_output / "architecture.md").write_text(
                generate_architecture.render_markdown(diagram))
            (args.architecture_output / "architecture.html").write_text(
                generate_architecture.render_html(diagram))
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Internal dependency generation failed: {error}", file=sys.stderr)
        return 1
    print(f"Generated internal dependency reference in {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
