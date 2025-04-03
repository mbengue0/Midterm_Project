// backend/index.js
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const cors = require("cors");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
const JWT_SECRET = "mySuperSecretKey123"; // In production, use environment variables

// MySQL Connection Pool
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Mycourse123#",
  database: "task_manager",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(express.json());
app.use(cors());

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token." });
  }
};

// User Registration Endpoint
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Check if user already exists
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "User already exists." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store user in database
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    // Return success response (exclude password)
    res.status(201).json({ 
      message: "User registered successfully", 
      user: { id: result.insertId, name, email } 
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// User Login Endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    // Check if user exists
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = users[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return success response with token
    res.json({ 
      message: "Login successful", 
      token, 
      user: { id: user.id, name: user.name, email: user.email } 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// Create a new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, description, due_date, status } = req.body;
  const user_id = req.user.id;
  
  // Validate required fields
  if (!title) {
    return res.status(400).json({ message: "Task title is required." });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO tasks (user_id, title, description, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [user_id, title, description, due_date || null, status || 'pending']
    );
    
    res.status(201).json({ 
      message: "Task created successfully",
      task_id: result.insertId
    });
  } catch (error) {
    console.error("Task creation error:", error);
    res.status(500).json({ message: "Server error when creating task." });
  }
});

// Get all tasks for the authenticated user
app.get('/api/tasks', authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  
  try {
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date ASC',
      [user_id]
    );
    
    res.json({ tasks });
  } catch (error) {
    console.error("Task retrieval error:", error);
    res.status(500).json({ message: "Server error when retrieving tasks." });
  }
});

// Get single task by ID
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  try {
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );
    
    if (tasks.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }
    
    res.json({ task: tasks[0] });
  } catch (error) {
    console.error("Task retrieval error:", error);
    res.status(500).json({ message: "Server error when retrieving task." });
  }
});

// Update a task
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;
  const { title, description, due_date, status } = req.body;

  try {
    // Check if task exists and belongs to the user
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );
    
    if (tasks.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }
    
    // Update the task
    await pool.execute(
      'UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ? WHERE id = ?',
      [title, description, due_date, status, taskId]
    );
    
    res.json({ message: "Task updated successfully" });
  } catch (error) {
    console.error("Task update error:", error);
    res.status(500).json({ message: "Server error when updating task." });
  }
});

// Delete a task
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  try {
    // Check if task exists and belongs to the user
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );
    
    if (tasks.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }
    
    // Delete the task
    await pool.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Task deletion error:", error);
    res.status(500).json({ message: "Server error when deleting task." });
  }
});

// User profile endpoint
app.get('/api/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    
    res.json({ user: users[0] });
  } catch (error) {
    console.error("Profile retrieval error:", error);
    res.status(500).json({ message: "Server error when retrieving profile." });
  }
});

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { name, email } = req.body;
  
  try {
    // Optional: Check if email is already taken by another user
    if (email) {
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ message: "Email already in use." });
      }
    }
    
    // Update user profile
    await pool.execute(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, userId]
    );
    
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error when updating profile." });
  }
});

// Change password
app.put('/api/change-password', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new passwords are required." });
  }
  
  try {
    // Get user with password
    const [users] = await pool.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }
    
    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "Server error when changing password." });
  }
});

// Database health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Try to execute a simple query
    await pool.execute('SELECT 1');
    res.json({ status: 'ok', message: 'Database connection is working' });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown to close MySQL connections
process.on('SIGINT', async () => {
  try {
    await pool.end();
    console.log('MySQL connections closed');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MySQL connections:', err);
    process.exit(1);
  }
});