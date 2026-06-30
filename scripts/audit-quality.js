const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'fern', 'docs', 'pages');
const ARCHIVE_DIR = path.join(__dirname, '..', 'data', 'mdx_archive');

const ISSUES = [];
const STATS = {
  total: 0,
  withIcons: 0,
  withCrossRef: 0,
  withSeeAlso: 0,
  withReferences: 0,
  withDataGrid: 0,
  withTabs: 0,
  withAccordion: 0,
  withCallout: 0,
  truncatedDesc: 0,
  missingSections: 0,
  brokenCrossRef: 0,
  brokenSeeAlso: 0,
  missingIconImport: 0
};

const ALL_SLUGS = new Set();

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function checkFile(file) {
  const filepath = path.join(PAGES_DIR, file);
  const content = fs.readFileSync(filepath, 'utf8');
  STATS.total++;
  
  const slug = file.replace(/\.mdx$/, '');
  ALL_SLUGS.add(slug);
  
  // Check for required sections
  const sections = [
    '## Definition & Etymology',
    '## Functional Modularity',
    '## Analytical Deep-Dive',
    '## Extended Knowledge Graph'
  ];
  
  const missingSections = sections.filter(s => !content.includes(s));
  if (missingSections.length > 0) {
    ISSUES.push({ file, severity: 'ERROR', message: `Missing sections: ${missingSections.join(', ')}` });
    STATS.missingSections++;
  }
  
  // Check for icon imports
  const hasIconImport = content.includes("from 'lucide-react'");
  if (!hasIconImport && !['index.mdx', 'glossary.mdx', 'figures.mdx', 'concepts.mdx', 'rhetoricians.mdx', 'movements.mdx', 'about.mdx'].includes(file)) {
    ISSUES.push({ file, severity: 'ERROR', message: 'Missing lucide-react icon import' });
    STATS.missingIconImport++;
  } else if (hasIconImport) {
    STATS.withIcons++;
  }
  
  // Check for component imports
  if (content.includes("from '@/components/botany-core'")) STATS.withCrossRef++;
  if (content.includes('<CrossRef')) STATS.withCrossRef++;
  if (content.includes('<SeeAlso')) STATS.withSeeAlso++;
  if (content.includes('<DataGrid')) STATS.withDataGrid++;
  if (content.includes('<Tabs')) STATS.withTabs++;
  if (content.includes('<Accordion')) STATS.withAccordion++;
  if (content.includes('<Callout')) STATS.withCallout++;
  if (content.includes('### References')) STATS.withReferences++;
  
  // Check description
  const descMatch = content.match(/^description:\s*"(.*)"$/m);
  if (descMatch) {
    const desc = descMatch[1];
    if (desc.endsWith('...') || desc.endsWith('–') || desc.endsWith('—') || desc.endsWith('-') || desc.endsWith('"') || desc.endsWith('“')) {
      ISSUES.push({ file, severity: 'WARN', message: `Truncated description: ${desc.slice(0, 60)}...` });
      STATS.truncatedDesc++;
    }
  }
  
  // Check SeeAlso links
  const seeAlsoMatches = content.match(/url: "([^"]+)"/g);
  if (seeAlsoMatches) {
    seeAlsoMatches.forEach(match => {
      const url = match.match(/"([^"]+)"/)[1];
      const targetSlug = url.replace('/terms/', '');
      const targetFile = targetSlug + '.mdx';
      if (!fs.existsSync(path.join(PAGES_DIR, targetFile))) {
        ISSUES.push({ file, severity: 'ERROR', message: `Broken SeeAlso link: ${url}` });
        STATS.brokenSeeAlso++;
      }
    });
  }
  
  // Check CrossRef IDs
  const crossRefMatches = content.match(/id="([^"]+)"/g);
  if (crossRefMatches) {
    crossRefMatches.forEach(match => {
      const id = match.match(/"([^"]+)"/)[1];
      if (!ALL_SLUGS.has(id) && !['index', 'glossary', 'figures', 'concepts', 'rhetoricians', 'movements'].includes(id)) {
        ISSUES.push({ file, severity: 'WARN', message: `CrossRef ID not found: ${id}` });
        STATS.brokenCrossRef++;
      }
    });
  }
  
  // Check for proper spacing classes
  if (!content.includes('max-w-4xl') || !content.includes('mx-auto')) {
    ISSUES.push({ file, severity: 'WARN', message: 'Missing container spacing classes' });
  }
  
  // Check for prose leading
  if (content.includes('prose prose-lg') && !content.includes('leading-relaxed')) {
    ISSUES.push({ file, severity: 'WARN', message: 'Missing leading-relaxed on prose sections' });
  }
}

