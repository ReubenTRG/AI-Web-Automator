// Content script that runs on all pages
console.log('AI Web Automator content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capturePageData') {
    try {
      const pageData = {
        html: document.documentElement.outerHTML,
        css: getCSSContent(),
        js: getJSContent(),
        title: document.title,
        domain: window.location.hostname,
        url: window.location.href
      };
      
      sendResponse(pageData);
    } catch (error) {
      console.error('Error capturing page data:', error);
      sendResponse({error: error.message});
    }
    return true; // Keep message channel open
  }
  
  if (request.action === 'executeCode') {
    try {
      console.log('Executing automation code:', request.code);
      executeAutomationCode(request.code);
      sendResponse({success: true});
    } catch (error) {
      console.error('Error executing code:', error);
      sendResponse({success: false, error: error.message});
    }
    return true; // Keep message channel open
  }
});

function getCSSContent() {
  let cssContent = '';
  
  try {
    // Get inline styles
    const styleElements = document.querySelectorAll('style');
    styleElements.forEach(style => {
      cssContent += style.textContent + '\n';
    });
    
    // Get external stylesheets
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules).forEach(rule => {
          cssContent += rule.cssText + '\n';
        });
      } catch (e) {
        cssContent += '/* External CSS not accessible due to CORS */\n';
      }
    });
  } catch (error) {
    cssContent = '/* Error capturing CSS: ' + error.message + ' */';
  }
  
  return cssContent;
}

function getJSContent() {
  let jsContent = '';
  
  try {
    // Get inline scripts
    const scriptElements = document.querySelectorAll('script');
    scriptElements.forEach(script => {
      if (script.src) {
        jsContent += `/* External script: ${script.src} */\n`;
      } else {
        jsContent += script.textContent + '\n';
      }
    });
  } catch (error) {
    jsContent = '/* Error capturing JS: ' + error.message + ' */';
  }
  
  return jsContent;
}

// Helper functions that can be used in automation code
function clickElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    // Try different click methods for better compatibility
    if (element.click) {
      element.click();
    } else {
      // Fallback: create and dispatch click event
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(event);
    }
    return true;
  }
  return false;
}

// Safe input function
function fillInput(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    // Focus the element first
    element.focus();
    
    // Set the value
    element.value = value;
    
    // Dispatch events to trigger any listeners
    element.dispatchEvent(new Event('input', {bubbles: true}));
    element.dispatchEvent(new Event('change', {bubbles: true}));
    element.dispatchEvent(new Event('keyup', {bubbles: true}));
    
    return true;
  }
  return false;
}

// Wait function
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get element text
function getElementText(selector) {
  const element = document.querySelector(selector);
  return element ? element.textContent.trim() : null;
}

// Check if element exists
function elementExists(selector) {
  return document.querySelector(selector) !== null;
}

function executeAutomationCode(code) {
  try {
    // Create a more secure execution environment using command parsing
    const commands = parseAutomationCode(code);
    console.log('Parsed commands:', commands);
    executeCommands(commands);
  } catch (error) {
    console.error('Code execution error:', error);
    throw error;
  }
}

function parseAutomationCode(code) {
  // Parse the generated code into safe commands
  const commands = [];
  const lines = code.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    
    // Parse clickElement commands with various quote types
    const clickMatch = trimmed.match(/clickElement\s*\(\s*['"']([^'"']+)['"']\s*\)/);
    if (clickMatch) {
      commands.push({
        type: 'click',
        selector: clickMatch[1]
      });
      continue;
    }
    
    // Parse fillInput commands with various quote types
    const fillMatch = trimmed.match(/fillInput\s*\(\s*['"']([^'"']+)['"']\s*,\s*['"']([^'"']*)['"']\s*\)/);
    if (fillMatch) {
      commands.push({
        type: 'fill',
        selector: fillMatch[1],
        value: fillMatch[2]
      });
      continue;
    }
    
    // Parse wait commands
    const waitMatch = trimmed.match(/wait\s*\(\s*(\d+)\s*\)/);
    if (waitMatch) {
      commands.push({
        type: 'wait',
        duration: parseInt(waitMatch[1])
      });
      continue;
    }
    
    // Parse console.log commands
    const logMatch = trimmed.match(/console\.log\s*\(\s*['"']([^'"']*)['"']\s*\)/);
    if (logMatch) {
      commands.push({
        type: 'log',
        message: logMatch[1]
      });
      continue;
    }
    
    // Parse simple document.querySelector operations (as backup)
    const domClickMatch = trimmed.match(/document\.querySelector\s*\(\s*['"']([^'"']+)['"']\s*\)\.click\s*\(\s*\)/);
    if (domClickMatch) {
      commands.push({
        type: 'click',
        selector: domClickMatch[1]
      });
      continue;
    }
    
    // Parse simple value assignments
    const domValueMatch = trimmed.match(/document\.querySelector\s*\(\s*['"']([^'"']+)['"']\s*\)\.value\s*=\s*['"']([^'"']*)['"']/);
    if (domValueMatch) {
      commands.push({
        type: 'fill',
        selector: domValueMatch[1],
        value: domValueMatch[2]
      });
      continue;
    }
  }
  
  return commands;
}

async function executeCommands(commands) {
  for (const command of commands) {
    try {
      switch (command.type) {
        case 'click':
          const clickResult = clickElement(command.selector);
          console.log(`Click ${command.selector}: ${clickResult ? 'success' : 'failed'}`);
          break;
          
        case 'fill':
          const fillResult = fillInput(command.selector, command.value);
          console.log(`Fill ${command.selector}: ${fillResult ? 'success' : 'failed'}`);
          break;
          
        case 'wait':
          await wait(command.duration);
          console.log(`Waited ${command.duration}ms`);
          break;
          
        case 'log':
          console.log(command.message);
          break;
          
        case 'dom':
          const element = document.querySelector(command.selector);
          if (element) {
            if (command.value) {
              element[command.property] = command.value;
            } else {
              element[command.property]();
            }
          }
          break;
      }
      
      // Small delay between commands for stability
      await wait(100);
      
    } catch (error) {
      console.error(`Error executing command:`, command, error);
    }
  }
}