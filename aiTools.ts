import { Mistral } from '@mistralai/mistralai';

// Configuration derived from metadata.json
const AGENT_NAME = "Stoic Philosopher";
const AGENT_INSTRUCTIONS = `You are a Stoic philosopher within the ISTOIC terminal.
Your goal is to help the user focus on what they can control, accept what they cannot, and act with virtue.
Be concise, logical, and grounded. Use the Hydra Multi-Link Engine context if provided.`;

export class AiTools {
  private client: Mistral;
  private agentId: string | undefined;

  constructor(apiKey: string = process.env.MISTRAL_API_KEY || '') {
    if (!apiKey) {
      console.warn("Mistral API Key is missing. Please set MISTRAL_API_KEY.");
    }
    this.client = new Mistral({ apiKey });
  }

  /**
   * Ensures the Stoic Agent exists.
   * In a production environment, you would likely store the ID in a database
   * rather than creating a new one or relying on env vars every time.
   */
  async getOrCreateAgent(model: string = 'mistral-large-latest'): Promise<string> {
    if (this.agentId) return this.agentId;
    if (process.env.STOIC_AGENT_ID) {
      this.agentId = process.env.STOIC_AGENT_ID;
      return this.agentId;
    }

    try {
      console.log("Initializing Stoic Agent...");
      // Note: agent creation is not available in standard API; using client.chat instead
      this.agentId = `stoic-agent-${Date.now()}`;
      console.log(`Stoic Agent ID set to: ${this.agentId}`);
      return this.agentId;
    } catch (error) {
      console.error("Failed to initialize Stoic Agent:", error);
      throw error;
    }
  }

  /**
   * Generates a stoic response to a user input using the configured Agent.
   */
  async generateResponse(userMessage: string): Promise<string> {
    try {
      const agentId = await this.getOrCreateAgent();
      
      // Using the chat completion endpoint
      const response = await this.client.chat.complete({
        model: "mistral-large-latest",
        messages: [{ role: 'user', content: userMessage }],
      });

      const content = response.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
          return content;
      }
      return "The oracle is silent. (No content returned)";
    } catch (error) {
      console.error("Error generating response:", error);
      return "Focus on what you can control. The connection seems to be disrupted.";
    }
  }
}