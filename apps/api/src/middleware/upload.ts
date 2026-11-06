import multer from 'multer';
import { BadRequestError } from '../utils/errors.js';
import { MAX_IMAGES_PER_LISTING } from '../services/image.service.js';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB per file

/** Up to 5 files in the "images" field, held in memory so sharp can validate and re-encode them */
export const uploadListingImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_IMAGES_PER_LISTING },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new BadRequestError('Only JPEG, PNG or WebP images are accepted'));
  },
}).array('images', MAX_IMAGES_PER_LISTING);
