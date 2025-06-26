// AI-Powered Customer Interview PWA - Main Application
class CustomerInterviewApp {
    constructor() {
        this.sessionId = null;
        this.interviewId = null;
        this.businessInfo = null;
        this.isRecording = false;
        this.recognition = null;
        this.conversationHistory = [];
        this.currentInput = '';
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            console.log('Starting app initialization...');
            console.log('APP_CONFIG:', window.APP_CONFIG);
            console.log('API_URL:', window.APP_CONFIG?.API_URL);
            
            // Fallback if config isn't loaded
            if (!window.APP_CONFIG || !window.APP_CONFIG.API_URL) {
                console.error('APP_CONFIG not loaded, using fallback');
                window.APP_CONFIG = {
                    API_URL: 'https://web-production-c070a.up.railway.app',
                    APP_NAME: 'GSurveyAI',
                    APP_VERSION: '1.0.0'
                };
            }
            
            // Get business ID from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const businessId = urlParams.get('business') || 'demo-business';
            console.log('Business ID:', businessId);
            
            // Show loading screen
            this.showLoadingScreen();
            console.log('Loading screen shown');
            
            // Initialize interview session
            console.log('Starting interview...');
            await this.startInterview(businessId);
            console.log('Interview started successfully');
            
            // Setup event listeners
            this.setupEventListeners();
            console.log('Event listeners setup');
            
            // Initialize voice recognition
            this.initializeVoiceRecognition();
            console.log('Voice recognition initialized');
            
            // Hide loading screen and show app
            this.hideLoadingScreen();
            console.log('Loading screen hidden');
            
            console.log('Customer Interview App initialized successfully');
        
        // Force correct styling for Firefox on Linux
        this.forceFirefoxStyling();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.hideLoadingScreen();
            this.showError('Failed to start interview. Please refresh and try again.');
        }
    }

    showLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }

    hideLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
    }

    async startInterview(businessId) {
        try {
            const deviceType = this.detectDeviceType();
            const languageCode = navigator.language.split('-')[0] || 'en';
            
            // Hardcoded URL to bypass config issues
            const API_URL = window.APP_CONFIG?.API_URL || 'https://web-production-c070a.up.railway.app';
            console.log('Using API_URL:', API_URL);
            const response = await fetch(`${API_URL}/api/interview/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    businessId,
                    languageCode,
                    deviceType,
                    metadata: {
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString(),
                        referrer: document.referrer
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to start interview: ${response.status}`);
            }

            const data = await response.json();
            
            this.sessionId = data.sessionId;
            this.interviewId = data.interviewId;
            this.businessInfo = {
                name: data.businessName,
                settings: data.businessSettings
            };

            // Update UI with business info
            this.updateBusinessInfo();
            
            // Add welcome message
            this.addMessage('ai', data.welcomeMessage);
            
        } catch (error) {
            console.error('Start interview error:', error);
            throw error;
        }
    }

    updateBusinessInfo() {
        const businessNameEl = document.getElementById('business-name');
        const businessLogoEl = document.getElementById('business-logo');
        
        if (this.businessInfo) {
            businessNameEl.textContent = this.businessInfo.name;
            
            // Update logo if available
            if (this.businessInfo.settings.logo) {
                businessLogoEl.innerHTML = `<img src="${this.businessInfo.settings.logo}" alt="${this.businessInfo.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
            }
            
            // Update theme colors
            if (this.businessInfo.settings.primaryColor) {
                document.documentElement.style.setProperty('--primary-color', this.businessInfo.settings.primaryColor);
            }
        }
    }

    setupEventListeners() {
        // Send button
        const sendButton = document.getElementById('send-button');
        sendButton.addEventListener('click', () => this.sendMessage());

        // Message input
        const messageInput = document.getElementById('message-input');
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 80) + 'px';
        });

        // Voice button
        const voiceButton = document.getElementById('voice-button');
        voiceButton.addEventListener('click', () => this.toggleVoiceRecording());

        // Review buttons
        document.getElementById('google-review-btn').addEventListener('click', () => this.handleGoogleReview());
        document.getElementById('private-feedback-btn').addEventListener('click', () => this.handlePrivateFeedback());
    }

    addMessage(sender, content, options = {}) {
        const conversationFlow = document.getElementById('conversation-flow');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-bubble ${sender}-bubble`;
        messageDiv.setAttribute('role', 'article');
        messageDiv.setAttribute('aria-label', `${sender} message`);

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (options.streaming) {
            messageContent.className += ' streaming';
        }
        
        messageContent.textContent = content;
        messageDiv.appendChild(messageContent);

        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.appendChild(timestamp);

        conversationFlow.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
        
        // Store in conversation history
        this.conversationHistory.push({
            sender,
            content,
            timestamp: new Date(),
            ...options
        });

        return messageDiv;
    }

    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();
        
        if (!content || !this.sessionId) return;

        // Clear input and disable send button
        messageInput.value = '';
        messageInput.style.height = 'auto';
        const sendButton = document.getElementById('send-button');
        sendButton.disabled = true;

        // Add user message
        this.addMessage('user', content);

        try {
            // Show typing indicator
            const typingMessage = this.addTypingIndicator();

            // Send message to API
            const API_URL = window.APP_CONFIG?.API_URL || 'https://web-production-c070a.up.railway.app';
            const response = await fetch(`${API_URL}/api/interview/${this.sessionId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content,
                    messageType: 'text',
                    deviceType: this.detectDeviceType()
                })
            });

            // Remove typing indicator
            typingMessage.remove();

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('Failed to parse API response:', parseError);
                throw new Error('Invalid response format from API');
            }
            
            // Validate and provide fallbacks for required data
            const validatedData = {
                content: data.content || 'I apologize, but I\'m having trouble right now. Could you please try again?',
                sentimentAnalysis: {
                    score: (data.sentimentAnalysis && typeof data.sentimentAnalysis.score === 'number') ? data.sentimentAnalysis.score : 0,
                    confidence: (data.sentimentAnalysis && typeof data.sentimentAnalysis.confidence === 'number') ? data.sentimentAnalysis.confidence : 0.5,
                    emotions: (data.sentimentAnalysis && Array.isArray(data.sentimentAnalysis.emotions)) ? data.sentimentAnalysis.emotions : []
                },
                responseTime: (typeof data.responseTime === 'number') ? data.responseTime : 0,
                shouldContinue: (typeof data.shouldContinue === 'boolean') ? data.shouldContinue : true
            };
            
            // Add AI response with validated data
            this.addMessage('ai', validatedData.content, {
                sentimentScore: validatedData.sentimentAnalysis.score,
                responseTime: validatedData.responseTime
            });

            // Check if interview should end
            if (!validatedData.shouldContinue) {
                setTimeout(() => this.completeInterview(), 2000);
            }

        } catch (error) {
            console.error('Send message error:', error);
            this.addMessage('ai', 'I apologize, but I\'m having trouble right now. Could you please try again?');
        } finally {
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    addTypingIndicator() {
        const conversationFlow = document.getElementById('conversation-flow');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-bubble ai-bubble';
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        
        messageDiv.appendChild(typingDiv);
        conversationFlow.appendChild(messageDiv);
        
        this.scrollToBottom();
        
        return messageDiv;
    }

    scrollToBottom() {
        const conversationFlow = document.getElementById('conversation-flow');
        conversationFlow.scrollTop = conversationFlow.scrollHeight;
    }

    initializeVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = navigator.language || 'en-US';

        this.recognition.onstart = () => {
            this.isRecording = true;
            const voiceButton = document.getElementById('voice-button');
            voiceButton.classList.add('recording');
            
            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        };

        this.recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            
            const messageInput = document.getElementById('message-input');
            messageInput.value = transcript;
            
            // Auto-resize
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 80) + 'px';
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            const voiceButton = document.getElementById('voice-button');
            voiceButton.classList.remove('recording');
            
            // Auto-send if there's content
            const messageInput = document.getElementById('message-input');
            if (messageInput.value.trim()) {
                this.sendMessage();
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isRecording = false;
            const voiceButton = document.getElementById('voice-button');
            voiceButton.classList.remove('recording');
        };
    }

    toggleVoiceRecording() {
        if (!this.recognition) {
            alert('Voice input is not supported on this device');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }

    async completeInterview() {
        try {
            const API_URL = window.APP_CONFIG?.API_URL || 'https://web-production-c070a.up.railway.app';
            const response = await fetch(`${API_URL}/api/interview/${this.sessionId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to complete interview: ${response.status}`);
            }

            const data = await response.json();
            
            // Show review options screen
            this.showReviewOptions(data);

        } catch (error) {
            console.error('Complete interview error:', error);
        }
    }

    showReviewOptions(data) {
        const reviewScreen = document.getElementById('review-screen');
        const reviewSubtitle = document.getElementById('review-subtitle');
        const complianceText = document.getElementById('compliance-text');
        
        // Update content
        reviewSubtitle.textContent = `Help others learn about your experience with ${this.businessInfo.name}`;
        complianceText.textContent = data.reviewOptions.complianceNotice;
        
        // Store review URLs
        this.googleReviewUrl = data.reviewOptions.googleReview.url;
        this.privateFeedbackUrl = data.reviewOptions.privateFeedback.url;
        
        // Show review screen
        reviewScreen.style.display = 'flex';
    }

    handleGoogleReview() {
        if (this.googleReviewUrl) {
            // Track the action
            this.trackReviewAction('google_review');
            
            // Open Google review page
            window.open(this.googleReviewUrl, '_blank');
            
            // Show thank you message
            this.showThankYou('Thank you for sharing your experience on Google!');
        }
    }

    handlePrivateFeedback() {
        if (this.privateFeedbackUrl) {
            // Track the action
            this.trackReviewAction('private_feedback');
            
            // Navigate to private feedback page
            window.location.href = this.privateFeedbackUrl;
        }
    }

    async trackReviewAction(action) {
        try {
            const API_URL = window.APP_CONFIG?.API_URL || 'https://web-production-c070a.up.railway.app';
            await fetch(`${API_URL}/api/interview/${this.sessionId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('Failed to track action:', error);
        }
    }

    showThankYou(message) {
        const reviewScreen = document.getElementById('review-screen');
        reviewScreen.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">✨</div>
                <h2 style="font-size: 24px; margin-bottom: 16px;">${message}</h2>
                <p style="color: var(--text-secondary); font-size: 16px;">
                    Your feedback helps ${this.businessInfo.name} improve and helps other customers make informed decisions.
                </p>
            </div>
        `;
    }

    detectDeviceType() {
        const userAgent = navigator.userAgent;
        if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
            return 'tablet';
        }
        if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
            return 'mobile';
        }
        return 'desktop';
    }

    showError(message) {
        // Simple error display - in production this would be more sophisticated
        alert(message);
    }
    
    forceFirefoxStyling() {
        // Force correct styling for Firefox on Linux to override GTK themes
        if (navigator.userAgent.includes('Firefox')) {
            console.log('Firefox detected - applying styling fixes');
            
            const inputWrapper = document.querySelector('.input-wrapper');
            const messageInput = document.querySelector('.message-input');
            const inputArea = document.querySelector('.input-area');
            
            if (inputWrapper) {
                inputWrapper.style.setProperty('background', '#f8f9fa', 'important');
                inputWrapper.style.setProperty('background-color', '#f8f9fa', 'important');
                inputWrapper.style.setProperty('border', 'none', 'important');
                inputWrapper.style.setProperty('border-radius', '24px', 'important');
                inputWrapper.style.setProperty('box-shadow', '0 1px 3px rgba(0, 0, 0, 0.1)', 'important');
            }
            
            if (messageInput) {
                messageInput.style.setProperty('background', 'transparent', 'important');
                messageInput.style.setProperty('background-color', 'transparent', 'important');
                messageInput.style.setProperty('color', '#202124', 'important');
                messageInput.style.setProperty('font-size', '16px', 'important');
                messageInput.style.setProperty('-moz-appearance', 'none', 'important');
                messageInput.style.setProperty('appearance', 'none', 'important');
            }
            
            if (inputArea) {
                inputArea.style.setProperty('background', '#FFFFFF', 'important');
                inputArea.style.setProperty('background-color', '#FFFFFF', 'important');
            }
            
            // Force focus styling
            if (messageInput) {
                messageInput.addEventListener('focus', () => {
                    console.log('Input focused - applying Google focus styling');
                    if (inputWrapper) {
                        inputWrapper.style.setProperty('background', '#ffffff', 'important');
                        inputWrapper.style.setProperty('background-color', '#ffffff', 'important');
                        inputWrapper.style.setProperty('box-shadow', '0 2px 8px rgba(0, 0, 0, 0.15)', 'important');
                    }
                    messageInput.style.setProperty('background', 'transparent', 'important');
                    messageInput.style.setProperty('color', '#202124', 'important');
                });
            }
        }
    }
}

// Utility functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Performance monitoring
const perfMonitor = {
    startTime: Date.now(),
    
    mark(name) {
        if (window.performance && window.performance.mark) {
            window.performance.mark(name);
        }
    },
    
    measure(name, startMark, endMark) {
        if (window.performance && window.performance.measure) {
            window.performance.measure(name, startMark, endMark);
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    perfMonitor.mark('app-start');
    window.customerInterviewApp = new CustomerInterviewApp();
    perfMonitor.mark('app-initialized');
    perfMonitor.measure('app-load-time', 'app-start', 'app-initialized');
});