import mupdf from 'mupdf';
import { parseHTMLIntoBlocks, renderSections } from './parser.js';

// DOM elements
const fileInput = document.getElementById('file-input');
const pdfContainer = document.getElementById('pdf-container');
const loading = document.getElementById('loading');
const error = document.getElementById('error');

// UI state management
function showError(message) {
  error.textContent = message;
  error.classList.remove('hidden');
  loading.classList.add('hidden');
}

function hideError() {
  error.classList.add('hidden');
}

function showLoading() {
  loading.classList.remove('hidden');
  hideError();
}

function hideLoading() {
  loading.classList.add('hidden');
}

function clearContainer() {
  pdfContainer.innerHTML = '';
}

// PDF processing functions
function getViewportDimensions() {
  const containerRect = pdfContainer.getBoundingClientRect();
  return {
    width: containerRect.width || window.innerWidth,
    height: window.innerHeight,
    emSize: 12
  };
}

function openPDFDocument(pdfData) {
  return mupdf.Document.openDocument(pdfData, 'application/pdf');
}

function layoutDocument(doc, viewportWidth, viewportHeight, emSize) {
  try {
    doc.layout(viewportWidth, viewportHeight, emSize);
  } catch (layoutErr) {
    throw new Error('This PDF is not reflowable. Reflow mode requires a tagged PDF.');
  }
}

function extractSectionsFromDocument(doc) {
  const pageCount = doc.countPages();
  const sections = [];
  let rawHTML = '';
  
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const structuredText = page.toStructuredText('preserve-images');
    const pageHTML = structuredText.asHTML(i);
    rawHTML += pageHTML;
    const pageSections = parseHTMLIntoBlocks(pageHTML);
    sections.push(...pageSections);
  }
  
  // // Log and save the beginning of raw HTML
  // logAndSaveRawHTML(rawHTML);
  
  return sections;
}

function logAndSaveRawHTML(rawHTML) {
  // Log the full HTML to console
  console.log('=== FULL RAW HTML (BEFORE PARSING) ===');
  console.log('Total length:', rawHTML.length);
  console.log(rawHTML);
  console.log('=== END OF FULL HTML ===');
  
  // Save the entire HTML to a file
  saveToFile(rawHTML, 'raw-html-full.html');
}

function saveToFile(content, filename) {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`Saved ${filename} (${content.length} bytes)`);
}


async function processPDFFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfData = new Uint8Array(arrayBuffer);
  
  const doc = openPDFDocument(pdfData);
  const { width, height, emSize } = getViewportDimensions();
  
  layoutDocument(doc, width, height, emSize);
  
  const sections = extractSectionsFromDocument(doc);
  const htmlContent = renderSections(sections);
  
  return htmlContent;
}

async function loadPDFFromFile(file) {
  showLoading();
  clearContainer();

  try {
    const htmlContent = await processPDFFile(file);
    pdfContainer.innerHTML = htmlContent;
    hideLoading();
  } catch (err) {
    console.error('Error loading PDF:', err);
    showError(`Failed to load PDF: ${err.message}`);
  }
}

// File handling
async function loadTestPDF() {
  try {
    const response = await fetch('/1807.05520v2.pdf');
    if (!response.ok) {
      return; // Test PDF not found, skip auto-load
    }
    
    const blob = await response.blob();
    const file = new File([blob], '1807.05520v2.pdf', { type: 'application/pdf' });
    await loadPDFFromFile(file);
  } catch (err) {
    console.error('Could not load test PDF:', err);
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    loadPDFFromFile(file);
  }
}

// Initialize
fileInput.addEventListener('change', handleFileSelect);
loadTestPDF();

