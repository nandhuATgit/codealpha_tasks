require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const postRoutes = require("./routes/posts");
const commentRoutes = require("./routes/comments");

const app = express();
const PORT = process.env.PORT;
const NODE_ENV = process.env.NODE_ENV;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);

app.get("/api/test", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoStatus =
    mongoState === 1
      ? "connected"
      : mongoState === 2
        ? "connecting"
        : mongoState === 3
          ? "disconnecting"
          : "disconnected";

  res.json({
    success: true,
    message: "API is working",
    mongodb: mongoStatus,
    database: mongoose.connection.name || null,
  });
});

async function start() {
  if (!PORT || !MONGODB_URI || !JWT_SECRET) {
    console.error(
      "Missing required environment variables. Check MONGODB_URI, JWT_SECRET, and PORT in .env"
    );
    process.exit(1);
  }

  if (
    MONGODB_URI.includes("127.0.0.1") ||
    MONGODB_URI.includes("localhost")
  ) {
    console.error(
      "Local MongoDB is not allowed. Set MONGODB_URI to your MongoDB Atlas connection string."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: "socialmedia_db",
      serverSelectionTimeoutMS: 15000,
    });
    console.log("MongoDB connected successfully");
    console.log("Database: socialmedia_db");
    if (NODE_ENV) {
      console.log(`Environment: ${NODE_ENV}`);
    }
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
