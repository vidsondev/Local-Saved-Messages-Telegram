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
  X,
  SmilePlus,
  Pin,
  PinOff
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

const getClientId = () => {
  let id = localStorage.getItem("telegram-clone-client-id");
  if (!id) {
    id = Math.random().toString(36).substring(2);
    localStorage.setItem("telegram-clone-client-id", id);
  }
  return id;
};
const clientId = getClientId();

const EMOJIS = ["👍", "❤️", "😆", "😮", "😢", "👏"];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    msg: Message;
  } | null>(null);
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

  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
      if (reactionMenuId) setReactionMenuId(null);
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && contextMenu) setContextMenu(null);
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [contextMenu, reactionMenuId]);

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

  const toggleReaction = (id: string, emoji: string) => {
    socket.emit("toggle-reaction", { id, emoji, clientId });
    setReactionMenuId(null);
  };

  const togglePin = (id: string, isPinned: boolean) => {
    socket.emit("toggle-pin", { id, isPinned });
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 200;
    const menuHeight = 250;
    let x = e.clientX;
    let y = e.clientY;
    
    if (window.innerWidth - x < menuWidth) x = window.innerWidth - menuWidth - 10;
    if (window.innerHeight - y < menuHeight) y = window.innerHeight - menuHeight - 10;

    setContextMenu({
      visible: true,
      x,
      y,
      msg
    });
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

      {/* Context Menu Overlay */}
      {contextMenu?.visible && (
        <div 
          className="fixed z-[100] bg-[#17212B] border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[200px] overflow-hidden backdrop-blur-md bg-opacity-95"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.msg.type === "text" && (
            <>
              <button className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-[#F5F5F5] hover:bg-[#2B5278]/80 transition-colors"
                onClick={() => { copyMessage(contextMenu.msg.id, contextMenu.msg.content); setContextMenu(null); }}>
                <Copy className="w-4 h-4 text-[#87B4D9]" /> Copy Text
              </button>
              <button className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-[#F5F5F5] hover:bg-[#2B5278]/80 transition-colors"
                onClick={() => { startEditing(contextMenu.msg.id, contextMenu.msg.content); setContextMenu(null); }}>
                <Pencil className="w-4 h-4 text-[#87B4D9]" /> Edit
              </button>
            </>
          )}
          {contextMenu.msg.type === "file" && (
            <a href={contextMenu.msg.content} download={contextMenu.msg.originalName} target="_blank" rel="noopener noreferrer" className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-[#F5F5F5] hover:bg-[#2B5278]/80 transition-colors block"
               onClick={() => setContextMenu(null)}>
              <Download className="w-4 h-4 text-[#87B4D9]" /> Download
            </a>
          )}
          <button className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-[#F5F5F5] hover:bg-[#2B5278]/80 transition-colors"
            onClick={() => togglePin(contextMenu.msg.id, !contextMenu.msg.isPinned)}>
            {contextMenu.msg.isPinned ? <PinOff className="w-4 h-4 text-[#87B4D9]" /> : <Pin className="w-4 h-4 text-[#87B4D9]" />} 
            {contextMenu.msg.isPinned ? "Unpin Message" : "Pin Message"}
          </button>
          
          <div className="h-[1px] bg-white/10 my-1" />
          
          <button className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-red-400 hover:bg-[#2B5278]/80 transition-colors"
            onClick={() => { deleteMessage(contextMenu.msg.id); setContextMenu(null); }}>
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full shadow-2xl relative bg-[#0E1621] sm:border-x sm:border-[#17212B]">
        
        {/* Header */}
        <header className="h-[60px] flex items-center px-4 bg-[#17212B] border-b border-[#000000]/20 shrink-0 sticky top-0 z-30 shadow-sm">
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

        {/* Pinned Messages Area */}
        {messages.filter(m => m.isPinned).length > 0 && (
          <div className="bg-[#17212B]/95 backdrop-blur-sm border-b border-[#000000]/20 shrink-0 z-20 shadow-sm max-h-[120px] overflow-y-auto custom-scrollbar">
            {messages.filter(m => m.isPinned).map((msg) => (
              <div key={`pin-${msg.id}`} className="px-4 py-2 border-l-2 border-[#2AABEE] hover:bg-[#2B5278]/20 transition-colors flex justify-between group cursor-pointer" onClick={() => {}}>
                <div className="min-w-0 pr-4">
                  <div className="text-[#2AABEE] text-[13px] font-medium leading-tight mb-0.5">Pinned Message</div>
                  <div className="text-[13px] text-[#F5F5F5] truncate leading-tight">
                    {msg.type === "text" ? msg.content : msg.originalName || "File"}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); togglePin(msg.id, false); }}
                  className="text-[#7F91A4] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
                  title="Unpin"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Messages List */}
        <div 
          className="flex-1 min-h-0 overflow-y-auto w-full relative custom-scrollbar flex flex-col"
          style={{ backgroundImage: 'url("https://telegram.org/img/t_logo.png")', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundSize: '30%', backgroundBlendMode: 'soft-light', opacity: 0.95 }}
        >
          <div className="p-4 flex flex-col mt-auto w-full">
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
                      <div 
                        key={msg.id} 
                        className="flex justify-end w-full group relative"
                        onContextMenu={(e) => handleContextMenu(e, msg)}
                      >
                        <div className="relative max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl text-left bg-gradient-to-br from-[#2B5278] to-[#234361] hover:shadow-md transition-shadow rounded-[18px] rounded-tr-[4px] px-3.5 pt-2 pb-2 shadow-sm border border-[#305C85]/30 text-[16px] leading-[1.45]">
                          {/* Reaction Menu popup */}
                          {reactionMenuId === msg.id && (
                            <div className="absolute top-0 right-0 -mt-14 mr-2 z-40 bg-[#17212B] border border-white/10 rounded-full shadow-2xl px-2 py-1.5 flex gap-1 animate-in fade-in zoom-in-95 duration-150">
                              {EMOJIS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                                  className="w-10 h-10 flex items-center justify-center hover:bg-[#2B5278] rounded-full text-[20px] transition-transform hover:scale-125"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Options buttons (shows on hover) */}
                          <div className="absolute top-0 right-0 -mt-2 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-30">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setReactionMenuId(reactionMenuId === msg.id ? null : msg.id); }}
                              className="bg-[#17212B] text-yellow-400 p-1.5 rounded-full hover:bg-yellow-500 hover:text-white shadow-xl border border-white/5 transition-all transform hover:scale-105"
                              title="Add Reaction"
                            >
                              <SmilePlus className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => togglePin(msg.id, !msg.isPinned)}
                              className="bg-[#17212B] text-purple-400 p-1.5 rounded-full hover:bg-purple-500 hover:text-white shadow-xl border border-white/5 transition-all transform hover:scale-105"
                              title={msg.isPinned ? "Unpin Message" : "Pin Message"}
                            >
                              {msg.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                            {msg.type === "text" && (
                              <>
                                <button 
                                  onClick={() => startEditing(msg.id, msg.content)}
                                  className="bg-[#17212B] text-blue-400 p-1.5 rounded-full hover:bg-blue-500 hover:text-white shadow-xl border border-white/5 transition-all transform hover:scale-105"
                                  title="Edit Message"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => copyMessage(msg.id, msg.content)}
                                  className="bg-[#17212B] text-green-400 p-1.5 rounded-full hover:bg-green-500 hover:text-white shadow-xl border border-white/5 transition-all transform hover:scale-105"
                                  title="Copy Message"
                                >
                                  {copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => deleteMessage(msg.id)}
                              className="bg-[#17212B] text-red-400 p-1.5 rounded-full hover:bg-red-500 hover:text-white shadow-xl border border-white/5 transition-all transform hover:scale-105"
                              title="Delete Message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Message Content */}
                          <div className="relative z-10">
                            {msg.type === "text" ? (
                              <div className="text-[#F5F5F5] whitespace-pre-wrap break-words mb-[18px] tracking-[0.01em]">
                                {msg.content}
                              </div>
                            ) : (
                              <div className="mb-[20px] font-sans">
                                {msg.mimeType?.startsWith('image/') ? (
                                  <div className="mb-2 -mx-3.5 -mt-2 rounded-t-[16px] overflow-hidden cursor-pointer bg-black/20 border-b border-black/10">
                                    <a href={msg.content} target="_blank" rel="noopener noreferrer">
                                      <img 
                                        src={msg.content} 
                                        alt={msg.originalName || "Uploaded Image"} 
                                        className="w-full max-h-[300px] sm:max-h-[400px] object-cover hover:opacity-95 transition-opacity"
                                        loading="lazy"
                                      />
                                    </a>
                                  </div>
                                ) : msg.mimeType?.startsWith('video/') ? (
                                  <div className="mb-2 -mx-3.5 -mt-2 rounded-t-[16px] overflow-hidden bg-black/40 text-center border-b border-black/10">
                                    <video 
                                      src={msg.content} 
                                      controls 
                                      className="w-full max-h-[300px] sm:max-h-[400px] object-contain mx-auto"
                                    />
                                  </div>
                                ) : msg.mimeType?.startsWith('audio/') ? (
                                  <div className="mb-3 mt-2 relative z-10 w-full min-w-[250px]">
                                    <audio 
                                      src={msg.content} 
                                      controls 
                                      className="w-full h-11 max-w-full outline-none rounded-xl shadow-sm"
                                    />
                                  </div>
                                ) : msg.mimeType === 'application/pdf' ? (
                                  <div className="mb-2 -mx-3.5 -mt-2 rounded-t-[16px] overflow-hidden bg-white/95">
                                    <iframe 
                                      src={msg.content} 
                                      className="w-full h-[300px] sm:h-[400px] border-none"
                                      title={msg.originalName || "PDF Preview"}
                                    />
                                  </div>
                                ) : null}
                                
                                <div className="flex items-center gap-3.5 bg-black/10 hover:bg-black/15 transition-colors p-3 rounded-xl border border-white/5 backdrop-blur-sm mt-2">
                                  <div className="w-11 h-11 bg-gradient-to-br from-[#2AABEE] to-[#2298D6] text-white rounded-full flex items-center justify-center shrink-0 shadow-sm">
                                    {(() => {
                                      const Icon = getFileIcon(msg.mimeType);
                                      return <Icon className="w-5 h-5" />;
                                    })()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="block font-medium text-[#F5F5F5] truncate text-[15px]">
                                      {msg.originalName || "Unnamed File"}
                                    </div>
                                    <div className="text-[#87B4D9] flex items-center gap-1.5 text-[12px] font-medium mt-0.5">
                                      {formatBytes(msg.size || 0)} 
                                      <span className="w-1 h-1 rounded-full bg-[#87B4D9]/50"></span> 
                                      {msg.mimeType?.split('/')[1]?.toUpperCase() || "FILE"}
                                    </div>
                                  </div>
                                  <a 
                                    href={msg.content} 
                                    download={msg.originalName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-[#17212B]/40 text-[#2AABEE] rounded-full flex items-center justify-center shrink-0 hover:bg-[#2AABEE] hover:text-white transition-all transform hover:scale-105 shadow-sm"
                                    title="Download File"
                                  >
                                    <Download className="w-[18px] h-[18px]" />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Reactions */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 mb-4 z-10 relative pr-16 text-left">
                              {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium transition-colors border shadow-sm",
                                    userIds.includes(clientId) 
                                      ? "bg-[#2B5278] border-[#2AABEE] text-[#F5F5F5]" 
                                      : "bg-black/20 border-white/10 text-[#F5F5F5] hover:bg-black/30"
                                  )}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-[11px] opacity-90">{userIds.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* Metadata */}
                          <div className={cn(
                            "flex items-center justify-end gap-1.5 text-[11px] font-semibold select-none pointer-events-none opacity-80 z-10",
                            msg.type === "text" ? "absolute bottom-1.5 right-3" : "absolute bottom-1.5 right-3"
                          )}>
                            {msg.updatedAt && (
                              <span className="text-[#87B4D9] opacity-70 italic mr-0.5">edited</span>
                            )}
                            <span className="text-[#87B4D9]">
                              {format(msg.createdAt, "HH:mm")}
                            </span>
                            {/* Checkmarks simulation */}
                            <svg className="w-[15px] h-[15px] text-[#50A6E1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
