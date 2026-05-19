// Form Validation and Stripe Payment Handling
let stripe;

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('jobApplicationForm');
    
    // Initialize Stripe (will be set from server response)
    fetch('/api/stripe-config')
        .then(res => res.json())
        .then(data => {
            stripe = Stripe(data.publishableKey);
        })
        .catch(error => console.error('Error loading Stripe:', error));
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            submitApplication();
        }
    });

    // Real-time validation
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
    });
});

// Validation Functions
function validateForm() {
    clearAllErrors();
    let isValid = true;

    // Validate name
    const name = document.getElementById('name').value.trim();
    if (!name) {
        showError('name', 'Full name is required');
        isValid = false;
    } else if (name.length < 2) {
        showError('name', 'Name must be at least 2 characters');
        isValid = false;
    }

    // Validate phone
    const phone = document.getElementById('phone').value.trim();
    if (!phone) {
        showError('phone', 'Phone number is required');
        isValid = false;
    } else if (!isValidPhone(phone)) {
        showError('phone', 'Please enter a valid phone number');
        isValid = false;
    }

    // Validate email
    const email = document.getElementById('email').value.trim();
    if (!email) {
        showError('email', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showError('email', 'Please enter a valid email address');
        isValid = false;
    }

    // Validate Canada status
    const canadaStatus = document.getElementById('canadaStatus').value;
    if (!canadaStatus) {
        showError('canadaStatus', 'Please select your status in Canada');
        isValid = false;
    }

    // Validate province
    const province = document.getElementById('province').value;
    if (!province) {
        showError('province', 'Please select your province');
        isValid = false;
    }

    // Validate driver license
    const driverLicense = document.querySelector('input[name="driverLicense"]:checked');
    if (!driverLicense) {
        showError('driverLicense', 'Please select if you have a driver license');
        isValid = false;
    }

    // Validate education field
    const educationField = document.getElementById('educationField').value;
    if (!educationField) {
        showError('educationField', 'Please select your educational field');
        isValid = false;
    }

    // Validate resume file
    const resumeInput = document.getElementById('resume');
    const resumeFile = resumeInput.files[0];
    if (!resumeFile) {
        showError('resume', 'Please upload your resume');
        isValid = false;
    } else {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(resumeFile.type)) {
            showError('resume', 'Only PDF, DOC, and DOCX files are allowed');
            isValid = false;
        } else if (resumeFile.size > maxSize) {
            showError('resume', 'File size must be less than 5MB');
            isValid = false;
        }
    }

    // Validate terms agreement
    const termsAgree = document.getElementById('termsAgree').checked;
    if (!termsAgree) {
        showError('termsAgree', 'You must agree to the terms and conditions');
        isValid = false;
    }

    return isValid;
}

function validateField(field) {
    const fieldName = field.name || field.id;
    let isValid = true;

    switch(fieldName) {
        case 'name':
            const nameValue = field.value.trim();
            if (!nameValue) {
                showError('name', 'Full name is required');
                isValid = false;
            } else if (nameValue.length < 2) {
                showError('name', 'Name must be at least 2 characters');
                isValid = false;
            } else {
                clearError('name');
            }
            break;
        case 'phone':
            const phoneValue = field.value.trim();
            if (!phoneValue) {
                showError('phone', 'Phone number is required');
                isValid = false;
            } else if (!isValidPhone(phoneValue)) {
                showError('phone', 'Please enter a valid phone number');
                isValid = false;
            } else {
                clearError('phone');
            }
            break;
        case 'email':
            const emailValue = field.value.trim();
            if (!emailValue) {
                showError('email', 'Email is required');
                isValid = false;
            } else if (!isValidEmail(emailValue)) {
                showError('email', 'Please enter a valid email address');
                isValid = false;
            } else {
                clearError('email');
            }
            break;
        case 'resume':
            const resumeFile = field.files[0];
            if (!resumeFile) {
                showError('resume', 'Please upload your resume');
                isValid = false;
            } else {
                const allowedTypes = [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ];
                const maxSize = 5 * 1024 * 1024;

                if (!allowedTypes.includes(resumeFile.type)) {
                    showError('resume', 'Only PDF, DOC, and DOCX files are allowed');
                    isValid = false;
                } else if (resumeFile.size > maxSize) {
                    showError('resume', 'File size must be less than 5MB');
                    isValid = false;
                } else {
                    clearError('resume');
                }
            }
            break;
        default:
            if (field.value) {
                clearError(field.id);
            }
    }

    return isValid;
}

// Email validation
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Phone validation (accepts various formats)
function isValidPhone(phone) {
    const re = /^[\d\s\-\(\)\+\.]{10,20}$/;
    return re.test(phone);
}

// Show error message
function showError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    const field = document.getElementById(fieldId);
    if (field && field.type !== 'radio' && field.type !== 'checkbox' && field.type !== 'file') {
        field.style.borderColor = '#e74c3c';
    }
}

// Clear error message
function clearError(fieldId) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
    
    const field = document.getElementById(fieldId);
    if (field && field.type !== 'radio' && field.type !== 'checkbox' && field.type !== 'file') {
        field.style.borderColor = '#ddd';
    }
}

// Clear all errors
function clearAllErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
    });
    
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        if (input.type !== 'radio' && input.type !== 'checkbox' && input.type !== 'file') {
            input.style.borderColor = '#ddd';
        }
    });
}

// Submit application and create Stripe checkout
function submitApplication() {
    const form = document.getElementById('jobApplicationForm');
    const formData = new FormData(form);
    
    const submitButton = document.querySelector('.btn-submit');
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';

    // First, upload the resume file
    fetch('/api/upload-resume', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            // Resume uploaded, now create Stripe checkout session
            const data = {
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                canadaStatus: formData.get('canadaStatus'),
                province: formData.get('province'),
                driverLicense: formData.get('driverLicense'),
                educationField: formData.get('educationField'),
                resumeFilename: result.filename
            };

            return fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        } else {
            throw new Error(result.message || 'Resume upload failed');
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.success && stripe) {
            // Redirect to Stripe Checkout
            stripe.redirectToCheckout({ sessionId: result.sessionId })
                .then(function(result) {
                    if (result.error) {
                        alert('Error: ' + result.error.message);
                        submitButton.disabled = false;
                        submitButton.textContent = 'Submit Application & Pay $25';
                    }
                });
        } else {
            alert('Error: ' + result.message);
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Application & Pay $25';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error submitting application. Please try again.');
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Application & Pay $25';
    });
}

// Show success message
function showSuccessMessage() {
    const form = document.getElementById('jobApplicationForm');
    const successMessage = document.getElementById('successMessage');
    
    form.style.display = 'none';
    successMessage.style.display = 'block';
    
    // Scroll to success message
    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Reset form after 5 seconds
    setTimeout(() => {
        form.reset();
        form.style.display = 'block';
        successMessage.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 5000);
}
