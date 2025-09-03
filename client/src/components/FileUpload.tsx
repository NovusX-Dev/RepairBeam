import { useState, useRef, useCallback } from "react";
import { Upload, X, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
  preview?: string | null;
  onClearPreview?: () => void;
  className?: string;
}

const DEFAULT_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const DEFAULT_MAX_SIZE = 5; // 5MB

export function FileUpload({ 
  onFileSelect, 
  maxSize = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  preview,
  onClearPreview,
  className 
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File) => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      const allowedExtensions = acceptedTypes.map(type => 
        type.replace('image/', '').toUpperCase()
      ).join(', ');
      return `Please select a valid image file (${allowedExtensions})`;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `File size must be less than ${maxSize}MB`;
    }

    return null;
  }, [acceptedTypes, maxSize]);

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(file);
  }, [validateFile, onFileSelect]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearPreview = useCallback(() => {
    if (onClearPreview) {
      onClearPreview();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
  }, [onClearPreview]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* File Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragOver 
            ? "border-cyan-400 bg-cyan-950/20" 
            : "border-slate-600 hover:border-slate-500",
          "hover:bg-slate-700/30"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        data-testid="file-upload-area"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          data-testid="file-input"
        />
        
        <div className="flex flex-col items-center space-y-3">
          <Upload className={cn(
            "w-8 h-8 transition-colors",
            isDragOver ? "text-cyan-400" : "text-slate-400"
          )} />
          
          <div>
            <p className="text-sm font-medium text-slate-200">
              Drop your image here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports PNG, JPEG, JPG up to {maxSize}MB
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-400 bg-red-950/20 border border-red-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">Preview:</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearPreview}
              className="h-auto p-1 text-slate-400 hover:text-slate-200"
              data-testid="button-clear-preview"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative inline-block">
            <img 
              src={preview} 
              alt="Logo preview" 
              className="w-20 h-20 object-contain rounded-lg border border-slate-500 bg-slate-600/50"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}