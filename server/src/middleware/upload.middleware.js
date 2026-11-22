import multer from 'multer';
const storage = multer.memoryStorage();

// File Filter (Only Images and PDFs allowed)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
});

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const extension = file.originalname.toLowerCase().match(/\.(csv|xlsx)$/)?.[1];
    if (extension) return cb(null, true);
    const error = new Error('Only CSV and XLSX roster files up to 5 MB are supported. Save legacy XLS files as XLSX first.');
    error.status = 400;
    return cb(error, false);
  },
});
