import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const DB_FILE = path.join(process.cwd(), "database.json");

// Define types
export type MessageType = "text" | "file";

export interface Message {
  id: string;
  type: MessageType;
  content: string; // text body or file name
  originalName?: string; // original file name
  mimeType?: string;
  size?: number;
  createdAt: number;
  updatedAt?: number;
}

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Simple JSON database
let messages: Message[] = [];
if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    messages = JSON.parse(data);
  } catch (error) {
    console.error("Error reading database:", error);
  }
}

const saveDb = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(messages, null, 2));
};

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});
const upload = multer({ storage });

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  // Socket.io for real-time sync
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  app.use(cors());
  app.use(express.json());
  
  // Serve uploaded files statically
  app.use("/uploads", express.static(UPLOADS_DIR));

  // --- API Routes ---
  
  // Get all messages
  app.get("/api/messages", (req, res) => {
    res.json(messages);
  });

  // Upload file endpoint
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const newMessage: Message = {
      id: Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
      type: "file",
      content: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      createdAt: Date.now(),
    };

    messages.push(newMessage);
    saveDb();

    // Broadcast to all connected clients
    io.emit("new-message", newMessage);

    res.json(newMessage);
  });

  // --- Socket.io Setup ---
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Initial load
    socket.emit("sync-messages", messages);

    socket.on("send-text", (text: string) => {
      const newMessage: Message = {
        id: Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
        type: "text",
        content: text,
        createdAt: Date.now(),
      };
      
      messages.push(newMessage);
      saveDb();
      
      io.emit("new-message", newMessage);
    });

    // Delete message
    socket.on("delete-message", (id: string) => {
      const msgIndex = messages.findIndex(m => m.id === id);
      if (msgIndex !== -1) {
        const msg = messages[msgIndex];
        // Remove file if it's a file type
        if (msg.type === "file" && msg.content) {
          const filePath = path.join(process.cwd(), msg.content);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (err) {
              console.error("Failed to delete file:", err);
            }
          }
        }
        
        messages.splice(msgIndex, 1);
        saveDb();
        io.emit("message-deleted", id);
      }
    });

    // Edit message
    socket.on("edit-message", ({ id, text }: { id: string, text: string }) => {
      const msg = messages.find(m => m.id === id);
      if (msg && msg.type === "text") {
        msg.content = text;
        msg.updatedAt = Date.now();
        saveDb();
        io.emit("message-edited", msg);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Local Access: You can use your mobile browser to connect to the computer's Local IP address on port 3000.`);
  });
}

startServer();
