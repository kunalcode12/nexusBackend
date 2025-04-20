const crypto = require('crypto');
const { promisify } = require('util');
const { pipeline } = require('stream');
const { createReadStream, createWriteStream } = require('fs');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const cloudinary = require('../config/cloudinary');
const Media = require('../models/mediaModel');
const sharp = require('sharp');
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// try {
//   fs.mkdir(uploadDir, { recursive: true });
// } catch (error) {
//   console.error('Failed to create uploads directory:', error);
// }
ffmpeg.setFfmpegPath(ffmpegPath);
class UploadService {
  constructor() {
    this.CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks
    this.tmpDir = path.join(os.tmpdir(), 'uploads');
  }

  async initialize() {
    await fs.mkdir(this.tmpDir, { recursive: true });
  }

  generateUploadId() {
    return crypto.randomBytes(16).toString('hex');
  }
  async preprocessChunk(chunk, mimetype) {
    // Create a temporary file path for the incoming chunk
    const chunkId = crypto.randomBytes(8).toString('hex');
    const tempChunkPath = path.join(this.tmpDir, `chunk_${chunkId}.tmp`);

    // Ensure temp directory exists
    await fs.mkdir(this.tmpDir, { recursive: true });

    // Write chunk to temporary file
    await fs.writeFile(tempChunkPath, chunk);

    try {
      const fileType = mimetype;
      let processedChunk;
      console.log('File type:', fileType);

      if (fileType === 'image') {
        processedChunk = await this.preprocessImageChunk(tempChunkPath);
      } else if (fileType === 'video') {
        processedChunk = await this.preprocessVideoChunk(tempChunkPath);
      } else {
        // If not image or video, return the original chunk
        processedChunk = await fs.readFile(tempChunkPath);
      }

      // Clean up the temporary chunk file
      await this.cleanupTempFile(tempChunkPath);

      return processedChunk;
    } catch (error) {
      // Cleanup temp file in case of error
      await this.cleanupTempFile(tempChunkPath);
      throw error;
    }
  }

