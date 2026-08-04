const puppeteer = require('puppeteer');
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } = require('docx');
const { parseDocument } = require('htmlparser2');
const { textContent } = require('domutils');

/**
 * Generate PDF from HTML using Puppeteer
 */
async function generatePDF(html, title) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Create a complete HTML document with proper styling
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Georgia', 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
            }
            h1 { font-size: 24pt; margin-top: 20px; margin-bottom: 10px; }
            h2 { font-size: 20pt; margin-top: 18px; margin-bottom: 9px; }
            h3 { font-size: 16pt; margin-top: 16px; margin-bottom: 8px; }
            h4 { font-size: 14pt; margin-top: 14px; margin-bottom: 7px; }
            h5 { font-size: 12pt; margin-top: 12px; margin-bottom: 6px; }
            h6 { font-size: 11pt; margin-top: 11px; margin-bottom: 6px; }
            p { margin: 10px 0; text-align: justify; }
            ul, ol { margin: 10px 0; padding-left: 30px; }
            li { margin: 5px 0; }
            strong, b { font-weight: bold; }
            em, i { font-style: italic; }
            u { text-decoration: underline; }
            s, strike { text-decoration: line-through; }
            a { color: #0066cc; text-decoration: underline; }
            blockquote { 
              margin: 20px 0; 
              padding: 10px 20px; 
              border-left: 4px solid #ccc; 
              background: #f9f9f9;
            }
            code {
              font-family: 'Courier New', monospace;
              background: #f4f4f4;
              padding: 2px 6px;
              border-radius: 3px;
            }
            pre {
              background: #f4f4f4;
              padding: 15px;
              border-radius: 5px;
              overflow-x: auto;
            }
            img { max-width: 100%; height: auto; }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 15px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
          </style>
          <title>${title || 'Document'}</title>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
      preferCSSPageSize: false
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

/**
 * Parse HTML and extract text runs with formatting
 */
function parseHtmlToDocxElements(html) {
  const elements = [];

  function processElement(node, level = 0) {
    if (node.type === 'tag') {
      const tag = node.name;
      const children = node.children || [];

      // Handle headings
      if (tag.match(/^h[1-6]$/)) {
        const headingLevel = parseInt(tag.substring(1));
        const text = textContent(node);
        
        const headingMap = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6
        };

        elements.push(new Paragraph({
          text: text,
          heading: headingMap[headingLevel],
          spacing: { before: 240, after: 120 }
        }));
        return;
      }

      // Handle paragraphs
      if (tag === 'p') {
        const textRuns = [];
        
        function extractTextRuns(node) {
          if (node.type === 'text') {
            textRuns.push(new TextRun(node.data));
          } else if (node.type === 'tag') {
            const children = node.children || [];
            const text = textContent(node);
            
            const options = { text };
            
            if (node.name === 'strong' || node.name === 'b') options.bold = true;
            if (node.name === 'em' || node.name === 'i') options.italics = true;
            if (node.name === 'u') options.underline = { type: UnderlineType.SINGLE };
            if (node.name === 's' || node.name === 'strike') options.strike = true;

            if (Object.keys(options).length > 1) {
              textRuns.push(new TextRun(options));
            } else {
              children.forEach(extractTextRuns);
            }
          }
        }

        children.forEach(extractTextRuns);
        
        if (textRuns.length > 0) {
          elements.push(new Paragraph({
            children: textRuns,
            spacing: { before: 100, after: 100 }
          }));
        } else {
          const text = textContent(node);
          if (text.trim()) {
            elements.push(new Paragraph({
              text: text,
              spacing: { before: 100, after: 100 }
            }));
          }
        }
        return;
      }

      // Handle lists
      if (tag === 'ul' || tag === 'ol') {
        children.forEach((child, index) => {
          if (child.name === 'li') {
            const text = textContent(child);
            elements.push(new Paragraph({
              text: text,
              bullet: tag === 'ul' ? { level: level } : undefined,
              numbering: tag === 'ol' ? { reference: 'default-numbering', level: level } : undefined,
              spacing: { before: 50, after: 50 }
            }));
          }
        });
        return;
      }

      // Handle line breaks
      if (tag === 'br') {
        elements.push(new Paragraph({ text: '' }));
        return;
      }

      // Recursively process children
      children.forEach(child => processElement(child, level));
    }
  }

  const dom = parseDocument(html);
  if (dom.children) {
    dom.children.forEach(child => processElement(child));
  }

  // If no elements were created, add at least the text content
  if (elements.length === 0) {
    const text = textContent(dom);
    if (text.trim()) {
      elements.push(new Paragraph({ text: text }));
    }
  }

  return elements;
}

/**
 * Generate DOCX from HTML
 */
async function generateDOCX(html, title) {
  try {
    const paragraphs = parseHtmlToDocxElements(html);

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs.length > 0 ? paragraphs : [
          new Paragraph({
            text: 'Empty document',
            spacing: { before: 100, after: 100 }
          })
        ]
      }]
    });

    const { Packer } = require('docx');
    const buffer = await Packer.toBuffer(doc);
    return buffer;
  } catch (error) {
    console.error('Error generating DOCX:', error);
    throw error;
  }
}

module.exports = {
  generatePDF,
  generateDOCX
};
