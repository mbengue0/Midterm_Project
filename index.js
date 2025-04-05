const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Mycourse123#', // Replace with your MySQL password
    database: 'task_manager'
});

const JWT_SECRET = 'my_secret_code'; // Replace with a secure secret

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
}

// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    try {
        const [existingUsers] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: "Username already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: `Server error during registration: ${error.message}` });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, username: user.username } });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: `Server error during login: ${error.message}` });
    }
});

// Create a new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { title, description, due_date, status, priority, category } = req.body;
    const user_id = req.user.id;

    if (!title) {
        return res.status(400).json({ message: "Task title is required." });
    }

    // Validate status
    if (status && !['pending', 'in_progress', 'completed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value. Must be 'pending', 'in_progress', or 'completed'." });
    }

    // Validate due_date
    let validatedDueDate = null;
    if (due_date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(due_date)) {
            return res.status(400).json({ message: "Invalid due_date format. Use YYYY-MM-DD." });
        }
        const parsedDate = new Date(due_date);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ message: "Invalid due_date. Must be a valid date." });
        }
        validatedDueDate = due_date;
    }

    // Validate priority
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({ message: "Invalid priority value. Must be 'low', 'medium', or 'high'." });
    }

    // Validate category
    if (category && (typeof category !== 'string' || category.length > 50)) {
        return res.status(400).json({ message: "Category must be a string with a maximum length of 50 characters." });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO tasks (user_id, title, description, due_date, status, priority, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user_id, title, description || null, validatedDueDate, status || 'pending', priority || 'medium', category || null]
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
    const userId = req.user.id;

    try {
        const [tasks] = await pool.execute('SELECT * FROM tasks WHERE user_id = ?', [userId]);
        res.json({ tasks });
    } catch (error) {
        console.error("Task retrieval error:", error);
        res.status(500).json({ message: `Server error when retrieving tasks: ${error.message}` });
    }
});

// Update a task
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;
    const { title, description, due_date, status, priority, category } = req.body;

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

        // Validate due_date if provided
        let validatedDueDate = due_date;
        if (due_date !== undefined && due_date !== null) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(due_date)) {
                return res.status(400).json({ message: "Invalid due_date format. Use YYYY-MM-DD." });
            }
            const parsedDate = new Date(due_date);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ message: "Invalid due_date. Must be a valid date." });
            }
            validatedDueDate = due_date;
        }

        // Validate priority if provided
        if (priority && !['low', 'medium', 'high'].includes(priority)) {
            return res.status(400).json({ message: "Invalid priority value. Must be 'low', 'medium', or 'high'." });
        }

        // Validate category if provided
        if (category !== undefined && category !== null && (typeof category !== 'string' || category.length > 50)) {
            return res.status(400).json({ message: "Category must be a string with a maximum length of 50 characters." });
        }

        // Update only the fields that are provided
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (due_date !== undefined) updates.due_date = validatedDueDate;
        if (status !== undefined) updates.status = status;
        if (priority !== undefined) updates.priority = priority;
        if (category !== undefined) updates.category = category;

        const [result] = await pool.execute(
            'UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ?, priority = ?, category = ? WHERE id = ?',
            [
                updates.title ?? tasks[0].title,
                updates.description ?? tasks[0].description,
                updates.due_date ?? tasks[0].due_date,
                updates.status ?? tasks[0].status,
                updates.priority ?? tasks[0].priority,
                updates.category ?? tasks[0].category,
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});