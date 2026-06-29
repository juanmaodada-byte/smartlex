/**
 * SmartLex Chrome Extension 构建脚本
 * 使用 esbuild 编译 TypeScript → JavaScript (IIFE, Chrome 100+)
 * 输出到 dist-extension/
 *
 * 使用：node build-extension.js
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'extension');
const OUT_DIR = path.join(__dirname, 'dist-extension');

async function build() {
  // 1. 清理输出目录
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entryPoints = {
    'background/service-worker': path.join(SRC_DIR, 'background', 'service-worker.ts'),
    'content/content': path.join(SRC_DIR, 'content', 'content.ts'),
    'content/popup/popup': path.join(SRC_DIR, 'content', 'popup', 'popup.ts'),
  };

  // 2. 编译 TypeScript
  const buildResults = await Promise.allSettled(
    Object.entries(entryPoints).map(([outName, entry]) =>
      esbuild.build({
        entryPoints: [entry],
        bundle: true,
        outfile: path.join(OUT_DIR, `${outName}.js`),
        format: 'iife',
        target: 'chrome100',
        platform: 'browser',
        logLevel: 'info',
      }).then(() => console.log(`  ✔ ${outName}.js`))
    )
  );

  // 检查构建结果
  const failures = buildResults.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.error('❌ Build failed for some entry points:');
    failures.forEach(f => console.error(f.reason));
    process.exit(1);
  }

  // 3. 复制静态文件
  const copies = [
    ['manifest.json'],
    ['icons', 'icon-16.png'],
    ['icons', 'icon-48.png'],
    ['icons', 'icon-128.png'],
    ['content', 'popup', 'popup.html'],
    ['content', 'popup', 'popup.css'],
  ];

  for (const segments of copies) {
    const src = path.join(SRC_DIR, ...segments);
    const dst = path.join(OUT_DIR, ...segments);
    const dstDir = path.dirname(dst);
    if (!fs.existsSync(dstDir)) {
      fs.mkdirSync(dstDir, { recursive: true });
    }
    fs.copyFileSync(src, dst);
    console.log(`  ✔ ${segments.join('/')} (copied)`);
  }

  // 4. 输出汇总
  console.log(`\n✅ Chrome extension built to ${OUT_DIR}/`);
  console.log('   在 Chrome 中加载：chrome://extensions/ → 开发者模式 → 加载已解压的扩展');
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