function checkMasterIndex() {
  const filepath = path.join(PAGES_DIR, 'index.mdx');
  if (!fs.existsSync(filepath)) {
    ISSUES.push({ file: 'index.mdx', severity: 'ERROR', message: 'Master index missing' });
    return;
  }
  
  const content = fs.readFileSync(filepath, 'utf8');
  if (!content.includes('# Encyclopedia of Rhetoric')) {
    ISSUES.push({ file: 'index.mdx', severity: 'ERROR', message: 'Missing main heading' });
  }
  if (!content.includes('<XCard')) {
    ISSUES.push({ file: 'index.mdx', severity: 'ERROR', message: 'Missing XCard' });
  }
  if (!content.includes('SeeAlso')) {
    ISSUES.push({ file: 'index.mdx', severity: 'WARN', message: 'Missing SeeAlso sections' });
  }
}

function checkGlossary() {
  const filepath = path.join(PAGES_DIR, 'glossary.mdx');
  if (!fs.existsSync(filepath)) {
    ISSUES.push({ file: 'glossary.mdx', severity: 'ERROR', message: 'Glossary missing' });
    return;
  }
  
  const content = fs.readFileSync(filepath, 'utf8');
  const rows = content.split('\n').filter(l => l.startsWith('| **')).length;
  if (rows < 200) {
    ISSUES.push({ file: 'glossary.mdx', severity: 'WARN', message: `Only ${rows} glossary entries` });
  }
}

function checkCategoryPages() {
  const categories = ['figures.mdx', 'concepts.mdx', 'rhetoricians.mdx', 'movements.mdx'];
  categories.forEach(cat => {
    const filepath = path.join(PAGES_DIR, cat);
    if (!fs.existsSync(filepath)) {
      ISSUES.push({ file: cat, severity: 'ERROR', message: 'Category page missing' });
    }
  });
}

function checkStaleFiles() {
  const staleFiles = [
    'fern/docs/changelog/overview.mdx',
    'fern/docs/changelog/09-01-2025.mdx',
    'fern/docs/changelog/10-01-2025.mdx',
    'fern/docs/changelog/10-15-2025.mdx',
    'fern/docs/changelog/10-29-2025.mdx'
  ];
  
  staleFiles.forEach(f => {
    const fullPath = path.join(__dirname, '..', f);
    if (fs.existsSync(fullPath)) {
      ISSUES.push({ file: f, severity: 'WARN', message: 'Stale Plant Store API changelog file still present' });
    }
  });
}

function checkOrphanedPages() {
  const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.mdx'));
  const archives = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.mdx'));
  const archiveNames = new Set(archives);
  
  const intentionalOrphans = new Set([
    'about.mdx', 'index.mdx', 'glossary.mdx', 
    'figures.mdx', 'concepts.mdx', 'rhetoricians.mdx', 'movements.mdx',
    'components.mdx'
  ]);
  
  pages.forEach(page => {
    if (!archiveNames.has(page) && !intentionalOrphans.has(page)) {
      ISSUES.push({ file: page, severity: 'WARN', message: 'Orphaned page with no archive source' });
    }
  });
}

function main() {
  console.log('=== COMPREHENSIVE QUALITY AUDIT ===\n');
  
  // First pass: collect all slugs
  const allFiles = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.mdx'));
  allFiles.forEach(f => ALL_SLUGS.add(f.replace(/\.mdx$/, '')));
  
  // Check each entry
  allFiles.forEach(file => {
    if (['index.mdx', 'glossary.mdx', 'figures.mdx', 'concepts.mdx', 'rhetoricians.mdx', 'movements.mdx', 'about.mdx'].includes(file)) return;
    checkFile(file);
  });
  
  // Check structural pages
  checkMasterIndex();
  checkGlossary();
  checkCategoryPages();
  
  // Check for stale files
  checkStaleFiles();
  
  // Check for orphaned pages
  checkOrphanedPages();
  
  // Report
  console.log('--- STATISTICS ---');
  console.log(`Total entries: ${STATS.total}`);
  console.log(`With icons: ${STATS.withIcons}`);
  console.log(`With CrossRef: ${STATS.withCrossRef}`);
  console.log(`With SeeAlso: ${STATS.withSeeAlso}`);
  console.log(`With DataGrid: ${STATS.withDataGrid}`);
  console.log(`With Tabs: ${STATS.withTabs}`);
  console.log(`With Accordion: ${STATS.withAccordion}`);
  console.log(`With Callout: ${STATS.withCallout}`);
  console.log(`With References: ${STATS.withReferences}`);
  console.log('');
  console.log('--- ISSUES ---');
  
  const errors = ISSUES.filter(i => i.severity === 'ERROR');
  const warnings = ISSUES.filter(i => i.severity === 'WARN');
  
  console.log(`ERRORS: ${errors.length}`);
  errors.forEach(e => console.log(`  [${e.file}] ${e.message}`));
  
  console.log(`\nWARNINGS: ${warnings.length}`);
  warnings.forEach(w => console.log(`  [${w.file}] ${w.message}`));
  
  console.log('\n--- SUMMARY ---');
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ ADAMANTINE: Zero defects. All entries are clean, structured, and fully linked.');
  } else {
    console.log(`✗ ${errors.length} errors, ${warnings.length} warnings require attention.`);
  }
}

main();
