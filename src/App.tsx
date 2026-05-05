import React, { useEffect, useRef, useState, DragEvent } from "react";
import { format } from "date-fns";
import { io, Socket } from "socket.io-client";
import { 
  Paperclip, 
  Send, 
  Bookmark, 
  MoreVertical, 
  FileIcon, 
  Download, 
  Trash2,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Search,
  Copy,
  Check,
  Pencil,
  X
} from "lucide-react";
import { Message } from "./types";
import { cn, formatBytes } from "./lib/utils";

// Detect file category for icon
const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return FileIcon;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.startsWith("text/")) return FileText;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("rar")) return FileArchive;
  return FileIcon;
};

// Only connect once
const socket: Socket = io({
  path: "/socket.io"
});

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    socket.on("sync-messages", (data: Message[]) => {
      setMessages(data);
      scrollToBottom(false);
    });

    socket.on("new-message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom(true);
    });

    socket.on("message-deleted", (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    });

    socket.on("message-edited", (updatedMsg: Message) => {
      setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });

    return () => {
      socket.off("sync-messages");
      socket.off("new-message");
      socket.off("message-deleted");
      socket.off("message-edited");
    };
  }, []);

  const scrollToBottom = (smooth = true) => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "end",
        });
      }
    }, 100);
  };

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    
    if (editingMessageId) {
      socket.emit("edit-message", { id: editingMessageId, text: inputText.trim() });
      setEditingMessageId(null);
    } else {
      socket.emit("send-text", inputText.trim());
    }
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      // The socket event will append it to messages
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload the file.");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      uploadFile(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const deleteMessage = (id: string) => {
    if (confirm("Delete this message?")) {
      socket.emit("delete-message", id);
    }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEditing = (id: string, content: string) => {
    setEditingMessageId(id);
    setInputText(content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setInputText("");
  };

  // Group messages by date
  const filteredMessages = messages.filter(msg => {
    if (!searchQuery.trim()) return true;
    if (msg.type === "text") {
      return msg.content.toLowerCase().includes(searchQuery.toLowerCase());
    } else if (msg.originalName) {
      return msg.originalName.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return false;
  });

  const groupedMessages = filteredMessages.reduce((acc, msg) => {
    const datePattern = format(msg.createdAt, "MMMM d");
    if (!acc[datePattern]) acc[datePattern] = [];
    acc[datePattern].push(msg);
    return acc;
  }, {} as Record<string, Message[]>);

  return (
    <div 
      className="flex h-screen w-full bg-[#0E1621] text-[#F5F5F5] font-sans selection:bg-[#2B5278]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0E1621]/80 backdrop-blur-sm border-4 border-dashed border-[#2AABEE] m-4 rounded-xl">
          <div className="text-center animate-pulse flex flex-col items-center">
            <Paperclip className="w-16 h-16 text-[#2AABEE] mb-4" />
            <h2 className="text-3xl font-semibold text-[#2AABEE]">Drop file to send</h2>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full shadow-2xl relative bg-[#0E1621] sm:border-x sm:border-[#17212B]">
        
        {/* Header */}
        <header className="h-[60px] flex items-center px-4 bg-[#17212B] border-b border-[#000000]/20 shrink-0 sticky top-0 z-20 shadow-sm">
          {isSearchOpen ? (
            <div className="flex-1 flex items-center gap-3">
              <button 
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 hover:bg-[#2B5278]/30 transition-colors text-[#7F91A4]" 
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <input
                type="text"
                autoFocus
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[#F5F5F5] outline-none text-[16px] placeholder-[#7F91A4]"
              />
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-[#2AABEE] flex items-center justify-center mr-4 shrink-0 shadow-md">
                <Bookmark className="w-5 h-5 text-white fill-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-[17px] font-semibold truncate leading-tight">Saved Messages</h1>
                <p className="text-[13px] text-[#7F91A4] leading-tight mt-0.5">Your cloud storage</p>
              </div>
              <button 
                className="p-2 mr-1 hover:bg-[#2B5278]/20 rounded-full text-[#7F91A4] transition-colors"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-[#2B5278]/20 rounded-full text-[#7F91A4] transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </>
          )}
        </header>

        {/* Messages List */}
        <div 
          className="flex-1 overflow-y-auto w-full relative custom-scrollbar flex flex-col"
          style={{ backgroundImage: 'url("https://telegram.org/img/t_logo.png")', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundSize: '30%', backgroundBlendMode: 'soft-light', opacity: 0.95 }}
        >
          <div className="p-4 flex-1 flex flex-col justify-end min-h-full">
            {Object.keys(groupedMessages).length === 0 ? (
              <div className="m-auto text-center p-6 bg-[#17212B]/80 backdrop-blur-md rounded-2xl max-w-sm">
                <div className="w-16 h-16 rounded-full bg-[#2B5278] flex items-center justify-center mx-auto mb-4">
                  <Bookmark className="w-8 h-8 text-[#2AABEE] fill-[#2AABEE]" />
                </div>
                <h3 className="text-lg font-medium mb-2">Saved Messages</h3>
                <p className="text-[#7F91A4] text-sm">
                  Forward messages here for safekeeping. Send files and text to access them on any device connected to your local network.
                </p>
              </div>
            ) : (
              (Object.entries(groupedMessages) as [string, Message[]][]).map(([date, msgs]) => (
                <div key={date} className="w-full mb-6">
                  {/* Date Badge */}
                  <div className="flex justify-center sticky top-2 z-10 mb-4">
                    <span className="bg-[#17212B]/90 backdrop-blur-sm text-[#7F91A4] text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                      {date}
                    </span>
                  </div>
                  
                  {/* Message Bubbles */}
                  <div className="flex flex-col gap-2">
                    {msgs.map((msg) => (
                      <div key={msg.id} className="flex justify-end w-full group">
                        <div className="relative max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl text-left bg-[#2B5278] rounded-2xl rounded-tr-sm px-3 pt-2 pb-1.5 shadow-sm text-[15px]">
                          {/* Options buttons (shows on hover) */}
                          <div className="absolute top-0 right-0 -mt-2 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                            {msg.type === "text" && (
                              <>
                                <button 
                                  onClick={() => startEditing(msg.id, msg.content)}
                                  className="bg-[#17212B] text-blue-400 p-1.5 rounded-full hover:bg-blue-500 hover:text-white shadow-md transition-colors"
                                  title="Edit Message"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => copyMessage(msg.id, msg.content)}
                                  className="bg-[#17212B] text-green-400 p-1.5 rounded-full hover:bg-green-500 hover:text-white shadow-md transition-colors"
                                  title="Copy Message"
                                >
                                  {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => deleteMessage(msg.id)}
                              className="bg-[#17212B] text-red-400 p-1.5 rounded-full hover:bg-red-500 hover:text-white shadow-md transition-colors"
                              title="Delete Message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {msg.type === "text" ? (
                            <div className="text-white whitespace-pre-wrap break-words leading-relaxed mb-4">
                              {msg.content}
                            </div>
                          ) : (
                            <div className="mb-3 font-sans">
                              {msg.mimeType?.startsWith('image/') ? (
                                <div className="mb-2 -mx-2 -mt-1 rounded-t-xl overflow-hidden cursor-pointer bg-black/20">
                                  <a href={msg.content} target="_blank" rel="noopener noreferrer">
                                    <img 
                                      src={msg.content} 
                                      alt={msg.originalName || "Uploaded Image"} 
                                      className="w-full max-h-[300px] sm:max-h-[400px] object-cover hover:opacity-90 transition-opacity"
                                      loading="lazy"
                                    />
                                  </a>
                                </div>
                              ) : msg.mimeType?.startsWith('video/') ? (
                                <div className="mb-2 -mx-2 -mt-1 rounded-t-xl overflow-hidden bg-black/20 text-center">
                                  <video 
                                    src={msg.content} 
                                    controls 
                                    className="w-full max-h-[300px] sm:max-h-[400px] object-contain mx-auto"
                                  />
                                </div>
                              ) : msg.mimeType?.startsWith('audio/') ? (
                                <div className="mb-2 mt-1 relative z-10 w-full min-w-[250px]">
                                  <audio 
                                    src={msg.content} 
                                    controls 
                                    className="w-full h-10 max-w-full outline-none rounded-xl"
                                  />
                                </div>
                              ) : msg.mimeType === 'application/pdf' ? (
                                <div className="mb-2 -mx-2 -mt-1 rounded-t-xl overflow-hidden bg-white">
                                  <iframe 
                                    src={msg.content} 
                                    className="w-full h-[300px] sm:h-[400px] border-none"
                                    title={msg.originalName || "PDF Preview"}
                                  />
                                </div>
                              ) : null}
                              
                              <div className="flex items-center gap-3 bg-[#17212B]/30 p-2.5 rounded-xl">
                                <a 
                                  href={msg.content} 
                                  download={msg.originalName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-12 h-12 bg-[#2AABEE] text-white rounded-full flex items-center justify-center shrink-0 hover:bg-[#2298D6] transition-colors shadow-sm cursor-pointer"
                                  title="Download File"
                                >
                                  {msg.mimeType?.startsWith('image/') ? <Download className="w-5 h-5" /> : (() => {
                                    const Icon = getFileIcon(msg.mimeType);
                                    return <Icon className="w-6 h-6" />;
                                  })()}
                                </a>
                                <div className="min-w-0 flex-1">
                                  <a 
                                    href={msg.content} 
                                    download={msg.originalName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block font-medium text-[#F5F5F5] truncate hover:underline"
                                  >
                                    {msg.originalName || "Unnamed File"}
                                  </a>
                                  <div className="text-[#87B4D9] flex items-center gap-2 text-xs font-medium mt-0.5">
                                    {formatBytes(msg.size || 0)} • {msg.mimeType?.substring(0, 20) || "Unknown Type"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className={cn(
                            "flex items-center justify-end gap-1 text-[11px] font-medium select-none pointer-events-none opacity-80",
                            msg.type === "text" ? "absolute bottom-1 right-2" : "mt-0"
                          )}>
                            {msg.updatedAt && (
                              <span className="text-[#87B4D9] opacity-70 italic mr-0.5">edited</span>
                            )}
                            <span className="text-[#87B4D9]">
                              {format(msg.createdAt, "HH:mm")}
                            </span>
                            {/* Checkmarks simulation */}
                            <svg className="w-3.5 h-3.5 text-[#50A6E1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-[#17212B] flex flex-col shrink-0 relative">
          {editingMessageId && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2B5278]/30">
              <div className="flex items-center gap-2 text-[#2AABEE]">
                <Pencil className="w-4 h-4" />
                <span className="text-sm font-medium">Edit Message</span>
              </div>
              <button 
                onClick={cancelEditing} 
                className="text-[#7F91A4] hover:text-[#F5F5F5] transition-colors p-1 rounded-full hover:bg-[#2B5278]/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="px-3 sm:px-4 py-3 flex items-end">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onFileChange} 
              className="hidden" 
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-[#7F91A4] hover:text-[#2AABEE] transition-colors rounded-full hover:bg-[#2B5278]/20 disabled:opacity-50"
              disabled={uploading || !!editingMessageId}
              title="Attach file"
            >
              <Paperclip className={cn("w-6 h-6", uploading && "animate-bounce")} />
            </button>
            
            <div className="flex-1 bg-[#242F3D] rounded-2xl mx-2 shadow-sm border border-transparent focus-within:border-[#2B5278] transition-colors">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={editingMessageId ? "Edit your message..." : "Write a message..."}
                className="w-full bg-transparent text-[#F5F5F5] placeholder-[#7F91A4] px-4 py-3.5 max-h-32 min-h-[52px] resize-none outline-none text-[15px] custom-scrollbar rounded-2xl"
                rows={1}
                style={{
                  height: "auto",
                }}
              />
            </div>
            
            {inputText.trim() ? (
              <button 
                onClick={handleSendText}
                className="w-[52px] h-[52px] bg-[#2AABEE] text-white rounded-full flex items-center justify-center hover:bg-[#2298D6] transition-colors shadow-md shrink-0"
                title={editingMessageId ? "Save Edit" : "Send Message"}
              >
                {editingMessageId ? <Check className="w-6 h-6" /> : <Send className="w-5 h-5 ml-1" />}
              </button>
            ) : (
              <button 
                className="w-[52px] h-[52px] bg-[#17212B] text-[#7F91A4] rounded-full flex items-center justify-center shrink-0 cursor-default"
                disabled
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
