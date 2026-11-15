# File: scripts/tests/test_python_setup.py
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "scripts/ensure-python.sh"


class PythonSetupTests(unittest.TestCase):
    def test_setup_prepares_environment_after_python_and_before_build(self):
        setup = (ROOT / "setup.sh").read_text()
        self.assertLess(setup.index('ensure_python "${TARGET_PROFILE}"'), setup.index("pnpm dev:prepare"))
        self.assertLess(setup.index("pnpm install --frozen-lockfile --ignore-scripts"), setup.index("pnpm dev:prepare"))
        self.assertLess(setup.index("pnpm dev:prepare"), setup.index("pnpm build"))

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.prefix = self.root / "brew-python"
        (self.prefix / "libexec/bin").mkdir(parents=True)
        self.profile = self.root / "profile"
        self.log = self.root / "brew.log"
        self.executable(self.bin / "brew", """#!/bin/bash
echo "$*" >> "$BREW_LOG"
case "$1" in
  list) [[ -f "$BREW_INSTALLED" ]] ;;
  install) [[ "${BREW_FAIL:-}" != 1 ]] || exit 1; touch "$BREW_INSTALLED" ;;
  --prefix) printf '%s\\n' "$BREW_PREFIX" ;;
  *) exit 1 ;;
esac
""")
        self.executable(self.prefix / "libexec/bin/python3", """#!/bin/bash
if [[ "$1" == "--version" ]]; then echo "Python 3.12.0"; fi
""")

    def executable(self, path, text):
        path.write_text(text)
        path.chmod(0o755)

    def execute(self, **extra):
        env = os.environ.copy()
        env.update({
            "PATH": f"{self.bin}:/usr/bin:/bin",
            "BREW_LOG": str(self.log),
            "BREW_PREFIX": str(self.prefix),
            "BREW_INSTALLED": str(self.root / "installed"),
            **extra,
        })
        return subprocess.run(
            ["bash", "-c", 'set -euo pipefail; source "$1"; ensure_python "$2"; python3 --version',
             "_", str(HELPER), str(self.profile)],
            env=env, text=True, capture_output=True,
        )

    def test_suitable_existing_python_does_not_install(self):
        self.executable(self.bin / "python3", '#!/bin/bash\necho "Python 3.10.0"\n')
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.log.exists())
        self.assertFalse(self.profile.exists())

    def test_missing_python_installs_and_updates_profile_once(self):
        self.executable(self.bin / "python3", "#!/bin/bash\nexit 127\n")
        for _ in range(2):
            result = self.execute()
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("Python 3.12.0", result.stdout)
        self.assertEqual(self.log.read_text().count("install python@3.12"), 1)
        self.assertEqual(self.profile.read_text().count('export PATH="$(brew --prefix python@3.12)/libexec/bin:$PATH"'), 1)

    def test_outdated_python_uses_installed_homebrew_python(self):
        self.executable(self.bin / "python3", '#!/bin/bash\n[[ "$1" == "--version" ]] && echo "Python 3.8.0" && exit 0\nexit 1\n')
        (self.root / "installed").touch()
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("install", self.log.read_text())
        self.assertIn("Python 3.12.0", result.stdout)

    def test_install_failure_stops_setup(self):
        self.executable(self.bin / "python3", "#!/bin/bash\nexit 127\n")
        result = self.execute(BREW_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.profile.exists())

    def test_missing_installed_executable_stops_setup(self):
        self.executable(self.bin / "python3", "#!/bin/bash\nexit 127\n")
        (self.prefix / "libexec/bin/python3").unlink()
        result = self.execute()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Homebrew Python 3.12 is unavailable", result.stderr)
        self.assertFalse(self.profile.exists())


if __name__ == "__main__":
    unittest.main()
