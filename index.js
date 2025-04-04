// backend/index.js
const express = require("express");
const bcrypt = require("bcryptjs");
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

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "User already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    res.status(201).json({ 
      message: "User registered successfully", 
      user: { id: result.insertId, name, email } 
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: `Server error during registration: ${error.message}` });
  }
});

// User Login Endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ 
      message: "Login successful", 
      token, 
      user: { id: user.id, name: user.name, email: user.email } 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: `Server error during login: ${error.message}` });
  }
});

// Create a new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, description, due_date, status } = req.body;
  const user_id = req.user.id;
  
  if (!title) {
    return res.status(400).json({ message: "Task title is required." });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO tasks (user_id, title, description, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [user_id, title, description || null, due_date || null, status || 'pending']
    );
    
    const [newTask] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ 
      message: "Task created successfully",
      task: newTask[0]
    });
  } catch (error) {
    console.error("Task creation error:", error);
    res.status(500).json({ message: `Server error when creating task: ${error.message}` });
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
    res.status(500).json({ message: `Server error when retrieving tasks: ${error.message}` });
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
    res.status(500).json({ message: `Server error when retrieving task: ${error.message}` });
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

    // Validate status if provided
    if (status && !['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ message: "Invalid status value. Must be 'pending', 'in_progress', or 'completed'." });
    }

    // Update only the fields that are provided
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (due_date !== undefined) updates.due_date = due_date;
    if (status !== undefined) updates.status = status;

    const [result] = await pool.execute(
      'UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ? WHERE id = ?',
      [
        updates.title ?? tasks[0].title,
        updates.description ?? tasks[0].description,
        updates.due_date ?? tasks[0].due_date,
        updates.status ?? tasks[0].status,
        taskId
      ]
    );

    // Fetch the updated task
    const [updatedTask] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ?',
      [taskId]
    );

    res.json({ message: "Task updated successfully", task: updatedTask[0] });
  } catch (error) {
    console.error("Task update error:", error);
    res.status(500).json({ message: `Server error when updating task: ${error.message}` });
  }
});

// Delete a task
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
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
    
    await pool.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Task deletion error:", error);
    res.status(500).json({ message: `Server error when deleting task: ${error.message}` });
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
    res.status(500).json({ message: `Server error when retrieving profile: ${error.message}` });
  }
});

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { name, email } = req.body;
  
  try {
    if (email) {
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ message: "Email already in use." });
      }
    }
    
    await pool.execute(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, userId]
    );
    
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: `Server error when updating profile: ${error.message}` });
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
    const [users] = await pool.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: `Server error when changing password: ${error.message}` });
  }
});

// Database health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({ status: 'ok', message: 'Database connection is working' });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(500).json({ status: 'error', message: `Database connection failed: ${error.message}` });
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