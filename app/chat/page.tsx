"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const transport = new TextStreamChatTransport({
  api: "/api/chat",
});

const SUGGESTIONS = [
  {
    title: "Verify viral remedy",
    prompt: "Is high-dose Vitamin C proven to cure or prevent viral respiratory infections?",
    icon: "🔬",
  },
  {
    title: "Check supplement safety",
    prompt: "Analyze the safety, clinical efficacy, and drug interactions of Ashwagandha.",
    icon: "💊",
  },
  {
    title: "Fact-check health claim",
    prompt: "Fact-check the claim: 'Cold plunge therapy immediately boosts metabolism by 350%'.",
    icon: "🧊",
  },
  {
    title: "Review clinical evidence",
    prompt: "What does authoritative consensus (WHO/CDC/FDA) say about intermittent fasting for longevity?",
    icon: "📋",
  },
];

export default function ClaudeStyleChat() {
  const { messages, sendMessage, status, setMessages, stop } = useChat({ transport });
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Image upload states
  const [selectedImage, setSelectedImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [messageImages, setMessageImages] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";
  const isBusy = isStreaming || isAnalyzingImage;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBusy]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const previewUrl = URL.createObjectURL(file);
    setSelectedImage({ file, previewUrl });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageSelect(e.target.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        handleImageSelect(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelect(e.dataTransfer.files[0]);
    }
  };

  // Submit via image analysis API (/api/analyze)
  const handleImageSubmit = async () => {
    if (!selectedImage) return;

    const currentFile = selectedImage.file;
    const currentPreview = selectedImage.previewUrl;
    const currentPrompt = input.trim();

    // Clean input & preview
    setSelectedImage(null);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setIsAnalyzingImage(true);

    const userMsgId = Date.now().toString();
    const botMsgId = (Date.now() + 1).toString();

    // Attach image to user message
    setMessageImages((prev) => ({ ...prev, [userMsgId]: currentPreview }));

    // Append user message to thread
    const userMessage = {
      id: userMsgId,
      role: "user" as const,
      parts: [
        {
          type: "text" as const,
          text: currentPrompt || "Please analyze this health claim screenshot and verify its clinical accuracy.",
        },
      ],
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const formData = new FormData();
      formData.append("image", currentFile);
      if (currentPrompt) {
        formData.append("text", currentPrompt);
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const report = await res.json();

      const verdictLabels: Record<string, string> = {
        Verified: "🟢 Verified",
        Misleading: "🟡 Misleading",
        False: "🔴 False",
        Scam: "🚨 Scam Warning",
      };

      const formattedReport = [
        `### 🛡️ Clinical Fact-Check Report`,
        `**Verdict:** **${verdictLabels[report.verdict] || report.verdict}** · **Credibility Score:** \`${report.credibilityScore} / 100\``,
        `---`,
        `#### 📋 Clinical Rationale\n${report.explanation}`,
        `#### 🔬 Verified Facts & Consensus\n${report.data?.correctFacts || report.correctFacts}`,
        `#### 🩺 Recommended Action Plan\n${report.data?.actionPlan || report.actionPlan}`,
        report.data?.communityNotesDraft ? `#### ✍️ Community Note Draft\n> ${report.data.communityNotesDraft}` : null,
        report.data?.sourcesCited?.length
          ? `#### 📚 Authoritative Sources Cited\n${report.data.sourcesCited.map((s: string) => `- ${s}`).join("\n")}`
          : null,
        `---`,
        report.reportUrl ? `🔗 **[View Permanent Clinical Report Record](${report.reportUrl})**` : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      const assistantMessage = {
        id: botMsgId,
        role: "assistant" as const,
        parts: [
          {
            type: "text" as const,
            text: formattedReport,
          },
        ],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage = {
        id: botMsgId,
        role: "assistant" as const,
        parts: [
          {
            type: "text" as const,
            text: `⚠️ **Clinical Analysis Error**: ${err.message || "Failed to analyze the image through the clinical fact-checker."}`,
          },
        ],
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBusy) return;

    if (selectedImage) {
      handleImageSubmit();
      return;
    }

    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setSelectedImage(null);
    setMessageImages({});
  };

  // Helper to extract full text from parts
  const getMessageText = (m: (typeof messages)[0]) => {
    return m.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join("");
  };

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex h-screen w-full bg-[#faf9f5] text-[#2c2724] font-sans antialiased selection:bg-[#f0dcd3] selection:text-[#913b1f] overflow-hidden">
      {/* Claude-style Left Sidebar */}

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 px-4 flex items-center justify-between border-b border-[#ece9e1] bg-[#faf9f5]/80 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-[#7d7871] hover:text-[#2c2724] hover:bg-[#edebe4] transition"
                title="Open sidebar"
              >
                <SidebarIcon className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f0eee6] border border-[#e4e1d7] text-xs font-medium text-[#524e48]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></span>
              <span>Gemini 3.6 Flash</span>
              <span className="text-[#a49f96]">·</span>
              <span className="text-[#7d7871]">Multimodal Fact-Checker</span>
            </div>
          </div>

          <button
            onClick={handleNewChat}
            className="text-xs text-[#7d7871] hover:text-[#2c2724] font-medium px-2.5 py-1.5 rounded-lg hover:bg-[#edebe4] transition"
          >
            Clear conversation
          </button>
        </header>

        {/* Chat Feed */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto py-6 min-h-full flex flex-col justify-between">
            {/* Landing / Welcome Screen (Empty State) */}
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-12">
                <div className="w-12 h-12 rounded-2xl bg-[#f0eee6] border border-[#e4e0d5] flex items-center justify-center mb-5 text-[#d97757] shadow-sm">
                  <ClaudeStarIcon className="w-6 h-6" />
                </div>
                <h1 className="text-2xl md:text-3xl font-serif font-normal tracking-tight text-[#2c2724] mb-2">
                  {getGreeting()}! I'm Hygie.
                </h1>
                <p className="text-sm text-[#7d7871] max-w-md mb-8 leading-relaxed">
                  Upload a health claim screenshot or type a question to verify consensus against authoritative clinical guidelines.
                </p>

                {/* Prompt Suggestions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl text-left">
                  {SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInput(item.prompt);
                        textareaRef.current?.focus();
                      }}
                      className="p-3.5 rounded-xl bg-white border border-[#e4e0d5] hover:border-[#c9c4b7] hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all group flex items-start gap-3 text-left"
                    >
                      <span className="text-lg mt-0.5">{item.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-[#2c2724] group-hover:text-[#d97757] transition">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[#7d7871] line-clamp-2 mt-0.5">
                          {item.prompt}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Active Message Stream */
              <div className="space-y-6 pb-4">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  const textContent = getMessageText(m);
                  const attachedImage = messageImages[m.id];

                  return (
                    <div
                      key={m.id}
                      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {isUser ? (
                        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 bg-[#f0ede6] text-[#2c2724] border border-[#e4dfd5] shadow-xs text-sm leading-relaxed whitespace-pre-wrap">
                          {attachedImage && (
                            <div className="mb-2.5 overflow-hidden rounded-xl border border-[#dedad1]/60">
                              <img
                                src={attachedImage}
                                alt="User uploaded screenshot"
                                className="max-h-60 w-auto rounded-lg object-contain"
                              />
                            </div>
                          )}
                          <div>{textContent}</div>
                        </div>
                      ) : (
                        <div className="w-full flex gap-3 items-start group">
                          {/* Claude Avatar Icon */}
                          <div className="w-7 h-7 rounded-lg bg-[#f0eee6] border border-[#e4dfd5] flex items-center justify-center text-[#d97757] shrink-0 mt-0.5">
                            <ClaudeStarIcon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[#7d7871] mb-1.5">
                              Hygie AI
                            </div>
                            <div className="text-sm leading-relaxed text-[#2c2724] font-normal">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                                  h1: ({ children }) => <h1 className="text-lg font-serif font-semibold mt-4 mb-2 text-[#2c2724]">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-serif font-semibold mt-3.5 mb-1.5 text-[#2c2724]">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1 text-[#2c2724]">{children}</h3>,
                                  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-2 border-[#d97757] pl-3 py-1 my-2.5 bg-[#f5f3ec]/60 rounded-r text-[#524e48] italic">
                                      {children}
                                    </blockquote>
                                  ),
                                  code: ({ children, className, ...props }: any) => {
                                    const isBlock = String(children).includes("\n") || className?.includes("language-");
                                    return isBlock ? (
                                      <pre className="bg-[#2c2724] text-[#f5f3ec] p-3 rounded-xl overflow-x-auto my-3 text-xs font-mono">
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    ) : (
                                      <code className="bg-[#f0eee6] border border-[#e4dfd5] text-[#913b1f] px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  a: ({ href, children }) => (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#d97757] hover:underline underline-offset-2 font-medium"
                                    >
                                      {children}
                                    </a>
                                  ),
                                  strong: ({ children }) => <strong className="font-semibold text-[#1e1b19]">{children}</strong>,
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto my-3 border border-[#e4dfd5] rounded-lg">
                                      <table className="min-w-full text-xs text-left divide-y divide-[#e4dfd5]">{children}</table>
                                    </div>
                                  ),
                                  thead: ({ children }) => <thead className="bg-[#f5f3ec] text-[#2c2724] font-medium">{children}</thead>,
                                  th: ({ children }) => <th className="px-3 py-2">{children}</th>,
                                  td: ({ children }) => <td className="px-3 py-2 border-t border-[#e4dfd5]">{children}</td>,
                                }}
                              >
                                {textContent}
                              </ReactMarkdown>
                            </div>

                            {/* Assistant message action bar */}
                            <div className="flex items-center gap-2 mt-3 pt-1 text-[#9c978f]">
                              <button
                                onClick={() => handleCopy(m.id, textContent)}
                                className="p-1 rounded hover:bg-[#eae6dc] hover:text-[#2c2724] transition flex items-center gap-1 text-xs"
                                title="Copy response"
                              >
                                {copiedId === m.id ? (
                                  <>
                                    <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-[11px] text-emerald-600">Copied</span>
                                  </>
                                ) : (
                                  <CopyIcon className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Loading / Generating State */}
                {isBusy && (
                  <div className="flex gap-3 items-start w-full">
                    <div className="w-7 h-7 rounded-lg bg-[#f0eee6] border border-[#e4dfd5] flex items-center justify-center text-[#d97757] shrink-0 mt-0.5 animate-pulse">
                      <ClaudeStarIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[#7d7871] mb-1">
                        {isAnalyzingImage
                          ? "Hygie is analyzing medical claims in screenshot..."
                          : "Hygie is researching..."}
                      </div>
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-[#d97757] animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 rounded-full bg-[#d97757] animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 rounded-full bg-[#d97757] animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        {/* Claude Floating Input Bar with Image Upload */}
        <div className="p-4 md:px-6 shrink-0 bg-gradient-to-t from-[#faf9f5] via-[#faf9f5] to-transparent">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={handleSubmit}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative bg-white border ${
                isDragging ? "border-[#d97757] ring-2 ring-[#d97757]/20" : "border-[#dedad1]"
              } focus-within:border-[#c55f3f] focus-within:ring-1 focus-within:ring-[#c55f3f] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all p-3`}
            >
              {/* Attached Image Preview */}
              {selectedImage && (
                <div className="relative inline-flex items-center gap-2.5 p-1.5 pr-3 mb-2.5 rounded-xl bg-[#f5f3ec] border border-[#e4dfd5] text-xs animate-in fade-in zoom-in-95 duration-150">
                  <img
                    src={selectedImage.previewUrl}
                    alt="Preview"
                    className="w-11 h-11 object-cover rounded-lg border border-[#dedad1] shrink-0"
                  />
                  <div className="flex flex-col min-w-0 max-w-[200px]">
                    <span className="font-medium text-[#2c2724] truncate">
                      {selectedImage.file.name}
                    </span>
                    <span className="text-[10px] text-[#7d7871]">
                      {(selectedImage.file.size / 1024).toFixed(0)} KB · Ready to fact-check
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="p-1 rounded-full hover:bg-[#dedad1] text-[#7d7871] hover:text-[#2c2724] transition ml-1 cursor-pointer"
                    title="Remove image"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  selectedImage
                    ? "Add notes or questions about this image (optional), then press Enter..."
                    : "Ask Hygie or paste medical advice to fact-check (or drop an image)..."
                }
                rows={1}
                className="w-full resize-none border-0 bg-transparent text-[#2c2724] placeholder-[#9c978f] focus:outline-none text-sm leading-relaxed max-h-48 min-h-[24px]"
              />

              {/* Bottom bar inside input card */}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#f4f2eb]">
                <div className="flex items-center gap-2 text-xs">
                  {/* Image Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[#7d7871] hover:text-[#2c2724] hover:bg-[#f0eee6] transition cursor-pointer font-medium text-xs border border-transparent hover:border-[#dedad1]"
                    title="Upload screenshot or medical claim image"
                  >
                    <PaperclipIcon className="w-3.5 h-3.5 text-[#d97757]" />
                    <span>Upload Image</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#f6f4ee] border border-[#e8e4db] text-[11px] font-medium text-[#706b63]">
                    <ShieldCheckIcon className="w-3 h-3 text-[#d97757]" />
                    Siri & Web Multimodal API
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={() => stop()}
                      className="p-1.5 rounded-xl bg-[#2c2724] text-white hover:bg-black transition shadow-sm cursor-pointer"
                      title="Stop generating"
                    >
                      <StopIcon className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={(!input.trim() && !selectedImage) || isBusy}
                      className={`p-1.5 rounded-xl transition-all shadow-xs flex items-center justify-center cursor-pointer ${
                        (input.trim() || selectedImage) && !isBusy
                          ? "bg-[#d97757] hover:bg-[#c36445] text-white active:scale-95"
                          : "bg-[#f0ede6] text-[#b8b3aa] cursor-not-allowed"
                      }`}
                      title="Send message"
                    >
                      <ArrowUpIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="text-center mt-2">
              <span className="text-[11px] text-[#a49f96]">
                Upload screenshots or text claims. Analyzed against WHO, CDC, and peer-reviewed consensus.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline SVGs for Claude's distinctive styling
function ClaudeStarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" />
    </svg>
  );
}

function SidebarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={className}>
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}