const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
const port = 3000;

const users = []; // In-memory array to store user data

app.use(express.json());
app.use(cors());



// Function to generate a simple random token
function generateToken() {
    return crypto.randomUUID().replace(/-/g, '');
}

// Function to handle user registration
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
        return res.status(400).json({ message: "All fields are required." });
    }

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
        return res.status(400).json({ message: "User already exists." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store user data
    const newUser = { name, email, password: hashedPassword };
    users.push(newUser);

    // Return success response
    const { password: _, ...userDetails } = newUser; // Exclude password from response
    res.status(201).json({ message: "User registered successfully", user: userDetails });
});

// Function to handle user login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ message: "All fields are required." });
    }

    // Check if user exists
    const user = users.find(user => user.email === email);
    if (!user) {
        return res.status(401).json({ message: "User does not exist." });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ message: "Password does not exist." });
    }

    // Return success response with token
    res.json({ message: "Login successful", token: generateToken() });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});