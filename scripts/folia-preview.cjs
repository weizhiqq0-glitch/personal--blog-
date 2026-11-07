// Runs the unmodified, pinned upstream in a separate origin. No blog credentials.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const integration = path.join(root, 'integrations/folia');
const manifest = require('../integrations/folia/upstream.json');
const source = path.join(integration, 'source');
const privateDir = path.join(root, 'private');
function run(command, args, cwd = source) {
  const result = spawnSync(command, args, { cwd, stdio:'inherit', windowsHide:true, env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD:'1' } });
  if (result.error || result.status !== 0) throw Error('运行失败：' + command + '。请检查网络及 Node.js 24 环境后重试。');
}
async function main() {
  fs.mkdirSync(privateDir,{recursive:true});
  if (!fs.existsSync(path.join(source,'package.json'))) {
    if (fs.existsSync(source)) throw Error('Folia 源码目录不完整，请检查 integrations/folia/source，未覆盖现有文件。');
    const archive = path.join(privateDir,'folia-download.tar.gz');
    try {
      console.log('从官方仓库下载固定版本 Folia…');
      const response = await fetch('https://codeload.github.com/' + manifest.repository + '/tar.gz/' + manifest.revision, { signal:AbortSignal.timeout(120000) });
      if (!response.ok) throw Error('无法下载 Folia，请检查网络。');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== manifest.archiveSha256) throw Error('源码校验不一致，已停止安装。');
      fs.writeFileSync(archive,bytes);fs.mkdirSync(source);
      run('tar',['-xzf',archive,'--strip-components=1','-C',source],root);
    } finally { if (fs.existsSync(archive)) fs.unlinkSync(archive); }
  }
  if (!fs.existsSync(path.join(source,'node_modules/vite/bin/vite.js'))) {
    console.log('安装锁定依赖（不执行第三方安装脚本）…');
    const npm = process.platform === 'win32' ? path.join(path.dirname(process.execPath),'npm.cmd') : 'npm';
    // cmd is used only to launch the fixed npm command, never for filesystem operations.
    if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe',['/d','/c','""' + npm + '" ci --ignore-scripts --no-audit --no-fund --cache="' + path.join(privateDir,'npm-cache') + '""']);
    else run(npm,['ci','--ignore-scripts','--no-audit','--no-fund','--cache='+path.join(privateDir,'npm-cache')]);
  }
  console.log('Folia：http://127.0.0.1:5191；小站音乐页：#/folia。关闭本窗口停止。');
  const child = spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5191','--strictPort'],{cwd:source,stdio:'inherit',windowsHide:true,env:{...process.env,VITE_SKIP_STARTUP_EXPERIENCE:'true'}});
  child.on('exit',code=>{process.exitCode=code || 0;});
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill());
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
