// src/components/ui/ProgressBar.tsx
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showPercentage = true,
  size = 'md'
}: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-2">
        <div className={cn('flex-1 bg-surface-elevated rounded-full overflow-hidden', sizeClasses[size])}>
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showPercentage && (
          <span className="text-xs text-secondary min-w-[3rem] text-right">
            {percentage}%
          </span>
        )}
      </div>
    </div>
  );
}

interface FileUploadProgressProps {
  progress: { loaded: number; total: number; percentage: number };
  fileName?: string;
  className?: string;
}

export function FileUploadProgress({
  progress,
  fileName,
  className
}: FileUploadProgressProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn('bg-surface border border-border rounded-lg p-4', className)}>
      {fileName && (
        <div className="text-sm text-secondary mb-2 truncate">
          {fileName}
        </div>
      )}
      <ProgressBar value={progress.percentage} size="sm" />
      <div className="flex justify-between text-xs text-secondary mt-1">
        <span>{formatBytes(progress.loaded)}</span>
        <span>{formatBytes(progress.total)}</span>
      </div>
    </div>
  );
}
