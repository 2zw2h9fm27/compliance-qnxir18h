import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

const ROOT = process.cwd();
const docsDir = path.join(ROOT, 'fern', 'docs', 'pages');
const docsYmlPath = path.join(ROOT, 'fern', 'docs.yml');

function getTitle(content: string, filename: string): string {
  const match = content.match(/^title:\s*["']?(.*?)["']?$/m);
  if (match) {
    return match[1].trim();
  }
  // Fallback to filename title-cased
  const name = path.basename(filename, path.extname(filename));
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
}

function generateNavigation() {
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));
  
  const entriesByLetter: Record<string, { page: string, path: string }[]> = {};

  for (const file of files) {
    const fullPath = path.join(docsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const title = getTitle(content, file);
    
    // Ignore some files if needed, e.g. index.mdx, this-page-intentionally-left-blank.mdx
    if (file === 'index.mdx' || file === 'components.mdx' || title.toLowerCase() === 'index' || title.toLowerCase() === 'components') {
      continue; 
    }

    // Determine the section letter
    let letter = title.charAt(0).toUpperCase();
    if (!/[A-Z]/.test(letter)) {
      letter = '#'; // Fallback for non-alphabetical
    }

    if (!entriesByLetter[letter]) {
      entriesByLetter[letter] = [];
    }

    entriesByLetter[letter].push({
      page: title,
      path: `docs/pages/${file}`
    });
  }

  // Sort each section's contents alphabetically by title
  for (const letter of Object.keys(entriesByLetter)) {
    entriesByLetter[letter].sort((a, b) => a.page.localeCompare(b.page));
  }

  // Create the layout array sorted by section letter
  const sortedLetters = Object.keys(entriesByLetter).sort();
  const layout = sortedLetters.map(letter => ({
    section: letter,
    collapsed: true,
    contents: entriesByLetter[letter]
  }));

  // Read existing docs.yml to preserve non-navigation settings
  let docStr = fs.readFileSync(docsYmlPath, 'utf8');
  
  // We use yaml.parseDocument to preserve comments (like the schema header)
  const doc = yaml.parseDocument(docStr);
  
  // Find navigation array.
  // Assuming navigation is an array with at least one item, and we want to update the layout of the first tab (Encyclopedia)
  const navNode = doc.get('navigation');
  if (navNode && yaml.isSeq(navNode) && navNode.items.length > 0) {
    const firstTab = navNode.items[0];
    if (yaml.isMap(firstTab)) {
      // Overwrite the layout property
      firstTab.set('layout', doc.createNode(layout));
    }
  } else {
    // If navigation doesn't exist or isn't formatted as expected, create it
    doc.set('navigation', doc.createNode([
      {
        tab: 'Encyclopedia',
        layout: layout
      }
    ]));
  }

  const newYamlStr = doc.toString();
  fs.writeFileSync(docsYmlPath, newYamlStr, 'utf8');
  console.log(`Successfully generated navigation for ${files.length} pages in docs.yml!`);
}

generateNavigation();
