import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import Message from "./model.js";
import dotenv from "dotenv";
const app = express();
const httpServer = createServer(app);
const FRONTEND_URL = "http://localhost:5173";
dotenv.config({ path: ".env" });
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use(express.json());

const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URL, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log("Connected to MongoDB");
      return true;
    } catch (error) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

const initializeSocketHandlers = () => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_room", (roomId) => {
      if (!roomId) {
        socket.emit("error", { message: "Room ID is required" });
        return;
      }

      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on("send_message", async (data) => {
      try {
        if (!data.room || !data.sender || !data.content) {
          socket.emit("error", { message: "Missing required message fields" });
          return;
        }

        const savedMessage = await Message.create({
          room: data.room,
          sender: data.sender,
          content: data.content,
          timestamp: new Date(),
        });

        // const savedMessage = await message.save();

        io.to(data.room).emit("receive_message", {
          _id: savedMessage._id,
          room: savedMessage.room,
          sender: savedMessage.sender,
          content: savedMessage.content,
          timestamp: savedMessage.timestamp,
        });
      } catch (error) {
        console.error("Error saving message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });
};
app.get("/messages/:room", async (req, res) => {
  try {
    if (!req.params.room) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    const messages = await Message.find({ room: req.params.room })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Error fetching messages" });
  }
});

// Error Handlers
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    initializeSocketHandlers();

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
