#!/usr/bin/env bun
/**
 * Self-contained build script for ElizaOS plugins
 */

import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { $ } from 'bun';

async function cleanBuild(outdir = 'dist') {
  if (existsSync(outdir)) {
    await rm(outdir, { recursive: true, force: true });
    console.log(`✓ Cleaned ${outdir} directory`);
  }
}

async function build() {
  const start = performance.now();
  console.log('🚀 Building plugin...');

  try {
    await cleanBuild('dist');
    console.log('Starting build tasks...');

    const [buildResult, tscResult] = await Promise.all([
      (async () => {
        console.log('📦 Bundling with Bun...');
        const result = await Bun.build({
          entrypoints: ['./src/index.ts'],
          outdir: './dist',
          target: 'node',
          format: 'esm',
          sourcemap: "linked",
          minify: false,
          external: ['dotenv', 'node:*', '@elizaos/core', '@elizaos/cli', 'zod'],
          naming: {
            entry: '[dir]/[name].[ext]',
          },
        });

        if (!result.success) {
          console.error('✗ Build failed:', result.logs);
          return { success: false, outputs: [] };
        }

        return result;
      })(),

      (async () => {
        console.log('📝 Generating TypeScript declarations...');
        try {
          await $`tsc --emitDeclarationOnly --incremental --project ./tsconfig.json`.quiet();
          console.log('✓ TypeScript declarations generated');
          return { success: true };
        } catch (error) {
          console.warn('⚠ Failed to generate TypeScript declarations', error);
          return { success: false };
        }
      })(),
    ]);

    if (!buildResult.success) {
      return false;
    }

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`✅ Build complete! (${elapsed}s)`);
    return true;
  } catch (error) {
    console.error('Build error:', error);
    return false;
  }
}

build()
  .then((success) => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Build script error:', error);
    process.exit(1);
  });
