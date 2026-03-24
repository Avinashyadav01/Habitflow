const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const publicPath = path.resolve(__dirname, ".");

// App root info
app.get("/", (req, res) => {
  res.send("HabitTracker API is running");
});

app.use(express.static(publicPath));

let users = [];
let habitsByUser = {};
let trackingByUser = {};

// Signup
app.post("/signup", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).send("Missing fields");
  const existing = users.find(u => u.email === email);
  if (existing) return res.status(400).send("User already exists");
  users.push({ name, email, password });
  habitsByUser[email] = habitsByUser[email] || [];
  trackingByUser[email] = trackingByUser[email] || {};
  res.json({ message: "User added" });
});

// Login
app.post("/login", (req, res) => {
  const user = users.find(
    u => u.email === req.body.email && u.password === req.body.password
  );

  if (user) {
    res.json({ token: "12345", user: { name: user.name, email: user.email } });
  } else {
    res.status(400).send("Invalid credentials");
  }
});

// Get habits
app.get("/habits", (req, res) => {
  const email = req.query.userEmail || req.headers['x-user-email'];
  const habits = email ? (habitsByUser[email] || []) : [];
  const tracking = email ? (trackingByUser[email] || {}) : {};
  res.json({ habits, tracking });
});

// Add habit
app.post("/add-habit", (req, res) => {
  const { userEmail, name, emoji, color, id } = req.body;
  if (!userEmail) return res.status(400).send('Missing userEmail');
  const habit = { id: id || Date.now().toString(), name, emoji, color };
  habitsByUser[userEmail] = habitsByUser[userEmail] || [];
  habitsByUser[userEmail].push(habit);
  res.json(habit);
});

// Toggle habit
app.post("/toggle-habit", (req, res) => {
  const { date, habitId, userEmail } = req.body;
  if (!userEmail) return res.status(400).send('Missing userEmail');
  trackingByUser[userEmail] = trackingByUser[userEmail] || {};
  const userTracking = trackingByUser[userEmail];
  userTracking[date] = userTracking[date] || {};
  userTracking[date][habitId] = !userTracking[date][habitId];
  res.json({ success: true });
});

// Frontend routing fallback (Render SPA support)
app.use((req, res, next) => {
  const skipPaths = ['/signup', '/login', '/habits', '/add-habit', '/toggle-habit'];
  if (req.method === 'GET' && !skipPaths.some(p => req.path.startsWith(p))) {
    return res.sendFile(path.join(publicPath, 'index.html'));
  }
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));