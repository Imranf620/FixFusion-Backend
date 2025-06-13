import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = 'uploads/profileImages';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Check if directory exists, if not create it
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

export const uploadProfileImage = multer({ storage, fileFilter });
