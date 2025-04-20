const Media = require('../models/mediaModel');
const uploadService = require('../services/uploadService');
const { Worker } = require('worker_threads');
const path = require('path');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError');
const mongoose = require('mongoose');
const redis = require('redis');
const { promisify } = require('util');
const multer = require('multer');
const Content = require('../models/contentModel');
const os = require('os');
const fs = require('fs-extra');
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 50 * 1024 * 1024 }, // 5MB max file size
// });

const redisClient = redis.createClient(process.env.REDIS_URL);
const getCache = promisify(redisClient.get).bind(redisClient);
const setCache = promisify(redisClient.setEx).bind(redisClient);

exports.initializeUpload = catchAsync(async (req, res, next) => {
  const { title, contentId, totalChunks, type, metadata } = req.body;

  const uploadId = uploadService.generateUploadId();
  const media = await Media.create({
    title,
    type,
    uploadId,
    totalChunks,
    metadata,
    user: req.user._id,
    status: 'uploading',
  });

  res.status(201).json({
    status: 'success',
    data: {
      uploadId,
      chunksReceived: 0,
      totalChunks,
      media,
    },
  });
});

exports.uploadChunk = catchAsync(async (req, res, next) => {
  try {
    const { uploadId, chunkIndex, totalChunks, typeFile } = req.body;
    const chunk = req.file ? req.file.buffer : null;
    const mimetype = req.file ? typeFile : null;

    // Validate input
    if (!uploadId || chunkIndex === undefined || totalChunks === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required upload parameters',
      });
    }

    if (!chunk || chunk.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No chunk data received',
      });
    }

    // Handle chunk upload with preprocessing
    const result = await uploadService.handleChunk(
      chunk,
      uploadId,
      chunkIndex,
      totalChunks,
      mimetype
    );

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Chunk upload failed',
    });
  }
});

exports.getUploadStatus = catchAsync(async (req, res, next) => {
  const { uploadId } = req.params;

  const media = await Media.findOne({ uploadId })
    .select('status uploadedChunks totalChunks url')
    .lean();

  if (!media) {
    return next(new appError('Upload not found', 404));
  }

  // Calculate progress
  const progress = media.uploadedChunks
    ? (media.uploadedChunks.length / media.totalChunks) * 100
    : 0;

  console.log('Media Status:', {
    status: media.status,
    uploadedChunksCount: media.uploadedChunks?.length || 0,
    totalChunks: media.totalChunks,
    progress,
  });

  res.status(200).json({
    status: 'success',
    data: {
      status: media.status,
      progress,
      url: media.url || null,
    },
  });
});

// exports.updateMedia = catchAsync(async (req, res, next) => {
//   const { id } = req.params;
//   const { typeFile, contentId } = req.body;
//   const file = req.file;

//   // Validate input
//   if (!file) {
//     return res.status(400).json({
//       status: 'error',
//       message: 'No file uploaded',
//     });
//   }

//   // Find existing media
//   const existingMedia = await Media.findById(id);

//   if (!existingMedia) {
//     return next(new appError('Media not found', 404));
//   }

//   try {
//     // Upload the file to Cloudinary
//     const result = await uploadService.uploadToCloudinary1(
//       file.buffer, // Pass buffer directly
//       typeFile // Pass media type
//     );

//     console.log('typeFile:', typeFile);

//     // Delete existing Cloudinary file if it exists

//     if (existingMedia.cloudinaryPublicId) {
//       await uploadService.deleteFromCloud(
//         existingMedia.cloudinaryPublicId,
//         existingMedia.type
//       );
//     }

//     // Update the existing media document
//     const updatedMedia = await Media.findByIdAndUpdate(
//       id,
//       {
//         url: result.secure_url, // Use secure_url
//         cloudinaryPublicId: result.public_id,
//         status: 'completed',
//         type: typeFile,
//         metadata: {
//           ...existingMedia.metadata,
//           size: file.size,
//           contentType: typeFile,
//         },
//       },
//       {
//         new: true,
//         runValidators: true,
//       }
//     );

//     // Update Content if contentId is provided
//     let updatedContent = null;
//     if (contentId) {
//       const contentUpdateFields = {};

