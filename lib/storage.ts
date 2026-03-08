import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import path from 'path';

// Parse private key properly if it contains \n string literals from env
const privateKey = process.env.GCS_PRIVATE_KEY
  ? process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

let storageClient: Storage | null = null;
if (process.env.GCS_PROJECT_ID && process.env.GCS_CLIENT_EMAIL && privateKey) {
  storageClient = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: {
      client_email: process.env.GCS_CLIENT_EMAIL,
      private_key: privateKey,
    },
  });
}

export const gcsBucketName = process.env.GCS_BUCKET_NAME || 'gugolfproject';

/**
 * Uploads a file to Google Cloud Storage.
 * If the file is a standard image (not GIF/WebP), it also generates and uploads a .webp optimized version alongside it.
 */
export async function uploadToGCS(
  filePath: string,
  buffer: Buffer,
  contentType: string = 'image/png'
): Promise<string> {
  if (!storageClient) {
    throw new Error('Google Cloud Storage is not configured in environment variables.');
  }

  const bucket = storageClient.bucket(gcsBucketName);
  
  // 1. Upload original file
  const originalFile = bucket.file(filePath);
  await originalFile.save(buffer, {
    contentType,
  });
  
  // 2. If it's a standard image, create and upload a WebP version
  if (contentType.startsWith('image/') && !['image/webp', 'image/gif'].includes(contentType)) {
    try {
      const webpBuffer = await sharp(buffer)
        .webp({ quality: 80 })
        .toBuffer();
        
      const parsedPath = path.parse(filePath);
      const webpFilePath = parsedPath.dir 
          ? `${parsedPath.dir}/${parsedPath.name}.webp`
          : `${parsedPath.name}.webp`;
      
      const webpFile = bucket.file(webpFilePath);
      await webpFile.save(webpBuffer, {
        contentType: 'image/webp',
      });
      console.log(`[Storage] Automatically generated & uploaded WebP: ${webpFilePath}`);
    } catch (webpError) {
      console.error('[Storage] Failed to generate WebP version:', webpError);
      // We don't throw here; the original file uploaded fine
    }
  }

  // Return the public URL for the original file
  return `https://storage.googleapis.com/${gcsBucketName}/${filePath}`;
}

/**
 * Deletes a file (and its .webp counterpart if it exists) from GCS
 */
export async function deleteFromGCS(filePathOrUrl: string) {
  if (!storageClient) return false;

  try {
    const bucket = storageClient.bucket(gcsBucketName);
    
    // Extract object path from full URL if necessary
    let objectName = filePathOrUrl;
    if (filePathOrUrl.includes('storage.googleapis.com')) {
        const url = new URL(filePathOrUrl);
        // The pathname includes the bucket name like /gugolfproject/content/image.png
        objectName = decodeURIComponent(url.pathname.replace(`/${gcsBucketName}/`, ''));
    }

    // 1. Delete original
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (exists) {
        await file.delete();
        console.log(`[Storage] Deleted original: ${objectName}`);
    }
    
    // 2. Attempt to delete WebP counterpart
    const parsedPath = path.parse(objectName);
    const webpObjectName = parsedPath.dir 
        ? `${parsedPath.dir}/${parsedPath.name}.webp`
        : `${parsedPath.name}.webp`;
        
    const webpFile = bucket.file(webpObjectName);
    const [webpExists] = await webpFile.exists();
    if (webpExists) {
        await webpFile.delete();
        console.log(`[Storage] Deleted WebP: ${webpObjectName}`);
    }
    
    return true;
  } catch (err: any) {
    console.error('[Storage] GCS delete failed:', err);
    return false;
  }
}

export async function uploadToStorage(
    bucket: string,
    path: string,
    fileBody: Buffer | any, // Use 'any' to bypass TS issues with Blob/File in Node if needed
    contentType: string = 'image/png',
    maxRetries: number = 3
): Promise<string> {
    // Determine Buffer
    let buffer: Buffer;
    if (Buffer.isBuffer(fileBody)) {
        buffer = fileBody;
    } else if (fileBody && typeof fileBody.arrayBuffer === 'function') {
        const arrayBuffer = await fileBody.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
    } else {
        throw new Error('Invalid file format provided for GCS upload');
    }

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Prepend the Supabase bucket name to the path so files are organized in GCS folders
            const fullPath = `${bucket}/${path}`;
            const publicUrl = await uploadToGCS(fullPath, buffer, contentType);
            return publicUrl;
        } catch (err: any) {
            lastError = err;
            console.warn(`[Attempt ${attempt}/${maxRetries}] Storage upload failed for ${path}: ${err.message}`);
            if (attempt < maxRetries) {
                // Exponential backoff: 2s, 4s, 8s...
                await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
            }
        }
    }

    throw new Error(`Failed to upload to GCS after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}
