/*
  Listing images: validated and re-encoded with sharp, stored on local disk.
  (The docs use Cloudinary, which needs an account; the storage calls are isolated here so it can be swapped.)
*/
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config/index.js';
import { BadRequestError } from '../utils/errors.js';

export const MAX_IMAGES_PER_LISTING = 5;

const root = () => path.resolve(config.uploadDir);

class ImageService {
  /** Re-encode to WebP (max 1600px), which also strips EXIF/GPS metadata and rejects non-images */
  async saveListingImage(listingId: string, buffer: Buffer): Promise<string> {
    const dir = path.join(root(), 'listings', listingId);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.webp`;

    try {
      await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(dir, filename));
    } catch {
      throw new BadRequestError('One of the files is not a valid image (use JPEG, PNG or WebP).');
    }

    return `/uploads/listings/${listingId}/${filename}`;
  }

  async removeByUrl(url: string): Promise<void> {
    const rel = url.replace(/^\/uploads\//, '');
    const target = path.resolve(root(), rel);
    // Never delete outside the upload directory
    if (!target.startsWith(root() + path.sep)) return;
    await fs.rm(target, { force: true });
  }

  async removeListingDir(listingId: string): Promise<void> {
    await fs.rm(path.join(root(), 'listings', listingId), { recursive: true, force: true });
  }
}

export const imageService = new ImageService();
