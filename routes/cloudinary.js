const crypto = require("crypto");
const express = require("express");

function createCloudinaryRouter() {
  const router = express.Router();

  router.get("/signature", (req, res) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const allowedFolders = {
      artists: "ohms/artists",
      bands: process.env.CLOUDINARY_FOLDER || "ohms/bands",
    };
    const folder = allowedFolders[req.query.folder] || allowedFolders.bands;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({
        ok: false,
        error: "Cloudinary environment variables are not set",
      });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(signaturePayload).digest("hex");

    res.json({
      ok: true,
      cloudName,
      apiKey,
      folder,
      timestamp,
      signature,
    });
  });

  return router;
}

module.exports = createCloudinaryRouter;
