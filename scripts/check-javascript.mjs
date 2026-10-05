import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function check(target) {
  if (fs.statSync(target).isDirectory()) {
    for (const entry of fs.readdirSync(target)) check(path.join(target, entry));
  } else if (/\.[cm]?js$/.test(target)) {
    execFileSync(process.execPath, ['--check', target], { stdio: 'inherit' });
  }
}
for (const target of process.argv.slice(2)) check(target);
