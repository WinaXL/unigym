/* Publish an already-built APK with a stable browser download filename.
 * Never starts or waits for an EAS build. Requires the authenticated gh CLI.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function releaseArgs(apk, tag, commit) {
  if (!/^preview-[a-zA-Z0-9._-]+$/.test(tag)) throw new Error('Use a preview-... release tag.');
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('Supply the full Git commit SHA used for this APK.');
  if (path.basename(apk) !== 'UniGym.apk') throw new Error('The release asset must be named UniGym.apk.');
  return ['release', 'create', tag, apk, '--repo', 'WinaXL/unigym', '--target', commit,
    '--prerelease', '--title', `UniGym preview (${commit.slice(0, 7)})`,
    '--notes', `UniGym Android preview. Source commit: ${commit}. Download UniGym.apk below.`];
}

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const args = argv.filter((arg) => arg !== '--dry-run');
  if (args.length !== 3) throw new Error('Usage: npm run preview:publish -- <built-apk-path> <preview-tag> <full-source-commit> [--dry-run]');
  const [source, tag, commit] = args;
  const config = require('../app.json').expo;
  if (config.name !== 'UniGym') throw new Error('The installed app name must remain UniGym.');
  // Validate all arguments before copying files or invoking GitHub.
  releaseArgs('UniGym.apk', tag, commit);
  const handle = fs.openSync(path.resolve(source), 'r');
  try {
    const signature = Buffer.alloc(4);
    if (fs.readSync(handle, signature, 0, 4, 0) !== 4 || !signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      throw new Error('The input is not an APK/ZIP archive.');
    }
  } finally { fs.closeSync(handle); }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'unigym-apk-'));
  const asset = path.join(temporary, 'UniGym.apk');
  try {
    fs.copyFileSync(path.resolve(source), asset);
    const command = releaseArgs(asset, tag, commit);
    if (dryRun) {
      console.log(JSON.stringify({ executable: 'gh', args: command }, null, 2));
    } else {
      const result = spawnSync('gh', command, { stdio: 'inherit', shell: false });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`GitHub release creation failed (${result.status}).`);
      console.log(`Download: https://github.com/WinaXL/unigym/releases/download/${tag}/UniGym.apk`);
    }
  } finally {
    if (fs.existsSync(asset)) fs.unlinkSync(asset);
    fs.rmdirSync(temporary);
  }
}

module.exports = { releaseArgs, main };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
