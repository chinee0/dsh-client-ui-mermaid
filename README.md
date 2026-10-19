# DSH Mermaid Preview

An inline Mermaid renderer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) code blocks.

A fenced ` ```mermaid ` block keeps its source by default. A **预览** (Preview) button appears in the code-block banner; clicking it swaps the source for the rendered diagram **in place**, and the button becomes **源码** (Source) to swap back. No side panel, no layout jump.

```
┌───────────────────────────────┐
│ 代码块        预览  自动换行  复制 │
├───────────────────────────────┤
│  flowchart LR                 │
│    A --> B                    │
└───────────────────────────────┘
        ↓ click 预览
┌───────────────────────────────┐
│ 代码块        源码  自动换行  复制 │
├───────────────────────────────┤
│      ┌───┐      ┌───┐         │
│      │ A │─────▶│ B │         │
│      └───┘      └───┘         │
└───────────────────────────────┘
```

## Why a plugin instead of a patch

The markdown fence dispatch lives in `ui-primitives`, which the client module loader resolves to the shell's own copy — a plugin cannot hook it. DOM augmentation is the remaining option, and `.md-code-block` is a literal class `CodeBlock.tsx` writes (not a CSS-module hash), so it is the one stable public hook available.

## Compatibility

- Built and tested against **DSH 0.2.1-rc.2** (the desktop runtime).
- The source tree this package was authored in is **0.1.0-rc.8**; it builds there and runs on the newer runtime.
- Rendering depends on the `.md-code-block` markup and the `[data-code-block-banner]` element. A shell change can break it; fix here, not upstream.

## Install

The plugin is a normal DSH bundle: it ships `dsh.bundle.patch` plus a `dsh.client` declaration, so it can be installed the same way as any other bundle.

### A. Through the Harness (recommended)

Ask the running DSH agent to install the bundle from this directory (it calls `install_bundle`), or use the Plugin Manager UI. That adds the package to the profile's dependencies, selects the bundle, and applies the row live.

### B. Manually, without the agent

1. Put this checkout somewhere stable, e.g. `%USERPROFILE%\src\dsh-client-ui-mermaid`.

2. Make the package resolvable from the profile. Profiles share `~/.dsh/profiles/node_modules`:

   ```bat
   mklink /J "%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-mermaid" "%USERPROFILE%\src\dsh-client-ui-mermaid"
   ```

3. Insert the row into **the patch of the profile your app actually boots** (the desktop app boots `desktop`; a `dsh web` process may boot another one — check `DSH_PROFILE` in a harness shell):

   ```yaml
   # %USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml
   - insert:
       - id: ui-mermaid
         name: '@deepseek-ai/dsh-client-ui-mermaid'
   ```

4. **Fully quit and restart the app.** A new Loader row is read at boot; a page refresh is not enough.

To uninstall: delete the row, remove the junction (or the dependency), restart.

## Build

The client bundle is emitted by tsdown through the harness's shared preset (`packages/client/tsdown.client.ts`), so building expects a deepseek-harness checkout:

```
deepseek-harness/
└── packages/client/ui-mermaid/   <- copy this repository here
```

```bash
pnpm install
pnpm --filter @deepseek-ai/dsh-client-ui-mermaid run bundle
```

A prebuilt `lib/client.js` is committed so the plugin can be installed without a build toolchain. It is ~7 MB (see the next section for why).

## Design notes (the three traps that shaped this)

**1. The banner label is not a language hook.** This shell prints a localized generic label (`代码块`, "code block") whenever the fence language has no registered grammar — and mermaid is exactly that case. Detection therefore checks the banner label, then `data-lang` / `data-language`, then falls back to the first non-empty, non-comment source line against a list of Mermaid diagram keywords (`flowchart`, `sequenceDiagram`, `classDiagram`, …). The source line is the one signal the renderer cannot rewrite.

**2. A client bundle is one file, always.** The client loader's `require` answers only module-table specifiers (platform seeds, materialized modules, registered factories) — a relative specifier such as `./mermaid.core-xxxx.cjs` can never resolve. The host also serves exactly one artifact per plugin (`/plugins/<id>/client.js` plus its sourcemap), so split chunks have no route at all. Dynamic imports are therefore inlined: mermaid ships inside the single ~7 MB bundle instead of as a lazily fetched chunk.

**3. Mermaid rejects CSS variables.** Its color parser (khroma) cannot read `var(--token)`. Theme tokens are resolved to concrete `rgb(...)` values with `getComputedStyle` before they reach `themeVariables`.

## Limitations

- Theme variables are resolved on the first render; switching the app theme later needs a reload before diagrams pick up the new colors.
- DOM augmentation is inherently fragile: it depends on `.md-code-block` and the banner structure.
- Detection is heuristic. A non-mermaid code block whose first line starts with a Mermaid keyword (for example a JS snippet starting with `graph`) would be offered a preview; the renderer then reports its parse error inside the block.
- Only `mermaid` fences are handled; no other diagram languages.

## Repository layout

| Path | Purpose |
|---|---|
| `src/client/index.ts` | The browser half: detection, toggle button, rendering |
| `src/index.ts` | The host half (empty `apply`; the plugin exists for its client surface) |
| `cordis.patch.yml` | Bundle patch that inserts the `ui-mermaid` row |
| `lib/client.js` | Prebuilt browser artifact (single file, mermaid inlined) |
| `lib/index.js` | Prebuilt host artifact |
| `locale/` | Plugin Manager title and description (en, zh) |
| `icon.svg` | Plugin artwork |
| `tsdown.config.ts` | In-tree build config (requires the harness preset) |

## License

MIT. See [LICENSE](LICENSE).
