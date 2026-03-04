const COLOR_PALETTES = [
  { name: 'Green (Primary)', prefix: 'green', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Grey', prefix: 'grey', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Blue', prefix: 'blue', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Red', prefix: 'red', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Orange', prefix: 'orange', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Teal', prefix: 'teal', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Light Green', prefix: 'light-green', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Yellow', prefix: 'yellow', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Pink', prefix: 'pink', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Purple', prefix: 'purple', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Dark Blue', prefix: 'dark-blue', shades: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
];

const SEMANTIC_COLORS = [
  { name: 'Primary', var: '--color-primary' },
  { name: 'Primary Hover', var: '--color-primary-hover' },
  { name: 'Primary Active', var: '--color-primary-active' },
  { name: 'Primary Light', var: '--color-primary-light' },
  { name: 'Secondary', var: '--color-secondary' },
  { name: 'Secondary Hover', var: '--color-secondary-hover' },
  { name: 'Secondary Light', var: '--color-secondary-light' },
  { name: 'Background', var: '--color-background' },
  { name: 'Background Subtle', var: '--color-background-subtle' },
  { name: 'Surface', var: '--color-surface' },
  { name: 'Surface Raised', var: '--color-surface-raised' },
  { name: 'Border', var: '--color-border' },
  { name: 'Error', var: '--color-error' },
  { name: 'Error Light', var: '--color-error-light' },
  { name: 'Success', var: '--color-success' },
  { name: 'Success Light', var: '--color-success-light' },
  { name: 'Warning', var: '--color-warning' },
  { name: 'Warning Light', var: '--color-warning-light' },
  { name: 'Info', var: '--color-info' },
  { name: 'Info Light', var: '--color-info-light' },
];

const TEXT_COLORS = [
  { name: 'Text (Default)', var: '--color-text' },
  { name: 'Text Secondary', var: '--color-text-secondary' },
  { name: 'Text Tertiary', var: '--color-text-tertiary' },
  { name: 'Text Placeholder', var: '--color-text-placeholder' },
  { name: 'Text Disabled', var: '--color-text-disabled' },
];

const FONT_SIZES = [
  { label: 'H-XXL (72px)', className: 'text-h-xxl', weight: 'font-bold' },
  { label: 'H-XL (60px)', className: 'text-h-xl', weight: 'font-bold' },
  { label: 'H-LG (48px)', className: 'text-h-lg', weight: 'font-semibold' },
  { label: 'H-MD (36px)', className: 'text-h-md', weight: 'font-semibold' },
  { label: 'H-SM (30px)', className: 'text-h-sm', weight: 'font-semibold' },
  { label: 'H-XS (24px)', className: 'text-h-xs', weight: 'font-semibold' },
  { label: 'Text XL (20px)', className: 'text-xl', weight: 'font-medium' },
  { label: 'Text LG (18px)', className: 'text-lg', weight: 'font-medium' },
  { label: 'Text MD (16px)', className: 'text-base', weight: 'font-normal' },
  { label: 'Text SM (14px)', className: 'text-sm', weight: 'font-normal' },
  { label: 'Text XS (12px)', className: 'text-xs', weight: 'font-normal' },
  { label: 'Text XXS (10px)', className: 'text-xxs', weight: 'font-normal' },
];

const SHADOWS = [
  { label: 'XS', className: 'shadow-xs' },
  { label: 'SM', className: 'shadow-sm' },
  { label: 'MD', className: 'shadow-md' },
  { label: 'LG', className: 'shadow-lg' },
  { label: 'XL', className: 'shadow-xl' },
  { label: '2XL', className: 'shadow-2xl' },
  { label: '3XL', className: 'shadow-3xl' },
];

const RADII = [
  { label: 'None', className: 'rounded-none' },
  { label: 'SM (4px)', className: 'rounded-sm' },
  { label: 'MD (6px)', className: 'rounded-md' },
  { label: 'LG (8px)', className: 'rounded-lg' },
  { label: 'XL (12px)', className: 'rounded-xl' },
  { label: '2XL (16px)', className: 'rounded-2xl' },
  { label: '3XL (24px)', className: 'rounded-3xl' },
  { label: 'Full', className: 'rounded-full' },
];

function ColorSwatch({ cssVar, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-12 h-12 rounded-lg border border-grey-200"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <span className="text-xxs text-text-secondary">{label}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-12">
      <h2 className="text-h-xs font-semibold text-foreground mb-6 pb-3 border-b border-border">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignTokensPreview() {
  return (
    <div className="min-h-screen bg-background-subtle">
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center">
          <h1 className="text-lg font-semibold text-foreground">
            Design Tokens Reference
          </h1>
          <span className="ml-3 text-xs font-medium text-text-tertiary bg-muted px-2 py-1 rounded-full">
            Figma Sync
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* ── Color Palettes ────────────── */}
        <Section title="Color Palettes">
          {COLOR_PALETTES.map((palette) => (
            <div key={palette.prefix} className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {palette.name}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {palette.shades.map((shade) => (
                  <ColorSwatch
                    key={shade}
                    cssVar={`--color-${palette.prefix}-${shade}`}
                    label={String(shade)}
                  />
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* ── Semantic Colors ────────────── */}
        <Section title="Semantic Colors">
          <div className="flex gap-3 flex-wrap">
            {SEMANTIC_COLORS.map((c) => (
              <ColorSwatch key={c.var} cssVar={c.var} label={c.name} />
            ))}
          </div>
        </Section>

        {/* ── Text Colors ─────────────────── */}
        <Section title="Text Colors">
          <div className="space-y-2">
            {TEXT_COLORS.map((t) => (
              <p
                key={t.var}
                className="text-base"
                style={{ color: `var(${t.var})` }}
              >
                {t.name} — The quick brown fox jumps over the lazy dog
              </p>
            ))}
          </div>
        </Section>

        {/* ── Typography Scale ──────────── */}
        <Section title="Typography Scale (Inter)">
          <div className="space-y-4 overflow-x-auto">
            {FONT_SIZES.map((f) => (
              <div key={f.className} className="flex items-baseline gap-4">
                <span className="text-xs text-text-tertiary w-36 shrink-0">
                  {f.label}
                </span>
                <span className={`${f.className} ${f.weight} text-foreground truncate`}>
                  The quick brown fox
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Font Weights ──────────────── */}
        <Section title="Font Weights">
          <div className="space-y-2">
            {['font-normal', 'font-medium', 'font-semibold', 'font-bold'].map((w) => (
              <p key={w} className={`text-lg text-foreground ${w}`}>
                {w.replace('font-', '')} (400/500/600/700) — The quick brown fox
              </p>
            ))}
          </div>
        </Section>

        {/* ── Shadows ──────────────────── */}
        <Section title="Shadows">
          <div className="flex gap-6 flex-wrap">
            {SHADOWS.map((s) => (
              <div
                key={s.label}
                className={`w-24 h-24 rounded-lg bg-surface flex items-center justify-center ${s.className}`}
              >
                <span className="text-xs text-text-secondary">{s.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Border Radius ────────────── */}
        <Section title="Border Radius">
          <div className="flex gap-4 flex-wrap items-end">
            {RADII.map((r) => (
              <div key={r.label} className="flex flex-col items-center gap-2">
                <div
                  className={`w-16 h-16 bg-primary ${r.className}`}
                />
                <span className="text-xxs text-text-secondary">{r.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Spacing Scale ────────────── */}
        <Section title="Spacing Scale">
          <div className="space-y-2">
            {[
              { label: '0.5 (2px)', className: 'w-[var(--spacing-0-5)]' },
              { label: '1 (4px)', className: 'w-[var(--spacing-1)]' },
              { label: '2 (8px)', className: 'w-[var(--spacing-2)]' },
              { label: '3 (12px)', className: 'w-[var(--spacing-3)]' },
              { label: '4 (16px)', className: 'w-[var(--spacing-4)]' },
              { label: '5 (20px)', className: 'w-[var(--spacing-5)]' },
              { label: '6 (24px)', className: 'w-[var(--spacing-6)]' },
              { label: '8 (32px)', className: 'w-[var(--spacing-8)]' },
              { label: '10 (40px)', className: 'w-[var(--spacing-10)]' },
              { label: '12 (48px)', className: 'w-[var(--spacing-12)]' },
              { label: '16 (64px)', className: 'w-[var(--spacing-16)]' },
              { label: '20 (80px)', className: 'w-[var(--spacing-20)]' },
              { label: '24 (96px)', className: 'w-[var(--spacing-24)]' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-xs text-text-tertiary w-20 shrink-0">
                  {s.label}
                </span>
                <div
                  className={`h-3 bg-primary rounded-sm ${s.className}`}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Button Preview ──────────── */}
        <Section title="Button Preview">
          <div className="flex gap-3 flex-wrap items-center">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover active:bg-primary-active transition-colors">
              Primary Button
            </button>
            <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-semibold text-sm hover:bg-secondary-hover transition-colors">
              Secondary Button
            </button>
            <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-semibold text-sm transition-colors">
              Destructive
            </button>
            <button className="px-4 py-2 bg-surface text-foreground border border-border rounded-lg font-semibold text-sm hover:bg-muted transition-colors">
              Outline
            </button>
          </div>
        </Section>
      </main>
    </div>
  );
}
