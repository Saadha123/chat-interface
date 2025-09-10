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
  <div className="w-full max-w-md rounded-2xl shadow-lg p-6 flex flex-col gap-4 bg-gradient-to-br from-blue-50 via-white to-green-50 border-0">
  <div className="flex-1 overflow-y-auto h-96 rounded-xl p-4 bg-white/80 shadow-inner">
          {messages.length === 0 ? (
            <div className="text-gray-400 text-center mt-20">No messages yet.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-end ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.sender === "ai" && (
                    <div className="w-8 h-8 rounded-full bg-green-300 flex items-center justify-center mr-2 shadow">
                      <span role="img" aria-label="AI">🤖</span>
                    </div>
                  )}
                  <div className={`max-w-xs px-5 py-3 rounded-2xl shadow-md text-base font-medium ${msg.sender === "user" ? "bg-blue-100 text-gray-900" : "bg-gray-100 text-gray-900"}`}>
                    {msg.text}
                  </div>
                  {msg.sender === "user" && (
                    <div className="w-8 h-8 rounded-full bg-blue-300 flex items-center justify-center ml-2 shadow">
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
              type="text"
              className="flex-1 px-3 py-2 rounded border focus:outline-none focus:ring focus:border-blue-300 bg-white text-gray-900 placeholder-gray-500"
              placeholder="Type your message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
          <button
            className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-1 rounded flex items-center justify-center disabled:bg-blue-300 transition-colors"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            aria-label="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
          <button
            className={`px-3 py-1 rounded-full flex items-center justify-center transition-colors shadow ${recording ? "bg-red-500 hover:bg-red-400" : "bg-green-500 hover:bg-green-400"}`}
            onClick={recording ? stopRecording : startRecording}
            disabled={loading}
            aria-label={recording ? "Stop Recording" : "Start Recording"}
          >
            {recording ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6">
                <circle cx="12" cy="12" r="10" fill="white" stroke="currentColor" strokeWidth="2" />
                <rect x="9" y="9" width="6" height="6" rx="1" fill="red" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6">
                <rect x="8" y="4" width="8" height="12" rx="4" fill="#222" />
                <rect x="10" y="16" width="4" height="2" rx="1" fill="#222" />
                <circle cx="12" cy="20" r="1" fill="#222" />
              </svg>
            )}
          </button>
          <audio ref={audioRef} hidden />
        </div>
      </div>
    </div>
  );
}
