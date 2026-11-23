#!/usr/bin/env python3
"""Merge local environment templates without overwriting existing values."""

import argparse
import os
from pathlib import Path
import re
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
EXCLUDED = {".git", ".turbo", "node_modules", "dist", "build"}
ASSIGNMENT = re.compile(r"^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=(.*)$")


def assignments(text: str, path: Path) -> dict[str, str]:
    result = {}
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = ASSIGNMENT.fullmatch(line)
        if not match:
            raise ValueError(f"{path}:{line_number}: unsupported environment entry")
        key, value = match.groups()
        if key in result:
            raise ValueError(f"{path}:{line_number}: duplicate variable {key}")
        result[key] = value
    return result


def templates(root: Path):
    for directory, dirs, files in os.walk(root):
        dirs[:] = [name for name in dirs if name not in EXCLUDED and not name.startswith(".")]
        if ".env.example" in files:
            yield Path(directory) / ".env.example"


def write_file(path: Path, contents: str):
    if path.is_symlink():
        raise ValueError(f"{path}: refusing to replace a symlink")
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o600
    fd, temporary = tempfile.mkstemp(prefix=".env-", dir=path.parent)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            file.write(contents)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _merge_missing(target: Path, current: str, example: str, missing: list[str]):
    lines = [
        line
        for line in example.splitlines()
        if (match := ASSIGNMENT.fullmatch(line)) and match.group(1) in missing
    ]
    merged = (
        current
        + ("" if not current or current.endswith("\n") else "\n")
        + "\n# Added from .env.example\n"
        + "\n".join(lines)
        + "\n"
    )
    write_file(target, merged)


def _report_differences(target: Path, expected: dict[str, str], existing: dict[str, str]):
    changed = [key for key in expected.keys() & existing.keys() if expected[key] != existing[key]]
    extra = sorted(existing.keys() - expected.keys())
    if changed:
        print(f"{target} differs from template: {', '.join(sorted(changed))}")
    if extra:
        print(f"{target} has local-only variables: {', '.join(extra)}")


def _copy_template(root: Path, template: Path, reset: bool):
    target = template.with_name(".env")
    example = template.read_text(encoding="utf-8")
    expected = assignments(example, template)
    relative_target = target.relative_to(root)
    if not target.exists() or reset:
        write_file(target, example)
        print(f"{'Reset' if reset else 'Created'} {relative_target}")
        return
    if target.is_symlink():
        raise ValueError(f"{target}: refusing to read a symlink")

    current = target.read_text(encoding="utf-8")
    existing = assignments(current, target)
    missing = [key for key in expected if key not in existing]
    if missing:
        _merge_missing(target, current, example, missing)
        print(f"Added {', '.join(missing)} to {relative_target}")
    _report_differences(relative_target, expected, existing)


def copy_env(root: Path, reset: bool = False):
    for template in sorted(templates(root)):
        _copy_template(root, template, reset)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="replace local files with examples")
    parser.add_argument("--yes", action="store_true", help="confirm reset without a prompt")
    args = parser.parse_args()
    if args.reset:
        print("WARNING: resetting .env files overwrites local settings and may break existing databases.", file=sys.stderr)
        if not args.yes and (not sys.stdin.isatty() or input("Type RESET to continue: ") != "RESET"):
            parser.exit(1, "Reset cancelled.\n")
    try:
        copy_env(ROOT, args.reset)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Environment setup failed: {error}\n")


if __name__ == "__main__":
    main()
