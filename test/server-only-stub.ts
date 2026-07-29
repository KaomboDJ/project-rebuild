// Vitest runs in a plain Node environment, not Next.js's server-component
// bundler, so the real `server-only` package (which throws unless the
// bundler sets the "react-server" export condition) would throw on import
// here. This stub is aliased in vitest.config.ts so `import "server-only"`
// is a no-op during tests while remaining a real safety guard in the Next.js
// build.
export {};
