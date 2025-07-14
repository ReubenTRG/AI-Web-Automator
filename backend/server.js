const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3000;

// Initialize Gemini AI (replace with your API key)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Main automation endpoint
app.post('/api/automate', async (req, res) => {
  try {
    const { prompt, pageData, url } = req.body;
    
    if (!prompt || !pageData) {
      return res.status(400).json({
        success: false,
        error: 'Missing prompt or page data'
      });
    }
    
    console.log('Processing automation request for:', url);
    console.log('User prompt:', prompt);
    
    // Create a comprehensive prompt for the AI
    const aiPrompt = createAIPrompt(prompt, pageData, url);
    
    // Generate code using Gemini
    const result = await model.generateContent(aiPrompt);
    const response = await result.response;
    const generatedCode = response.text();
    
    // Extract and validate the JavaScript code
    const extractedCode = extractJavaScriptCode(generatedCode);
    
    console.log('Generated code:', extractedCode);
    
    res.json({
      success: true,
      code: extractedCode,
      rawResponse: generatedCode
    });
    
  } catch (error) {
    console.error('Error processing automation request:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function createAIPrompt(userPrompt, pageData, url) {
  const prompt = `You are a web automation assistant. Generate JavaScript code to automate web interactions based on the user's request.

CONTEXT:
- Current URL: ${url}
- Page Title: ${pageData.title}
- Domain: ${pageData.domain}

USER REQUEST: ${userPrompt}

PAGE HTML (first 2000 chars):
${pageData.html.substring(0, 2000)}...

AVAILABLE HELPER FUNCTIONS:
- clickElement(selector) - Click an element
- fillInput(selector, value) - Fill input field
- wait(ms) - Wait for specified milliseconds
- getElementText(selector) - Get text from element
- elementExists(selector) - Check if element exists

REQUIREMENTS:
1. Generate ONLY simple function calls that will be parsed and executed safely
2. Use ONLY these helper functions:
   - clickElement('selector')
   - fillInput('selector', 'value')
   - wait(milliseconds)
   - console.log('message')
3. Use CSS selectors to target elements (prefer ID and class selectors)
4. Each command should be on its own line
5. Add comments explaining each step using // comments
6. Do NOT use complex JavaScript constructs, loops, or variables
7. Do NOT use document.querySelector directly
8. Be safe and avoid potentially harmful operations

EXAMPLE CODE FORMAT:
// Step 1: Find and click login button
clickElement('#login-btn');
console.log('Login button clicked');

// Step 2: Fill username field
fillInput('input[name="username"]', 'john@example.com');
console.log('Username filled');

// Step 3: Wait a moment
wait(1000);

// Step 4: Click submit button
clickElement('button[type="submit"]');

Generate the automation code now using ONLY the allowed functions:`;

  return prompt;
}

function extractJavaScriptCode(response) {
  // Try to extract code from markdown code blocks
  const codeBlockMatch = response.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // If no code block, try to extract JavaScript-like content
  const lines = response.split('\n');
  const codeLines = [];
  let inCodeSection = false;
  
  for (const line of lines) {
    // Look for JavaScript patterns
    if (line.includes('document.') || 
        line.includes('clickElement') || 
        line.includes('fillInput') || 
        line.includes('console.log') ||
        line.includes('if (') ||
        line.includes('function') ||
        line.includes('const ') ||
        line.includes('let ') ||
        line.includes('var ')) {
      inCodeSection = true;
    }
    
    if (inCodeSection && line.trim()) {
      codeLines.push(line);
    }
    
    // Stop if we hit explanatory text after code
    if (inCodeSection && line.includes('This code') || line.includes('The above')) {
      break;
    }
  }
  
  return codeLines.length > 0 ? codeLines.join('\n') : response;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Web Automator backend running on http://localhost:${PORT}`);
  console.log('Make sure to set your GEMINI_API_KEY in the code');
});

module.exports = app;