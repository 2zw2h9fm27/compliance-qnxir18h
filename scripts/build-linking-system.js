const fs = require('fs');
const path = require('path');

const ARCHIVE_DIR = path.join(__dirname, '..', 'data', 'mdx_archive');
const PAGES_DIR = path.join(__dirname, '..', 'fern', 'docs', 'pages');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function splitFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function fixHyphenation(text) {
  return text
    .replace(/([a-zA-Z])-\n\s*([a-zA-Z])/g, '$1$2')
    .replace(/([a-zA-Z])-\r\n\s*([a-zA-Z])/g, '$1$2');
}

function fixSpacing(text) {
  let result = text;
  const matches = text.match(/([a-zA-Z])\s+([a-zA-Z])/g) || [];
  matches.forEach(match => {
    const parts = match.split(/\s+/);
    if (parts[0].length === 1 && parts[1].length === 1) return;
    if (/^(and|or|the|a|an|in|on|at|to|for|of|with|by|is|it|as|be|he|we|she|you|they|my|your|his|her|its|our|their|this|that|these|those|am|are|was|were|has|have|had|do|does|did|will|would|could|should|may|might|must|can|shall|not|no|but|if|then|else|when|where|why|how|all|any|each|every|both|few|more|most|other|some|such|than|too|very|just|still|already|yet|also|even|only|own|same|so|up|out|down|off|over|under|again|once|here|there|now|then|today|tomorrow|yesterday)$/i.test(parts[1])) return;
    if (/^[A-Z]$/.test(parts[1])) return;
    if (/^[a-z]$/.test(parts[0]) && /^[a-z]$/.test(parts[1])) {
      result = result.replace(match, parts[0] + parts[1]);
    }
  });
  return result
    .replace(/([,;:!?])([A-Za-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/servesto/g, 'serves to')
    .replace(/belocated/g, 'be located')
    .replace(/\bmadefor\b/g, 'made for')
    .replace(/\bAsthese\b/g, 'As these')
    .replace(/\btheclichés\b/g, 'the clichés')
    .replace(/\bthisapproach\b/g, 'this approach')
    .replace(/\briajor\b/g, 'major')
    .replace(/\bsnailpac'd\b/g, "snail-paced")
    .replace(/\blearn'd\b/g, 'learned')
    .replace(/\bfearful commenting\b/g, 'fearful commenting')
    .replace(/\bleaden servitor\b/g, 'leaden servitor')
    .replace(/\bimpotent and snailpac'd beggary\b/g, 'impotent and snail-paced beggary')
    .replace(/\bfiery expedition\b/g, 'fiery expedition');
}

function cleanTitle(title) {
  return title
    .replace(/;/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromFilename(filename) {
  let title = filename
    .replace(/\.mdx$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  return cleanTitle(title);
}

function isRhetoricianFilename(filename) {
  const base = filename.replace(/\.mdx$/, '');
  return /\d{4}[-–]\d{4}/.test(base) || 
         /\d{4}[-–]\d{3,4}/.test(base) || 
         /[,-]\d{4}$/.test(base) ||
         /\b[bcd]\.?\s*\d{3,4}/i.test(base) ||
         /\d{3,4}\s*[–-]\s*\d{3,4}/.test(base);
}

function detectType(title, body, filename) {
  if (isRhetoricianFilename(filename)) return 'rhetorician';
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

function buildTerminologyRegistry() {
  const registry = {};
  const files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.mdx'));
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(ARCHIVE_DIR, file), 'utf8');
    const parsed = splitFrontmatter(content);
    if (!parsed) return;
    
    const titleMatch = parsed.frontmatter.match(/^title:\s*"(.*)"$/m);
    const title = titleMatch ? cleanTitle(titleMatch[1]) : titleFromFilename(file);
    const fileSlug = file.replace(/\.mdx$/, '');
    const type = detectType(title, parsed.body, file);
    
    registry[title.toLowerCase()] = {
      title,
      slug: fileSlug,
      type,
      filename: file,
      aliases: generateAliases(title, file)
    };
  });
  
  return registry;
}

function generateAliases(title, filename) {
  const aliases = [];
  const base = filename.replace(/\.mdx$/, '').replace(/-/g, ' ');
  
  if (title.includes('(') || title.includes(',')) {
    const shortName = title.split(/[,(]/)[0].trim();
    if (shortName !== title) aliases.push(shortName);
  }
  
  if (base !== title.toLowerCase()) {
    aliases.push(base);
  }
  
  return aliases;
}

function findCrossReferences(body, registry) {
  const references = [];
  const lowerBody = body.toLowerCase();
  
  Object.keys(registry).forEach(term => {
    if (term === '') return;
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerBody.match(regex);
    if (matches && matches.length > 0) {
      references.push({
        term: registry[term].title,
        slug: registry[term].slug,
        type: registry[term].type,
        count: matches.length
      });
    }
  });
  
  return references.sort((a, b) => b.count - a.count).slice(0, 8);
}

function extractRelatedTerms(title, type, registry) {
  const terms = [];
  const lowerTitle = title.toLowerCase();
  
  if (type === 'rhetorician') {
    if (lowerTitle.includes('aristotle')) terms.push('Plato', 'Cicero', 'Rhetoric', 'Stasis Theory', 'Inventio');
    else if (lowerTitle.includes('cicero')) terms.push('Aristotle', 'Quintilian', 'Rhetoric', 'Inventio', 'Arrangement');
    else if (lowerTitle.includes('quintilian')) terms.push('Cicero', 'Aristotle', 'Progymnasmata', 'Rhetoric', 'Inventio');
    else if (lowerTitle.includes('plato')) terms.push('Aristotle', 'Socrates', 'Rhetoric', 'Dialectic');
    else if (lowerTitle.includes('kennedy')) terms.push('Aristotle', 'Cicero', 'Rhetoric', 'Classical Rhetoric');
    else terms.push('Rhetoric', 'Classical Rhetoric', 'Figures of Speech', 'Rhetorician');
  } else if (lowerTitle.includes('anaphora')) {
    terms.push('Epistrophe', 'Symploce', 'Antanaclasis', 'Anadiplosis', 'Antimetabole', 'Asyndeton', 'Polysyndeton');
  } else if (lowerTitle.includes('antimetabole')) {
    terms.push('Anaphora', 'Antanaclasis', 'Chiasmus', 'Symploce', 'Epistrophe');
  } else if (lowerTitle.includes('epistrophe')) {
    terms.push('Anaphora', 'Symploce', 'Antimetabole', 'Epizeuxis');
  } else if (lowerTitle.includes('chiasmus')) {
    terms.push('Antimetabole', 'Anaphora', 'Symploce', 'Antithesis');
  } else if (lowerTitle.includes('asyndeton')) {
    terms.push('Polysyndeton', 'Anaphora', 'Ellipsis', 'Aposiopesis');
  } else if (lowerTitle.includes('polysyndeton')) {
    terms.push('Asyndeton', 'Anaphora', 'Epistrophe');
  } else if (lowerTitle.includes('metonymy')) {
    terms.push('Synecdoche', 'Metalepsis', 'Metaphor', 'Personification');
  } else if (lowerTitle.includes('synecdoche')) {
    terms.push('Metonymy', 'Metalepsis', 'Metaphor');
  } else if (lowerTitle.includes('metaphor')) {
    terms.push('Simile', 'Metonymy', 'Personification', 'Synecdoche');
  } else if (lowerTitle.includes('ethos')) {
    terms.push('Logos', 'Pathos', 'Kairos', 'Inventio', 'Proof');
  } else if (lowerTitle.includes('logos')) {
    terms.push('Ethos', 'Pathos', 'Kairos', 'Enthymeme', 'Syllogism');
  } else if (lowerTitle.includes('pathos')) {
    terms.push('Ethos', 'Logos', 'Kairos', 'Appeal');
  } else if (lowerTitle.includes('kairos')) {
    terms.push('Ethos', 'Logos', 'Pathos', 'Inventio');
  } else if (lowerTitle.includes('enthymeme')) {
    terms.push('Logos', 'Syllogism', 'Proof', 'Inventio');
  } else if (lowerTitle.includes('invention') || lowerTitle.includes('inventio')) {
    terms.push('Stasis Theory', 'Topics', 'Ethos', 'Logos', 'Pathos');
  } else if (lowerTitle.includes('arrangement')) {
    terms.push('Exordium', 'Narratio', 'Confirmatio', 'Peroratio', 'Divisio');
  } else if (lowerTitle.includes('style')) {
    terms.push('Figures of Speech', 'Tropes', 'Diction', 'Amplification');
  } else if (lowerTitle.includes('memory')) {
    terms.push('Inventio', 'Delivery', 'Actio');
  } else if (lowerTitle.includes('delivery') || lowerTitle.includes('actio')) {
    terms.push('Memory', 'Style', 'Arrangement');
  } else {
    terms.push('Rhetoric', 'Figures of Speech', 'Classical Rhetoric', 'Composition Studies');
  }
  
  const validTerms = terms.filter(t => {
    const slug = slugify(t);
    return registry[t.toLowerCase()] || Object.values(registry).some(r => r.slug === slug);
  });
  
  const fallbackTerms = ['Rhetoric', 'Figures of Speech', 'Classical Rhetoric', 'Composition Studies'];
  const finalTerms = validTerms.length >= 2 ? validTerms : fallbackTerms.filter(t => {
    const slug = slugify(t);
    return registry[t.toLowerCase()] || Object.values(registry).some(r => r.slug === slug);
  });
  
  return finalTerms.slice(0, 4).map(t => {
    const slug = slugify(t);
    const entry = registry[t.toLowerCase()] || Object.values(registry).find(r => r.slug === slug);
    return {
      label: t,
      url: `/terms/${entry ? entry.slug : slug}`
    };
  });
}

function generateDataGrid(title, type, body, filename) {
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
    const nameOnly = title.replace(/[\d\s\-–]+$/, '').trim();
    rows.push({ col1: 'Name', col2: nameOnly });
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

function fixDescription(description, body) {
  if (!description || description.length < 20) {
    const firstLine = body.split('\n')[0].trim().replace(/^["""]+|["""]+$/g, '');
    return firstLine || description;
  }
  
  const trimmed = description.trim();
  const firstLine = body.split('\n')[0].trim().replace(/^["""]+|["""]+$/g, '').trim();
  const firstPara = body.split('\n\n')[0].trim().replace(/^["""]+|["""]+$/g, '').trim().replace(/\n/g, ' ');
  
  const endsMidWord = /[a-zA-Z]'$/.test(trimmed) || 
                      /[a-z]$/.test(trimmed) ||
                      trimmed.endsWith('to') ||
                      trimmed.endsWith('of') ||
                      trimmed.endsWith('the') ||
                      trimmed.endsWith('and') ||
                      trimmed.endsWith('in') ||
                      trimmed.endsWith('for') ||
                      trimmed.endsWith('with') ||
                      trimmed.endsWith('as') ||
                      trimmed.endsWith('by') ||
                      trimmed.endsWith('is') ||
                      trimmed.endsWith('on') ||
                      trimmed.endsWith('at') ||
                      trimmed.endsWith('from') ||
                      trimmed.endsWith('that') ||
                      trimmed.endsWith('this') ||
                      trimmed.endsWith('have') ||
                      trimmed.endsWith('been') ||
                      trimmed.endsWith('were') ||
                      trimmed.endsWith('their') ||
                      trimmed.endsWith('which') ||
                      trimmed.endsWith('not') ||
                      trimmed.endsWith('but') ||
                      trimmed.endsWith('all') ||
                      trimmed.endsWith('more') ||
                      trimmed.endsWith('some') ||
                      trimmed.endsWith('into') ||
                      trimmed.endsWith('over') ||
                      trimmed.endsWith('under') ||
                      trimmed.endsWith('when') ||
                      trimmed.endsWith('where') ||
                      trimmed.endsWith('how') ||
                      trimmed.endsWith('what') ||
                      trimmed.endsWith('who') ||
                      trimmed.endsWith('why') ||
                      trimmed.endsWith('may') ||
                      trimmed.endsWith('can') ||
                      trimmed.endsWith('will') ||
                      trimmed.endsWith('has') ||
                      trimmed.endsWith('had') ||
                      trimmed.endsWith('does') ||
                      trimmed.endsWith('did') ||
                      trimmed.endsWith('such') ||
                      trimmed.endsWith('each') ||
                      trimmed.endsWith('every') ||
                      trimmed.endsWith('both') ||
                      trimmed.endsWith('few') ||
                      trimmed.endsWith('most') ||
                      trimmed.endsWith('other') ||
                      trimmed.endsWith('than') ||
                      trimmed.endsWith('too') ||
                      trimmed.endsWith('very') ||
                      trimmed.endsWith('just') ||
                      trimmed.endsWith('still') ||
                      trimmed.endsWith('already') ||
                      trimmed.endsWith('yet') ||
                      trimmed.endsWith('also') ||
                      trimmed.endsWith('even') ||
                      trimmed.endsWith('only') ||
                      trimmed.endsWith('own') ||
                      trimmed.endsWith('same') ||
                      trimmed.endsWith('up') ||
                      trimmed.endsWith('out') ||
                      trimmed.endsWith('down') ||
                      trimmed.endsWith('off') ||
                      trimmed.endsWith('again') ||
                      trimmed.endsWith('once') ||
                      trimmed.endsWith('here') ||
                      trimmed.endsWith('there') ||
                      trimmed.endsWith('now') ||
                      trimmed.endsWith('then') ||
                      trimmed.endsWith('today') ||
                      trimmed.endsWith('tomorrow') ||
                      trimmed.endsWith('yesterday');
  
  const isTruncated = trimmed.endsWith('...') || 
                      trimmed.endsWith('–') || 
                      trimmed.endsWith('—') || 
                      trimmed.endsWith('-') || 
                      trimmed.endsWith('"') ||
                      trimmed.endsWith('“') ||
                      trimmed.endsWith('”') ||
                      (endsMidWord && firstPara.length > trimmed.length + 20);
  
  if (isTruncated) {
    const words = firstPara.split(/\s+/);
    if (words.length >= 5 && firstPara.length > trimmed.length) {
      const sentenceEnd = firstPara.search(/[.!?]\s/);
      if (sentenceEnd > 50 && sentenceEnd < 200) {
        return firstPara.substring(0, sentenceEnd + 1);
      }
      return words.slice(0, 30).join(' ') + '...';
    }
    if (words.length >= 5) {
      return words.slice(0, Math.ceil(words.length * 0.7)).join(' ') + '...';
    }
  }
  
  return trimmed;
}

function cleanBodyText(body) {
  let text = body;
  text = fixHyphenation(text);
  text = fixSpacing(text);
  text = text.replace(/<BibliographyCard>[\s\S]*?<\/BibliographyCard>/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  const lines = text.split('\n');
  const cleanedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) {
      cleanedLines.push(lines[i]);
      continue;
    }
    
    if (/^[A-Z][A-Z]/.test(line) && line.length < 60) {
      break;
    }
    
    if (/^a[a-z]/i.test(line) && line.length < 50 && !line.includes(' ')) {
      break;
    }
    
    if (/^[A-Z][a-z]+$/.test(line) && line.length > 5 && line.length < 30) {
      const nextNext = lines[i + 2] ? lines[i + 2].trim() : '';
      if (nextNext.startsWith('From ') || nextNext.startsWith('French ') || /^[A-Z][a-z]+ \d{4}/.test(nextNext)) {
        break;
      }
    }
    
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
    if (nextLine.startsWith('From Greek') || 
        nextLine.startsWith('From Latin') ||
        nextLine.startsWith('From French') ||
        /^[A-Z][a-z]+ \d{4}/.test(nextLine) ||
        /^An early/.test(nextLine) ||
        /^A prominent/.test(nextLine) ||
        /^French /.test(nextLine) ||
        /^Born in/.test(nextLine)) {
      const capitalizedWords = nextLine.split(/\s+/).filter(w => /^[A-Z]/.test(w) && w.length > 2);
      if (capitalizedWords.length >= 2 && !nextLine.includes('.') && nextLine.length < 80) {
        break;
      }
    }
    
    cleanedLines.push(lines[i]);
  }
  
  text = cleanedLines.join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function getIconImports(type) {
  const icons = [
    'BookOpen', 'MessageSquare', 'User', 'Users',
    'Lightbulb', 'GitBranch', 'BookMarked', 'GraduationCap',
    'Scale', 'Quote', 'Hash', 'Layers',
    'Sparkles', 'Compass', 'Clock', 'Globe'
  ];
  if (type === 'rhetorician') {
    return [icons[2], icons[6]];
  } else if (type === 'figure') {
    return [icons[1], icons[3]];
  } else if (type === 'movement') {
    return [icons[3], icons[5]];
  }
  return [icons[0], icons[4]];
}

function getTypeColor(type) {
  if (type === 'rhetorician') return 'text-amber-600';
  if (type === 'figure') return 'text-purple-600';
  if (type === 'movement') return 'text-emerald-600';
  return 'text-blue-600';
}

function getTypeBgColor(type) {
  if (type === 'rhetorician') return 'bg-amber-50';
  if (type === 'figure') return 'bg-purple-50';
  if (type === 'movement') return 'bg-emerald-50';
  return 'bg-blue-50';
}

function getTypeBorderColor(type) {
  if (type === 'rhetorician') return 'border-amber-200';
  if (type === 'figure') return 'border-purple-200';
  if (type === 'movement') return 'border-emerald-200';
  return 'border-blue-200';
}

function buildTemplate(title, description, type, body, bibliography, relatedTerms, crossRefs) {
  const cleanBody = cleanBodyText(body);
  
  const paragraphs = cleanBody.split('\n\n').filter(p => p.trim().length > 0);
  const introParagraphs = paragraphs.slice(0, 2).join('\n\n');
  
  const dataGrid = generateDataGrid(title, type, cleanBody, '');
  const tabs = generateTabs(title, type, cleanBody);
  const accordionContent = generateAccordion(title, type, cleanBody);
  const callout = generateCallout(title, type);
  
  const date = new Date().toISOString();
  const slug = slugify(title);
  
  const colorClass = getTypeColor(type);
  const iconImports = getIconImports(type);
  const iconImportStr = iconImports.map(i => `  ${i}`).join(',\n');
  
  let template = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
date: ${date}
status: "Published"
---

import { 
${iconImportStr}
} from 'lucide-react';
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

<div className="max-w-4xl mx-auto px-6 py-12">

# ${title}

<div className="my-10">

<XCard 
  variant="featured"
  title="${title}" 
  metaData={[
    { label: "Classification", value: "${type === 'figure' ? 'Scheme of Repetition' : type === 'rhetorician' ? 'Historical Figure' : type === 'movement' ? 'Intellectual Movement' : 'Rhetorical Concept'}" },
    { label: "Period", value: "Classical to Contemporary" },
    { label: "Source", value: "Encyclopedia of Rhetoric" }
  ]} 
  icon={<${iconImports[0]} className="w-8 h-8 ${colorClass}" />}
/>

</div>

<div className="my-14">

## Definition & Etymology

<div className="flex items-center mb-8">
  <${iconImports[1]} className="w-6 h-6 ${colorClass} mr-3" />
</div>

<div className="prose prose-lg max-w-none leading-relaxed ${getTypeBgColor(type)} ${getTypeBorderColor(type)} border-l-4 pl-6 py-2 pr-4 rounded-r-lg">

${introParagraphs}

</div>

<DataGrid 
  columns={['Dimension', 'Scope']}
  data={[
${dataGrid.map(row => `    { col1: '${row.col1.replace(/'/g, "\\'")}', col2: '${row.col2.replace(/'/g, "\\'")}' }`).join(',\n')}
  ]}
/>

</div>

<div className="my-12">

## Functional Modularity

<div className="flex items-center mb-8">
  <Layers className="w-6 h-6 ${colorClass} mr-3" />
</div>

<div className="prose prose-lg max-w-none leading-relaxed">
<Tabs>
`;
  
  tabs.forEach(tab => {
    template += `  <Tabs.Item title="${tab.title.replace(/"/g, '\\"')}">
    ${tab.content}
  </Tabs.Item>
`;
  });
  
   template += `</Tabs>

</div>

<div className="my-14">

## Analytical Deep-Dive

<div className="flex items-center mb-8">
  <Compass className="w-6 h-6 ${colorClass} mr-3" />
</div>

<div className="prose prose-lg max-w-none leading-relaxed">
<Accordion title="Scholarly Analysis">
  <CrossRef id="${slug}" label="${title}" />
  ${accordionContent}
</Accordion>

<Callout variant="warning" title="${callout.title.replace(/"/g, '\\"')}">
  ${callout.content}
</Callout>

</div>

<div className="my-14">

## Extended Knowledge Graph

<SeeAlso 
  items={[
${relatedTerms.map(t => `    { label: "${t.label}", url: "${t.url}" },`).join('\n')}
  ]} 
/>

</div>

</div>

---

`;
  
  if (bibliography.length > 0) {
    template += `### References\n\n`;
    bibliography.forEach((bib, i) => {
      const cleaned = bib.trim().replace(/\|/g, '\\|');
      template += `${i + 1}. ${cleaned}\n`;
    });
    template += '\n';
  }
  
  if (crossRefs.length > 0) {
    template += `### Cross-Referenced Terms\n`;
    crossRefs.forEach(ref => {
      template += `- <CrossRef id="${ref.slug}" label="${ref.term}" />\n`;
    });
    template += '\n';
  }
  
  return template;
}

function processFile(file, registry) {
  const srcPath = path.join(ARCHIVE_DIR, file);
  const destPath = path.join(PAGES_DIR, file);
  
  let content = fs.readFileSync(srcPath, 'utf8');
  const parsed = splitFrontmatter(content);
  if (!parsed) return null;
  
  let { frontmatter, body } = parsed;
  
  const descMatch = frontmatter.match(/^description:\s*"(.*)"$/m);
  let description = descMatch ? descMatch[1] : '';
  description = fixDescription(description, body);
  
  const titleMatch = frontmatter.match(/^title:\s*"(.*)"$/m);
  let title = titleMatch ? cleanTitle(titleMatch[1]) : titleFromFilename(file);
  
  const cleanBody = cleanBodyText(body);
  const type = detectType(title, cleanBody, file);
  const bibliography = extractBibliography(body);
  const relatedTerms = extractRelatedTerms(title, type, registry);
  const crossRefs = findCrossReferences(cleanBody, registry);
  
  return {
    title,
    slug: slugify(title),
    type,
    description,
    template: buildTemplate(title, description, type, cleanBody, bibliography, relatedTerms, crossRefs)
  };
}

function buildMasterIndex(registry) {
  const categories = {
    figure: [],
    concept: [],
    rhetorician: [],
    movement: []
  };
  
  Object.values(registry).forEach(entry => {
    if (categories[entry.type]) {
      categories[entry.type].push(entry);
    }
  });
  
  Object.keys(categories).forEach(key => {
    categories[key].sort((a, b) => a.title.localeCompare(b.title));
  });
  
  let index = `---
title: "Encyclopedia of Rhetoric"
description: "Comprehensive reference for rhetorical terms, figures of speech, historical figures, and movements in rhetorical studies."
date: ${new Date().toISOString()}
status: "Published"
---

import { 
  BookOpen,
  Sparkles,
  Users,
  GitBranch,
  MessageSquare,
  Lightbulb,
  User
} from 'lucide-react';
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

<div className="max-w-4xl mx-auto px-6 py-12">

# Encyclopedia of Rhetoric

<div className="my-10">

<XCard 
  variant="featured"
  title="Encyclopedia of Rhetoric" 
  metaData={[
    { label: "Entries", value: "${Object.keys(registry).length}" },
    { label: "Classification", value: "Reference Work" },
    { label: "Scope", value: "Rhetorical Theory, Practice, and History" }
  ]} 
  icon={<BookOpen className="w-8 h-8 text-blue-600" />}
/>

</div>

<div className="my-14">

<div className="flex items-center mb-8">
  <Sparkles className="w-6 h-6 text-blue-600 mr-3" />
</div>

Welcome to the Encyclopedia of Rhetoric, a comprehensive reference work covering rhetorical terms, figures of speech, historical rhetoricians, and intellectual movements from classical antiquity to the present.

## Browse by Category

<DataGrid 
  columns={['Category', 'Entries', 'Description']}
  data={[
    { col1: 'Figures of Speech', col2: '${categories.figure.length} entries', col3: 'Schemes and tropes for rhetorical effect' },
    { col1: 'Rhetorical Concepts', col2: '${categories.concept.length} entries', col3: 'Fundamental principles and theories' },
    { col1: 'Historical Figures', col2: '${categories.rhetorician.length} entries', col3: 'Rhetoricians, theorists, and practitioners' },
    { col1: 'Movements & Fields', col2: '${categories.movement.length} entries', col3: 'Schools, movements, and disciplines' }
  ]}
/>

## Figures of Speech

<div className="flex items-center mb-6">
  <MessageSquare className="w-5 h-5 text-purple-600 mr-2" />
</div>

<SeeAlso 
  items={[
${categories.figure.slice(0, 10).map(e => `    { label: "${e.title}", url: "/terms/${e.slug}" },`).join('\n')}
  ]} 
/>

## Rhetorical Concepts

<div className="flex items-center mb-6">
  <Lightbulb className="w-5 h-5 text-blue-600 mr-2" />
</div>

<SeeAlso 
  items={[
${categories.concept.slice(0, 10).map(e => `    { label: "${e.title}", url: "/terms/${e.slug}" },`).join('\n')}
  ]} 
/>

## Historical Figures

<div className="flex items-center mb-6">
  <User className="w-5 h-5 text-amber-600 mr-2" />
</div>

<SeeAlso 
  items={[
${categories.rhetorician.slice(0, 10).map(e => `    { label: "${e.title}", url: "/terms/${e.slug}" },`).join('\n')}
  ]} 
/>

## Movements & Fields

<div className="flex items-center mb-6">
  <Users className="w-5 h-5 text-emerald-600 mr-2" />
</div>

<SeeAlso 
  items={[
${categories.movement.slice(0, 10).map(e => `    { label: "${e.title}", url: "/terms/${e.slug}" },`).join('\n')}
  ]} 
/>

</div>

---

<Callout variant="info" title="Using This Encyclopedia">
  Each entry includes definitions, historical context, functional analysis, and cross-references to related terms. Use the search function or browse by category to explore the encyclopedia.
</Callout>

</div>

`;

  fs.writeFileSync(path.join(PAGES_DIR, 'index.mdx'), index);
  return categories;
}

function buildGlossary(registry) {
  const entries = Object.values(registry).sort((a, b) => a.title.localeCompare(b.title));
  
  let glossary = `---
title: "Glossary"
description: "Alphabetical listing of all rhetorical terms in the Encyclopedia of Rhetoric."
date: ${new Date().toISOString()}
status: "Published"
---

import { 
  BookOpen,
  Hash
} from 'lucide-react';
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

<div className="max-w-4xl mx-auto px-6 py-12">

# Glossary

<div className="my-10">

<XCard 
  variant="featured"
  title="Glossary" 
  metaData={[
    { label: "Entries", value: "${entries.length}" },
    { label: "Format", value: "Alphabetical" },
    { label: "Scope", value: "Complete Terminology" }
  ]} 
  icon={<BookOpen className="w-8 h-8 text-blue-600" />}
/>

</div>

<div className="my-14">

<div className="flex items-center mb-8">
  <Hash className="w-6 h-6 text-blue-600 mr-3" />
</div>

| Term | Type | Page |
| :--- | :--- | :--- |
`;
  
  entries.forEach(entry => {
    glossary += `| **${entry.title}** | ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} | [View](/terms/${entry.slug}) |\n`;
  });
  
  glossary += '\n';
  fs.writeFileSync(path.join(PAGES_DIR, 'glossary.mdx'), glossary);
}

function buildCategoryPages(categories, registry) {
  const categoryNames = {
    figure: 'Figures of Speech',
    concept: 'Rhetorical Concepts',
    rhetorician: 'Historical Figures',
    movement: 'Movements & Fields'
  };
  
  Object.entries(categories).forEach(([type, entries]) => {
    const name = categoryNames[type];
    const slug = type + 's';
    
    let page = `---
title: "${name}"
description: "${name} in the Encyclopedia of Rhetoric."
date: ${new Date().toISOString()}
status: "Published"
---

import { 
  BookOpen,
  MessageSquare,
  Lightbulb,
  Users
} from 'lucide-react';
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

<div className="max-w-4xl mx-auto px-6 py-12">

# ${name}

<div className="my-10">

<XCard 
  variant="featured"
  title="${name}" 
  metaData={[
    { label: "Entries", value: "${entries.length}" },
    { label: "Classification", value: "${type}" }
  ]} 
  icon={<BookOpen className="w-8 h-8 text-blue-600" />}
/>

</div>

<div className="my-14">

| Term | Description | Page |
| :--- | :--- | :--- |
`;
    
    entries.forEach(entry => {
      page += `| **${entry.title}** | [View details](/terms/${entry.slug}) | |\n`;
    });
    
    page += '\n</div>\n</div>\n';
    fs.writeFileSync(path.join(PAGES_DIR, `${slug}.mdx`), page);
  });
}

function main() {
  ensureDir(PAGES_DIR);
  
  console.log('Building terminology registry...');
  const registry = buildTerminologyRegistry();
  console.log(`Found ${Object.keys(registry).length} terms`);
  
  console.log('Building master index...');
  const categories = buildMasterIndex(registry);
  
  console.log('Building glossary...');
  buildGlossary(registry);
  
  console.log('Building category pages...');
  buildCategoryPages(categories, registry);
  
  console.log('Processing individual files...');
  const files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.mdx'));
  const skipFiles = ['index.mdx', 'glossary.mdx', 'figures.mdx', 'concepts.mdx', 'rhetoricians.mdx', 'movements.mdx'];
  files.forEach((file, index) => {
    if (skipFiles.includes(file)) return;
    const result = processFile(file, registry);
    if (result) {
      fs.writeFileSync(path.join(PAGES_DIR, file), result.template);
    }
    if ((index + 1) % 50 === 0) {
      console.log(`Progress: ${index + 1}/${files.length}`);
    }
  });
  
  console.log('Done building linking system.');
}

main();
