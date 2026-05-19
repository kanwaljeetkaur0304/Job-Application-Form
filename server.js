const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const multer = require('multer');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Create applications storage directory
const applicationsDir = path.join(__dirname, 'applications');
if (!fs.existsSync(applicationsDir)) {
    fs.mkdirSync(applicationsDir, { recursive: true });
}

// Create uploads directory for resumes
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'resume-' + uniqueSuffix + ext);
    }
});

// Multer file filter - only PDF, DOC, DOCX
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to format date
function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Helper function to get province name
function getProvinceName(code) {
    const provinces = {
        'ab': 'Alberta',
        'bc': 'British Columbia',
        'mb': 'Manitoba',
        'nb': 'New Brunswick',
        'nl': 'Newfoundland and Labrador',
        'ns': 'Nova Scotia',
        'nt': 'Northwest Territories',
        'nu': 'Nunavut',
        'on': 'Ontario',
        'pe': 'Prince Edward Island',
        'qc': 'Quebec',
        'sk': 'Saskatchewan',
        'yt': 'Yukon'
    };
    return provinces[code] || code;
}

// Helper function to get status name
function getStatusName(status) {
    const statuses = {
        'citizen': 'Canadian Citizen',
        'permanent-resident': 'Permanent Resident',
        'work-permit': 'Work Permit Holder',
        'student': 'International Student',
        'other': 'Other'
    };
    return statuses[status] || status;
}

// Helper function to get education field name
function getEducationFieldName(field) {
    const fields = {
        'it': 'Information Technology',
        'engineering': 'Engineering',
        'healthcare': 'Healthcare',
        'business': 'Business Administration',
        'finance': 'Finance/Accounting',
        'marketing': 'Marketing',
        'education': 'Education',
        'law': 'Law',
        'arts': 'Arts/Humanities',
        'trades': 'Trades/Technical',
        'agriculture': 'Agriculture',
        'other': 'Other'
    };
    return fields[field] || field;
}

// API endpoint for uploading resume
app.post('/api/upload-resume', upload.single('resume'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        res.json({
            success: true,
            filename: req.file.filename,
            originalName: req.file.originalname
        });
    } catch (error) {
        console.error('Error uploading resume:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading resume: ' + error.message
        });
    }
});

