const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { ZipArchive } = require("archiver");

const SOFFICE_EXE = path.join(
  "C:",
  "Program Files",
  "LibreOffice",
  "program",
  "soffice.exe"
);

const CONVERTED_DIR = path.join(__dirname, "..", "converted");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBaseName(inputPath) {
  return path.parse(path.basename(inputPath)).name;
}

function getOutputPath(inputPath, extension) {
  return path.join(CONVERTED_DIR, `${getBaseName(inputPath)}.${extension}`);
}

function toFileUrl(dirPath) {
  return "file:///" + dirPath.replace(/\\/g, "/");
}

function runLibreOffice(inputPath, format, infilter) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(SOFFICE_EXE)) {
      reject(
        new Error(
          "LibreOffice not found. Install it from https://www.libreoffice.org/"
        )
      );
      return;
    }

    ensureDir(CONVERTED_DIR);

    const profileDir = path.join(
      os.tmpdir(),
      `lo-profile-${Date.now()}-${process.pid}`
    );
    fs.mkdirSync(profileDir, { recursive: true });

    const args = [
      "--headless",
      `-env:UserInstallation=${toFileUrl(profileDir)}`,
    ];

    if (infilter) {
      args.push(`--infilter=${infilter}`);
    }

    args.push("--convert-to", format, inputPath, "--outdir", CONVERTED_DIR);

    const child = spawn(SOFFICE_EXE, args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      fs.rm(profileDir, { recursive: true, force: true }, () => {});

      if (code !== 0) {
        reject(new Error(stderr.trim() || `LibreOffice exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

async function waitForOutput(inputPath, extension, timeoutMs = 60000) {
  const candidates = [
    getOutputPath(inputPath, extension),
    path.join(
      CONVERTED_DIR,
      `${getBaseName(inputPath).replace(/^\d+-/, "")}.${extension}`
    ),
  ];

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).size > 0) {
        return candidate;
      }
    }
    await sleep(400);
  }

  return null;
}

async function convertWordToPdf(inputPath) {
  await runLibreOffice(inputPath, "pdf");
  const output = await waitForOutput(inputPath, "pdf");
  if (!output) {
    throw new Error("PDF was not created by LibreOffice");
  }
  return output;
}

async function convertPdfToWord(inputPath) {
  await runLibreOffice(inputPath, "docx", "writer_pdf_import");
  const output = await waitForOutput(inputPath, "docx");
  if (!output) {
    throw new Error("Word document was not created by LibreOffice");
  }
  return output;
}

function findOutputFile(inputPath, extension) {
  const expected = getOutputPath(inputPath, extension);
  if (fs.existsSync(expected) && fs.statSync(expected).size > 0) {
    return expected;
  }

  const alternate = path.join(
    CONVERTED_DIR,
    `${getBaseName(inputPath).replace(/^\d+-/, "")}.${extension}`
  );

  if (fs.existsSync(alternate) && fs.statSync(alternate).size > 0) {
    return alternate;
  }

  return null;
}

function compressFile(inputPath) {
  return new Promise((resolve, reject) => {
    ensureDir(CONVERTED_DIR);

    const zipPath = path.join(CONVERTED_DIR, `${getBaseName(inputPath)}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", () => {
      if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0) {
        resolve(zipPath);
      } else {
        reject(new Error("ZIP file was empty"));
      }
    });

    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.file(inputPath, { name: path.basename(inputPath) });
    archive.finalize();
  });
}

module.exports = {
  convertWordToPdf,
  convertPdfToWord,
  compressFile,
  getOutputPath,
  findOutputFile,
  CONVERTED_DIR,
};
