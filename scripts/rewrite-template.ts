import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARCHIVE_DIR = path.join(__dirname, '..', 'data', 'mdx_archive');
const PAGES_DIR = path.join(__dirname, '..', 'fern', 'docs', 'pages');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function splitFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

function fixHyphenation(text) {
  return text
    .replace(/([a-zA-Z])-\n\s*([a-zA-Z])/g, '$1$2')
    .replace(/([a-zA-Z])-\r\n\s*([a-zA-Z])/g, '$1$2');
}

function fixFrontmatterDescription(fm, body) {
  const descMatch = fm.match(/^description:\s*"(.*)"$/m);
  if (!descMatch) return fm;
  
  let desc = descMatch[1];
  const firstLine = body.split('\n')[0].trim();
  
  if (desc.endsWith('...') || desc.endsWith('–') || desc.endsWith('—') || desc.endsWith('-')) {
    const completed = firstLine.replace(/^["""]+|["""]+$/g, '').trim();
    const newDesc = desc + ' ' + completed;
    return fm.replace(/^description:\s*".*"$/m, `description: "${newDesc}"`);
  }
  return fm;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function detectType(title, body) {
  const lower = body.toLowerCase();
  if (lower.includes('born in') && lower.includes('died in')) return 'rhetorician';
  if (lower.includes('movement') || lower.includes('school') || lower.includes('studies')) return 'movement';
  if (lower.includes('repetition') || lower.includes('scheme') || lower.includes('trope')) return 'figure';
  if (lower.includes('the repetition of') || lower.includes('the use of') || lower.includes('a figure of speech')) return 'figure';
  return 'concept';
}

function extractBibliography(body) {
  const bibMatch = body.match(/<BibliographyCard>([\s\S]*?)<\/BibliographyCard>/);
  if (!bibMatch) return [];
  return bibMatch[1].split('\n').filter(line => line.trim().length > 0);
}

function extractRelatedTerms(title) {
  const terms = [];
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('anaphora')) {
    terms.push('Epistrophe', 'Symploce', 'Antanaclasis', 'Anadiplosis', 'Antimetabole', 'Asyndeton', 'Polysyndeton');
  } else if (lowerTitle.includes('antimetabole')) {
    terms.push('Anaphora', 'Antanaclasis', 'Chiasmus', 'Symploce', 'Epistrophe');
  } else if (lowerTitle.includes('epistrophe')) {
    terms.push('Anaphora', 'Symploce', 'Antimetabole', 'Epizeuxis');
  } else if (lowerTitle.includes('chiasmus')) {
    terms.push('Antimetabole', 'Anaphora', 'Symploce');
  } else if (lowerTitle.includes('asyndeton')) {
    terms.push('Polysyndeton', 'Anaphora', 'Ellipsis');
  } else if (lowerTitle.includes('polysyndeton')) {
    terms.push('Asyndeton', 'Anaphora', 'Epistrophe');
  } else if (lowerTitle.includes('metonymy')) {
    terms.push('Synecdoche', 'Metalepsis', 'Metaphor', 'Personification');
  } else if (lowerTitle.includes('synecdoche')) {
    terms.push('Metonymy', 'Metalepsis', 'Metaphor');
  } else if (lowerTitle.includes('metaphor')) {
    terms.push('Simile', 'Metonymy', 'Personification', 'Synecdoche');
  } else {
    terms.push('Rhetoric', 'Figures of Speech', 'Classical Rhetoric');
  }
  
  return terms.slice(0, 4).map(t => ({
    label: t,
    url: `/terms/${slugify(t)}`
  }));
}

