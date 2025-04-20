const fs = require('fs').promises;
const os = require('os');
const path = require('path');

async function cleanupTempUploads() {
  const tmpDir = path.join(os.tmpdir(), 'uploads');
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    const files = await fs.readdir(tmpDir);
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      // Delete files older than 24 hours
      const stats = await fs.stat(filePath);
      if (Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
        await fs.unlink(filePath);
      }
    }
    console.log('Temp upload cleanup completed');
  } catch (error) {
    console.error('Temp upload cleanup error:', error);
  }
}

module.exports = {
  cleanupTempUploads,
  startTempUploadCleanup: () => {
    cleanupTempUploads(); // Initial run
    return setInterval(cleanupTempUploads, 12 * 60 * 60 * 1000);
  },
};
