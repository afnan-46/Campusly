const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { HttpError } = require('../utils/http');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // Random file names, so nobody can guess or overwrite another report's photo.
  filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + ALLOWED[file.mimetype]),
});

const uploadPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(new HttpError(400, 'The photo must be a JPG, PNG, WebP or GIF image.'));
  },
}).single('photo');

module.exports = { uploadPhoto, UPLOAD_DIR };
