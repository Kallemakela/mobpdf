/**
 * PDF HTML Parser
 * Extracts structured content from mupdf HTML output and converts it to clean sections
 */

/**
 * Parse style attribute to extract font properties
 */
function parseStyle(styleAttr) {
  const style = styleAttr || '';
  
  const fontSizeMatch = style.match(/font-size:\s*([\d.]+)pt/i);
  const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 0;
  
  const fontWeightMatch = style.match(/font-weight:\s*(bold|\d+)/i);
  const isBold = fontWeightMatch && 
    (fontWeightMatch[1] === 'bold' || parseInt(fontWeightMatch[1]) >= 600);
  
  const fontStyleMatch = style.match(/font-style:\s*italic/i);
  const isItalic = !!fontStyleMatch;
  
  return { fontSize, isBold, isItalic };
}

/**
 * Extract font properties from element and its nested children
 * Checks nested spans, b tags, etc.
 */
function extractFontProperties(el) {
  let maxFontSize = 0;
  let isBold = false;
  
  // Check element's own style
  const style = el.getAttribute('style') || '';
  const ownStyle = parseStyle(style);
  maxFontSize = Math.max(maxFontSize, ownStyle.fontSize);
  isBold = isBold || ownStyle.isBold;
  
  // Check for <b> tags
  const boldTags = el.querySelectorAll('b, strong');
  if (boldTags.length > 0) {
    isBold = true;
  }
  
  // Check nested spans and other elements for font-size
  const allElements = el.querySelectorAll('*');
  for (const child of allElements) {
    const childStyle = child.getAttribute('style') || '';
    const childProps = parseStyle(childStyle);
    maxFontSize = Math.max(maxFontSize, childProps.fontSize);
    
    // Check if child is bold
    if (childProps.isBold || child.tagName.toLowerCase() === 'b' || child.tagName.toLowerCase() === 'strong') {
      isBold = true;
    }
  }
  
  return { fontSize: maxFontSize, isBold };
}

/**
 * Determine if an element is likely a heading based on styling
 */
function isLikelyHeading(text, fontSize, isBold) {
  return (
    fontSize > 14 ||
    (fontSize > 12 && isBold) ||
    (isBold && text.length < 200 && !text.includes('.') && !text.match(/^\d+\./)) ||
    (fontSize > 16 && text.length < 300)
  );
}

/**
 * Determine heading level based on font size
 */
function getHeadingLevel(fontSize, isBold) {
  if (fontSize > 20) return 1;
  if (fontSize > 18) return 2;
  if (fontSize > 16) return 2;
  if (fontSize > 14) return 3;
  if (isBold && fontSize > 12) return 3;
  return 3;
}

/**
 * Create a section object
 */
function createSection(type, content, level = 0, images = []) {
  return { type, content, level, images };
}

/**
 * Check if element's parent has been processed
 */
