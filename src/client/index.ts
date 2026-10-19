/**
 * Mermaid preview for markdown fences.
 *
 * The fence keeps its source by default. A 预览 button in the code-block
 * banner swaps the source for the rendered diagram in place; the same button
 * (now labelled 源码) swaps it back. Render failures stay inside the block.
 *
 * Why DOM augmentation: the markdown renderer belongs to the shell-seeded
 * `ui-primitives`, whose fence dispatch a plugin cannot intercept, while
 * `.md-code-block` is a literal class CodeBlock writes.
 *
 * The banner label is NOT a usable hook: this shell prints a localized generic
 * label whenever the fence language has no registered grammar, and mermaid is
 * exactly that case. Detection therefore falls back to the source's first line.
 *
 * Vanilla DOM on purpose: no React/JSX and no CSS pipeline, so the bundle
 * carries only this file plus the inlined mermaid implementation.
 */

const LANG = 'mermaid'
const BLOCK = '.md-code-block'
const MARK = 'mermaidPreview'
const SHOW = '预览'
const HIDE = '源码'

type MermaidModule = typeof import("mermaid")["default"]

/** First-line keywords Mermaid accepts as a diagram start. */
const MERMAID_START = /^(?:flowchart|graph|sequenceDiagram|classDiagram|classDiagram-v2|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|kanban|radar-beta|treemap-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|info)\b/i

let mermaidPromise: Promise<MermaidModule> | undefined
let seq = 0

/**
 * Resolve one theme token to a concrete color.
 *
 * Mermaid parses color values itself (khroma) and rejects CSS `var(...)`, so a
 * token must be substituted into a real color before it reaches
 * `themeVariables`. The probe element also normalizes any modern color syntax
 * `getComputedStyle` understands into the `rgb(...)` form mermaid accepts.
 */
function cssColor(token: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = raw === '' ? fallback : raw
  document.body.append(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved === '' ? fallback : resolved
}

function loadMermaid(): Promise<MermaidModule> {
  mermaidPromise ??= import("mermaid").then((mod) => {
    const mermaid = mod.default
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      themeVariables: {
        background: cssColor('--dsw-alias-bg-layer-1', '#ffffff'),
        primaryColor: cssColor('--dsw-alias-bg-layer-3', '#f3f4f6'),
        primaryTextColor: cssColor('--dsw-alias-label-primary', '#1f2328'),
        primaryBorderColor: cssColor('--dsw-alias-border-l2', '#d0d7de'),
        secondaryColor: cssColor('--dsw-alias-bg-layer-2', '#eef1f4'),
        tertiaryColor: cssColor('--dsw-alias-bg-layer-1', '#ffffff'),
        lineColor: cssColor('--dsw-alias-border-l3', '#8c959f'),
        textColor: cssColor('--dsw-alias-label-primary', '#1f2328'),
        mainBkg: cssColor('--dsw-alias-bg-layer-3', '#f3f4f6'),
        nodeBorder: cssColor('--dsw-alias-border-l2', '#d0d7de'),
        actorBkg: cssColor('--dsw-alias-bg-layer-3', '#f3f4f6'),
        actorBorder: cssColor('--dsw-alias-border-l2', '#d0d7de'),
        actorTextColor: cssColor('--dsw-alias-label-primary', '#1f2328'),
        signalColor: cssColor('--dsw-alias-label-secondary', '#57606a'),
        signalTextColor: cssColor('--dsw-alias-label-primary', '#1f2328'),
        noteBkgColor: cssColor('--dsw-alias-markdown-code-block', '#f6f8fa'),
        noteTextColor: cssColor('--dsw-alias-label-primary', '#1f2328'),
        noteBorderColor: cssColor('--dsw-alias-border-l2', '#d0d7de'),
        fontFamily: 'inherit',
      },
    })
    return mermaid
  })
  return mermaidPromise
}

/** Mermaid fence detection: label, data attributes, then the source. */
function isMermaid(block: HTMLElement): boolean {
  const labelled = block.querySelector('[data-code-block-banner] span')?.textContent?.trim()
  if (labelled !== undefined && labelled.toLowerCase() === LANG) return true
  for (const element of [block, ...block.querySelectorAll('[data-lang],[data-language]')]) {
    const value = element.getAttribute('data-lang') ?? element.getAttribute('data-language')
    if (value !== null && value.trim().toLowerCase() === LANG) return true
  }
  const source = block.querySelector('pre')?.textContent ?? ''
  for (const line of source.split('\n')) {
    const text = line.trim()
    if (text === '' || text.startsWith('%%')) continue
    return MERMAID_START.test(text)
  }
  return false
}

/** Render one fence source into the block-local view. */
async function renderInto(view: HTMLElement, source: string): Promise<void> {
  const mermaid = await loadMermaid()
  const id = 'dsh-mermaid-' + String(++seq)
  const out = await mermaid.render(id, source)
  document.getElementById('d' + id)?.remove()
  view.innerHTML = out.svg
  for (const svg of view.querySelectorAll('svg')) {
    svg.style.maxWidth = '100%'
    svg.style.height = 'auto'
    svg.style.display = 'block'
    svg.style.margin = '0 auto'
  }
}

/** Add one in-place source/diagram toggle to a mermaid fence. */
function augment(block: HTMLElement): void {
  if (block.dataset[MARK] !== undefined) return
  if (!isMermaid(block)) return

  const banner = block.firstElementChild as HTMLElement | null
  const body = [...block.children].filter((child): child is HTMLElement => child !== banner)
  const action = block.querySelector('button')?.parentElement
  if (body.length === 0 || action === null || action === undefined) return
  block.dataset[MARK] = ''

  const view = document.createElement('div')
  Object.assign(view.style, {
    display: 'none',
    overflow: 'auto',
    padding: '12px',
    background: 'var(--dsw-alias-bg-layer-1)',
    color: 'var(--dsw-alias-label-primary)',
  } as Partial<CSSStyleDeclaration>)
  block.append(view)

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = SHOW
  button.title = '在代码块内展开或收起渲染图'
  Object.assign(button.style, {
    marginRight: '10px',
    border: 'none',
    background: 'transparent',
    padding: '0',
    cursor: 'pointer',
    color: 'var(--dsw-alias-state-business-primary, inherit)',
    font: 'inherit',
  } as Partial<CSSStyleDeclaration>)

  let shown = false
  let rendered = false

  const showSource = (): void => {
    view.style.display = 'none'
    for (const element of body) element.style.display = ''
    shown = false
    button.textContent = SHOW
  }

  const showDiagram = async (): Promise<void> => {
    view.style.display = 'block'
    for (const element of body) element.style.display = 'none'
    shown = true
    button.textContent = HIDE
    if (rendered) return
    const source = body.map(element => element.textContent ?? '').join('\n')
    try {
      await renderInto(view, source)
      rendered = true
    } catch (cause) {
      view.textContent = 'Mermaid: ' + (cause instanceof Error ? cause.message : String(cause))
      view.style.color = 'var(--dsw-alias-label-error)'
      view.style.whiteSpace = 'pre-wrap'
    }
  }

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (shown) showSource()
    else void showDiagram()
  })

  action.prepend(button)
}

function scan(root: ParentNode): void {
  for (const block of root.querySelectorAll<HTMLElement>(BLOCK)) augment(block)
}

/** Client plugin body: watch message markup and add one toggle per fence. */
export function apply(): () => void {
  scan(document)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue
        const element = node as HTMLElement
        if (element.matches(BLOCK)) augment(element)
        scan(element)
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => { observer.disconnect() }
}
