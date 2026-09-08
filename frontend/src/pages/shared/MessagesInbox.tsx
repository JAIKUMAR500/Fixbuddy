import React, { useEffect, useRef, useState } from "react";
import { Send, ArrowLeft, Phone, Image, Mic } from "lucide-react";
import { View } from "../../types";
import { Avatar, EmptyState, Skeleton } from "../../components/ui";
import { ChatAPI, uploadMedia, type ChatMsg, type ChatThread } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { startCall, jobAllowsCall } from "../../api/phone";

export default function MessagesInbox({
  navigate,
  mine = "customer",
}: {
  navigate: (v: View) => void;
  mine?: "customer" | "provider";
}) {
  const { setActiveRequestId, activeRequestId } = useApp();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        let conversationId: string | null = null;
        const listed = await ChatAPI.list();
        if (cancelled) return;
        let conversations = listed.conversations;
        if (activeRequestId) {
          const existing = conversations.find((t) => t.requestId === activeRequestId);
          if (existing) {
            conversationId = existing.id;
          } else {
            const opened = await ChatAPI.open(activeRequestId);
            const refreshed = await ChatAPI.list();
            if (cancelled) return;
            conversations = refreshed.conversations;
            conversationId = opened.conversationId;
          }
        }
        setThreads(conversations);
        if (conversationId) setActiveId(conversationId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load messages");
        try {
          const d = await ChatAPI.list();
          if (!cancelled) setThreads(d.conversations);
        } catch {
          /* list already failed */
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeRequestId]);

  useEffect(() => {
    if (!activeId) return;
    ChatAPI.messages(activeId)
      .then((d) => setMessages(d.messages))
      .catch((e) => setError(e.message));
  }, [activeId]);

  const active = threads.find((t) => t.id === activeId);

  const pushMessage = (message: ChatMsg) => {
    setMessages((prev) => [...prev, message]);
    setThreads((prev) => prev.map((t) => (t.id === activeId ? { ...t, lastMessage: message.text } : t)));
  };

  const send = async (body: { text?: string; kind?: string; mediaUrl?: string }) => {
    if (!activeId) return;
    setSending(true);
    setError("");
    try {
      const { message } = await ChatAPI.send(activeId, body);
      pushMessage(message);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  const sendVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const file = new File([new Blob(chunks, { type: rec.mimeType || "audio/webm" })], "voice.webm", { type: rec.mimeType || "audio/webm" });
        const { url } = await uploadMedia(file);
        await send({ kind: "voice", mediaUrl: url, text: "Voice note" });
      };
      rec.start();
      setTimeout(() => rec.stop(), 8000);
    } catch {
      setError("Microphone permission is required");
    }
  };

  return (
    <div className="h-[calc(100vh-128px)] lg:h-[calc(100vh-64px)] flex overflow-hidden">
      <div className={`${activeId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r border-sky-100 bg-white`}>
        <div className="px-4 py-4 border-b border-sky-100">
          <h2 className="font-display font-bold text-slate-900 text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Messages</h2>
        </div>
        {loading && <div className="p-4"><Skeleton className="h-16 w-full" /></div>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!loading && threads.length === 0 && (
          <div className="p-4">
            <EmptyState icon="💬" title="No conversations" description="Chat starts after a request is assigned." />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {threads.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveId(m.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-sky-50 border-b border-sky-50 min-h-[72px] ${activeId === m.id ? "bg-sky-50" : ""}`}
            >
              <Avatar src={m.avatar} name={m.name} size="md" />
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                  <span className="text-xs text-slate-400">{m.time}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{m.lastMessage}</p>
                <p className="text-xs text-sky-500">{m.service}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div className="flex-1 flex flex-col bg-sky-50">
          <div className="bg-white border-b border-sky-100 px-4 py-3 flex items-center gap-3">
            <button className="md:hidden p-2 rounded-xl hover:bg-sky-50 min-w-11 min-h-11" onClick={() => setActiveId(null)}>
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <Avatar src={active.avatar} name={active.name} size="sm" />
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">{active.name}</p>
              <p className="text-xs text-slate-500">{active.service}</p>
            </div>
            {jobAllowsCall(active.status) && (
              <button
                type="button"
                onClick={() => startCall(active.phone)}
                className="p-3 rounded-xl bg-emerald-50 text-emerald-700 min-w-11 min-h-11 flex items-center justify-center"
                title="Call"
              >
                <Phone className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => {
                setActiveRequestId(active.requestId);
                navigate(mine === "customer" ? "request-status" : "job-details");
              }}
              className="text-sm text-sky-600 font-medium bg-sky-50 px-4 py-2.5 rounded-xl"
            >
              Request
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((cm) => (
              <div key={cm.id} className={`flex ${cm.sender === mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${cm.sender === mine ? "bg-sky-600 text-white" : "bg-white border border-sky-100"}`}>
                  {cm.kind === "image" && cm.mediaUrl ? (
                    <img src={cm.mediaUrl} alt="" className="rounded-xl max-h-56 w-full object-cover mb-1" />
                  ) : null}
                  {cm.kind === "voice" && cm.mediaUrl ? (
                    <audio controls src={cm.mediaUrl} className="w-52" />
                  ) : null}
                  {cm.kind !== "image" && cm.kind !== "voice" ? cm.text : null}
                  <p className={`text-[10px] mt-1 ${cm.sender === mine ? "text-sky-100" : "text-slate-400"}`}>{cm.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white border-t border-sky-100 px-3 py-3 flex items-center gap-2">
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void uploadMedia(file).then(({ url }) => send({ kind: "image", mediaUrl: url, text: "Photo" }));
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => photoRef.current?.click()} className="p-3 rounded-xl bg-sky-50 text-sky-700 min-w-11 min-h-11">
              <Image className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => void sendVoice()} className="p-3 rounded-xl bg-sky-50 text-sky-700 min-w-11 min-h-11">
              <Mic className="w-5 h-5" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && text.trim() && void send({ text: text.trim() })}
              placeholder="Type a message…"
              className="flex-1 bg-sky-50 rounded-xl px-4 py-3 border border-sky-200 text-sm focus:outline-none min-h-12"
            />
            <button disabled={sending || !text.trim()} onClick={() => void send({ text: text.trim() })} className="p-3 rounded-xl bg-sky-600 text-white min-w-12 min-h-12 disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center bg-sky-50">
          <p className="text-sm text-slate-500">Select a conversation to start messaging.</p>
        </div>
      )}
    </div>
  );
}