function isParentProcessed(el, processedElements, rootElement) {
  let parent = el.parentElement;
  while (parent && parent !== rootElement) {
    if (processedElements.has(parent)) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Extract heading from nested structure (e.g., heading wrapped in paragraph)
 */
function extractNestedHeading(el) {
  const firstChild = el.firstElementChild;
  if (!firstChild) return null;
  
  const firstTag = firstChild.tagName.toLowerCase();
  
  // Extract font properties from nested children
  const { fontSize, isBold } = extractFontProperties(el);
  
  const headingText = firstChild.textContent.trim();
  if (!headingText) return null;
  
  const isHeadingTag = firstTag.match(/^h[1-6]$/);
  const isHeadingStyle = (fontSize && fontSize > 14) || 
                         (isBold && headingText.length < 200);
  
  if (!isHeadingTag && !isHeadingStyle) return null;
  
  let level = 3;
  if (isHeadingTag) {
    level = parseInt(firstTag.charAt(1));
  } else if (fontSize > 18) {
    level = 1;
  } else if (fontSize > 16) {
    level = 2;
  }
  
  // Get remaining text by cloning element, removing first child, then getting text
  const clone = el.cloneNode(true);
  const cloneFirstChild = clone.firstElementChild;
  if (cloneFirstChild && cloneFirstChild.textContent.trim() === headingText) {
    cloneFirstChild.remove();
  }
  const remainingText = clone.textContent.trim();
  
  return {
    heading: createSection('heading', headingText, level),
    remainingText: remainingText
  };
}

/**
 * Process an image element
 */
function processImage(el, processedElements) {
  const src = el.getAttribute('src');
  if (!src) return null;
  
  processedElements.add(el);
  return createSection('image', '', 0, [{ src }]);
}

/**
 * Process a heading element
 */
function processHeading(el, processedElements) {
  const text = el.textContent.trim();
  if (!text) return null;
  
  const tagName = el.tagName.toLowerCase();
  const level = parseInt(tagName.charAt(1));
  
  processedElements.add(el);
  return createSection('heading', text, level);
}

/**
 * Process a text element (paragraph, div, span)
 */
function processTextElement(el, tagName, processedElements) {
  const text = el.textContent.trim();
  if (!text) return null;
  
  // Extract font properties from element and nested children
  const { fontSize, isBold } = extractFontProperties(el);
  
  // Check for nested heading first
  if (tagName === 'p' || tagName === 'div') {
    const nested = extractNestedHeading(el);
    if (nested) {
      processedElements.add(el);
      const sections = [nested.heading];
      if (nested.remainingText) {
        sections.push(createSection('paragraph', nested.remainingText));
      }
      return sections;
    }
  }
  
  // Check if it's a heading based on styling
  if (isLikelyHeading(text, fontSize, isBold)) {
    const level = getHeadingLevel(fontSize, isBold);
    processedElements.add(el);
    return createSection('heading', text, level);
  }
  
  // Regular paragraph
  if (tagName === 'p' || tagName === 'div') {
    processedElements.add(el);
    return createSection('paragraph', text);
  }
  
  // Span - only if substantial
  if (tagName === 'span' && text.length > 50) {
    processedElements.add(el);
    return createSection('paragraph', text);
  }
  
  return null;
}

/**
 * Fix hyphenated words within text (handles both across sections and within multi-line text)
 */
function fixHyphenatedWords(text) {
  // Pattern: word ending with "-" followed by newline/space and lowercase letter
  // This handles cases like "it-\neratively" or "it- eratively"
  // But preserve intentional hyphens like "k-means" (single letter before hyphen)
  // Only merge if there are at least 2 characters before the hyphen
  return text.replace(/(\w{2,})-\s*\n?\s*([a-z])/g, '$1$2');
}

/**
 * Merge hyphenated words split across paragraphs
 */
function mergeHyphenatedWords(sections) {
  const merged = [];
  
  for (let i = 0; i < sections.length; i++) {
    const current = sections[i];
    const next = sections[i + 1];
    
    // Fix hyphenated words within current section's content
    if (current.content) {
      current.content = fixHyphenatedWords(current.content);
    }
    
    // Only process paragraphs
    if (current.type === 'paragraph' && next && next.type === 'paragraph') {
      const currentText = current.content.trim();
      const nextText = next.content.trim();
      
      // Check if current paragraph ends with a hyphenated word (ends with "-")
      // and next paragraph starts with lowercase (continuation of word)
      if (currentText.endsWith('-') && nextText.length > 0 && nextText[0].toLowerCase() === nextText[0]) {
        // Merge: remove the hyphen and combine
        const mergedText = currentText.slice(0, -1) + nextText;
        merged.push(createSection('paragraph', fixHyphenatedWords(mergedText)));
        i++; // Skip next since we merged it
        continue;
      }
    }
    
    merged.push(current);
  }
  
  return merged;
}

/**
 * Merge adjacent paragraphs that should be combined
 * (e.g., abstract lines split across multiple paragraphs)
 * This function iteratively merges paragraphs until no more can be merged
 */
function mergeAdjacentParagraphs(sections) {
  let merged = [...sections];
  let changed = true;
  
  // Keep merging until no more changes occur
  while (changed) {
    changed = false;
    const newMerged = [];
    
    for (let i = 0; i < merged.length; i++) {
      const current = merged[i];
      const next = merged[i + 1];
      
      // If current and next are both paragraphs
      if (current.type === 'paragraph' && next && next.type === 'paragraph') {
        const currentText = current.content.trim();
        const nextText = next.content.trim();
        
        if (!nextText) {
          newMerged.push(current);
          continue;
        }
        
        // Merge if:
        // 1. Current doesn't end with sentence-ending punctuation (likely continuation)
        // 2. AND next starts with lowercase letter (continuation of sentence)
        // OR current ends with hyphen (word split)
        // OR current is short and doesn't end with punctuation (incomplete sentence)
        const currentEndsWithPunctuation = !!currentText.match(/[.!?]$/);
        const nextStartsLowercase = nextText[0] && nextText[0].toLowerCase() === nextText[0];
        const currentEndsWithHyphen = currentText.endsWith('-');
        const currentIsShortIncomplete = currentText.length < 100 && !currentEndsWithPunctuation;
        
        // Merge if:
        // 1. Current doesn't end with punctuation AND next starts with lowercase (sentence continuation)
        // 2. OR current ends with hyphen (word split)
        // 3. OR current is short/incomplete AND next starts with lowercase
        const shouldMerge = 
          (!currentEndsWithPunctuation && nextStartsLowercase) ||
          currentEndsWithHyphen ||
          (currentIsShortIncomplete && nextStartsLowercase);
        
        if (shouldMerge) {
          // Merge paragraphs with a space
          newMerged.push(createSection('paragraph', `${current.content} ${next.content}`));
          i++; // Skip next since we merged it
          changed = true;
          continue;
        }
      }
      
      newMerged.push(current);
    }
    
    merged = newMerged;
  }
  
  return merged;
}

/**
 * Merge adjacent headings with similar styling
 * Also handles case where heading is followed by paragraph that should be part of heading
 */
function mergeAdjacentHeadings(sections) {
  const merged = [];
  
  for (let i = 0; i < sections.length; i++) {
    const current = sections[i];
    const next = sections[i + 1];
    
    // If current is heading and next is paragraph
    if (current.type === 'heading' && next && next.type === 'paragraph') {
      const nextText = next.content.trim();
      const currentText = current.content.trim();
      
      // Split next paragraph by newlines to check first line
      const firstLine = nextText.split('\n')[0].trim();
      
      // Check if first line of next paragraph looks like continuation of heading
      // (short, starts with lowercase "of", "and", "the", etc., or is very short)
      const looksLikeContinuation = 
        firstLine.length < 50 && (
          firstLine.match(/^(of|and|the|a|an|in|on|at|to|for|with|by)\s/i) ||
          (!firstLine.match(/^[A-Z]/) && firstLine.length < 30)
        );
      
      if (looksLikeContinuation && !currentText.match(/[.!?]$/)) {
        // Merge heading with continuation (only first line)
        merged.push(createSection(
          'heading',
          `${current.content} ${firstLine}`,
          current.level,
          []
        ));
        
        // If there's remaining content after the first line, add it as a new paragraph
        const remainingLines = nextText.split('\n').slice(1).join('\n').trim();
        if (remainingLines) {
          merged.push(createSection('paragraph', remainingLines));
        }
        i++; // Skip next since we processed it
        continue;
      }
    }
    
    // If current and next are both headings with same level
    if (current.type === 'heading' && next && next.type === 'heading' && current.level === next.level) {
      // Merge them
      merged.push(createSection(
        'heading',
        `${current.content} ${next.content}`,
        current.level,
        []
      ));
      i++; // Skip next since we merged it
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Check if element is a page marker div (should be ignored)
 */
function isPageMarker(el) {
  const tagName = el.tagName.toLowerCase();
  if (tagName !== 'div') return false;
  
  const id = el.getAttribute('id') || '';
  // Match patterns like "page0", "page1", "page2", etc.
  return /^page\d+$/.test(id);
}

/**
 * Parse HTML into structured sections
 */
export function parseHTMLIntoBlocks(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const sections = [];
  const processedElements = new Set();
  
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_ELEMENT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    const el = node;
    const tagName = el.tagName.toLowerCase();
    
    // Skip if already processed
    if (processedElements.has(el)) continue;
    
    // Handle page markers first (before parent check)
    // Page markers should be ignored but their children processed
    if (isPageMarker(el)) {
      continue; // Skip the page div itself, but TreeWalker will process its children
    }
    
    // Skip if parent is already processed
    if (isParentProcessed(el, processedElements, tempDiv)) continue;
    
    // Handle images
    if (tagName === 'img') {
      const section = processImage(el, processedElements);
      if (section) sections.push(section);
      continue;
    }
    
    // Handle headings
    if (tagName.match(/^h[1-6]$/)) {
      const section = processHeading(el, processedElements);
      if (section) sections.push(section);
      continue;
    }
    
    // Handle text elements
    if (tagName.match(/^(p|div|span)$/)) {
      const result = processTextElement(el, tagName, processedElements);
      if (result) {
        if (Array.isArray(result)) {
          sections.push(...result);
        } else {
          sections.push(result);
        }
      }
    }
  }
  
  // Merge hyphenated words split across paragraphs
  let mergedSections = mergeHyphenatedWords(sections);
  
  // Merge adjacent paragraphs that should be combined
  mergedSections = mergeAdjacentParagraphs(mergedSections);
  
  // Merge adjacent headings with similar styling
  return mergeAdjacentHeadings(mergedSections);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render a single section to HTML
 */
function renderSection(section) {
  if (!section.content && section.images.length === 0) {
    return '';
  }
  
  let html = '';
  
  if (section.type === 'heading') {
    const tag = `h${Math.min(section.level || 2, 6)}`;
    html += `<${tag}>${escapeHtml(section.content)}</${tag}>`;
  } else if (section.type === 'image') {
    for (const image of section.images) {
      if (image && image.src) {
        html += `<img src="${image.src}" alt="" />`;
      }
    }
  } else if (section.content.trim()) {
    html += `<p>${escapeHtml(section.content)}</p>`;
    
    // Render images after paragraph
    for (const image of section.images) {
      if (image && image.src) {
        html += `<img src="${image.src}" alt="" />`;
      }
    }
  }
  
  return html;
}

/**
 * Render sections array to HTML
 */
export function renderSections(sections) {
  return sections.map(renderSection).join('');
}

