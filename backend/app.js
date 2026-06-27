const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const upload = require("./middleware/upload");
const {
  convertWordToPdf,
  convertPdfToWord,
  compressFile,
} = require("./services/converter");

const app = express();
const UPLOADS_DIR = path.join(__dirname, "uploads");

[UPLOADS_DIR, path.join(__dirname, "converted")].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("Server Running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "2.1" });
});

function withUpload(handler) {
  return (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "File upload failed" });
      }
      handler(req, res, next).catch(next);
    });
  };
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    return res.status(500).json({ message: "Output file not found" });
  }
  res.download(filePath);
}

app.post(
  "/convert/word-to-pdf",
  withUpload(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const pdfPath = await convertWordToPdf(req.file.path);
    sendFile(res, pdfPath);
  })
);

app.post(
  "/convert/pdf-to-word",
  withUpload(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const docxPath = await convertPdfToWord(req.file.path);
    sendFile(res, docxPath);
  })
);

app.post(
  "/compress",
  withUpload(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const zipPath = await compressFile(req.file.path);
    sendFile(res, zipPath);
  })
);

app.post(
  "/convert",
  withUpload(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const pdfPath = await convertWordToPdf(req.file.path);
    sendFile(res, pdfPath);
  })
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: err.message || "Server error",
  });
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
