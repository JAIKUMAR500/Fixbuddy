import React, { useRef, useState } from "react";
import { Mic, Trash2 } from "lucide-react";
import { mediaUrl, recordingExtension, supportedRecordingMime, uploadMedia } from "../api/client";

function formatSec(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export default function VoiceRecorder({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recSec, setRecSec] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (typeof MediaRecorder === "undefined") {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("Voice recording is not supported in this browser.");
      }
      const mime = supportedRecordingMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recRef.current = rec;
      streamRef.current = stream;
      rec.start();
      setRecording(true);
      setRecSec(0);
      timer.current = window.setInterval(() => setRecSec((s) => s + 1), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone permission is required for voice notes.");
    }
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };

  const cancel = () => {
    recRef.current?.stop();
    recRef.current = null;
    stopTracks();
    setRecording(false);
    setRecSec(0);
  };

  const send = async () => {
    const rec = recRef.current;
    if (!rec) return;
    const mime = rec.mimeType || supportedRecordingMime() || "audio/webm";
    await new Promise<void>((resolve) => {
      rec.onstop = async () => {
        stopTracks();
        setRecording(false);
        const blob = new Blob(chunks.current, { type: mime });
        const file = new File([blob], `voice-${Date.now()}.${recordingExtension(mime)}`, { type: mime });
        setBusy(true);
        try {
          const { url: next } = await uploadMedia(file);
          onChange(next);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Voice upload failed");
        } finally {
          setBusy(false);
          resolve();
        }
      };
      rec.stop();
      recRef.current = null;
    });
  };

  return (
    <div className="space-y-2">
      {recording ? (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 min-h-12">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-semibold text-red-700">Recording… {formatSec(recSec)}</span>
          <button type="button" onClick={cancel} className="ml-auto text-xs font-semibold text-slate-500">Cancel</button>
          <button type="button" onClick={() => void send()} className="text-xs font-semibold text-sky-700">Send</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void start()} className="flex-1 min-h-12 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-brand text-white font-semibold text-sm">
            <Mic className="w-5 h-5" /> {url ? "Re-record voice" : "Record voice note"}
          </button>
          {url && (
            <button type="button" onClick={() => onChange("")} className="min-h-12 px-4 rounded-2xl border border-slate-200 text-slate-600">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
      {busy && <p className="text-xs text-slate-500">Uploading voice…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {url && !recording && <audio controls src={mediaUrl(url)} className="w-full" />}
    </div>
  );
}
