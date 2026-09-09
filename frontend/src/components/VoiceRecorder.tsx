import React, { useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { recordingExtension, supportedRecordingMime, uploadMedia } from "../api/client";

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
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

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
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blobType = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type: blobType });
        const file = new File([blob], `voice-${Date.now()}.${recordingExtension(blobType)}`, { type: blobType });
        setBusy(true);
        try {
          const { url: next } = await uploadMedia(file);
          onChange(next);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Voice upload failed");
        } finally {
          setBusy(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone permission is required for voice notes.");
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <button type="button" onClick={() => void start()} className="flex-1 min-h-12 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-brand text-white font-semibold text-sm">
            <Mic className="w-5 h-5" /> {url ? "Re-record voice" : "Record voice note"}
          </button>
        ) : (
          <button type="button" onClick={stop} className="flex-1 min-h-12 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm">
            <Square className="w-5 h-5" /> Stop recording
          </button>
        )}
        {url && (
          <button type="button" onClick={() => onChange("")} className="min-h-12 px-4 rounded-2xl border border-slate-200 text-slate-600">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
      {busy && <p className="text-xs text-slate-500">Uploading voice…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {url && <audio controls src={url} className="w-full" />}
    </div>
  );
}
