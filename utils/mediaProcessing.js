const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

// Common website-standard dimensions
const MEDIA_STANDARDS = {
  images: {
    maxWidth: 720,
    maxHeight: 720,
    quality: 80,
    format: 'webp',
  },
  videos: {
    width: 1280,
    height: 720,
    fps: 30,
    videoBitrate: '1500k',
    audioBitrate: '128k',
  },
};

exports.validateFileSize = (req, res, next) => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  console.log(`File in processing: ${req.file}`);

  if (req.file) {
    const fileSize =
      req.file.size || (req.file.buffer ? req.file.buffer.length : 0);

    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        status: 'error',
        message: 'File size exceeds the maximum limit of 50MB',
      });
    }
  }

  next();
};

// Middleware for image preprocessing
exports.preprocessImage = async (req, res, next) => {
  if (!req.file || !req.file.buffer) return next();

  try {
    // Ensure the file is an image
    const fileType = req.file.mimetype.split('/')[0];
    if (fileType !== 'image') return next();

    // Log input file details for debugging
    console.log('Original Image Details:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      originalSize: req.file.buffer.length,
    });

    // Process image using Sharp
    const processedImage = await sharp(req.file.buffer)
      .resize({
        width: MEDIA_STANDARDS.images.maxWidth,
        height: MEDIA_STANDARDS.images.maxHeight,
        fit: 'inside', // Maintain aspect ratio
        withoutEnlargement: true, // Don't upscale smaller images
      })
      .toFormat(MEDIA_STANDARDS.images.format, {
        quality: MEDIA_STANDARDS.images.quality,
      })
      .toBuffer();

    // Log processed image details
    console.log('Processed Image Details:', {
      processedSize: processedImage.length,
      format: MEDIA_STANDARDS.images.format,
      maxWidth: MEDIA_STANDARDS.images.maxWidth,
      maxHeight: MEDIA_STANDARDS.images.maxHeight,
    });

    // Replace original file buffer with processed buffer
    req.file.buffer = processedImage;
    req.file.size = processedImage.length;
    req.file.originalname = `processed.${MEDIA_STANDARDS.images.format}`;
    req.file.mimetype = `image/${MEDIA_STANDARDS.images.format}`;

    next();
  } catch (error) {
    console.error('Image preprocessing error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Image preprocessing failed',
      details: error.message,
    });
  }
};
// Middleware for video preprocessing
exports.preprocessVideo = async (req, res, next) => {
  if (!req.file || !req.file.buffer) return next();

  try {
    const fileType = req.file.mimetype.split('/')[0];

    if (fileType === 'video') {
      // Create a temporary file for processing
      const tempInputPath = path.join(
        __dirname,
        `temp_input_${Date.now()}.mp4`
      );
      const tempOutputPath = path.join(
        __dirname,
        `processed_${Date.now()}.mp4`
      );

      // Write buffer to temp file
      await fs.writeFile(tempInputPath, req.file.buffer);

      // Process video
      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .videoCodec('libx264')
          .size(
            `${MEDIA_STANDARDS.videos.width}x${MEDIA_STANDARDS.videos.height}`
          )
          .fps(MEDIA_STANDARDS.videos.fps)
          .videoBitrate(MEDIA_STANDARDS.videos.videoBitrate)
          .audioBitrate(MEDIA_STANDARDS.videos.audioBitrate)
          .toFormat('mp4')
          .on('end', async () => {
            // Read processed video back to buffer
            const processedBuffer = await fs.readFile(tempOutputPath);

            // Clean up temp files
            await Promise.all([
              fs.unlink(tempInputPath),
              fs.unlink(tempOutputPath),
            ]);

            // Update request file
            req.file.buffer = processedBuffer;
            req.file.size = processedBuffer.length;
            req.file.originalname = 'processed.mp4';
            req.file.mimetype = 'video/mp4';

            resolve();
          })
          .on('error', (err) => {
            console.error('Video processing error:', err);
            reject(err);
          })
          .save(tempOutputPath);
      });
    }

    next();
  } catch (error) {
    console.error('Video preprocessing error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Video preprocessing failed',
    });
  }
};

// Middleware to determine preprocessing based on file type
exports.preprocessMedia = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const fileType = req.file.mimetype.split('/')[0];

    if (fileType === 'image') {
      await this.preprocessImage(req, res, next);
    } else if (fileType === 'video') {
      await this.preprocessVideo(req, res, next);
    } else {
      next();
    }
    console.log(fileType);
  } catch (error) {
    console.error('Media preprocessing error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Media preprocessing failed',
    });
  }
};
