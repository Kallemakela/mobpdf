/**
 * Parser Component Tests using Jest
 */

import { describe, test, expect } from '@jest/globals';
import { parseHTMLIntoBlocks, renderSections } from '../parser.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the raw HTML excerpt
function loadRawHTMLExcerpt() {
  const filePath = join(__dirname, 'mock-abs.html');
  return readFileSync(filePath, 'utf-8');
}

// Test helpers
function findSection(sections, searchText) {
  return sections.find(s => s.content && s.content.includes(searchText));
}

function findSections(sections, predicate) {
  return sections.filter(predicate);
}

describe('Parser Component Tests', () => {
  let html;
  let sections;

  beforeAll(() => {
    html = loadRawHTMLExcerpt();
    sections = parseHTMLIntoBlocks(html);
  });

  test('should load HTML excerpt', () => {
    expect(html.length).toBeGreaterThan(0);
  });

  test('should parse HTML into sections', () => {
    expect(sections.length).toBeGreaterThan(0);
  });

  test('title should be detected as heading', () => {
    const titleSection = findSection(sections, 'Deep Clustering for Unsupervised Learning');
    expect(titleSection).toBeDefined();
    expect(titleSection.type).toBe('heading');
    expect(titleSection.level).toBe(3);
  });

  test('title should contain full text', () => {
    const titleSection = findSection(sections, 'Deep Clustering for Unsupervised Learning');
    expect(titleSection).toBeDefined();
    expect(titleSection.content).toContain('Deep Clustering for Unsupervised Learning');
    expect(titleSection.content).toContain('of Visual Features');
  });

  test('authors should be detected as paragraph', () => {
    const authorsSection = findSection(sections, 'Mathilde Caron');
    expect(authorsSection).toBeDefined();
    expect(authorsSection.type).toBe('paragraph');
  });

  test('abstract should be detected as paragraphs', () => {
    const abstractSections = findSections(sections, s => 
      s.content && s.content.includes('Clustering is a class of unsupervised learning')
    );
    expect(abstractSections.length).toBeGreaterThan(0);
  });

  test('keywords should be detected as paragraph', () => {
    const keywordsSection = findSection(sections, 'Keywords:');
    expect(keywordsSection).toBeDefined();
    expect(keywordsSection.type).toBe('paragraph');
    expect(keywordsSection.content).toContain('unsupervised learning');
    expect(keywordsSection.content).toContain('clustering');
  });

  test('no sections should have positioning styles', () => {
    const sectionsWithPositioning = sections.filter(s => 
      s.content && (s.content.includes('top:') || s.content.includes('left:'))
    );
    expect(sectionsWithPositioning.length).toBe(0);
  });

  test('rendered HTML should be clean', () => {
    const rendered = renderSections(sections);
    expect(rendered).not.toContain('top:');
    expect(rendered).not.toContain('left:');
  });

  test('hyphenated words should be merged correctly', () => {
    const rendered = renderSections(sections);
    // "it-" + "eratively" should become "iteratively"
    expect(rendered).toContain('iteratively');
    expect(rendered).not.toContain('it- eratively');
    expect(rendered).not.toContain('it-\neratively');
  });

  test('page change markers should be ignored', () => {
    const pageChangeHTML = readFileSync(join(__dirname, 'mock-page-change.html'), 'utf-8');
    const pageChangeSections = parseHTMLIntoBlocks(pageChangeHTML);
    
    // Page marker divs should not create sections
    const hasPageMarker = pageChangeSections.some(s => 
      s.content && (s.content.includes('page1') || s.content.includes('page2'))
    );
    expect(hasPageMarker).toBe(false);
    
    // But content inside page markers should still be parsed
    const hasContent = pageChangeSections.some(s => 
      s.content && s.content.includes('Deep Clustering for Unsupervised Learning of Visual Features')
    );
    expect(hasContent).toBe(true);
    
    // Content from both pages should be present
    const hasPage1Content = pageChangeSections.some(s => 
      s.content && s.content.includes('impact of these choices')
    );
    const hasPage2Content = pageChangeSections.some(s => 
      s.content && s.content.includes('We demonstrate that our approach')
    );
    expect(hasPage1Content).toBe(true);
    expect(hasPage2Content).toBe(true);
  });

  test('lines in a section should be combined', () => {
    const linesHTML = readFileSync(join(__dirname, 'mock-lines.html'), 'utf-8');
    const sections = parseHTMLIntoBlocks(linesHTML);
    
    // Find sections containing abstract content
    const abstractSections = findSections(sections, s => 
      s.content && (s.content.includes('Abstract') || s.content.includes('Clustering is a class'))
    );
    
    // All three lines should be combined - check if they're in one or more sections
    const hasAllContent = abstractSections.some(s => 
      s.content.includes('Clustering is a class of unsupervised learning methods that') &&
      s.content.includes('has been extensively applied and studied in computer vision') &&
      s.content.includes('has been done to adapt it to the end-to-end training')
    );
    
    expect(hasAllContent).toBe(true);
    
    // Should be at most 2 sections (heading "Abstract." + merged paragraph, or just merged paragraph)
    expect(abstractSections.length).toBeLessThanOrEqual(2);
    
    // If there's a heading, the paragraph should contain all the text
    const paragraphSection = abstractSections.find(s => s.type === 'paragraph');
    if (paragraphSection) {
      expect(paragraphSection.content).toContain('Clustering is a class of unsupervised learning methods that');
      expect(paragraphSection.content).toContain('has been extensively applied and studied in computer vision');
      expect(paragraphSection.content).toContain('has been done to adapt it to the end-to-end training');
    }
  });
});