  async preprocessImageChunk(tempChunkPath) {
    try {
      await fs.access(tempChunkPath);
      return await sharp(tempChunkPath)
        .resize({
          width: 720,
          height: 720,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFormat('webp', { quality: 80 })
        .toBuffer();
    } catch (error) {
      console.error('Image chunk preprocessing error:', error);
      throw new Error(`Image chunk preprocessing failed: ${error.message}`);
    }
  }

  async preprocessVideoChunk(tempChunkPath) {
    return new Promise((resolve, reject) => {
      // Validate file exists and is readable
      fs.access(tempChunkPath)
        .then(() => {
          const outputPath = path.join(
            this.tmpDir,
            `processed_chunk_${crypto.randomBytes(8).toString('hex')}.mp4`
          );

          ffmpeg(tempChunkPath)
            .videoCodec('libx264')
            .size('720x720')
            .fps(30)
            .videoBitrate('1500k')
            .audioBitrate('128k')
            .toFormat('mp4')
            .on('start', (commandLine) => {
              console.log('Spawned FFmpeg with command: ' + commandLine);
            })
            .on('end', async () => {
              try {
                const processedBuffer = await fs.readFile(outputPath);
                await this.cleanupTempFile(outputPath);
                resolve(processedBuffer);
              } catch (error) {
                reject(new Error(`File read error: ${error.message}`));
              }
            })
            .on('error', (err) => {
              console.error('Detailed FFmpeg Error:', {
                message: err.message,
                command: err.command,
                fatal: err.fatal,
              });
              reject(new Error(`Video processing error: ${err.message}`));
            })
            .save(outputPath);
        })
        .catch((error) => {
          reject(new Error(`File access error: ${error.message}`));
        });
    });
  }

  async createTempFile(uploadId) {
    try {
      // Ensure the temp directory exists
      await fs.mkdir(this.tmpDir, { recursive: true });

      const tempPath = path.join(this.tmpDir, `${uploadId}.tmp`);

      // Create an empty file to ensure it can be written to
      await fs.writeFile(tempPath, Buffer.from(''), { flag: 'w' });

      return tempPath;
    } catch (error) {
      console.error('Error creating temp file:', error);
      throw new Error(`Failed to create temporary file: ${error.message}`);
    }
  }

  async handleChunk(chunk, uploadId, chunkIndex, totalChunks, mimetype) {
    let filePath = null;
    let processedFilePath = null;
    try {
      // Ensure chunk is a Buffer
      if (!Buffer.isBuffer(chunk)) {
        throw new Error('Chunk must be a buffer');
      }

      // Convert chunkIndex to a number
      const parsedChunkIndex = Number(chunkIndex);
      const parsedTotalChunks = Number(totalChunks);

      // Find or create the media upload record
      let media = await Media.findOne({ uploadId });

      if (!media) {
        media = new Media({
          uploadId,
          totalChunks: parsedTotalChunks,
          status: 'uploading',
          uploadedChunks: [],
        });
      }

      // Check if chunk already exists
      const existingChunkIndex = media.uploadedChunks.findIndex(
        (c) => c.chunkIndex === parsedChunkIndex
      );

      if (existingChunkIndex === -1) {
        // Add new chunk
        media.uploadedChunks.push({
          chunkIndex: parsedChunkIndex,
          chunkData: chunk,
        });
      } else {
        // Update existing chunk
        media.uploadedChunks[existingChunkIndex].chunkData = chunk;
      }

      // Sort chunks by index
      media.uploadedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Check if upload is complete
      if (media.uploadedChunks.length === parsedTotalChunks) {
        // Combine chunks
        const fullFile = Buffer.concat(
          media.uploadedChunks.map((chunk) => chunk.chunkData)
        );

        // Create a temporary file path for original media
        filePath = path.join(this.tmpDir, `${uploadId}-original.tmp`);

        // Write original file
        await fs.writeFile(filePath, fullFile);

        // Process the file
        let processedFile;
        try {
          if (mimetype === 'image') {
            processedFile = await this.preprocessImageChunk(filePath);
          } else if (mimetype === 'video') {
            processedFile = await this.preprocessVideoChunk(filePath);
          } else {
            // If not image or video, use original file
            processedFile = fullFile;
          }

          // Create a path for the processed file
          processedFilePath = path.join(
            this.tmpDir,
            `${uploadId}-processed.tmp`
          );

          // Write processed file
          await fs.writeFile(processedFilePath, processedFile);

          // Upload to Cloudinary with processed file
          const cloudinaryResponse = await this.uploadToCloudinary(
            processedFilePath,
            media
          );

          // Update media record
          media.status = 'completed';
          media.url = cloudinaryResponse.secure_url;
          media.cloudinaryPublicId = cloudinaryResponse.public_id;
        } catch (processingError) {
          // Processing or Cloudinary upload failed
          media.status = 'failed';
          console.error('Media processing/upload error:', {
            message: processingError.message,
            stack: processingError.stack,
            originalFileName: filePath,
            processedFileName: processedFilePath,
          });

          // Throw to trigger error handling
          throw processingError;
        } finally {
          // Cleanup temporary files
          const tempFiles = [filePath, processedFilePath].filter(Boolean);
          for (const tempFile of tempFiles) {
            try {
              await this.cleanupTempFile(tempFile);
            } catch (cleanupError) {
              console.error('Failed to delete temporary file:', {
                path: tempFile,
                error: cleanupError.message,
                stack: cleanupError.stack,
              });
            }
          }
        }
      } else {
        media.status = 'uploading';
      }

      // Save the media document
      await media.save();

      return {
        uploadId,
        status: media.status,
        receivedChunks: media.uploadedChunks.length,
        totalChunks: parsedTotalChunks,
        url: media.url || null,
      };
    } catch (error) {
      // Comprehensive error logging
      console.error('Handle chunk overall error:', {
        message: error.message,
        stack: error.stack,
        uploadId,
        originalFilePath: filePath,
        processedFilePath,
      });

      // Update media status to failed
      try {
        await Media.findOneAndUpdate(
          { uploadId },
          { status: 'failed' },
          { new: true }
        );
      } catch (updateError) {
        console.error('Failed to update media status:', {
          uploadId,
          error: updateError.message,
          stack: updateError.stack,
        });
      }

      // Cleanup temporary files if they exist
      const tempFiles = [filePath, processedFilePath].filter(Boolean);
      for (const tempFile of tempFiles) {
        try {
          await this.cleanupTempFile(tempFile);
        } catch (cleanupError) {
          console.error(
            'Failed to delete temporary file during error handling:',
            {
              path: tempFile,
              error: cleanupError.message,
              stack: cleanupError.stack,
            }
          );
        }
      }

      throw new Error(`Failed to handle chunk: ${error.message}`);
    }
  }

  async deleteFromCloud(cloudinaryPublicId, resourceType) {
    if (!cloudinaryPublicId) return;

    try {
      const result = await cloudinary.uploader.destroy(cloudinaryPublicId, {
        resource_type: resourceType, // Automatically detect resource type
      });

      console.log('Cloudinary deletion result:', result);
      return result;
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      throw new Error(`Cloudinary deletion failed: ${error.message}`);
    }
  }

  async cleanupTempFile(filePath) {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (!filePath) return;

    try {
      // Wait briefly to allow other processes to release the file
      await delay(10000);

      // Check if file exists before attempting to delete
      await fs.access(filePath, fs.constants.F_OK);

      // Attempt to delete the file
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error deleting file:', {
          path: filePath,
          errorCode: error.code,
          errorMessage: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }
  }
  async processCompleteFile(media, tempPath) {
    try {
      media.status = 'processing';
      await media.save();

      // Ensure all chunks are in the correct order
      const sortedChunks = media.chunks.sort((a, b) => a.index - b.index);

      // Use pipeline for more robust file writing
      await new Promise((resolve, reject) => {
        const writeStream = createWriteStream(tempPath);

        const chunks = sortedChunks.map((chunk) => chunk.data);

        pipeline(
          require('stream').Readable.from(chunks),
          writeStream,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Rest of the method remains the same...
    } catch (error) {
      console.error('File processing error:', error);
      media.status = 'failed';
      await media.save();

      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath).catch(() => {});
      } catch {}

      throw error;
    }
  }

  async uploadToCloudinary1(fileBuffer, mediaType) {
    return new Promise((resolve, reject) => {
      // Create a stream from the buffer
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: mediaType === 'video' ? 'video' : 'image',
          eager_async: true,
          eager: this.getTransformations(mediaType),
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('Cloudinary upload result:', {
              url: result.secure_url,
              width: result.width,
              height: result.height,
            });
            resolve(result);
          }
        }
      );

      // Convert buffer to stream and pipe it
      const bufferStream = new Readable();
      bufferStream.push(fileBuffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    });
  }

  async uploadToCloudinary(filePath, media) {
    console.log('Uploading to Cloudinary:', {
      filePath,
      mediaType: media.type,
      fileSize: (await fs.stat(filePath)).size,
    });

    const uploadOptions = {
      resource_type: media.type === 'video' ? 'video' : 'image',
      chunk_size: this.CHUNK_SIZE,
      eager_async: true,
      eager: this.getTransformations(media.type),
    };

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(filePath, uploadOptions, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('Cloudinary upload result:', {
            url: result.secure_url,
            width: result.width,
            height: result.height,
          });
          resolve(result);
        }
      });
    });
  }

  getTransformations(mediaType) {
    if (mediaType === 'video') {
      return [
        { format: 'mp4', quality: 'auto:good' },
        { format: 'webm', quality: 'auto:good' },
      ];
    }
    return [
      { format: 'webp', quality: 'auto:good' },
      { format: 'jpg', quality: 'auto:good' },
    ];
  }
}

module.exports = new UploadService();
