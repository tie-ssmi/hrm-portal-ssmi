import React, { useState, useEffect, type ChangeEvent } from 'react';
import { uploadEmployeeImage } from '@/helpers/firebaseStorage';
import { Camera } from 'lucide-react';

interface Props {
  // ຖ້າບໍ່ສົ່ງມາຈະໃຊ້ "ImageUpload"
  imageId?: string; // ຖ້າບໍ່ສົ່ງມາຈະ auto generate UUID
  imageType?: 'profile' | 'idCard' | 'photo3x4'| 'criminalRecord' | 'declaration'; // ປະເພດຮູບ
  employeeId?: string; // Employee UID for Firestore updates
  updateFirestore?: boolean; // Whether to update Firestore immediately
  label?: string;
  oldUrl?: string; // ລິ້ງຮູບເກົ່າ (optional)
  onImageSelected?: (file: File | null, preview: string | null, uuid: string) => void;
  onUploadComplete?: (url: string, uuid: string) => void;
  onUploadError?: () => void;
  previewSize?: 'small' | 'medium' | 'large';
}

// Generate UUID v4
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const ImageUpload: React.FC<Props> = ({ 
  imageId: propImageId, 
  imageType = 'profile',
  employeeId = '',
  updateFirestore = false,
  oldUrl='',
  onImageSelected,
  onUploadComplete,
  onUploadError
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string>(propImageId || '');

  // Auto generate UUID if not provided
  useEffect(() => {
    if (!propImageId) {
      setImageId(generateUUID());
    }
  }, [propImageId]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      if (!selectedFile.type.startsWith("image/")) {
        alert("ກະລຸນາເລືອກໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (PNG, JPG, WEBP, ...)");
        return;
      }

      if (selectedFile.size > 20 * 1024 * 1024) {
        alert("File is too large! Max 20MB.");
        return;
      }

      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);

      if (onImageSelected) {
        onImageSelected(selectedFile, previewUrl, imageId);
      }

      setLoading(true);
      try {
        const url = await uploadEmployeeImage(selectedFile, employeeId || imageId, imageType, updateFirestore);
        if (url && onUploadComplete) {
          onUploadComplete(url, imageId);
        } else {
          onUploadError?.();
        }
      } catch {
        onUploadError?.();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Upload Area */}
      <label className="relative flex flex-col items-center justify-center w-full gap-3 p-8 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors overflow-hidden" style={{ minHeight: '200px' }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange}
          disabled={loading}
          className="hidden"
        />
        
        {preview ? (
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-auto max-h-48 object-scale-down" 
          />
        ) : oldUrl ? (
          <img 
            src={oldUrl} 
            alt="Old Preview" 
            className="w-full h-auto max-h-48 object-scale-down" 
          />
        ) : (
          <>
            <Camera className="w-10 h-10 text-blue-500" />
            <span className="text-base font-semibold text-blue-600">ເລືອກຮູບ</span>
            <span className="text-sm text-gray-500">ເລືອກຮູບໂພລະຢາວສືບໃນ 5 MB</span>
          </>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
            <span className="text-sm text-gray-600">ກຳລັງອັບໂຫຼດ...</span>
          </div>
        )}
      </label>
    </div>
  );
};

export default ImageUpload;
export { ImageUpload };