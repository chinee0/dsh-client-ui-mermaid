import { clientBundle } from '../tsdown.client.ts'

const base = clientBundle('@deepseek-ai/dsh-client-ui-mermaid', ['lib/types/index.js'])

/**
 * Dynamic client bundles ship as ONE file: the loader `require` answers only
 * module-table specifiers, and the host serves only `/plugins/<id>/client.js`
 * plus its sourcemap. A split chunk has no route and no resolver, so the
 * mermaid dynamic import must be inlined into the single artifact.
 */
export default (inline: Parameters<typeof base>[0]) => base(inline).map(config =>
  config.name === '@deepseek-ai/dsh-client-ui-mermaid/client'
    ? { ...config, outputOptions: { ...config.outputOptions, inlineDynamicImports: true } }
    : config)
