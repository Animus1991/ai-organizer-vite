// src/lib/exportUtils.ts
// Export utilities for documents and segments

export interface ExportOptions {
  format: 'json' | 'txt' | 'md' | 'csv';
  includeMetadata?: boolean;
}

/**
 * Export document to JSON
 */
export function exportDocumentToJSON(document: any, options: ExportOptions = { format: 'json' }): string {
  const data: any = {
    title: document.title,
    filename: document.filename,
    text: document.text,
  };

  if (options.includeMetadata) {
    data.metadata = {
      sourceType: document.sourceType,
      parseStatus: document.parseStatus,
      parseError: document.parseError,
      upload: document.upload,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Export document to TXT
 */
export function exportDocumentToTXT(document: any, options: ExportOptions = { format: 'txt' }): string {
  let content = '';
  
  if (options.includeMetadata) {
    content += `Title: ${document.title || 'Untitled'}\n`;
    if (document.filename) content += `Filename: ${document.filename}\n`;
    if (document.sourceType) content += `Source Type: ${document.sourceType}\n`;
    if (document.parseStatus) content += `Parse Status: ${document.parseStatus}\n`;
    content += '\n---\n\n';
  }

  content += document.text || '';

  return content;
}

/**
 * Export document to Markdown
 */
export function exportDocumentToMD(document: any, options: ExportOptions = { format: 'md' }): string {
  let content = '';
  
  if (options.includeMetadata) {
    content += `# ${document.title || 'Untitled'}\n\n`;
    if (document.filename) content += `**Filename:** ${document.filename}\n\n`;
    if (document.sourceType) content += `**Source Type:** ${document.sourceType}\n\n`;
    if (document.parseStatus) content += `**Parse Status:** ${document.parseStatus}\n\n`;
    content += '---\n\n';
  }

  // Convert text to markdown (preserve line breaks)
  const text = document.text || '';
  content += text.split('\n').map(line => line || '').join('\n');

  return content;
}

/**
 * Export segments to JSON
 */
export function exportSegmentsToJSON(segments: any[], options: ExportOptions = { format: 'json' }): string {
  const data: any = {
    segments: segments.map(seg => ({
      id: seg.id,
      title: seg.title,
      content: seg.content,
      mode: seg.mode,
      orderIndex: seg.orderIndex,
      isManual: seg.isManual,
      startChar: seg.startChar,
      endChar: seg.endChar,
      createdAt: seg.createdAt,
    })),
  };

  if (options.includeMetadata) {
    data.metadata = {
      exportDate: new Date().toISOString(),
      totalCount: segments.length,
      format: 'json',
    };
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Export segments to CSV
 */
export function exportSegmentsToCSV(segments: any[]): string {
  const headers = ['ID', 'Title', 'Content', 'Mode', 'Order Index', 'Is Manual', 'Start Char', 'End Char'];
  const rows = segments.map(seg => [
    seg.id,
    seg.title || '',
    (seg.content || '').replace(/"/g, '""'), // Escape quotes
    seg.mode || '',
    seg.orderIndex || 0,
    seg.isManual ? 'Yes' : 'No',
    seg.startChar || 0,
    seg.endChar || 0,
  ]);

  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ];

  return csvRows.join('\n');
}

/**
 * Export segments to TXT
 */
export function exportSegmentsToTXT(segments: any[], options: ExportOptions = { format: 'txt' }): string {
  let content = '';
  
  if (options.includeMetadata) {
    content += `Segments Export\n`;
    content += `Total: ${segments.length}\n`;
    content += `Export Date: ${new Date().toISOString()}\n`;
    content += '\n---\n\n';
  }

  segments.forEach((seg, index) => {
    content += `${index + 1}. ${seg.title || 'Untitled'}\n`;
    content += `Mode: ${seg.mode || 'N/A'}\n`;
    if (seg.isManual) content += `Type: Manual\n`;
    content += `Order: ${seg.orderIndex || 0}\n`;
    content += '\n';
    content += seg.content || '';
    content += '\n\n';
    content += '---\n\n';
  });

  return content;
}

/**
 * Export segments to Markdown
 */
export function exportSegmentsToMD(segments: any[], options: ExportOptions = { format: 'md' }): string {
  let content = '';
  
  if (options.includeMetadata) {
    content += `# Segments Export\n\n`;
    content += `**Total Segments:** ${segments.length}\n\n`;
    content += `**Export Date:** ${new Date().toISOString()}\n\n`;
    content += '---\n\n';
  }

  segments.forEach((seg, index) => {
    content += `## ${index + 1}. ${seg.title || 'Untitled'}\n\n`;
    content += `**Mode:** ${seg.mode || 'N/A'}\n\n`;
    if (seg.isManual) content += `**Type:** Manual\n\n`;
    content += `**Order:** ${seg.orderIndex || 0}\n\n`;
    content += `${seg.content || ''}\n\n`;
    content += '---\n\n';
  });

  return content;
}

/**
 * Download file
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Calculate document statistics
 */
export function calculateDocumentStats(text: string): {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
} {
  const trimmed = text.trim();
  
  return {
    characters: trimmed.length,
    charactersNoSpaces: trimmed.replace(/\s/g, '').length,
    words: trimmed.split(/\s+/).filter(w => w.length > 0).length,
    sentences: trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
    paragraphs: trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0).length,
    lines: trimmed.split('\n').length,
  };
}