function generateDataGrid(title, type, body) {
  const rows = [];
  
  if (type === 'figure') {
    rows.push({ col1: 'Classification', col2: 'Scheme or Trope' });
    rows.push({ col1: 'Traditional Domain', col2: 'Classical and Renaissance Rhetoric' });
    rows.push({ col1: 'Modern Relevance', col2: 'Discourse Analysis, Stylistics, Critical Discourse Studies' });
    rows.push({ col1: 'Function', col2: 'Emphasis, Rhythm, Persuasion, Meaning Construction' });
  } else if (type === 'concept') {
    rows.push({ col1: 'Domain', col2: 'Rhetorical Theory' });
    rows.push({ col1: 'Historical Span', col2: 'Classical Antiquity to Present' });
    rows.push({ col1: 'Application', col2: 'Composition, Speech, Literary Analysis, Pedagogy' });
    rows.push({ col1: 'Key Tradition', col2: 'Greek, Roman, and Modern Rhetorical Theory' });
  } else if (type === 'rhetorician') {
    const bornMatch = body.match(/born in (\d+[^.]*)/i);
    const diedMatch = body.match(/died in (\d+[^.]*)/i);
    rows.push({ col1: 'Lifespan', col2: `${bornMatch ? bornMatch[1] : 'Unknown'} – ${diedMatch ? diedMatch[1] : 'Unknown'}` });
    rows.push({ col1: 'Primary Field', col2: 'Rhetoric, Philosophy, Oratory' });
    rows.push({ col1: 'Key Contribution', col2: 'Systematization of Rhetorical Precepts' });
    rows.push({ col1: 'Historical Period', col2: 'Classical Antiquity' });
  } else if (type === 'movement') {
    rows.push({ col1: 'Origin', col2: 'Historical and Cultural Context' });
    rows.push({ col1: 'Scope', col2: 'Rhetorical Practice and Theory' });
    rows.push({ col1: 'Key Figures', col2: 'Various Theorists and Practitioners' });
    rows.push({ col1: 'Influence', col2: 'Contemporary Rhetorical Studies' });
  }
  
  return rows;
}

function generateTabs(title, type, body) {
  if (type === 'figure') {
    return [
      { title: 'Definition & Function', content: `In rhetoric, **${title}** functions as a deliberate stylistic choice designed to produce specific rhetorical effects. Classical rhetoricians catalogued such devices as essential tools for persuasive composition, emphasizing their capacity to create emphasis, rhythm, and memorable impact in both speech and writing.` },
      { title: 'Historical Application', content: `From the Greek orators through the Roman tradition and into modern literary criticism, **${title}** has been analyzed as a mechanism for shaping audience response. Biblical exegesis, parliamentary oratory, and literary stylistics have all drawn on the formal properties of this device.` },
      { title: 'Critical Perspectives', content: `Contemporary critical discourse analysis examines how **${title}** operates not merely as ornament but as a means of enacting power. The formal repetition encoded in the device can naturalize ideological positions, construct authority, and organize social relations through textual practice.` }
    ];
  } else if (type === 'concept') {
    return [
      { title: 'Definition', content: `**${title}** constitutes a fundamental concept in rhetorical theory, referring to the structured organization and deployment of persuasive means. Its meaning has evolved from classical codifications to encompass both technical procedures and philosophical principles.` },
      { title: 'Historical Development', content: `The Roman rhetoricians devoted extensive discussion to **${title}**, systematizing it into rules and catalogues designed to guide the practitioner. From *ad Herennium* and *De Inventione* through the medieval ars dictaminis, the concept retained its central role in rhetorical education.` },
      { title: 'Contemporary Relevance', content: `Modern rhetorical theory and composition studies continue to engage **${title}** as both a descriptive category and a normative framework. Its principles inform speechwriting, legal argument, and the analysis of persuasive texts across media.` }
    ];
  } else if (type === 'rhetorician') {
    return [
      { title: 'Biography', content: `The life of **${title}** unfolded against a backdrop of political and intellectual ferment. Born into circumstances that connected him to centers of power and learning, he pursued education and political engagement in ways that shaped the development of rhetorical theory for centuries.` },
      { title: 'Major Works', content: `The surviving corpus of **${title}** includes systematic treatises that codified rhetorical precepts, dialogues that engaged contemporary philosophical debates, and practical handbooks designed for the education of statesmen and orators.` },
      { title: 'Legacy', content: `The influence of **${title}** permeates two millennia of rhetorical instruction and practice. His systematic approach to the parts of speech, the topics of invention, and the ethics of persuasion established frameworks that continue to define the discipline.` }
    ];
  } else if (type === 'movement') {
    return [
      { title: 'Overview', content: `**${title}** represents a significant current within rhetorical studies, encompassing both a set of critical practices and a body of theoretical reflection on the role of rhetoric in society.` },
      { title: 'Key Figures & Texts', content: `The development of **${title}** has been shaped by the work of numerous scholars who have expanded the boundaries of rhetorical inquiry to address issues of identity, power, and social justice.` },
      { title: 'Methodology', content: `Practitioners of **${title}** employ methods drawn from literary criticism, cultural studies, and social theory to analyze how rhetorical forms mediate social relations and construct meaning.` }
    ];
  }
  
  return [
    { title: 'Overview', content: body.split('\n\n')[0] || `An entry on **${title}** from the Encyclopedia of Rhetoric.` },
    { title: 'Analysis', content: body.split('\n\n').slice(1).join('\n\n') || 'Further analysis pending.' }
  ];
}

