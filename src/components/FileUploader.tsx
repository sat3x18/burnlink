import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileUp, X, File, Image, FileText, Film, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  files: File[];
  setFiles: (files: File[]) => void;
  maxSize?: number;
  maxFiles?: number;
}

export function FileUploader({
  files,
  setFiles,
  maxSize = 50 * 1024 * 1024, // 50MB
  maxFiles = 10,
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles);
      setFiles(newFiles);
    },
    [files, setFiles, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
    maxFiles: maxFiles - files.length,
  });

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return Image;
    if (file.type.startsWith("video/")) return Film;
    if (file.type.startsWith("audio/")) return Music;
    if (file.type.includes("pdf") || file.type.includes("document")) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300",
          isDragActive
            ? "border-primary bg-primary/10"
            : "border-border/50 hover:border-primary/50 hover:bg-card/50"
        )}
      >
        <input {...getInputProps()} />
        <FileUp
          className={cn(
            "w-12 h-12 mx-auto mb-4 transition-colors",
            isDragActive ? "text-primary" : "text-muted-foreground"
          )}
        />
        {isDragActive ? (
          <p className="text-primary font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="font-medium mb-1">Drag & drop files here</p>
            <p className="text-sm text-muted-foreground">
              or click to browse • Max {maxFiles} files, {formatFileSize(maxSize)} each
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => {
            const Icon = getFileIcon(file);
            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground text-center">
            {files.length} file{files.length !== 1 ? "s" : ""} •{" "}
            {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))} total
          </p>
        </div>
      )}
    </div>
  );
}
