// server/socket.js
const { Server } = require("socket.io");
const { redis } = require("../utils/redis");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Join user-specific and role-specific rooms
    socket.on("join", ({ userId, role }) => {
      if (userId) socket.join(userId);
      if (role) socket.join(role);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Subscribe to Redis channel
  redis.subscribe("notifications", (message) => {
    try {
      const data = JSON.parse(message);
      if (io && data.role) {
        io.to(data.role).emit("notification", data); // emit to role-based room
      }
    } catch (err) {
      console.error("Redis parse error:", err);
    }
  });
}

module.exports = { initSocket, io };