function generateAccordion(title, type, body) {
  if (type === 'figure') {
    return `While **${title}** is traditionally classified as a specific scheme of repetition, its application across genres and media reveals a more complex set of functions. The device operates simultaneously as a marker of textual coherence, a vehicle for emotional intensification, and a means of establishing ideological alignment between speaker and audience.`;
  } else if (type === 'concept') {
    return `The concept of **${title}** has been subject to ongoing reinterpretation as rhetorical theory has engaged with neighboring disciplines. From its origins in classical pedagogy through its elaboration in medieval and Renaissance rhetoric, the term has accumulated layers of meaning that sometimes conflict and sometimes complement one another.`;
  } else if (type === 'rhetorician') {
    return `The historical record concerning **${title}** is fragmentary and subject to interpretive reconstruction. Ancient biographical traditions, combined with analysis of the surviving corpus, provide the primary evidence for understanding his life, intellectual development, and influence on subsequent rhetorical thought.`;
  } else if (type === 'movement') {
    return `The emergence and development of **${title}** can be traced through a complex interplay of institutional, political, and intellectual forces. Its history reflects broader shifts in the understanding of rhetoric's scope and purpose within the academy and the public sphere.`;
  }
  return body.split('\n\n').slice(0, 2).join('\n\n');
}

function generateCallout(title, type) {
  if (type === 'figure') {
    return {
      title: 'Terminological Precision',
      content: `Ensure that references to **${title}** distinguish between the rhetorical device and any cognate terms in linguistics or discourse analysis. The rhetorical sense denotes a specific formal pattern; broader linguistic uses may refer to referential phenomena with different structural properties.`
    };
  } else if (type === 'concept') {
    return {
      title: 'Conceptual Scope',
      content: `The term **${title}** has been used with varying degrees of specificity across rhetorical traditions. Consult primary sources and authoritative secondary literature to determine which definitional framework applies in a given context.`
    };
  }
  return {
    title: 'Editorial Note',
    content: `This entry on **${title}** has been formatted from archival sources. Verify citations against primary texts where possible.`
  };
}