//       // Update URL based on media type
//       if (typeFile === 'image') {
//         contentUpdateFields.image = result.secure_url;
//         contentUpdateFields.video = null;
//       } else if (typeFile === 'video') {
//         contentUpdateFields.video = result.secure_url;
//         contentUpdateFields.image = null;
//       }

//       updatedContent = await Content.findByIdAndUpdate(
//         contentId,
//         contentUpdateFields,
//         { new: true }
//       );
//     }

//     res.status(200).json({
//       status: 'success',
//       data: {
//         url: result.secure_url,
//         media: updatedMedia,
//         content: updatedContent,
//       },
//     });
//   } catch (error) {
//     console.error('Media replacement error:', error);
//     return next(new appError('Failed to replace media', 500));
//   }
// });

exports.updateMedia = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { typeFile, contentId } = req.body;
  const file = req.file;

  // Validate input
  if (!file) {
    return res.status(400).json({
      status: 'error',
      message: 'No file uploaded',
    });
  }

  // Find existing media
  const existingMedia = await Media.findById(id);

  if (!existingMedia) {
    return next(new appError('Media not found', 404));
  }

  let tempChunkPath;

  try {
    // Preprocess the file based on type
    tempChunkPath = path.join(
      os.tmpdir(),
      `temp_${typeFile}_${Date.now()}${path.extname(file.originalname)}`
    );

    await fs.writeFile(tempChunkPath, file.buffer);
    let processedBuffer;
    if (typeFile === 'image') {
      processedBuffer = await uploadService.preprocessImageChunk(tempChunkPath);
    } else if (typeFile === 'video') {
      processedBuffer = await uploadService.preprocessVideoChunk(tempChunkPath);
    } else {
      processedBuffer = file.buffer;
    }

    await fs.remove(tempChunkPath).catch((err) => {
      console.warn(`Could not remove temporary file: ${err.message}`);
    });

    // Upload the processed file to Cloudinary
    const result = await uploadService.uploadToCloudinary1(
      processedBuffer, // Use processed buffer
      typeFile // Pass media type
    );

    console.log('typeFile:', typeFile);

    // Delete existing Cloudinary file if it exists
    if (existingMedia.cloudinaryPublicId) {
      await uploadService.deleteFromCloud(
        existingMedia.cloudinaryPublicId,
        existingMedia.type
      );
    }

    // Update the existing media document
    const updatedMedia = await Media.findByIdAndUpdate(
      id,
      {
        url: result.secure_url, // Use secure_url
        cloudinaryPublicId: result.public_id,
        status: 'completed',
        type: typeFile,
        metadata: {
          ...existingMedia.metadata,
          size: processedBuffer.length, // Use processed buffer size
          contentType: typeFile,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    // Update Content if contentId is provided
    let updatedContent = null;
    if (contentId) {
      const contentUpdateFields = {};

      // Update URL based on media type
      if (typeFile === 'image') {
        contentUpdateFields.image = result.secure_url;
        contentUpdateFields.video = null;
      } else if (typeFile === 'video') {
        contentUpdateFields.video = result.secure_url;
        contentUpdateFields.image = null;
      }

      updatedContent = await Content.findByIdAndUpdate(
        contentId,
        contentUpdateFields,
        { new: true }
      );
    }

    res.status(200).json({
      status: 'success',
      data: {
        url: result.secure_url,
        media: updatedMedia,
        content: updatedContent,
      },
    });
  } catch (error) {
    console.error('Media replacement error:', error);
    return next(new appError('Failed to replace media', 500));
  }
});

exports.deleteMedia = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Find media and check ownership
  const media = await Media.findById(id);

  if (!media) {
    return next(new appError('Media not found', 404));
  }

  // Check if user owns the media or is admin
  if (
    media.user.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return next(new appError('Not authorized to delete this media', 403));
  }

  // If media is completed and has cloudinary ID, delete from cloud storage
  if (media.status === 'completed' && media.cloudinaryId) {
    try {
      await uploadService.deleteFromCloud(media.cloudinaryPublicId, media.type);
    } catch (error) {
      console.error('Cloud storage deletion error:', error);
      // Continue with deletion even if cloud storage deletion fails
    }
  }

  // Delete the media document
  await Media.findByIdAndDelete(id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
