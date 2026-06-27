import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:5000";

const MODES = [
  {
    id: "word-to-pdf",
    label: "Word to PDF",
    endpoint: "/convert/word-to-pdf",
    accept: {
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    hint: "Upload a .doc or .docx file",
    outputExt: "pdf",
    icon: "📄",
  },
  {
    id: "pdf-to-word",
    label: "PDF to Word",
    endpoint: "/convert/pdf-to-word",
    accept: { "application/pdf": [".pdf"] },
    hint: "Upload a .pdf file",
    outputExt: "docx",
    icon: "📝",
  },
  {
    id: "compress",
    label: "Compress File",
    endpoint: "/compress",
    accept: undefined,
    hint: "Upload any file to compress into a ZIP",
    outputExt: "zip",
    icon: "🗜️",
  },
];

async function parseError(err) {
  if (!err.response) {
    if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
      return "Cannot connect to server. Start the backend with: cd backend && npm start";
    }
    return err.message || "Operation failed";
  }

  const { data, status } = err.response;

  if (data instanceof Blob) {
    const text = await data.text();
    try {
      const json = JSON.parse(text);
      return json.message || `Server error (${status})`;
    } catch {
      if (status === 404) {
        return "Server endpoint not found. Restart the backend: cd backend && npm start";
      }
      return `Server error (${status}). Restart the backend and try again.`;
    }
  }

  return data?.message || `Server error (${status})`;
}

function downloadBlob(data, filename) {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function App() {
  const [mode, setMode] = useState(MODES[0]);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setStatus({ type: "", message: "" });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: mode.accept,
    multiple: false,
    disabled: loading,
  });

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setFile(null);
    setStatus({ type: "", message: "" });
  };

  const handleProcess = async () => {
    if (!file) {
      setStatus({ type: "error", message: "Please select a file first." });
      return;
    }

    setLoading(true);
    setStatus({ type: "info", message: "Processing your file…" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(`${API_BASE}${mode.endpoint}`, formData, {
        responseType: "blob",
      });

      const contentType = response.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        const text = await response.data.text();
        const json = JSON.parse(text);
        throw { response: { data: json, status: response.status } };
      }

      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const filename = `${baseName}.${mode.outputExt}`;
      downloadBlob(response.data, filename);

      setStatus({ type: "success", message: "Done! Your file has been downloaded." });
    } catch (err) {
      const message = await parseError(err);
      setStatus({ type: "error", message });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">DocTools</div>
        <h1>Document Converter &amp; Compressor</h1>
        <p className="subtitle">
          Convert Word ↔ PDF and compress files — fast, simple, and free.
        </p>
      </header>

      <main className="main">
        <div className="mode-tabs">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-tab ${mode.id === m.id ? "active" : ""}`}
              onClick={() => handleModeChange(m)}
              disabled={loading}
            >
              <span className="mode-icon">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        <div className="card">
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? "drag-active" : ""} ${file ? "has-file" : ""}`}
          >
            <input {...getInputProps()} />
            <div className="dropzone-content">
              {file ? (
                <>
                  <div className="file-icon">📎</div>
                  <p className="file-name">{file.name}</p>
                  <p className="file-size">{formatSize(file.size)}</p>
                  <p className="dropzone-hint">Click or drag to replace</p>
                </>
              ) : (
                <>
                  <div className="upload-icon">⬆️</div>
                  <p className="dropzone-title">
                    {isDragActive ? "Drop your file here" : "Drag & drop your file"}
                  </p>
                  <p className="dropzone-hint">or click to browse</p>
                  <p className="dropzone-format">{mode.hint}</p>
                </>
              )}
            </div>
          </div>

          <button
            className="action-btn"
            onClick={handleProcess}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Processing…
              </>
            ) : (
              <>
                {mode.icon} {mode.label}
              </>
            )}
          </button>

          {status.message && (
            <div className={`status status-${status.type}`}>
              {status.type === "success" && "✅ "}
              {status.type === "error" && "❌ "}
              {status.type === "info" && "⏳ "}
              {status.message}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>Powered by LibreOffice · Files are processed locally on your server</p>
      </footer>
    </div>
  );
}

export default App;
