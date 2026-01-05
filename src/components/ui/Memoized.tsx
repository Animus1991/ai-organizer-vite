// src/components/ui/Memoized.tsx
import { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

// Memoized Segment Item
interface SegmentItemProps {
  segment: {
    id: number;
    title: string;
    content: string;
    mode: string;
    orderIndex: number;
  };
  onClick: (segment: any) => void;
  className?: string;
}

export const SegmentItem = memo<SegmentItemProps>(({ segment, onClick, className }) => {
  const handleClick = useCallback(() => {
    onClick(segment);
  }, [segment, onClick]);

  const previewContent = useMemo(() => {
    const oneLine = (segment.content ?? "").replace(/\s+/g, " ").trim();
    return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
  }, [segment.content]);

  return (
    <div
      className={cn(
        "p-3 bg-surface-elevated border border-border rounded-lg cursor-pointer hover:bg-surface transition-colors",
        className
      )}
      onClick={handleClick}
    >
      <div className="font-medium">{segment.title}</div>
      <div className="text-sm text-secondary">{previewContent}</div>
      <div className="text-xs text-secondary mt-1">
        {segment.mode} • {segment.orderIndex}
      </div>
    </div>
  );
});

SegmentItem.displayName = 'SegmentItem';

// Memoized Upload Item
interface UploadItemProps {
  upload: {
    uploadId: number;
    documentId: number;
    filename: string;
    sizeBytes: number;
    parseStatus: string;
    parseError?: string;
  };
  selected: boolean;
  onSelect: (documentId: number) => void;
  className?: string;
}

export const UploadItem = memo<UploadItemProps>(({ upload, selected, onSelect, className }) => {
  const handleClick = useCallback(() => {
    onSelect(upload.documentId);
  }, [upload.documentId, onSelect]);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const statusBadge = useCallback((parseStatus?: string) => {
    if (parseStatus === "ok") return "✅ ok";
    if (parseStatus === "failed") return "⛔ failed";
    if (parseStatus === "pending") return "⏳ pending";
    return parseStatus ? `• ${parseStatus}` : "—";
  }, []);

  return (
    <div
      className={cn(
        "p-3 bg-surface-elevated border border-border rounded-lg cursor-pointer hover:bg-surface transition-colors",
        selected && "border-primary",
        className
      )}
      onClick={handleClick}
    >
      <div className="font-medium">{upload.filename}</div>
      <div className="text-sm text-secondary">
        {formatFileSize(upload.sizeBytes)} • {statusBadge(upload.parseStatus)}
      </div>
      {upload.parseStatus === "failed" && upload.parseError && (
        <div className="text-xs text-red-400 mt-1">
          {upload.parseError}
        </div>
      )}
    </div>
  );
});

UploadItem.displayName = 'UploadItem';

// Memoized Search Input
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export const SearchInput = memo<SearchInputProps>(({ 
  value, 
  onChange, 
  placeholder = "Search...", 
  className,
  debounceMs = 300 
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, onChange, debounceMs]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg",
        className
      )}
    />
  );
});

SearchInput.displayName = 'SearchInput';
