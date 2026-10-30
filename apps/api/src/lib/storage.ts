import type { Db } from './db';

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_BYTES = 3.5 * 1024 * 1024;

/** Uploads a product image to the public `product-images` bucket. */
export async function uploadImage(
  db: Db,
  shopId: string,
  contentType: string,
  dataBase64: string,
): Promise<{ url: string } | { error: string }> {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) return { error: 'Unsupported image type' };

  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length === 0) return { error: 'Empty file' };
  if (bytes.length > MAX_BYTES) return { error: 'File too large (max 3.5 MB)' };

  const path = `${shopId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await db.storage.from('product-images').upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data } = db.storage.from('product-images').getPublicUrl(path);
  return { url: data.publicUrl };
}
