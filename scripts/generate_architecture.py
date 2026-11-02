#!/usr/bin/env python3

import argparse
import html
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "docs/architecture/model.json"
OUTPUT_DIR = ROOT / "docs/generated/architecture"
IMAGE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
EDGE_TYPES = {
    "http": ("-->", "HTTP / REST", "#2563eb", "solid"),
    "nats-request-reply": ("<-->", "NATS request / reply", "#c2410c", "solid"),
    "nats-pub-sub": ("-.->", "NATS pub / sub", "#0f766e", "dashed"),
}


def image_id(image_name: str) -> str:
    name = image_name.rsplit("/", 1)[-1]
    if ":" in name:
        name = name.rsplit(":", 1)[0]
    if not IMAGE_ID_PATTERN.fullmatch(name):
        raise ValueError(f"Image name cannot be used as an architecture ID: {image_name}")
    return name


def load_images(artifact_file: Path) -> list[str]:
    try:
        content = json.loads(artifact_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read Skaffold build output at {artifact_file}: {error}") from error

    if not isinstance(content, dict):
        raise ValueError("Skaffold build output must be a JSON object")
    builds = content.get("builds")
    if not isinstance(builds, list) or not builds:
        raise ValueError("Skaffold build output must contain a non-empty 'builds' list")

    images: list[str] = []
    for build in builds:
        name = build.get("imageName") if isinstance(build, dict) else None
        if not isinstance(name, str) or not name:
            raise ValueError("Every Skaffold build entry must include an imageName")
        images.append(image_id(name))

    if len(set(images)) != len(images):
        raise ValueError("Skaffold image names must map to unique architecture IDs")
    return sorted(images)


def validate_model(images: list[str], model: dict[str, Any]) -> None:
    if not isinstance(model, dict):
        raise ValueError("Architecture model must be a JSON object")
    compositions = model.get("compositions")
    interactions = model.get("interactions")
    if not isinstance(compositions, list):
        raise ValueError("'compositions' must be a list")
    if not isinstance(interactions, list):
        raise ValueError("'interactions' must be a list")

    rendered_image_ids = [mermaid_node_id(image) for image in images]
    if len(set(rendered_image_ids)) != len(rendered_image_ids):
        raise ValueError("Skaffold image names must map to unique Mermaid node IDs")

    external_ids = _validate_external_nodes(model, rendered_image_ids)
    _validate_compositions(images, compositions)
    _validate_interactions(set(images) | external_ids, interactions)


def _validate_external_nodes(model: dict[str, Any], rendered_image_ids: list[str]) -> set[str]:
    external_nodes = model.get("externalNodes", [])
    if not isinstance(external_nodes, list):
        raise ValueError("'externalNodes' must be a list")

    external_ids: set[str] = set()
    rendered_node_ids = set(rendered_image_ids)
    for node in external_nodes:
        if not isinstance(node, dict):
            raise ValueError("Every external node must be an object")
        node_id = node.get("id")
        if not isinstance(node_id, str) or not IMAGE_ID_PATTERN.fullmatch(node_id):
            raise ValueError(f"Invalid external node ID: {node_id}")
        rendered_id = mermaid_node_id(node_id)
        if rendered_id in rendered_node_ids:
            raise ValueError(f"Duplicate architecture node ID: {node_id}")
        if not isinstance(node.get("label"), str) or not node["label"]:
            raise ValueError(f"External node {node_id} must have a label")
        external_ids.add(node_id)
        rendered_node_ids.add(rendered_id)
    return external_ids


def _validate_compositions(images: list[str], compositions: list[Any]) -> None:
    for composition in compositions:
        if not isinstance(composition, dict):
            raise ValueError("Every composition must be an object")
        _validate_composition(images, composition)


def _validate_composition(images: list[str], composition: dict[str, Any]) -> None:
    shell = composition.get("shell")
    if shell not in images:
        raise ValueError(f"Composition references unknown shell image: {shell}")
    if not isinstance(composition.get("page"), str) or not composition["page"]:
        raise ValueError("Every composition must have a page label")
    widgets = composition.get("widgets")
    if not isinstance(widgets, list) or not widgets:
        raise ValueError(f"Composition for {shell} must have at least one widget")
    for widget in widgets:
        _validate_widget(images, shell, widget)


def _validate_widget(images: list[str], shell: str, widget: Any) -> None:
    if not isinstance(widget, dict) or widget.get("image") not in images:
        raise ValueError(f"Composition for {shell} references an unknown widget image")
    if not isinstance(widget.get("module"), str) or not widget["module"]:
        raise ValueError(f"Composition for {shell} has a widget without a module label")


def _validate_interactions(known_ids: set[str], interactions: list[Any]) -> None:
    for interaction in interactions:
        if not isinstance(interaction, dict):
            raise ValueError("Every interaction must be an object")
        _validate_interaction(known_ids, interaction)


def _validate_interaction(known_ids: set[str], interaction: dict[str, Any]) -> None:
    source = interaction.get("from")
    target = interaction.get("to")
    if not isinstance(source, str) or not isinstance(target, str):
        raise ValueError("Every interaction must identify source and target nodes")
    if source not in known_ids or target not in known_ids:
        raise ValueError(
            f"Interaction references an unknown architecture node: "
            f"{source} -> {target}"
        )
    interaction_type = interaction.get("type")
    if not isinstance(interaction_type, str) or interaction_type not in EDGE_TYPES:
        raise ValueError(f"Unsupported interaction type: {interaction_type}")
    if not isinstance(interaction.get("label"), str) or not interaction["label"]:
        raise ValueError("Every interaction must have a label")


def mermaid_node_id(node_id: str) -> str:
    return re.sub(r"\W", "_", node_id)


def mermaid_label(label: str) -> str:
    return label.replace('"', "&quot;").replace("|", "/").replace("\n", " ")


def render_mermaid(images: list[str], model: dict[str, Any]) -> str:
    validate_model(images, model)
    lines = [
        "flowchart LR",
        "  classDef application fill:#172554,stroke:#60a5fa,color:#fff",
        "  classDef shell fill:#312e81,stroke:#a78bfa,color:#fff",
        "  classDef broker fill:#78350f,stroke:#f59e0b,color:#fff",
    ]

    shell_images = {
        composition["shell"]
        for composition in model["compositions"]
    }
    lines.extend(["", "  subgraph images[Application images from Skaffold]"])
    for image in images:
        node_class = "shell" if image in shell_images or image.endswith("-shell") else "application"
        lines.append(
            f'    {mermaid_node_id(image)}["{mermaid_label(image)}"]:::{node_class}'
        )
    lines.append("  end")

    for node in model.get("externalNodes", []):
        lines.append(
            f'  {mermaid_node_id(node["id"])}["{mermaid_label(node["label"])}"]:::broker'
        )

    edge_styles: list[tuple[int, str, str]] = []
    edge_index = 0
    for composition in model["compositions"]:
        shell = mermaid_node_id(composition["shell"])
        for widget in composition["widgets"]:
            target = mermaid_node_id(widget["image"])
            label = mermaid_label(f'{composition["page"]}: {widget["module"]}')
            lines.append(f"  {shell} ==>|{label}| {target}")
            edge_styles.append((edge_index, "#a78bfa", "3px"))
            edge_index += 1

    for interaction in model["interactions"]:
        arrow, _legend, color, line_style = EDGE_TYPES[interaction["type"]]
        source = mermaid_node_id(interaction["from"])
        target = mermaid_node_id(interaction["to"])
        label = mermaid_label(interaction["label"])
        lines.append(f"  {source} {arrow}|{label}| {target}")
        edge_styles.append((edge_index, color, "2px" if line_style == "solid" else "2px,stroke-dasharray: 6 4"))
        edge_index += 1

    for index, color, width in edge_styles:
        lines.append(f"  linkStyle {index} stroke:{color},stroke-width:{width}")

    return "\n".join(lines)


def render_markdown(mermaid: str) -> str:
    legend = "\n".join(
        f"- **{legend}**"
        for _arrow, legend, _color, _style in EDGE_TYPES.values()
    )
    return (
        "# Generated service architecture\n\n"
        "This view is generated from `docs/architecture/model.json`; application image "
        "nodes are discovered from `skaffold.yaml` during CI. Update the model when "
        "page composition or service interactions change.\n\n"
        "```mermaid\n"
        f"{mermaid}\n"
        "```\n\n"
        "## Interaction legend\n\n"
        f"{legend}\n\n"
        "**UI composition** uses thick purple arrows, labeled by page and widget. "
        "NATS pub/sub is shown as separate publisher-to-broker and broker-to-subscriber "
        "edges.\n"
    )


def render_html(mermaid: str) -> str:
    escaped_diagram = html.escape(mermaid)
    legend_items = "\n".join(
        f'<li><span class="swatch" style="border-color:{color};'
        f'border-style:{"dashed" if line_style == "dashed" else "solid"}"></span>'
        f"{html.escape(label)}</li>"
        for _arrow, label, color, line_style in EDGE_TYPES.values()
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Generated service architecture</title>
  <style>
    :root {{ color-scheme: dark; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }}
    body {{ margin: 0; padding: 2rem; }}
    main {{ max-width: 1500px; margin: auto; }}
    .diagram {{ overflow: auto; padding: 1.5rem; border: 1px solid #334155; border-radius: 0.75rem; background: #111827; }}
    .mermaid {{ min-width: 950px; }}
    ul {{ display: flex; flex-wrap: wrap; gap: 1.5rem; padding: 0; list-style: none; }}
    li {{ display: flex; align-items: center; gap: 0.5rem; }}
    .swatch {{ display: inline-block; width: 1.5rem; border-top: 3px solid; }}
    a {{ color: #93c5fd; }}
  </style>
</head>
<body>
  <main>
    <h1>Generated service architecture</h1>
    <p>Generated from <code>docs/architecture/model.json</code>; application image nodes are discovered from Skaffold.</p>
    <ul>{legend_items}<li><span class="swatch" style="border-color:#a78bfa;border-width:3px"></span>UI composition</li></ul>
    <section class="diagram"><pre class="mermaid">{escaped_diagram}</pre></section>
    <p>Update the architecture model when page composition or service interactions change.</p>
  </main>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({{ startOnLoad: false, securityLevel: "strict", theme: "dark" }});
    await mermaid.run({{ querySelector: ".mermaid" }});
  </script>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a service architecture view from Skaffold images.")
    parser.add_argument("--artifacts", type=Path, required=True, help="Skaffold build output JSON file")
    parser.add_argument("--model", type=Path, default=MODEL_PATH, help="Structured architecture model JSON file")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR, help="Generated report directory")
    args = parser.parse_args()

    try:
        images = load_images(args.artifacts)
        model = json.loads(args.model.read_text(encoding="utf-8"))
        diagram = render_mermaid(images, model)
        args.output_dir.mkdir(parents=True, exist_ok=True)
        (args.output_dir / "architecture.md").write_text(render_markdown(diagram), encoding="utf-8")
        (args.output_dir / "architecture.html").write_text(render_html(diagram), encoding="utf-8")
    except (OSError, ValueError) as error:
        print(f"Architecture generation failed: {error}", file=sys.stderr)
        return 1

    print(f"Generated architecture markdown and HTML in {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