// API endpoint for creating Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            canadaStatus,
            province,
            driverLicense,
            educationField,
            resumeFilename
        } = req.body;

        // Validate required fields
        if (!name || !phone || !email || !canadaStatus || !province || !driverLicense || !educationField || !resumeFilename) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'cad',
                        product_data: {
                            name: 'Job Application Fee',
                            description: 'Job application submission fee'
                        },
                        unit_amount: 2500 // $25.00 in cents
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/`,
            customer_email: email,
            metadata: {
                name,
                phone,
                email,
                canadaStatus,
                province,
                driverLicense,
                educationField,
                resumeFilename
            }
        });

        res.json({
            success: true,
            sessionId: session.id,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
        });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating payment session: ' + error.message
        });
    }
});

// API endpoint for handling successful payment
app.post('/api/process-payment-success', async (req, res) => {
    try {
        const { sessionId } = req.body;

        // Retrieve session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Payment not completed'
            });
        }

        const {
            name,
            phone,
            email,
            canadaStatus,
            province,
            driverLicense,
            educationField,
            resumeFilename
        } = session.metadata;

        // Create application data
        const applicationData = {
            id: `APP-${Date.now()}`,
            name,
            phone,
            email,
            canadaStatus: getStatusName(canadaStatus),
            province: getProvinceName(province),
            driverLicense: driverLicense === 'yes' ? 'Yes' : 'No',
            educationField: getEducationFieldName(educationField),
            resumeFilename,
            paymentId: session.id,
            paymentStatus: 'Completed',
            paymentAmount: '$25.00',
            submittedAt: formatDate(new Date()),
            timestamp: new Date().toISOString()
        };

        // Save to JSON file
        const filename = path.join(applicationsDir, `${applicationData.id}.json`);
        fs.writeFileSync(filename, JSON.stringify(applicationData, null, 2));

        // Prepare resume attachment for email
        const resumePath = path.join(uploadsDir, resumeFilename);
        let attachments = [];
        if (fs.existsSync(resumePath)) {
            attachments.push({
                filename: resumeFilename,
                path: resumePath
            });
        }

        // Send confirmation email to applicant
        const applicantEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                    .content { background: white; padding: 20px; border-radius: 0 0 10px 10px; }
                    .details { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .details p { margin: 8px 0; }
                    .label { font-weight: bold; color: #667eea; }
                    .payment-badge { background: #28a745; color: white; padding: 10px 15px; border-radius: 5px; display: inline-block; margin: 10px 0; }
                    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ Application Received!</h1>
                    </div>
                    <div class="content">
                        <p>Hello ${name},</p>
                        <p>Thank you for submitting your job application!</p>
                        
                        <div class="payment-badge">✓ Payment Received: $25.00</div>

                        <div class="details">
                            <p><span class="label">Application ID:</span> ${applicationData.id}</p>
                            <p><span class="label">Transaction ID:</span> ${session.id}</p>
                            <p><span class="label">Submitted:</span> ${applicationData.submittedAt}</p>
                        </div>

                        <h3>Your Application Details:</h3>
                        <div class="details">
                            <p><span class="label">Name:</span> ${name}</p>
                            <p><span class="label">Phone:</span> ${phone}</p>
                            <p><span class="label">Email:</span> ${email}</p>
                            <p><span class="label">Status in Canada:</span> ${applicationData.canadaStatus}</p>
                            <p><span class="label">Province:</span> ${applicationData.province}</p>
                            <p><span class="label">Driver's License:</span> ${applicationData.driverLicense}</p>
                            <p><span class="label">Educational Field:</span> ${applicationData.educationField}</p>
                            <p><span class="label">Application Fee:</span> $25.00 (Paid)</p>
                        </div>

                        <p>Our recruitment team will review your application and contact you within 3-5 business days if you meet the job requirements.</p>
                        
                        <p><strong>Please keep this email for your records.</strong></p>
                        
                        <p>If you have any questions, feel free to reply to this email.</p>
                        
                        <p>Best regards,<br>The Recruitment Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Job Application Form. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Application Received - Payment Confirmed',
            html: applicantEmailHtml
        });

        // Send notification email to admin with resume attached
        const adminEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px; }
                    .header { background: #333; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                    .content { background: white; padding: 20px; border-radius: 0 0 10px 10px; }
                    .details { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .payment-status { background: #28a745; color: white; padding: 10px; border-radius: 5px; margin: 10px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th { background: #667eea; color: white; padding: 10px; text-align: left; }
                    td { padding: 10px; border-bottom: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ New Paid Job Application</h1>
                    </div>
                    <div class="content">
                        <p>A new application with payment received has been submitted:</p>
                        
                        <div class="payment-status">✓ PAYMENT RECEIVED: $25.00</div>

                        <table>
                            <tr>
                                <th>Field</th>
                                <th>Information</th>
                            </tr>
                            <tr>
                                <td><span class="label">Application ID:</span></td>
                                <td>${applicationData.id}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Transaction ID:</span></td>
                                <td>${session.id}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Submitted:</span></td>
                                <td>${applicationData.submittedAt}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Name:</span></td>
                                <td>${name}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Phone:</span></td>
                                <td>${phone}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Email:</span></td>
                                <td>${email}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Status in Canada:</span></td>
                                <td>${applicationData.canadaStatus}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Province:</span></td>
                                <td>${applicationData.province}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Driver's License:</span></td>
                                <td>${applicationData.driverLicense}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Educational Field:</span></td>
                                <td>${applicationData.educationField}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Fee Paid:</span></td>
                                <td>$25.00 ✓</td>
                            </tr>
                        </table>

                        <p><strong>Action Required:</strong> Review this application and respond to the applicant.</p>
                        <p><strong>Resume:</strong> Attached to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `✓ New Paid Application: ${name}`,
            html: adminEmailHtml,
            attachments: attachments
        });

        res.json({
            success: true,
            message: 'Application submitted successfully',
            applicationId: applicationData.id
        });

    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing payment: ' + error.message
        });
    }
});

// API endpoint for form submission (kept for backward compatibility)
app.post('/api/submit-application', upload.single('resume'), async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            canadaStatus,
            province,
            driverLicense,
            educationField,
            submittedAt
        } = req.body;

        // Validate required fields
        if (!name || !phone || !email || !canadaStatus || !province || !driverLicense || !educationField) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        const resumeFilename = req.file ? req.file.filename : null;

        // Create application data
        const applicationData = {
            id: `APP-${Date.now()}`,
            name,
            phone,
            email,
            canadaStatus: getStatusName(canadaStatus),
            province: getProvinceName(province),
            driverLicense: driverLicense === 'yes' ? 'Yes' : 'No',
            educationField: getEducationFieldName(educationField),
            resumeFilename,
            submittedAt: formatDate(submittedAt),
            timestamp: new Date().toISOString()
        };

        // Save to JSON file
        const filename = path.join(applicationsDir, `${applicationData.id}.json`);
        fs.writeFileSync(filename, JSON.stringify(applicationData, null, 2));

        // Prepare resume attachment for email
        let attachments = [];
        if (req.file) {
            attachments.push({
                filename: req.file.originalname,
                path: req.file.path
            });
        }

        // Send confirmation email to applicant
        const applicantEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                    .content { background: white; padding: 20px; border-radius: 0 0 10px 10px; }
                    .details { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .details p { margin: 8px 0; }
                    .label { font-weight: bold; color: #667eea; }
                    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Application Received!</h1>
                    </div>
                    <div class="content">
                        <p>Hello ${name},</p>
                        <p>Thank you for submitting your job application! We have successfully received your submission and application fee of <strong>$25.00</strong>.</p>
                        
                        <div class="details">
                            <p><span class="label">Application ID:</span> ${applicationData.id}</p>
                            <p><span class="label">Submitted:</span> ${applicationData.submittedAt}</p>
                        </div>

                        <h3>Your Application Details:</h3>
                        <div class="details">
                            <p><span class="label">Name:</span> ${name}</p>
                            <p><span class="label">Phone:</span> ${phone}</p>
                            <p><span class="label">Email:</span> ${email}</p>
                            <p><span class="label">Status in Canada:</span> ${applicationData.canadaStatus}</p>
                            <p><span class="label">Province:</span> ${applicationData.province}</p>
                            <p><span class="label">Driver's License:</span> ${applicationData.driverLicense}</p>
                            <p><span class="label">Educational Field:</span> ${applicationData.educationField}</p>
                        </div>

                        <p>Our recruitment team will review your application and contact you within 3-5 business days if you meet the job requirements.</p>
                        
                        <p><strong>Please keep this email for your records.</strong></p>
                        
                        <p>If you have any questions, feel free to reply to this email.</p>
                        
                        <p>Best regards,<br>The Recruitment Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Job Application Form. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Application Received - Confirmation',
            html: applicantEmailHtml
        });

        // Send notification email to admin with resume attached
        const adminEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px; }
                    .header { background: #333; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                    .content { background: white; padding: 20px; border-radius: 0 0 10px 10px; }
                    .details { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .details p { margin: 8px 0; }
                    .label { font-weight: bold; color: #333; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th { background: #667eea; color: white; padding: 10px; text-align: left; }
                    td { padding: 10px; border-bottom: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>New Job Application Received</h1>
                    </div>
                    <div class="content">
                        <p>A new application has been submitted:</p>
                        
                        <table>
                            <tr>
                                <th>Field</th>
                                <th>Information</th>
                            </tr>
                            <tr>
                                <td><span class="label">Application ID:</span></td>
                                <td>${applicationData.id}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Submitted:</span></td>
                                <td>${applicationData.submittedAt}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Name:</span></td>
                                <td>${name}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Phone:</span></td>
                                <td>${phone}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Email:</span></td>
                                <td>${email}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Status in Canada:</span></td>
                                <td>${applicationData.canadaStatus}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Province:</span></td>
                                <td>${applicationData.province}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Driver's License:</span></td>
                                <td>${applicationData.driverLicense}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Educational Field:</span></td>
                                <td>${applicationData.educationField}</td>
                            </tr>
                            <tr>
                                <td><span class="label">Fee Paid:</span></td>
                                <td>$25.00</td>
                            </tr>
                        </table>

                        <p><strong>Action Required:</strong> Review this application and respond to the applicant.</p>
                        <p><strong>Resume:</strong> Attached to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `New Job Application: ${name}`,
            html: adminEmailHtml,
            attachments: attachments
        });

        res.json({
            success: true,
            message: 'Application submitted successfully',
            applicationId: applicationData.id
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// API endpoint to get all applications (for admin dashboard - optional)
app.get('/api/applications', (req, res) => {
    try {
        const files = fs.readdirSync(applicationsDir);
        const applications = files.map(file => {
            const data = fs.readFileSync(path.join(applicationsDir, file), 'utf8');
            return JSON.parse(data);
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            total: applications.length,
            applications: applications
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving applications'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Get Stripe config endpoint
app.get('/api/stripe-config', (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// Serve the form at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler for unsupported routes
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Route not found: ' + req.method + ' ' + req.path 
    });
});

// Error handler for server errors
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Server error: ' + err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Job Application Server running on http://localhost:${PORT}`);
    console.log(`📧 Email configured: ${process.env.SMTP_USER}`);
    console.log(`👤 Admin notifications will be sent to: ${process.env.ADMIN_EMAIL}`);
    console.log(`\n📁 Applications saved to: ${applicationsDir}`);
    console.log(`📄 Resumes saved to: ${uploadsDir}\n`);
});
