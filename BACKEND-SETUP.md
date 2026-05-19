# Node.js Backend Setup Guide

Your job application form is now connected to a Node.js backend server that receives form submissions and sends emails.

## What the Backend Does ✅

- ✅ Receives form submissions from the website
- ✅ Validates all data
- ✅ Saves applications as JSON files
- ✅ Sends confirmation email to applicants
- ✅ Sends admin notification emails to you
- ✅ Stores all application data locally

## Installation & Setup

### Step 1: Install Node.js

Download and install from: https://nodejs.org (Get the LTS version)

Verify installation:
```bash
node --version
npm --version
```

### Step 2: Install Dependencies

Navigate to your project folder in terminal and run:

```bash
cd "/Users/kanwaljeetkaur/Websites/Job Application Form"
npm install
```

This installs: express, cors, nodemailer, body-parser, dotenv

### Step 3: Configure Email Settings

1. **Create `.env` file**
   - Copy the contents of `.env.example`
   - Create new file called `.env`
   - Paste the contents and fill in your details

2. **For Gmail (Recommended):**

   a) Go to: https://myaccount.google.com/
   
   b) Click "Security" in left menu
   
   c) Turn on "2-Step Verification"
   
   d) Search for "App passwords"
   
   e) Create an "App password" for "Mail" and "Windows Computer"
   
   f) Copy the 16-character password

3. **Update `.env` file:**

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx
   
   ADMIN_EMAIL=your-email@gmail.com
   
   PORT=3000
   NODE_ENV=development
   ```

### Step 4: Run the Server

```bash
npm start
```

You should see:
```
🚀 Job Application Server running on http://localhost:3000
📧 Email configured: your-email@gmail.com
👤 Admin notifications will be sent to: your-email@gmail.com

📁 Applications saved to: /Users/.../applications
```

### Step 5: Test the Form

1. Open browser: http://localhost:3000
2. Fill out the form completely
3. Submit the form
4. Check your email for confirmation

## File Structure

```
Job Application Form/
├── index.html           # Frontend form
├── styles.css           # Form styling
├── script.js            # Form validation
├── server.js            # Backend server (NEW)
├── package.json         # Node.js dependencies (NEW)
├── .env.example         # Email configuration template (NEW)
├── .env                 # Your actual email settings (CREATE THIS)
├── applications/        # Applications saved here (AUTO-CREATED)
│   ├── APP-1234567.json
│   ├── APP-1234568.json
│   └── ...
└── README.md
```

## Common Issues & Solutions

### Issue: "npm: command not found"
**Solution:** Node.js not installed. Download from https://nodejs.org

### Issue: "Cannot find module 'express'"
**Solution:** Run `npm install` in the project folder

### Issue: "Error: Invalid login credentials"
**Solution:** 
- Check email is correct in `.env`
- Use 16-character app password (not regular Gmail password)
- Check SMTP_USER matches SMTP_PASS account

### Issue: "Port 3000 already in use"
**Solution:** Either:
- Kill the process using port 3000
- Or change PORT in `.env` to 3001, 3002, etc.

### Issue: Emails not sending
**Solution:**
1. Check `.env` file has correct values
2. Check Gmail 2-Step Verification is ON
3. Use 16-character App Password (not Gmail password)
4. Check email settings in server.js aren't overridden

## Deployment Options

When ready to go live (no longer running on localhost):

### Option A: Heroku (Free tier available)
1. Create account: https://heroku.com
2. Push code to Heroku
3. Set environment variables
4. Site will be live at: https://your-app.herokuapp.com

### Option B: Railway (Simple, $5/month)
1. Create account: https://railway.app
2. Connect GitHub repository
3. Deploy automatically
4. Get live URL

### Option C: Your own VPS
1. Rent VPS from DigitalOcean, Linode, AWS
2. Install Node.js on server
3. Run `npm start` with process manager (PM2)
4. Use Nginx as reverse proxy

### Option D: Docker Container
Create a Dockerfile and deploy to Docker Hub or AWS

## API Endpoints

### Submit Application
```
POST /api/submit-application
Content-Type: application/json

{
    "name": "John Doe",
    "email": "john@example.com",
    "canadaStatus": "permanent-resident",
    "province": "on",
    "driverLicense": "yes",
    "educationField": "it",
    "cardName": "John Doe",
    "submittedAt": "2024-05-19T00:11:47.596Z"
}
```

Response:
```json
{
    "success": true,
    "message": "Application submitted successfully",
    "applicationId": "APP-1234567890"
}
```

### Get All Applications (Admin)
```
GET /api/applications
```

Returns JSON with all submitted applications.

### Health Check
```
GET /api/health
```

Returns `{"status": "Server is running"}`

## Data Storage

### Application Files
Each application is saved as JSON in `applications/` folder:
- Filename: `APP-{timestamp}.json`
- Contains: Name, email, status, province, driver license, education field, submission date

### Email Notifications
- **Applicant receives:** Confirmation with application ID
- **Admin receives:** New application notification with all details

You can change email templates in `server.js` (around line 140-200)

## Stopping the Server

In terminal: Press `Ctrl + C`

## Restarting the Server

```bash
npm start
```

## Optional: Use Nodemon for Development

Automatically restarts server when you change code:

```bash
npm install --save-dev nodemon
npm run dev
```

---

## Next Steps

1. ✅ Set up email in `.env`
2. ✅ Run `npm install`
3. ✅ Start server with `npm start`
4. ✅ Test form at http://localhost:3000
5. ⏳ Later: Add payment processing with Stripe/Square/PayPal
6. ⏳ Later: Deploy to production server

## Need Help?

- Check server output in terminal for error messages
- Check email `.env` configuration
- Review email logs in Gmail
- Check `applications/` folder for saved data

Good luck! 🚀
