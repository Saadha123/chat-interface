"use client";
import { useState, useRef, useEffect } from "react";

type Message = {
  sender: "user" | "ai";
  text: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Play TTS for last AI message
  useEffect(() => {
    // Scroll to bottom on new message
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // Play TTS for last AI message
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender === "ai") {
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lastMsg.text }),
      })
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          const blob = new Blob([buffer], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play();
          }
        });
    }
  }, [messages]);

  // Start recording audio
  const startRecording = async () => {
    setRecording(true);
    audioChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      setRecording(false);
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.wav");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.transcript) {
        setInput("");
        // Add transcribed text as a user message to the chat and send to AI
        setMessages((msgs) => [...msgs, { sender: "user", text: data.transcript }]);
        setLoading(true);
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: data.transcript }),
          });
          const aiData = await res.json();
          setMessages((msgs) => [...msgs, { sender: "ai", text: aiData.reply } as Message]);
        } catch {
          setMessages((msgs) => [...msgs, { sender: "ai", text: "Error: Could not get response." } as Message]);
        }
        setLoading(false);
      }
    };
    mediaRecorder.start();
  };

  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { sender: "user", text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setLoading(true);
    // Call OpenAI/chat API here
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      setMessages((msgs) => [...msgs, { sender: "ai", text: data.reply } as Message]);
    } catch {
      setMessages((msgs) => [...msgs, { sender: "ai", text: "Error: Could not get response." } as Message]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded shadow p-4 flex flex-col gap-4">
        <div className="flex-1 overflow-y-auto h-96 border rounded p-2 bg-gray-100">
          {messages.length === 0 ? (
            <div className="text-gray-400 text-center mt-20">No messages yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-end ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.sender === "ai" && (
                    <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center mr-2">
                      <span role="img" aria-label="AI">🤖</span>
                    </div>
                  )}
                  <div className={`max-w-xs px-4 py-2 rounded-lg shadow text-sm ${msg.sender === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800 border"}`}>
                    {msg.text}
                  </div>
                  {msg.sender === "user" && (
                    <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center ml-2">
                      <span role="img" aria-label="User">🧑</span>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
          {loading && (
            <div className="flex justify-center items-center mt-2">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-blue-600 text-sm">AI is thinking...</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 border rounded px-2 py-1"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded disabled:bg-blue-300"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
          <button
            className={`bg-gray-600 text-white px-3 py-1 rounded ${recording ? "bg-red-600 animate-pulse" : ""}`}
            onClick={recording ? stopRecording : startRecording}
            disabled={loading}
          >
            {recording ? "Stop" : "Record"}
          </button>
          <audio ref={audioRef} hidden />
        </div>
      </div>
    </div>
  );
}
