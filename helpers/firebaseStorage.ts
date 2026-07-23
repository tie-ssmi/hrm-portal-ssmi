import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";

// Storage base path: gs://hrm-ssmi.firebasestorage.app/images

function convertToWebp(file: File, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    if (file.type === 'image/webp') { resolve(file); return; }
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
          resolve(new File([blob], name, { type: 'image/webp' }));
        },
        'image/webp',
        quality,
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

// Generate UUID v4
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Upload image with UUID filename (returns URL only, does not update Firestore)
export const uploadImageWithUUID = async (
  file: File,
  folder: string = 'images'
): Promise<{ url: string | null; uuid: string }> => {
  const uuid = generateUUID();
  try {
    const webpFile = await convertToWebp(file);
    const fileExtension = webpFile.name.split('.').pop()?.toLowerCase() || 'webp';
    const storageRef = ref(storage, `${folder}/${uuid}.${fileExtension}`);
    
    const snapshot = await uploadBytes(storageRef, webpFile);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return { url: downloadURL, uuid };
  } catch (error) {
    console.error("Upload error:", error);
    return { url: null, uuid };
  }
};

export const uploadEmployeeImage = async (
  file: File,
  employeeId: string,
  imageType: 'profile' | 'idCard' | 'photo3x4' | 'criminalRecord' | 'declaration' = 'profile',
  updateFirestore: boolean = false
): Promise<string | null> => {
  try {
    const uuid = generateUUID();
    const webpFile = await convertToWebp(file);
    const fileExtension = webpFile.name.split('.').pop()?.toLowerCase() || 'webp';
    const folderByType: Record<typeof imageType, string> = {
      profile: 'images/profiles',
      idCard: 'images/idCards',
      photo3x4: 'images/photo3x4',
      criminalRecord: 'images/criminalRecords',
      declaration: 'images/declarations',
    };
    const firestoreFieldByType: Record<typeof imageType, string> = {
      profile: 'profileImage',
      idCard: 'idCardPhotoUrl',
      photo3x4: 'photo3x4Url',
      criminalRecord: 'criminalRecordUrl',
      declaration: 'declarationUrl',
    };
    const storageRef = ref(storage, `${folderByType[imageType]}/${uuid}.${fileExtension}`);

    const snapshot = await uploadBytes(storageRef, webpFile);
    const downloadURL = await getDownloadURL(snapshot.ref);

    if (updateFirestore && employeeId) {
      const employeeDoc = doc(db, "employees", employeeId);
      await updateDoc(employeeDoc, {
        [firestoreFieldByType[imageType]]: downloadURL,
        updatedAt: new Date(),
      });
    }

    return downloadURL;
  } catch (error) {
    console.error("Upload error:", error);
    return null;
  }
};

export const uploadEmployeeDocument = async (
  file: File, 
  employeeId: string,
  updateFirestore: boolean = false
): Promise<string | null> => {
  try {
    // 1. Create Reference with UUID filename in /doc folder
    const uuid = generateUUID();
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const storageRef = ref(storage, `doc/${uuid}.${fileExtension}`);

    // 2. Upload
    const snapshot = await uploadBytes(storageRef, file);
    
    // 3. Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    // 4. Update Firestore with the document URL (optional)
    if (updateFirestore && employeeId) {
      const employeeDoc = doc(db, "employees", employeeId);
      const updateData: Record<string, any> = { 
        documentUrl: downloadURL,
        updatedAt: new Date() 
      };
      
      await updateDoc(employeeDoc, updateData);
    }

    return downloadURL;
  } catch (error) {
    console.error("Document upload error:", error);
    return null;
  }
};

export const uploadMultipleImages = async (
  files: { file: File; type: 'profile' | 'idCard' | 'photo3x4' | 'criminalRecord' | 'declaration' }[],
  employeeId: string
): Promise<Record<string, string | null>> => {
  const results: Record<string, string | null> = {};
  
  for (const { file, type } of files) {
    results[type] = await uploadEmployeeImage(file, employeeId, type);
  }
  
  return results;
};

// Get employee data
export const getEmployeeData = async (employeeId: string): Promise<Record<string, unknown>> => {
  const employeeDoc = await getDoc(doc(db, "employees", employeeId));
  const data = employeeDoc.data();
  return data ?? {};
};

//get image URL by type
export const getEmployeeImageUrl = async (
  employeeId: string,
  imageType: 'profile' | 'idCard' | 'photo3x4' | 'criminalRecord' | 'declaration' = 'profile'
): Promise<string | null> => {
  const employeeData = await getEmployeeData(employeeId);
  const fieldByType: Record<typeof imageType, string> = {
    profile: 'profileImage',
    idCard: 'idCardPhotoUrl',
    photo3x4: 'photo3x4Url',
    criminalRecord: 'criminalRecordUrl',
    declaration: 'declarationUrl',
  };
  return (employeeData[fieldByType[imageType]] as string) ?? null;
};
