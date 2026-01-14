Bundle profiling

Run a bundle analysis to inspect which modules inflate mobile bundle size and identify candidates for lazy-loading or code-splitting.

How to run locally (Linux/macOS / CI):

1. Install deps

   npm ci

2. Generate bundle report

   npm run build:report

3. Open the generated report

   open dist/bundle-visualizer.html # macOS
   xdg-open dist/bundle-visualizer.html # Linux

On CI: trigger the `Bundle Profile` workflow (workflow_dispatch) in GitHub Actions and download the `bundle-visualizer` artifact to inspect.

Next actions once report is generated:
- Identify large modules (eg. `@google/genai`, `openai`, `react-virtuoso`) and lazily import them.
- Extract large UI-only pages into route-level code-splitting (dynamic import).
- Add `vite-plugin-compression` to pre-generate compressed assets for mobile.
- Optimize large assets (images / fonts) and prefer system fonts where feasible.
- Test on Android emulator and iOS simulator (Capacitor builds) and measure cold-start and memory usage.
