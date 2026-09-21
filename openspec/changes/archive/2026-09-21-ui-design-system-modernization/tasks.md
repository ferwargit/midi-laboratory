## 1. Button Component Refactor

- [x] 1.1 Update Button.tsx variant styles to match AGENTS.md Pro-Audio Hardware palette:
  - primary: bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-sm shadow-cyan-500/20 active:scale-[0.98]
  - secondary: bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 shadow-sm active:scale-[0.98]
  - success: bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]
  - danger: bg-rose-600 hover:bg-rose-500 text-white active:scale-[0.98]
  - ghost: hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 active:scale-[0.98]
    Verify by checking the variantStyles object matches exactly

- [x] 1.2 Add accessibility focus-visible rings: focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none
      Verify by inspecting button className string includes focus-visible classes

- [x] 1.3 Ensure micro-transition: transition-all duration-150 ease-out is applied to className
      Verify transition-all duration-150 ease-out present in className

- [x] 1.4 Confirm ButtonProps interface unchanged (variant: ButtonVariant, size: 'sm'|'md'|'lg')
      Verify type)
      Verify interface definition unchanged

- [x] 1.5 Run npm test to ensure no test failures from Button changes
      Verify test suite passes (0 failures)

## 2. Card Component Refactor

- [x] 2.1 Update Card background to bg-linear-to-b from-slate-900/95 to-slate-950/95
      Verify bg-linear-to-b from-slate-900/95 to-slate-950/95 present in className

- [x] 2.2 Set border to border-slate-800/80 and rounded to rounded-xl
      Verify border-slate-800/80 rounded-xl present

- [x] 2.3 Implement glow variants:
  - cyan: border-cyan-500/30 shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]
  - purple: border-purple-500/30 shadow-[0_0_20px_-5px_rgba(168,85,247,0.15)]
  - none: border-slate-800/80 (no shadow)
    Verify glowStyles object matches exactly

- [x] 2.4 Remove backdrop-blur-xl and adjust padding to consumer control (remove p-4.5 hardcoding)
      Verify backdrop-blur-xl removed and p-4.5 not hardcoded

- [x] 2.5 Confirm CardProps interface unchanged (glow?: 'cyan'|'purple'|'none')
      Verify interface definition unchanged

- [x] 2.6 Run npm test to ensure no test failures from Card changes
      Verify test suite passes (0 failures)

## 3. Badge Component Refactor

- [x] 3.1 Update badgeStyles to translucent 950/60 backgrounds with 300-tone text and 500/30 borders:
  - success: bg-emerald-950/60 text-emerald-300 border border-emerald-500/30
  - danger: bg-rose-950/60 text-rose-300 border border-rose-500/30
  - warning: bg-amber-950/60 text-amber-300 border border-amber-500/30
  - info: bg-cyan-950/60 text-cyan-300 border border-cyan-500/30
    Verify badgeStyles object matches exactly

- [x] 3.2 Confirm BadgeProps interface unchanged (variant?: BadgeVariant)
      Verify interface definition unchanged

- [x] 3.3 Run npm test to ensure no test failures from Badge changes
      Verify test suite passes (0 failures)

## 4. StatCard Component Refactor

- [x] 4.1 Update StatCard value div to use tabular-nums font-mono for numeric stability
      Verify value div className includes tabular-nums font-mono

- [x] 4.2 Ensure text contrast meets WCAG AA on dark background (verify in design)
      Verify design.md documents contrast compliance

- [x] 4.3 Confirm StatCardProps interface unchanged (title, value, highlightColor)
      Verify interface definition unchanged

- [x] 4.4 Run npm test to ensure no test failures from StatCard changes
      Verify test suite passes (0 failures)

## 5. Integration Verification

- [x] 5.1 Run full test suite: npm run test
      Verify all 533 tests pass

- [x] 5.2 Run type checker: npm run typecheck
      verify no TypeScript errors

- [x] 5.3 Manual spot-check of 5 consumer components (e.g., KnowledgeGuideModal, Header, SessionsTableTab, etc.)
      verify visual appearance matches AGENTS.md spec (documented in tester notes)
