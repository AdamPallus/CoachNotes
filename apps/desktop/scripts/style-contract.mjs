import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rendererRoot = path.resolve(import.meta.dirname, '..', 'renderer');
const stylesPath = process.env.COACHNOTES_STYLE_CONTRACT_PATH
  ? path.resolve(process.env.COACHNOTES_STYLE_CONTRACT_PATH)
  : path.join(rendererRoot, 'styles.css');
const tokensPath = path.join(rendererRoot, 'tokens.css');
const styles = fs.readFileSync(stylesPath, 'utf8');
const tokens = fs.readFileSync(tokensPath, 'utf8');
const failures = [];

const matches = (source, pattern) => [...source.matchAll(pattern)].map((match) => match[0]);
const valuesFor = (property) => new Set(
  matches(styles, new RegExp(`${property}:\\s*[^;]+`, 'g'))
    .map((declaration) => declaration.replace(new RegExp(`^${property}:\\s*`), '').trim())
);

const rootCount = matches(tokens, /(^|\n):root\s*\{/g).length;
const darkRootCount = matches(tokens, /html\[data-theme="dark"\]\s*\{/g).length;
if (rootCount !== 1 || darkRootCount !== 1) {
  failures.push(`tokens.css must contain one :root block and one dark token block (found ${rootCount} and ${darkRootCount}).`);
}
if (/(^|\n):root\s*\{/.test(styles)) {
  failures.push('styles.css must not declare a :root token block.');
}

for (const token of ['--surface-page', '--surface-card', '--surface-chrome', '--action', '--highlight', '--risk']) {
  if (!tokens.includes(`${token}:`)) failures.push(`tokens.css is missing ${token}.`);
}

const hexValues = matches(styles, /#[0-9a-fA-F]{3,8}\b/g);
const uniqueHexValues = new Set(hexValues.map((value) => value.toLowerCase()));
const legacyLimits = {
  hexOccurrences: 137,
  uniqueHexValues: 89,
  importantDeclarations: 12,
  fontSizeValues: 36,
  borderRadiusValues: 22,
  boxShadowValues: 33
};

if (hexValues.length > legacyLimits.hexOccurrences || uniqueHexValues.size > legacyLimits.uniqueHexValues) {
  failures.push(`Raw hex debt increased (${hexValues.length} occurrences, ${uniqueHexValues.size} unique). Add new colors to tokens.css instead.`);
}

const importantBlocks = [...styles.matchAll(/([^{}]+)\{([^{}]*!important[^{}]*)\}/g)]
  .map((match) => ({ selector: match[1].trim(), body: match[2] }));
const importantCount = matches(styles, /!important/g).length;
const approvedImportantBlock = ({ selector, body }) => {
  const normalizedSelector = selector.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  return normalizedSelector === '[hidden]'
    || normalizedSelector === '.sr-only'
    || (normalizedSelector.includes('*::before') && body.includes('animation-duration: 0.01ms !important'));
};
if (importantCount > legacyLimits.importantDeclarations || importantBlocks.some((block) => !approvedImportantBlock(block))) {
  failures.push('Only [hidden], .sr-only, and reduced-motion accessibility overrides may use !important.');
}

const valueChecks = [
  ['font-size', legacyLimits.fontSizeValues],
  ['border-radius', legacyLimits.borderRadiusValues],
  ['box-shadow', legacyLimits.boxShadowValues]
];
for (const [property, limit] of valueChecks) {
  const values = valuesFor(property);
  if (values.size > limit) {
    failures.push(`${property} introduced a new ungoverned value (${values.size}; limit ${limit}). Use a token or reduce the scale.`);
  }
}

for (const retiredComment of ['Living practice atlas', 'Final cascade', 'Dark-mode corrections that must win']) {
  if (styles.includes(retiredComment)) failures.push(`Retired pass-era section returned: ${retiredComment}.`);
}

if (failures.length) {
  process.stderr.write(`Style contract failed:\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Style contract passed: ${hexValues.length} legacy hex uses, ${importantCount} approved !important declarations; no new scale values.\n`
  );
}
