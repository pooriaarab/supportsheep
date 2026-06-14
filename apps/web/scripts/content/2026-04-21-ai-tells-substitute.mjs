// AI-writing de-tell pass — scripted substitutions over 436 prod articles
// Idempotent via article.aiTellsPassAt stamp
import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { parse, serialize } from 'parse5';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.startsWith('FIREBASE_ADMIN'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]; })
);

if (env.FIREBASE_ADMIN_PROJECT_ID !== 'pooriaarab-blogbat') {
  console.error('Refusing to run — FIREBASE_ADMIN_PROJECT_ID must be pooriaarab-blogbat');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === '1';
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'REAL WRITE'}  ·  Project: ${env.FIREBASE_ADMIN_PROJECT_ID}`);

// Substitution rules. Word-boundary regex; preserve casing via helper.
function preserveCase(match, replacement) {
  if (!replacement) return replacement;
  if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const rules = [
  // Simple word substitutions. Careful with word boundaries, skip in context-sensitive ones.
  { re: /\bseamlessly\b/gi, to: 'smoothly' },
  { re: /\bseamless (integration|experience|transition|process)\b/gi, to: '$1' },
  { re: /\bcomprehensive\b/gi, to: 'complete' },
  { re: /\brobust\b/gi, to: 'reliable' },
  { re: /\bstreamlined\b/gi, to: 'simpler' },
  { re: /\bstreamline\b/gi, to: 'simplify' },
  { re: /\bleveraging\b/gi, to: 'using' },
  { re: /\bleverage\b/gi, to: 'use' },
  { re: /\bdelving into\b/gi, to: 'exploring' },
  { re: /\bdelve into\b/gi, to: 'explore' },
  { re: /\bdelves into\b/gi, to: 'explores' },
  { re: /\b(digital|SEO|marketing|business|online) landscape\b/gi, to: '$1 field' },
  { re: /\bfoster (growth|relationships|engagement|trust|loyalty)\b/gi, to: 'build $1' },
  // Phrase deletions
  { re: /\bin today's (world|digital age|landscape|market|economy),?\s*/gi, to: '' },
  { re: /\bat the end of the day,?\s*/gi, to: '' },
  { re: /\bIt's important to\s+(note that\s+)?/gi, to: '' },
  { re: /\bit's important to\s+(note that\s+)?/g, to: '' },
  { re: /\bin order to\b/gi, to: 'to' },
  // Navigate: skip if near nav words
  { re: /\bnavigating\s+(the\s+)?(?!menu|navigation|website|site|page|map|app|interface|dashboard|tab)(complexities|challenges|landscape|world|process|journey)\b/gi,
    to: 'handling $1$2' },
];

function applyCasedRule(text, re, to) {
  return text.replace(re, (...args) => {
    const match = args[0];
    // Replace with preserved-case if replacement is a word (not a group-ref template)
    if (!to.includes('$')) return preserveCase(match, to);
    // For group-ref replacements, use standard String.replace behavior
    const groups = args.slice(1, -2);
    let result = to;
    groups.forEach((g, i) => { result = result.replace(new RegExp('\\$' + (i + 1), 'g'), g ?? ''); });
    return result;
  });
}

// HTML-aware walker: operate on text nodes only, skip pre/code/blockquote.
const SKIP_TAGS = new Set(['pre', 'code', 'blockquote', 'script', 'style']);

function walk(node, counts, inSkip = false) {
  if (!node) return '';
  if (node.nodeName === '#text') {
    if (inSkip) return node.value;
    let text = node.value;
    for (const r of rules) {
      const before = text;
      text = applyCasedRule(text, r.re, r.to);
      if (text !== before) {
        const matches = before.match(r.re);
        if (matches) counts[r.re.source] = (counts[r.re.source] || 0) + matches.length;
      }
    }
    node.value = text;
    return text;
  }
  const skipHere = inSkip || SKIP_TAGS.has(node.nodeName);
  if (node.childNodes) {
    for (const child of node.childNodes) walk(child, counts, skipHere);
  }
  return '';
}

async function run() {
  const snap = await db.collection('articles').where('blogId', '==', 'default').get();
  console.log(`Scanned ${snap.size} articles`);
  const globalCounts = {};
  let processed = 0, modified = 0, skipped = 0, flagged = 0;
  const samples = [];
  const batches = [];
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.aiTellsPassAt) { skipped++; continue; }
    if (typeof data.body !== 'string' || data.body.length === 0) { skipped++; continue; }
    const counts = {};
    const dom = parse(data.body, { sourceCodeLocationInfo: false });
    walk(dom, counts);
    const newBody = serialize(dom);
    const totalChanges = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalChanges === 0) { skipped++; continue; }
    if (totalChanges > 40) { flagged++; skipped++; console.warn(`  ⚠️  ${doc.id}: ${totalChanges} changes — flagged, skipped`); continue; }
    modified++;
    for (const [k, v] of Object.entries(counts)) globalCounts[k] = (globalCounts[k] || 0) + v;
    if (samples.length < 5) {
      const re = /(seamless|comprehensive|robust|streamline|leverage)\w{0,5}/i;
      const m = data.body.match(re);
      if (m) {
        const idx = m.index;
        const before = data.body.slice(Math.max(0, idx - 50), idx + m[0].length + 50);
        // Find equivalent in newBody
        const afterIdx = newBody.toLowerCase().search(re);
        const after = afterIdx >= 0 ? newBody.slice(Math.max(0, afterIdx - 50), afterIdx + 60) : newBody.slice(Math.max(0, idx - 50), idx + 60);
        samples.push({ id: doc.id, title: data.title?.slice(0, 60), before, after });
      }
    }
    if (!DRY_RUN) {
      batch.update(doc.ref, { body: newBody, updatedAt: new Date().toISOString(), aiTellsPassAt: new Date().toISOString() });
      batchCount++;
      if (batchCount >= 400) { batches.push(batch.commit()); batch = db.batch(); batchCount = 0; }
    }
    processed++;
    if (processed % 50 === 0) console.log(`  processed ${processed}...`);
  }
  if (!DRY_RUN && batchCount > 0) batches.push(batch.commit());
  if (batches.length > 0) await Promise.all(batches);

  console.log(`\n=== Summary ===`);
  console.log(`Scanned:  ${snap.size}`);
  console.log(`Modified: ${modified}`);
  console.log(`Skipped (no changes or already stamped): ${skipped}`);
  console.log(`Flagged (>40 changes): ${flagged}`);
  console.log(`\nTop rule hits:`);
  Object.entries(globalCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${v.toString().padStart(5)}  /${k}/`));
  console.log(`\n=== Sample diffs ===`);
  samples.forEach(s => {
    console.log(`\n[${s.id}] ${s.title}`);
    console.log(`  BEFORE: ...${s.before.replace(/\s+/g, ' ')}...`);
    console.log(`  AFTER:  ...${s.after.replace(/\s+/g, ' ')}...`);
  });
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
