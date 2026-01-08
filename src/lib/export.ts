// src/lib/export.ts
import type { UploadItemDTO } from './api';

export interface ExportOptions {
  format: 'json' | 'csv' | 'txt' | 'md';
  includeMetadata?: boolean;
  includeSegments?: boolean;
  segmentMode?: 'all' | 'qa' | 'paragraphs';
}

export interface DocumentExportData {
  document: UploadItemDTO;
  segments?: any[];
  metadata?: {
    exportDate: string;
    exportFormat: string;
    totalCount: number;
  };
}

export class DocumentExporter {
  static async exportDocument(
    document: UploadItemDTO,
    segments: any[] = [],
    options: ExportOptions = { format: 'json' }
  ): Promise<void> {
    const exportData: DocumentExportData = {
      document,
      segments: options.includeSegments ? segments : undefined,
      metadata: options.includeMetadata ? {
        exportDate: new Date().toISOString(),
        exportFormat: options.format,
        totalCount: segments.length
      } : undefined
    };

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (options.format) {
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        filename = `${this.sanitizeFileName(document.filename)}.json`;
        mimeType = 'application/json';
        break;

      case 'csv':
        content = this.convertToCSV(exportData);
        filename = `${this.sanitizeFileName(document.filename)}.csv`;
        mimeType = 'text/csv';
        break;

      case 'txt':
        content = this.convertToTXT(exportData);
        filename = `${this.sanitizeFileName(document.filename)}.txt`;
        mimeType = 'text/plain';
        break;

      case 'md':
        content = this.convertToMarkdown(exportData);
        filename = `${this.sanitizeFileName(document.filename)}.md`;
        mimeType = 'text/markdown';
        break;

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    this.downloadFile(content, filename, mimeType);
  }

  static async exportMultipleDocuments(
    documents: UploadItemDTO[],
    segmentsMap: Map<number, any[]>,
    options: ExportOptions = { format: 'json' }
  ): Promise<void> {
    const exportData = documents.map(doc => ({
      document: doc,
      segments: options.includeSegments 
        ? (segmentsMap.get(doc.documentId) || []).filter(seg => 
            !options.segmentMode || options.segmentMode === 'all' || seg.mode === options.segmentMode
          )
        : undefined,
      metadata: options.includeMetadata ? {
        exportDate: new Date().toISOString(),
        exportFormat: options.format,
        totalCount: segmentsMap.get(doc.documentId)?.length || 0
      } : undefined
    }));

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (options.format) {
      case 'json':
        content = JSON.stringify({
          exportDate: new Date().toISOString(),
          totalDocuments: documents.length,
          documents: exportData
        }, null, 2);
        filename = `documents_export_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
        break;

      case 'csv':
        content = this.convertMultipleToCSV(exportData);
        filename = `documents_export_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;

      case 'txt':
        content = this.convertMultipleToTXT(exportData);
        filename = `documents_export_${new Date().toISOString().split('T')[0]}.txt`;
        mimeType = 'text/plain';
        break;

      case 'md':
        content = this.convertMultipleToMarkdown(exportData);
        filename = `documents_export_${new Date().toISOString().split('T')[0]}.md`;
        mimeType = 'text/markdown';
        break;

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    this.downloadFile(content, filename, mimeType);
  }

  private static convertToCSV(data: DocumentExportData): string {
    if (!data.segments || data.segments.length === 0) {
      return 'No segments to export';
    }

    const headers = ['ID', 'Title', 'Content', 'Mode', 'Order Index', 'Created At'];
    const rows = data.segments.map(segment => [
      segment.id || '',
      `"${this.escapeCSVField(segment.title || '')}"`,
      `"${this.escapeCSVField(segment.content || '')}"`,
      segment.mode || '',
      segment.orderIndex || '',
      segment.createdAt || ''
    ]);

    return [headers.join(','), ...rows].join('\n');
  }

  private static convertMultipleToCSV(data: DocumentExportData[]): string {
    const headers = ['Document ID', 'Filename', 'Status', 'Size (bytes)', 'Upload ID', 'Segment Count', 'Created At'];
    const rows = data.map(item => [
      item.document.documentId || '',
      `"${this.escapeCSVField(item.document.filename || '')}"`,
      item.document.parseStatus || '',
      item.document.sizeBytes || '',
      item.document.uploadId || '',
      item.segments?.length || 0,
      item.document.createdAt || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
  }

  private static convertMultipleToTXT(data: DocumentExportData[]): string {
    let content = `Batch Export - ${data.length} Document(s)\n`;
    content += `Export Date: ${new Date().toISOString()}\n`;
    content += '='.repeat(80) + '\n\n';

    data.forEach((item, index) => {
      content += `Document ${index + 1}: ${item.document.filename}\n`;
      content += '-'.repeat(80) + '\n';
      content += `ID: ${item.document.documentId}\n`;
      content += `Status: ${item.document.parseStatus}\n`;
      content += `Size: ${item.document.sizeBytes} bytes\n`;
      content += `Segments: ${item.segments?.length || 0}\n`;
      
      if (item.segments && item.segments.length > 0) {
        content += '\nSegments:\n';
        item.segments.forEach((segment, segIndex) => {
          content += `  ${segIndex + 1}. ${segment.title || 'Untitled'}\n`;
          content += `     Mode: ${segment.mode}\n`;
          content += `     Content: ${(segment.content || '').substring(0, 100)}${(segment.content || '').length > 100 ? '...' : ''}\n`;
        });
      }
      
      content += '\n' + '='.repeat(80) + '\n\n';
    });

    return content;
  }

  private static convertMultipleToMarkdown(data: DocumentExportData[]): string {
    let content = `# Batch Export - ${data.length} Document(s)\n\n`;
    content += `**Export Date:** ${new Date().toISOString()}\n\n`;
    content += '---\n\n';

    data.forEach((item, index) => {
      content += `## Document ${index + 1}: ${item.document.filename}\n\n`;
      content += `- **ID:** ${item.document.documentId}\n`;
      content += `- **Status:** ${item.document.parseStatus}\n`;
      content += `- **Size:** ${item.document.sizeBytes} bytes\n`;
      content += `- **Segments:** ${item.segments?.length || 0}\n\n`;
      
      if (item.segments && item.segments.length > 0) {
        content += '### Segments\n\n';
        item.segments.forEach((segment, segIndex) => {
          content += `#### ${segIndex + 1}. ${segment.title || 'Untitled'}\n\n`;
          content += `**Mode:** ${segment.mode}\n\n`;
          content += `${segment.content || ''}\n\n`;
          content += '---\n\n';
        });
      }
      
      content += '\n';
    });

    return content;
  }

  private static convertToTXT(data: DocumentExportData): string {
    let content = `Document: ${data.document.filename}\n`;
    content += `Status: ${data.document.parseStatus}\n`;
    content += `Size: ${data.document.sizeBytes} bytes\n\n`;

    if (data.segments && data.segments.length > 0) {
      content += 'Segments:\n';
      content += '=' .repeat(50) + '\n\n';
      
      data.segments.forEach((segment, index) => {
        content += `${index + 1}. ${segment.title}\n`;
        content += `Mode: ${segment.mode}\n`;
        content += `Content:\n${segment.content}\n`;
        content += '-'.repeat(30) + '\n\n';
      });
    }

    return content;
  }

  private static convertToMarkdown(data: DocumentExportData): string {
    let content = `# ${data.document.filename}\n\n`;
    
    if (data.metadata) {
      content += '## Document Information\n\n';
      content += `- **Status:** ${data.document.parseStatus}\n`;
      content += `- **Size:** ${data.document.sizeBytes} bytes\n`;
      content += `- **Export Date:** ${data.metadata.exportDate}\n\n`;
    }

    if (data.segments && data.segments.length > 0) {
      content += '## Segments\n\n';
      
      data.segments.forEach((segment, index) => {
        content += `### ${index + 1}. ${segment.title}\n\n`;
        content += `**Mode:** ${segment.mode}\n\n`;
        content += `${segment.content}\n\n`;
        content += '---\n\n';
      });
    }

    return content;
  }

  private static escapeCSVField(field: string): string {
    return field.replace(/"/g, '""');
  }

  private static sanitizeFileName(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
}

// Export presets for common use cases
export const EXPORT_PRESETS = {
  FULL_DOCUMENT: {
    format: 'json' as const,
    includeMetadata: true,
    includeSegments: true
  },
  SEGMENTS_ONLY: {
    format: 'csv' as const,
    includeMetadata: false,
    includeSegments: true
  },
  METADATA_ONLY: {
    format: 'json' as const,
    includeMetadata: true,
    includeSegments: false
  },
  READABLE_FORMAT: {
    format: 'md' as const,
    includeMetadata: true,
    includeSegments: true
  }
} as const;
