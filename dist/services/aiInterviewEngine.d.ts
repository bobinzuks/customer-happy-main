import { AIResponse, ConversationMessage, BusinessSettings } from '../types';
export declare class AIInterviewEngine {
    private groqClient;
    private openaiClient;
    private conversationMemory;
    constructor();
    generateResponse(userInput: string, sessionId: string, businessSettings: BusinessSettings, conversationHistory?: ConversationMessage[]): Promise<AIResponse>;
    private analyzeSentiment;
    private selectOptimalModel;
    private callAIModel;
    private buildInterviewPrompt;
    private getSentimentContext;
    private getResponseStrategy;
    private buildConversationContext;
    private determineNextQuestionType;
    private shouldContinueInterview;
    private generateSuggestedActions;
    private getFallbackResponse;
    streamResponse(userInput: string, sessionId: string, businessSettings: BusinessSettings, conversationHistory?: ConversationMessage[]): AsyncGenerator<{
        type: 'partial' | 'complete';
        content: string;
        metadata?: any;
    }>;
}
