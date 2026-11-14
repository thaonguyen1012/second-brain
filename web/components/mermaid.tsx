'use client';
import { useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

// mermaid is loaded at runtime from public/vendor (local copy of the npm bundle, see scripts/prepare-vendor.mjs),
// only on pages that contain a diagram.
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/vendor/mermaid/mermaid.esm.min.mjs`;
        const { default: mermaid } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
          // mermaid's dark theme lays the edge labels ("yes", "no") in #ccc on #585858, 4.43:1 (WCAG 1.4.3): a step
          // darker, #4b4b4b, is 5.4:1. A themeVariable outlasts the theme's own calculation; light needs none
          ...(resolvedTheme === 'dark' && { themeVariables: { edgeLabelBackground: '#4b4b4b' } }),
          fontFamily: 'inherit',
        });
        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (failed || !svg) {
    // before rendering (and if the diagram is invalid) show the source, so nothing is lost
    return (
      <pre className="mermaid-source" data-state={failed ? 'error' : 'loading'}>
        <code>{chart}</code>
      </pre>
    );
  }
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
