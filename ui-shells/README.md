# UI shells

The federated frontend: a global shell that hosts profile selection and
composes domain shells, which in turn compose the services' federated widgets
through module federation.

## Composition

The [global shell](./global-shell/) fetches `/registry/apps.json` at runtime
and initializes its federation remotes from that manifest. It loads the auth
service's `ProfileSelector` into the header, then the selected domain shell's
`App`. The registry lists the domain shells (`compliance_shell`,
`topology_shell`) and the service clients (`compliance_client`,
`topology_client`, `audit_client`, `auth_client`).

The [domain shells](./domain-shells/):

- **topology-shell** composes the topology widgets: asset registration,
  organization selector, and the network canvas.
- **compliance-shell** composes the compliance document, template, and
  workflow widgets together with topology selectors and the audit transfers
  table for review pages.

Each widget is owned and documented by its service — see the service READMEs
under [services/](../services/).

## Routing

The selected page is reflected in the URL, so reloading or sharing a page link
returns to the same page. Switching domains opens that domain's default page.
Through Traefik, the global shell is served at `/`, and the domain shells and
service clients are routed under their own prefixes (for example
`/topology/client/remoteEntry.js`).

## Styling

Shared visual patterns such as surfaces, navigation tabs, and text are defined
in [global.css](../packages/styles/src/global.css). They use Tailwind's
component layer so individual components can still add utility classes for
layout and local adjustments. Component-specific styling stays with the
component.

## Local development

Each shell has a Dockerfile, a Compose definition, and a Helm chart
(`global-shell`, `compliance-shell`, `topology-shell`). Containers serve on
internal port `3000` behind Traefik. Vite dev ports are `3010`
(topology-shell) and `3020` (compliance-shell). Use
`make dev svcs=ui-shells/global-shell` for Compose dev overrides, and
`pnpm storybook` for isolated component work.
