"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIInterviewEngine = void 0;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const openai_1 = require("openai");
class AIInterviewEngine {
    constructor() {
        this.conversationMemory = new Map();
        this.groqClient = new groq_sdk_1.default({
            apiKey: process.env.GROQ_API_KEY || ''
        });
        this.openaiClient = new openai_1.OpenAI({
            apiKey: process.env.OPENAI_API_KEY || ''
        });
    }
    async generateResponse(userInput, sessionId, businessSettings, conversationHistory = []) {
        try {
            const context = this.buildConversationContext(conversationHistory, businessSettings);
            const sentimentAnalysis = await this.analyzeSentiment(userInput);
            // Use Groq for speed, fallback to OpenAI for complex queries
            const aiModel = this.selectOptimalModel(userInput, sentimentAnalysis.score);
            const prompt = this.buildInterviewPrompt(userInput, context, sentimentAnalysis, businessSettings);
            const response = await this.callAIModel(aiModel, prompt);
            return {
                content: response.content,
                nextQuestionType: this.determineNextQuestionType(sentimentAnalysis.score),
                sentimentAnalysis,
                shouldContinue: this.shouldContinueInterview(conversationHistory.length, sentimentAnalysis.score),
                suggestedActions: this.generateSuggestedActions(sentimentAnalysis.score)
            };
        }
        catch (error) {
            console.error('AI Interview Engine Error:', error);
            return this.getFallbackResponse();
        }
    }
    async analyzeSentiment(text) {
        try {
            // Using Groq for fast sentiment analysis
            const response = await this.groqClient.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are a sentiment analysis expert. Analyze the sentiment of the following text and return a JSON response with:
            - score: number between -1 (very negative) and 1 (very positive)
            - confidence: number between 0 and 1
            - emotions: array of detected emotions (max 3)
            
            Response format: {"score": 0.5, "confidence": 0.8, "emotions": ["happy", "satisfied"]}`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                model: "llama3-8b-8192",
                temperature: 0.1,
                max_tokens: 200
            });
            const result = JSON.parse(response.choices[0].message.content || '{"score": 0, "confidence": 0.5, "emotions": []}');
            return result;
        }
        catch (error) {
            console.error('Sentiment analysis error:', error);
            return { score: 0, confidence: 0.5, emotions: [] };
        }
    }
    selectOptimalModel(userInput, sentimentScore) {
        // Use Groq for simple, fast responses. OpenAI for complex emotional situations
        const isComplexQuery = userInput.length > 200 ||
            sentimentScore < -0.5 ||
            userInput.toLowerCase().includes('problem') ||
            userInput.toLowerCase().includes('issue');
        return isComplexQuery ? 'openai' : 'groq';
    }
    async callAIModel(model, prompt) {
        if (model === 'groq') {
            const response = await this.groqClient.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama3-70b-8192", // Fastest model with good quality
                temperature: 0.7,
                max_tokens: 500
            });
            return { content: response.choices[0].message.content || '' };
        }
        else {
            const response = await this.openaiClient.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-4o-mini", // Fast and cost-effective
                temperature: 0.7,
                max_tokens: 500
            });
            return { content: response.choices[0].message.content || '' };
        }
    }
    buildInterviewPrompt(userInput, context, sentiment, businessSettings) {
        const companyName = businessSettings.branding.companyName;
        const sentimentContext = this.getSentimentContext(sentiment.score);
        return `You are an AI customer experience interviewer for ${companyName}. Your role is to conduct professional, empathetic customer interviews to understand their experience.

IMPORTANT GUIDELINES:
- Keep responses concise (1-2 sentences max)
- Be genuinely empathetic and professional
- Ask follow-up questions based on sentiment
- Avoid leading questions or bias
- Focus on understanding their specific experience

CURRENT CONVERSATION CONTEXT:
${context}

CUSTOMER SENTIMENT: ${sentimentContext} (Score: ${sentiment.score})
DETECTED EMOTIONS: ${sentiment.emotions.join(', ')}

CUSTOMER'S LATEST MESSAGE: "${userInput}"

Based on the sentiment and conversation history, generate an appropriate follow-up response. ${this.getResponseStrategy(sentiment.score)}

Response:`;
    }
    getSentimentContext(score) {
        if (score > 0.3)
            return "POSITIVE - Customer seems satisfied";
        if (score < -0.3)
            return "NEGATIVE - Customer has concerns";
        return "NEUTRAL - Customer is providing factual feedback";
    }
    getResponseStrategy(sentimentScore) {
        if (sentimentScore > 0.3) {
            return "Since the customer is positive, ask about specific aspects they enjoyed and what made their experience great.";
        }
        if (sentimentScore < -0.3) {
            return "Since the customer has concerns, show empathy, ask specific questions about what went wrong, and understand their perspective.";
        }
        return "Since the customer is neutral, ask open-ended questions to understand their overall experience better.";
    }
    buildConversationContext(history, settings) {
        if (history.length === 0) {
            return `This is the start of a customer interview for ${settings.branding.companyName}.`;
        }
        const recentMessages = history.slice(-6); // Last 6 messages for context
        return recentMessages.map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`).join('\n');
    }
    determineNextQuestionType(sentimentScore) {
        if (sentimentScore > 0.5)
            return 'positive_details';
        if (sentimentScore < -0.3)
            return 'problem_exploration';
        return 'general_experience';
    }
    shouldContinueInterview(messageCount, sentimentScore) {
        // Continue if less than 5 exchanges, or if negative sentiment needs more exploration
        return messageCount < 10 && (messageCount < 6 || sentimentScore < -0.2);
    }
    generateSuggestedActions(sentimentScore) {
        const actions = [];
        if (sentimentScore > 0.5) {
            actions.push('google_review', 'share_positive');
        }
        else if (sentimentScore < -0.3) {
            actions.push('escalate_support', 'collect_details');
        }
        else {
            actions.push('continue_conversation');
        }
        return actions;
    }
    getFallbackResponse() {
        return {
            content: "I understand. Could you tell me more about your experience with us today?",
            nextQuestionType: 'general_experience',
            sentimentAnalysis: { score: 0, confidence: 0.5, emotions: [] },
            shouldContinue: true,
            suggestedActions: ['continue_conversation']
        };
    }
    // Streaming response for real-time UI updates
    async *streamResponse(userInput, sessionId, businessSettings, conversationHistory = []) {
        try {
            const context = this.buildConversationContext(conversationHistory, businessSettings);
            const sentimentAnalysis = await this.analyzeSentiment(userInput);
            const prompt = this.buildInterviewPrompt(userInput, context, sentimentAnalysis, businessSettings);
            // Stream from Groq for speed
            const stream = await this.groqClient.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama3-70b-8192",
                temperature: 0.7,
                max_tokens: 500,
                stream: true
            });
            let fullContent = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullContent += content;
                    yield {
                        type: 'partial',
                        content: content
                    };
                }
            }
            // Final response with metadata
            yield {
                type: 'complete',
                content: '',
                metadata: {
                    sentimentAnalysis,
                    shouldContinue: this.shouldContinueInterview(conversationHistory.length, sentimentAnalysis.score),
                    suggestedActions: this.generateSuggestedActions(sentimentAnalysis.score)
                }
            };
        }
        catch (error) {
            console.error('Streaming error:', error);
            yield {
                type: 'complete',
                content: "I understand. Could you tell me more about your experience?",
                metadata: {
                    sentimentAnalysis: { score: 0, confidence: 0.5, emotions: [] },
                    shouldContinue: true,
                    suggestedActions: ['continue_conversation']
                }
            };
        }
    }
}
exports.AIInterviewEngine = AIInterviewEngine;
