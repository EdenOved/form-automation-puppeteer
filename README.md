# 🧾 Form Automation with Puppeteer

A Node.js script that automates the process of filling and submitting web forms using **Puppeteer**.  
Includes real-time validation, dynamic input, dropdown selection, screenshot capture, and success-page verification.

## ✨ Features

- Auto-fills form fields (name, email, phone, company)
- Validates user input before submission
- Selects employee count from dropdown
- Captures screenshot before and after submission
- Detects and verifies successful submission via "Thank You" page content or URL
- Automatically creates a `/screenshots` directory for output

## 🚀 Tech Stack

- Node.js
- Puppeteer
- JavaScript (ES6+)

## 📦 Setup

Make sure you have Node.js v16+ installed.

```bash
npm install puppeteer


## ▶️ Run the script
```bash
node FormAutomation.js
