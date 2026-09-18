import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, ErrorText } from "./ui";
import VoicePlayer from "./VoicePlayer";
import { colors, radius, space } from "../constants/theme";
import { UploadAPI } from "../services/requests";
import { ApiError } from "../services/api";

function formatSec(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the recording"));
    reader.readAsDataURL(blob);
  });
}

export default function VoiceRecorder({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canRecord = Platform.OS === "web" && typeof MediaRecorder !== "undefined";

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const start = async () => {
    setError("");
    if (!canRecord) {
      setError("Voice recording is on the website (http://localhost:5173). This Expo preview cannot use the microphone.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recRef.current = rec;
      streamRef.current = stream;
      rec.start();
      setRecSec(0);
      setRecording(true);
    } catch {
      setError("Microphone permission is required for voice notes.");
    }
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  };

  const cancel = () => {
    recRef.current?.stop();
    recRef.current = null;
    stopTracks();
    setRecSec(0);
  };

  const send = async () => {
    const rec = recRef.current;
    if (!rec) return;
    setBusy(true);
    setError("");
    const mime = rec.mimeType || "audio/webm";
    await new Promise<void>((resolve) => {
      rec.onstop = async () => {
        stopTracks();
        recRef.current = null;
        try {
          const blob = new Blob(chunks.current, { type: mime });
          const dataUrl = await blobToDataUrl(blob);
          const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
          const { url: next } = await UploadAPI.dataUrl(dataUrl, `voice.${ext}`);
          onChange(next);
          setRecSec(0);
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "Voice upload failed");
        } finally {
          setBusy(false);
          resolve();
        }
      };
      rec.stop();
    });
  };

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>VOICE NOTE</Text>
      <Text style={styles.title}>Record the problem</Text>
      <Text style={styles.hint}>Same as the website. Workers can play this on the job.</Text>
      {recording ? (
        <View style={styles.live}>
          <View style={styles.dot} />
          <Text style={styles.liveText}>Recording… {formatSec(recSec)}</Text>
          <Pressable onPress={cancel}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => void send()}>
            <Text style={styles.send}>Send</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button title={url ? "Re-record voice" : "Record voice note"} onPress={() => void start()} loading={busy} />
          </View>
          {url ? (
            <Pressable onPress={() => onChange("")} style={styles.trash}>
              <Text style={styles.trashText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {busy ? <Text style={styles.hint}>Uploading voice…</Text> : null}
      <ErrorText>{error}</ErrorText>
      {url && !recording ? <VoicePlayer url={url} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.brand,
    padding: space.md,
    gap: 10,
  },
  kicker: { color: colors.brand, fontWeight: "800", fontSize: 12, letterSpacing: 0.8 },
  title: { fontSize: 20, fontWeight: "800", color: colors.navy },
  hint: { color: colors.muted, fontSize: 14 },
  live: {
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  liveText: { flex: 1, color: "#B91C1C", fontWeight: "800" },
  cancel: { color: colors.muted, fontWeight: "800" },
  send: { color: colors.brand, fontWeight: "800" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  trash: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  trashText: { fontSize: 18, color: colors.muted, fontWeight: "800" },
});
