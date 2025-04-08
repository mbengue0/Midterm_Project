# Task Manager Application

## Overview
The Task Manager Application is a full-stack web application that allows users to manage their tasks. Users can register, log in, create tasks, view all their tasks, retrieve a specific task by ID, update tasks, and delete tasks. The application ensures that users can only access their own tasks through JWT-based authentication.

This project was developed by Mouhamadou Mbengue to demonstrate proficiency in full-stack development, including building a RESTful API, integrating a frontend with a backend, and managing a MySQL database.

## Features
- **User Authentication**:
  - Register a new user with a username and password.
  - Log in to access the dashboard.
  - JWT-based authentication to secure API endpoints.
- **Task Management**:
  - Create a new task with fields like title, description, due date, status, priority, and category.
  - View all tasks for the authenticated user.
  - Retrieve a specific task by its ID.
  - Update an existing task.
  - Delete a task.
- **Security**:
  - Passwords are hashed using `bcryptjs`.
  - API endpoints are protected with JWT authentication.
- **Responsive Design**:
  - The frontend is styled with CSS to provide a clean and user-friendly interface.
  - Styles for the dashboard are separated into `styles.css` for better organization.

## Technologies Used
- **Backend**:
  - Node.js
  - Express.js
  - MySQL (Database)
  - `mysql2/promise` (MySQL driver for Node.js)
  - `bcryptjs` (Password hashing)
  - `jsonwebtoken` (JWT authentication)
  - `cors` (Enable CORS for frontend-backend communication)
- **Frontend**:
  - HTML
  - CSS (Separated into `styles.css` for modularity)
  - JavaScript (Vanilla JS for API calls and DOM manipulation)
- **Database**:
  - MySQL
- **Tools**:
  - Git & GitHub (Version control)
  - `http-server` (To serve the frontend)
  - Postman (For testing API endpoints)

## Project Structure
task-manager/
├── index.js          # Backend server (Express.js)
├── login.html        # Login and registration page
├── Dashboard.html    # Dashboard page for managing tasks
├── styles.css        # CSS styles for Dashboard.html
└── README.md         # Project documentation


## Setup Instructions
Follow these steps to set up and run the project locally.

### Prerequisites
- **Node.js**: Install Node.js from [nodejs.org](https://nodejs.org/).
- **MySQL**: Install MySQL (e.g., via XAMPP, Homebrew, or direct installation).
- **Git**: Install Git to clone the repository.

### 1. Clone the Repository
Clone the project from GitHub:
```bash
git clone https://github.com/[Your GitHub Username]/task-manager.git
cd task-manager
```

#### 2. Set Up the Database
1. Start your MySQL server (e.g., via XAMPP or `sudo systemctl start mysql`).
2. Log in to MySQL:
```bash
   mysql -u root -p

CREATE DATABASE task_manager;
USE task_manager;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    category VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```
### 3. Update Backend Configuration
- Open `index.js` and update the MySQL user and password to match your local MySQL setup:
```bash javascript
  const pool = mysql.createPool({
      host: 'localhost',
      user: 'task_user',
      password: 'TaskPassword123#', // Replace with your MySQL password
      database: 'task_manager'
  });
```
### 4. Run the Application
- Install dependencies: `npm install` or `yarn install`.
- Start the server: `node index.js` or `yarn start`.
- Open your web browser and navigate to `http://localhost:5500` to access the task
manager application.

