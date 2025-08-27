import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Image } from "lucide-react";

interface ShopImageUploaderProps {
  currentImageUrl?: string;
  onImageUpload: (imageUrl: string) => void;
  disabled?: boolean;
}

export function ShopImageUploader({ 
  currentImageUrl, 
  onImageUpload, 
  disabled 
}: ShopImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setUploading(true);
    
    try {
      // Get upload URL
      const response = await fetch('/api/shop-images/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to get upload URL');
      
      const { uploadURL } = await response.json();

      // Upload file to cloud storage
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error('Failed to upload image');

      // Notify parent component with the uploaded image URL
      onImageUpload(uploadURL.split('?')[0]); // Remove query params to get clean URL
      
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
      >
        {currentImageUrl ? (
          <div className="space-y-3">
            <img
              src={currentImageUrl}
              alt="Shop logo"
              className="w-24 h-24 object-cover rounded-lg mx-auto border"
            />
            <p className="text-sm text-muted-foreground">
              Drop a new image here or click to change
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center mx-auto">
              <Image className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Drop your shop logo here</p>
              <p className="text-sm text-muted-foreground">
                Or click to browse files (PNG, JPG up to 5MB)
              </p>
            </div>
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          disabled={disabled || uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
        className="w-full"
        data-testid="button-upload-image"
      >
        <Upload className="w-4 h-4 mr-2" />
        {uploading ? 'Uploading...' : 'Choose File'}
      </Button>
    </div>
  );
}