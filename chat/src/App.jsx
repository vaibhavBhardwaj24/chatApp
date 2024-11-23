import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
const SOCKET_SERVER = "http://localhost:3000";

const App = () => {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState(null);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!username.trim() || !room.trim()) {
      setError("Username and Room ID are required");
      return;
    }
    setIsJoined(true);
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
            Join Chat Room
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label
                htmlFor="room"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Room ID
              </label>
              <input
                id="room"
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter room ID"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <ChatRoom username={username} roomId={room} />;
};

const ChatRoom = ({ username, roomId }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef();
  const messagesEndRef = useRef();

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
      socketRef.current.emit("join_room", roomId);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setError("Failed to connect to chat server");
      setIsConnected(false);
    });

    socketRef.current.on("receive_message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socketRef.current.on("error", (error) => {
      setError(error.message);
    });

    fetchMessages();

    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${SOCKET_SERVER}/messages/${roomId}`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      const data = await response.json();
      setMessages(data.reverse());
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to load messages");
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      room: roomId,
      sender: username,
      content: messageInput.trim(),
    });

    setMessageInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Room: {roomId}</h2>
            <p className="text-sm opacity-90">Joined as: {username}</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="text-sm bg-green-500 px-2 py-1 rounded">
                Connected
              </span>
            ) : (
              <span className="text-sm bg-red-500 px-2 py-1 rounded">
                Disconnected
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 text-red-700 text-sm">{error}</div>
        )}

        <div className="h-[calc(100vh-280px)] overflow-y-auto p-4 bg-gray-50">
          {messages.map((message) => (
            <div
              key={message._id}
              className={`mb-4 max-w-[70%] ${
                message.sender === username ? "ml-auto" : "mr-auto"
              }`}
            >
              <div
                className={`rounded-lg p-3 ${
                  message.sender === username
                    ? "bg-blue-600 text-white"
                    : "bg-white shadow-md"
                }`}
              >
                <div className="font-semibold text-sm mb-1">
                  {message.sender}
                </div>
                <div className="break-words">{message.content}</div>
                <div
                  className={`text-xs mt-1 ${
                    message.sender === username
                      ? "text-blue-100"
                      : "text-gray-500"
                  }`}
                >
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="p-4 bg-white border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!isConnected}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;
