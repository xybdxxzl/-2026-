import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const noOpen = process.argv.includes('--no-open');

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error(`当前 Node.js 版本为 ${process.version}，请使用22.12或更新版本。`);
  }
  if (!existsSync(resolve(projectRoot, 'node_modules/vite/bin/vite.js'))) {
    throw new Error('尚未安装项目依赖。请在 web 目录运行 npm install，然后重新启动。');
  }

  process.chdir(projectRoot);
  console.log('\n转动的授时图 · 正在启动本地原型……\n');

  const { createServer } = await import('vite');
  const server = await createServer({
    root: projectRoot,
    configFile: resolve(projectRoot, 'vite.config.js'),
    server: { host: '127.0.0.1', port: 5173, strictPort: false, open: !noOpen },
  });
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) {
    await server.close();
    throw new Error('服务未能取得可访问的本地地址，请重新启动。');
  }
  console.log(`原型已就绪：${url}`);
  console.log(noOpen ? '浏览器自动打开已跳过。' : '正在自动打开默认浏览器；如果没有弹出，请复制上面的地址打开。');
  console.log('使用期间请保留此窗口。按 Ctrl+C 或关闭窗口可停止服务。\n');

  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    await server.close();
    process.exit(0);
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(`\n启动失败：${error.message}\n`);
  process.exitCode = 1;
}
