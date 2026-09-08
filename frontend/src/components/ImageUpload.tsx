import React, { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, Plus, Replace, X } from "lucide-react";
import { uploadImage } from "../api/client";

type Variant = "logo" | "cover" | "gallery";

type Props = {
  label: string;
  hint?: string;
  icon?: string;
  multiple?: boolean;
  urls: string[];
  max?: number;
  onChange: (urls: string[]) => void;
  variant?: Variant;
};

export default function ImageUpload({
  label,
  hint = "PNG, JPG, SVG, or an image URL",
  multiple = false,
  urls,
  max = 8,
  onChange,
  variant,
}: Props) {
  const kind: Variant = variant || (multiple ? "gallery" : "cover");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [remote, setRemote] = useState("");

  const pick = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      const next = multiple ? [...urls] : [];
      const room = Math.max(0, max - next.length);
      for (const file of Array.from(files).slice(0, room || 1)) {
        if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")) continue;
        const { url } = await uploadImage(file);
        if (multiple) next.push(url);
        else next[0] = url;
      }
      onChange(next.slice(0, max));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openPicker = () => {
    if (!busy) inputRef.current?.click();
  };

  const addRemoteUrl = () => {
    const trimmed = remote.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("data:image")) {
      setError("Paste an https image URL or SVG URL.");
      return;
    }
    const next = multiple ? [...urls, trimmed] : [trimmed];
    onChange(next.slice(0, max));
    setRemote("");
    setError("");
  };

  const remove = (url: string) => onChange(urls.filter((item) => item !== url));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void pick(e.dataTransfer.files);
  };

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop,
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,image/svg+xml,.svg"
      multiple={multiple}
      className="hidden"
      onChange={(e) => void pick(e.target.files)}
    />
  );

  const empty = (
    <button
      type="button"
      onClick={openPicker}
      {...dropProps}
      className={`w-full border-2 border-dashed rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center gap-3 transition-all ${
        dragOver ? "border-sky-500 bg-sky-50" : "border-sky-200 bg-white hover:border-sky-400 hover:bg-sky-50/60"
      } ${kind === "cover" ? "min-h-40 sm:min-h-48" : kind === "logo" ? "min-h-44" : "min-h-36"}`}
    >
      <span className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
        {busy ? <Loader2 className="w-7 h-7 animate-spin" /> : kind === "gallery" ? <Camera className="w-7 h-7" /> : <ImageIcon className="w-7 h-7" />}
      </span>
      <p className="font-semibold text-slate-800 text-base">{label}</p>
      <p className="text-sm text-slate-500 text-center max-w-xs">{hint}</p>
      <span className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl text-sm font-semibold bg-sky-600 text-white">
        {busy ? "Uploading…" : multiple ? "Upload photos" : "Choose photo"}
      </span>
    </button>
  );

  return (
    <div className="space-y-2">
      {fileInput}
      {kind === "logo" && urls[0] ? (
        <div className="bg-white rounded-3xl border border-sky-100 p-4 sm:p-5">
          <p className="text-sm font-semibold text-slate-800 mb-3">{label}</p>
          <div className="relative mx-auto w-40 h-40 sm:w-48 sm:h-48 rounded-3xl overflow-hidden border-2 border-white shadow-md bg-sky-50">
            <img src={urls[0]} alt="Logo" className="w-full h-full object-cover" />
            {busy && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(urls[0])}
              className="absolute top-2 right-2 w-9 h-9 bg-slate-900/85 text-white rounded-full flex items-center justify-center"
              aria-label="Remove logo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={openPicker}
            className="mt-4 w-full min-h-11 rounded-xl bg-sky-50 text-sky-700 font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-sky-100"
          >
            <Replace className="w-4 h-4" /> Change logo
          </button>
        </div>
      ) : kind === "cover" && urls[0] ? (
        <div className="bg-white rounded-3xl border border-sky-100 overflow-hidden">
          <div className="relative">
            <img src={urls[0]} alt="Cover" className="w-full h-44 sm:h-56 object-cover" />
            {busy && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-3 left-4 text-white font-semibold text-sm drop-shadow">{label}</p>
            <button
              type="button"
              onClick={() => remove(urls[0])}
              className="absolute top-3 right-3 w-9 h-9 bg-slate-900/85 text-white rounded-full flex items-center justify-center"
              aria-label="Remove cover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={openPicker}
            className="w-full min-h-12 text-sm font-semibold text-sky-700 hover:bg-sky-50 inline-flex items-center justify-center gap-2"
          >
            <Replace className="w-4 h-4" /> Change cover photo
          </button>
        </div>
      ) : kind === "gallery" && urls.length > 0 ? (
        <div className="bg-white rounded-3xl border border-sky-100 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <p className="font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-500">{urls.length}/{max} photos</p>
            </div>
            {urls.length < max && (
              <button
                type="button"
                onClick={openPicker}
                className="min-h-10 px-3 rounded-xl bg-sky-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {urls.map((url) => (
              <div key={url} className="relative rounded-2xl overflow-hidden h-32 sm:h-40 bg-sky-50">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(url)}
                  className="absolute top-2 right-2 w-9 h-9 bg-slate-900/85 text-white rounded-full flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {urls.length < max && (
              <button
                type="button"
                onClick={openPicker}
                {...dropProps}
                className={`h-32 sm:h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-sky-600 ${
                  dragOver ? "border-sky-500 bg-sky-50" : "border-sky-200 hover:border-sky-400 hover:bg-sky-50"
                }`}
              >
                {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-7 h-7" />}
                <span className="text-xs font-semibold">{busy ? "Uploading…" : "Add photo"}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        empty
      )}
      {error && <p className="text-sm text-red-600 px-1">{error}</p>}
      <div className="flex gap-2">
        <input
          value={remote}
          onChange={(e) => setRemote(e.target.value)}
          placeholder="Or paste image / SVG URL"
          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm"
        />
        <button type="button" onClick={addRemoteUrl} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Add URL
        </button>
      </div>
    </div>
  );
}
