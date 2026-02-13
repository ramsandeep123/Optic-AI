"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Camera,
  Layers,
  CheckCircle2,
  Copy,
  RefreshCw,
  Image as ImageIcon,
  Send,
  Loader2,
  Check,
  X,
  AlertCircle,
  Download,
  Printer
} from "lucide-react";

const WEBHOOK_URL =
  "https://webhook.digimix4u.live/webhook/c52909f2-9513-4dd6-b9df-c3bea5d36d3a";

export default function PassportExtractor() {
  const [step, setStep] = useState<"front" | "back" | "ready" | "results">("front");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [status, setStatus] = useState("Ready");
  const [processingFile, setProcessingFile] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"opening" | "active" | "error">("opening");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackCameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const savedFront = localStorage.getItem("front_image");
    const savedBack = localStorage.getItem("back_image");
    const savedStep = localStorage.getItem("current_step");

    if (savedFront) setFrontImage(savedFront);
    if (savedBack) setBackImage(savedBack);
    if (savedStep && savedStep !== "results") {
      setStep(savedStep as any);
    }
  }, []);

// Effect to reliably attach stream to video element
useEffect(() => {
  if (cameraStatus === "active" && streamRef.current && videoRef.current) {
    videoRef.current.srcObject = streamRef.current;
  }
}, [cameraStatus, isCameraOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setProcessingFile(true);
    setStatus("Processing Image...");
    try {
      const compressedBase64 = await downscaleImage(file);
      if (step === "front") {
        setFrontImage(compressedBase64);
        localStorage.setItem("front_image", compressedBase64);
        setStep("back");
        localStorage.setItem("current_step", "back");
      } else if (step === "back") {
        setBackImage(compressedBase64);
        localStorage.setItem("back_image", compressedBase64);
        setStep("ready");
        localStorage.setItem("current_step", "ready");
      }
      setStatus("Ready");
    } catch (err) {
      console.error("Compression error:", err);
      showNotify("Failed to process image. Please try again.");
      setStatus("Error");
    } finally {
      setProcessingFile(false);
    }
  };

  const downscaleImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Use JPEG with 0.7 quality for good compression vs quality balance
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        // Memory cleanup
        URL.revokeObjectURL(imageUrl);
        img.onload = null;
        img.onerror = null;
        canvas.width = 0;
        canvas.height = 0;
        
        resolve(dataUrl);
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(imageUrl);
        reject(err);
      };

      img.src = imageUrl;
    });
  };

  const handleSubmit = async () => {
    if (!frontImage || !backImage) return;

    setSubmitting(true);
    setStatus("Submitting...");
    
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          front_image: frontImage,
          back_image: backImage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit to webhook");
      }

      const data = await response.json();
      
      // Handle array response (take first element if it's an array)
      const sanitizedData = Array.isArray(data) ? (data.length > 0 ? data[0] : {}) : data;
      
      setResults(sanitizedData);
      setStep("results");
      setStatus("Success");
      showNotify("Data Extracted Successfully!");

      // Clear persistent storage on success
      localStorage.removeItem("front_image");
      localStorage.removeItem("back_image");
      localStorage.removeItem("current_step");
    } catch (error: any) {
      console.error("Submission error:", error);
      setStatus("Error");
      showNotify("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setCameraStatus("opening");
    setCameraError(null);
    
    // Check for secure context
    if (!window.isSecureContext) {
      setCameraStatus("error");
      setCameraError("In-app camera requires a secure (HTTPS) connection. Your browser blocks camera access on HTTP sites for security.");
      return;
    }

    const tryGetMedia = async (constraints: MediaStreamConstraints) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraStatus("active");
        return true;
      } catch (e) {
        return false;
      }
    };

    // Tier 1: Ideal constraints
    let success = await tryGetMedia({
      video: { 
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    // Tier 2: Simple environment
    if (!success) {
      success = await tryGetMedia({
        video: { facingMode: "environment" },
        audio: false
      });
    }

    // Tier 3: Any video
    if (!success) {
      success = await tryGetMedia({
        video: true,
        audio: false
      });
    }

    if (!success) {
      setCameraStatus("error");
      setCameraError("Unable to access camera. This could be due to permission settings or another app using the camera.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.width > 0 && canvas.height > 0 ? canvas.getContext("2d") : null;
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            processFile(file);
          }
          stopCamera();
        }, "image/jpeg", 0.85);
      }
    }
  };

  const resetApp = () => {
    setFrontImage(null);
    setBackImage(null);
    setStep("front");
    setResults(null);
    setStatus("Ready");
    
    // Clear persistent storage
    localStorage.removeItem("front_image");
    localStorage.removeItem("back_image");
    localStorage.removeItem("current_step");

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (fallbackCameraRef.current) fallbackCameraRef.current.value = "";
  };

  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const copyText = (val: string) => {
    navigator.clipboard.writeText(val).then(() => {
      showNotify("Copied!");
    });
  };

  const handleDeleteImage = (side: "front" | "back") => {
    if (side === "front") {
      setFrontImage(null);
      localStorage.removeItem("front_image");
      if (step !== "results") {
        setStep("front");
        localStorage.setItem("current_step", "front");
      }
    } else {
      setBackImage(null);
      localStorage.removeItem("back_image");
      if (step !== "results") {
        const newStep = frontImage ? "back" : "front";
        setStep(newStep);
        localStorage.setItem("current_step", newStep);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (fallbackCameraRef.current) fallbackCameraRef.current.value = "";
  };

  return (
    <>
      <div className="main-grid">
      <section className="card">
        <div className="step-indicator" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <div className={`step-dot ${step === 'front' ? 'active' : frontImage ? 'completed' : ''}`}>1</div>
          <div className={`step-line ${frontImage ? 'completed' : ''}`}></div>
          <div className={`step-dot ${step === 'back' ? 'active' : backImage ? 'completed' : ''}`}>2</div>
          <div className={`step-line ${backImage ? 'completed' : ''}`}></div>
          <div className={`step-dot ${step === 'ready' ? 'active' : step === 'results' ? 'completed' : ''}`}>3</div>
        </div>

        <h2 style={{ fontFamily: "var(--font-orbitron)", fontSize: "1rem", marginBottom: "15px", color: "var(--primary)" }}>
          {step === "front" && "Step 1: Front Side of Passport"}
          {step === "back" && "Step 2: Back Side of Passport"}
          {step === "ready" && "Step 3: Ready to Extract"}
          {step === "results" && "Extraction Complete"}
        </h2>

        {(step === "front" || step === "back") && (
          <div
            className={`upload-zone ${processingFile ? 'processing' : ''}`}
            onClick={() => !processingFile && fileInputRef.current?.click()}
          >
            {processingFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--primary)', fontWeight: '600' }}>COMPRESSING IMAGE...</p>
              </div>
            ) : (
              <>
                <UploadCloud className="upload-icon" />
                <p>
                  Upload <b>{step === "front" ? "FRONT" : "BACK"}</b> Side
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "15px" }}>
                  <button className="browse-btn" type="button">Select File</button>
                </div>
                <button
                  className="camera-btn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startCamera();
                  }}
                >
                  <Camera size={20} /> Take Photo
                </button>
              </>
            )}
          </div>
        )}


        {(frontImage || backImage) && (
          <div className="preview-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' }}>
            {frontImage && (
              <div className="preview-item">
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px' }}>FRONT SIDE</p>
                <div className="preview-box">
                  <img src={frontImage} className="preview-img" alt="Front Preview" />
                </div>
                <button 
                  className="delete-img-btn" 
                  onClick={() => handleDeleteImage("front")}
                  title="Remove Image"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {backImage && (
              <div className="preview-item">
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px' }}>BACK SIDE</p>
                <div className="preview-box">
                  <img src={backImage} className="preview-img" alt="Back Preview" />
                </div>
                <button 
                  className="delete-img-btn" 
                  onClick={() => handleDeleteImage("back")}
                  title="Remove Image"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* {step === "ready" && ( */}
          <div className="ready-action" style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="glow-icon-container" style={{ marginBottom: '20px' }}>
              <Send size={48} className="upload-icon" style={{ animation: 'bounce 2s infinite' }} />
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px' }}>{step === "ready" ? "Both sides captured. Ready for Processing." : ""}</p>
            { step !== "results" ?  <button 
              className="browse-btn" 
              style={{ width: '100%', height: '50px', fontSize: '1.1rem', marginBottom: '10px' }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Processing...
                </>
              ) : (
                <>
                  <Send size={20} /> Submit
                </>
              )}
            </button> :
            <button className="camera-btn" style={{ flex: 1 }} onClick={resetApp}>
              <RefreshCw size={18} /> Start New Scan
            </button>
            }
            <button 
              className="btn-outline" 
              style={{ width: '100%', height: '45px',justifyContent: 'center',marginTop:"10px" }}
              onClick={handlePrint}
            >
              <Printer size={18} /> Print
            </button>
          </div>
        {/* )} */}

        {/* {step === "results" && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="camera-btn" style={{ flex: 1 }} onClick={resetApp}>
              <RefreshCw size={18} /> Start New Scan
            </button>
            <button className="btn-outline" style={{ flex: 1 }} onClick={handlePrint}>
              <Printer size={18} /> Print to PDF
            </button>
          </div>
        )} */}

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <input
          type="file"
          ref={fallbackCameraRef}
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </section>

      <section className="card">
        <div className="results-header">
          <h2 style={{ fontFamily: "var(--font-orbitron)", fontSize: "1.1rem" }}>
            Extraction Results
          </h2>
          <div
            className="status-badge"
            style={{ color: status === "Success" ? "#00ffcc" : status === "Error" ? "#ff4444" : "" }}
          >
            {status}
          </div>
        </div>

        <div id="resultsContent" style={{ position: 'relative', minHeight: '200px' }}>
          {submitting && (
            <div className="scan-line"></div>
          )}
          
          {!results ? (
            <div className="empty-state">
              {submitting ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                  <div className="glow-icon-container">
                    <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary)' }} />
                  </div>
                  <p style={{ color: 'var(--primary)', fontWeight: '600' }}>EXTRACTING DATA...</p>
                </div>
              ) : (
                <>
                  <Layers
                    style={{
                      width: "48px",
                      height: "48px",
                      opacity: 0.2,
                      marginBottom: "10px",
                    }}
                  />
                  <p>Ready for extraction</p>
                </>
              )}
            </div>
          ) : (
            <div className="records-list">
              <div className="record-card">
                <div className="record-title">
                  <span>EXTRACTED DATA</span>
                  <CheckCircle2 style={{ width: "16px", color: "#00ffcc" }} />
                </div>
                <div className="field-grid">
                  {Object.entries(results).map(([k, v]: [string, any]) => (
                    <div key={k} className="field-item">
                      <div className="field-content">
                        <div className="field-label">
                          {k.replace(/_/g, " ")}
                        </div>
                        <div className="field-value">{String(v)}</div>
                      </div>
                      <button
                        className="copy-field-btn"
                        onClick={() => copyText(String(v))}
                        title="Copy"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {results && (
          <div className="action-group">
            <button className="btn-outline" onClick={() => {
              let text = "";
              Object.entries(results).forEach(([k, v]) => {
                text += `${k.replace(/_/g, " ")}: ${v}\n`;
              });
              copyText(text);
            }}>
              <Copy size={16} /> Copy All
            </button>
            <button className="btn-outline" onClick={resetApp}>
              <RefreshCw size={16} /> Clear
            </button>
          </div>
        )}
      </section>

      {notification && <div id="notification" className="show">{notification}</div>}

      <style jsx>{`
        .step-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid var(--card-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: var(--text-muted);
          transition: all 0.3s;
        }
        .step-dot.active {
          border-color: var(--primary);
          color: var(--primary);
          box-shadow: 0 0 10px var(--primary-glow);
        }
        .step-dot.completed {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--bg-dark);
        }
        .step-line {
          flex-grow: 1;
          height: 1px;
          background: var(--card-border);
          align-self: center;
          transition: all 0.3s;
        }
        .step-line.completed {
          background: var(--primary);
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: var(--primary);
          box-shadow: 0 0 15px var(--primary);
          animation: scan 2s infinite ease-in-out;
          z-index: 10;
        }
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .upload-zone.processing {
          border-color: var(--primary);
          background: rgba(0, 242, 255, 0.05);
          cursor: wait;
        }
      `}</style>

      {isCameraOpen && (
        <div className="camera-modal">
          <div className="camera-container">
            {cameraStatus === "active" ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="camera-video" 
                />
                <div className="camera-guide-overlay">
                  <div className="guide-text">ALIGN PASSPORT HERE</div>
                </div>
              </>
            ) : (
              <div className="camera-status-overlay">
                {cameraStatus === "opening" && (
                  <>
                    <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)', marginBottom: '20px' }} />
                    <p>WAKING UP CAMERA...</p>
                  </>
                )}
                {cameraStatus === "error" && (
                  <div style={{ padding: '30px', textAlign: 'center' }}>
                    <X size={48} style={{ color: '#ff4444', marginBottom: '20px' }} />
                    <p style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: '15px' }}>CAMERA BLOCKED</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '25px' }}>
                      {cameraError}
                    </p>
                    <button 
                      className="browse-btn" 
                      style={{ width: '100%', marginBottom: '10px' }}
                      onClick={() => {
                        stopCamera();
                        fallbackCameraRef.current?.click();
                      }}
                    >
                      Use System Camera App
                    </button>
                    <button 
                      className="btn-outline" 
                      style={{ width: '100%' }}
                      onClick={stopCamera}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="camera-controls">
              <button className="cam-control-btn close" onClick={stopCamera}>
                <X size={24} />
              </button>
              {cameraStatus === "active" && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <button className="cam-capture-btn" onClick={capturePhoto}>
                    <div className="capture-inner" />
                  </button>
                  <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', letterSpacing: '1px' }}>TAP TO CAPTURE</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    {/* Hidden Print Only Section */}
    <div className="print-only">
      {frontImage && (
        <div className="print-image-container">
          <img src={frontImage} className="print-image" alt="Front Side" />
        </div>
      )}
      {backImage && (
        <div className="print-image-container">
          <img src={backImage} className="print-image" alt="Back Side" />
        </div>
      )}
    </div>
  </>
);
}