function buildTemplate(title, description, type, body, bibliography) {
  const cleanBody = fixHyphenation(body)
    .replace(/<BibliographyCard>[\s\S]*?<\/BibliographyCard>/g, '')
    .trim();
  
  const paragraphs = cleanBody.split('\n\n').filter(p => p.trim().length > 0);
  const introParagraphs = paragraphs.slice(0, 2).join('\n\n');
  
  const dataGrid = generateDataGrid(title, type, cleanBody);
  const tabs = generateTabs(title, type, cleanBody);
  const accordionContent = generateAccordion(title, type, cleanBody);
  const callout = generateCallout(title, type);
  const relatedTerms = extractRelatedTerms(title);
  
  const date = new Date().toISOString();
  const slug = slugify(title);
  
  let template = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
date: ${date}
status: "Published"
---

import { 
  Callout, 
  Tooltip, 
  CrossRef, 
  XCard, 
  Tabs, 
  Accordion, 
  SeeAlso,
  DataGrid,
  ImageFeature
} from '@/components/botany-core';

# ${title}

<XCard 
  variant="featured"
  title="${title}" 
  metaData={[
    { label: "Classification", value: "${type === 'figure' ? 'Scheme of Repetition' : type === 'rhetorician' ? 'Historical Figure' : type === 'movement' ? 'Intellectual Movement' : 'Rhetorical Concept'}" },
    { label: "Period", value: "Classical to Contemporary" },
    { label: "Source", value: "Encyclopedia of Rhetoric" }
  ]} 
/>

## Definition & Etymology
${introParagraphs}

<DataGrid 
  columns={['Dimension', 'Scope']}
  data={[
${dataGrid.map(row => `    { col1: '${row.col1.replace(/'/g, "\\'")}', col2: '${row.col2.replace(/'/g, "\\'")}' }`).join(',\n')}
  ]}
/>

## Functional Modularity
<Tabs>
`;
  
  tabs.forEach(tab => {
    template += `  <Tabs.Item title="${tab.title.replace(/"/g, '\\"')}">
    ${tab.content}
  </Tabs.Item>
`;
  });
  
  template += `</Tabs>

---

## Analytical Deep-Dive
<Accordion title="Scholarly Analysis">
  <CrossRef id="${slug}" label="${title}" />
  ${accordionContent}
</Accordion>

<Callout variant="warning" title="${callout.title.replace(/"/g, '\\"')}">
  ${callout.content}
</Callout>

## Extended Knowledge Graph
<SeeAlso 
  items={[
${relatedTerms.map(t => `    { label: "${t.label}", url: "${t.url}" },`).join('\n')}
  ]} 
/>

---

`;
  
  if (bibliography.length > 0) {
    template += `### Scholarly References\n| Author | Work | Publication |\n :--- | :--- | :--- |\n`;
    bibliography.forEach(bib => {
      const cleaned = bib.trim().replace(/\|/g, '\\|');
      template += `| ${cleaned} | | |\n`;
    });
    template += '\n';
  }
  
  return template;
}

function processFiles() {
  ensureDir(PAGES_DIR);
  
  const files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.mdx'));
  
  for (const file of files) {
    const srcPath = path.join(ARCHIVE_DIR, file);
    const destPath = path.join(PAGES_DIR, file);
    
    let content = fs.readFileSync(srcPath, 'utf8');
    
    const parsed = splitFrontmatter(content);
    if (!parsed) {
      console.log(`Skipping ${file}: no valid frontmatter`);
      continue;
    }
    
    const { frontmatter, body } = parsed;
    
    let description = '';
    const descMatch = frontmatter.match(/^description:\s*"(.*)"$/m);
    if (descMatch) {
      description = descMatch[1];
    }
    
    if (!description || description.length < 20) {
      const firstLine = body.split('\n')[0].trim().replace(/^["""]+|["""]+$/g, '');
      description = firstLine || titleFromFilename(file);
    }
    
    const titleMatch = frontmatter.match(/^title:\s*"(.*)"$/m);
    const title = titleMatch ? titleMatch[1] : titleFromFilename(file);
    
    const cleanBody = fixHyphenation(body)
      .replace(/<BibliographyCard>[\s\S]*?<\/BibliographyCard>/g, '')
      .trim();
    
    const type = detectType(title, cleanBody);
    const bibliography = extractBibliography(body);
    
    const template = buildTemplate(title, description, type, cleanBody, bibliography);
    
    fs.writeFileSync(destPath, template);
    console.log(`Processed: ${file}`);
  }
}

function titleFromFilename(filename) {
  return filename
    .replace(/\.mdx$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

processFiles();
console.log('Done processing archive files.');
