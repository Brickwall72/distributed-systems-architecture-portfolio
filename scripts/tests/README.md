# Script tests

Unit tests for the scripts in the sibling folders. They load the scripts by
file path, so they do not require workspace installation or running services.

Run everything:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/tests -v
node --test scripts/tests/boundary-calls.test.mjs
```

CI runs the Python suite in its automation job and the Node test in the
documentation verification job. Test modules are named after the script or
chart they cover (for example `test_demo_reset.py` covers
`scripts/demo-vm/k8s-demo-reset.py`; `test_topology_demo_chart.py` and
`test_network_policy_chart.py` render Helm charts).
