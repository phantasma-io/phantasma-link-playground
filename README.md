# Phantasma Link Playground

A side-by-side tester and reference dApp for the [Phantasma Link](https://github.com/phantasma-io)
dApp&harr;wallet protocol. Two panels run the **same** set of operations so you can compare the
new **v5** protocol (top) against the legacy **v4** (bottom):

- **v5** &mdash; built on [`@phantasma/link-react`](https://github.com/phantasma-io/phantasma-link-react)
  over `PhantasmaLink5`. Pick the transport (cross-device QR over the relay, or same-device
  deeplink), pair, and run the typed `pha_*` methods.
- **v4** &mdash; the legacy callback-based `PhantasmaLink` from `phantasma-sdk-ts`, over the local
  socket / injected wallet.

Each panel has a connect control, an account view, the shared operation runner (get chains, sign
message, send SOUL), and a live event/request log.

## Run

```sh
npm install
npm run dev
```

Then open http://localhost:3000.

For the **v5 relay (QR)** flow you need a Poltergeist wallet on a phone; for **v5 deeplink** and
**v4** you need the wallet on the same device (deeplink) or its local socket / extension (v4). The
default network is localnet (`simnet` nexus, RPC `localhost:5172`); switch it in the v5 panel.

## Stack

Next.js 16 (App Router, Turbopack) &middot; React 19 &middot; TypeScript &middot; Tailwind CSS 4
&middot; Radix UI + CVA &middot; MobX &middot; next-themes &middot; sonner. The conventions and
theme match the other Phantasma frontends (deployment / status / explorer).

> **Local packages during development.** Phantasma Link v5 is not yet on npm, so both
> `@phantasma/link-react` and `phantasma-sdk-ts` are linked via `file:` to sibling checkouts.
> `next.config.ts` points Turbopack's root at the parent directory so those symlinks resolve.
> Once v5 ships to npm, the `file:` dependencies flip to version ranges.
