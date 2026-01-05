// src/components/ExportDialog.tsx
import { useState } from 'react';
import { DocumentExporter, ExportOptions, EXPORT_PRESETS } from '../lib/export';
import type { UploadItemDTO } from '../lib/api';
import { LoadingSpinner } from './ui/Spinner';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: UploadItemDTO | null;
  segments: any[];
}

export function ExportDialog({ isOpen, onClose, document, segments }: ExportDialogProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeMetadata: true,
    includeSegments: true
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!document) return;

    setIsExporting(true);
    try {
      await DocumentExporter.exportDocument(document, segments, exportOptions);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePresetClick = (preset: keyof typeof EXPORT_PRESETS) => {
    setExportOptions(EXPORT_PRESETS[preset]);
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-border rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Export Document</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Document Info */}
          <div className="bg-surface-elevated p-3 rounded-lg">
            <h3 className="font-medium mb-2">{document.filename}</h3>
            <div className="text-sm text-secondary space-y-1">
              <div>Status: {document.parseStatus}</div>
              <div>Size: {(document.sizeBytes / 1024).toFixed(1)} KB</div>
              <div>Segments: {segments.length}</div>
            </div>
          </div>

          {/* Export Presets */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Quick Presets</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handlePresetClick('FULL_DOCUMENT')}
                className="px-3 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface text-sm"
              >
                Full Document
              </button>
              <button
                onClick={() => handlePresetClick('SEGMENTS_ONLY')}
                className="px-3 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface text-sm"
              >
                Segments Only
              </button>
              <button
                onClick={() => handlePresetClick('METADATA_ONLY')}
                className="px-3 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface text-sm"
              >
                Metadata Only
              </button>
              <button
                onClick={() => handlePresetClick('READABLE_FORMAT')}
                className="px-3 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface text-sm"
              >
                Readable Format
              </button>
            </div>
          </div>

          {/* Export Options */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Export Options</label>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-secondary mb-1">Format</label>
                <select
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    format: e.target.value as ExportOptions['format']
                  }))}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="txt">Plain Text</option>
                  <option value="md">Markdown</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeMetadata}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      includeMetadata: e.target.checked
                    }))}
                  />
                  Include metadata
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeSegments}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      includeSegments: e.target.checked
                    }))}
                  />
                  Include segments
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isExporting ? (
                <LoadingSpinner text="Exporting..." />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
