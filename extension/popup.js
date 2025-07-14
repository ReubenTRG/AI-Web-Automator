document.addEventListener('DOMContentLoaded', function() {
  const promptInput = document.getElementById('promptInput');
  const executeBtn = document.getElementById('executeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  
  let isExecuting = false;
  
  // Load saved prompt
  chrome.storage.local.get(['lastPrompt'], function(result) {
    if (result.lastPrompt) {
      promptInput.value = result.lastPrompt;
    }
  });
  
  // Save prompt on change
  promptInput.addEventListener('input', function() {
    chrome.storage.local.set({lastPrompt: promptInput.value});
  });
  
  executeBtn.addEventListener('click', executeAutomation);
  stopBtn.addEventListener('click', stopAutomation);
  
  async function executeAutomation() {
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
      showStatus('Please enter a prompt', 'error');
      return;
    }
    
    if (isExecuting) {
      showStatus('Already executing...', 'error');
      return;
    }
    
    isExecuting = true;
    executeBtn.disabled = true;
    stopBtn.disabled = false;
    
    try {
      showStatus('Capturing page content...', 'loading');
      
      // Get the current active tab
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      // Inject content script and capture page data
      const results = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: capturePageData
      });
      
      const pageData = results[0].result;
      
      showStatus('Sending to AI backend...', 'loading');
      
      // Send to backend
      const response = await fetch('http://localhost:3000/api/automate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          pageData: pageData,
          url: tab.url
        })
      });
      
      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        showStatus('Executing automation...', 'loading');
        
        // Execute the returned code
        await chrome.tabs.sendMessage(tab.id, {
          action: 'executeCode',
          code: result.code
        });
        
        showStatus('Automation completed successfully!', 'success');
      } else {
        throw new Error(result.error || 'Unknown error from backend');
      }
      
    } catch (error) {
      console.error('Automation error:', error);
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      isExecuting = false;
      executeBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }
  
  function stopAutomation() {
    isExecuting = false;
    executeBtn.disabled = false;
    stopBtn.disabled = true;
    showStatus('Automation stopped', 'error');
  }
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }
});

// Function to be injected into the page
function capturePageData() {
  return {
    html: document.documentElement.outerHTML,
    css: Array.from(document.styleSheets).map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
      } catch (e) {
        return '/* CSS rules not accessible */';
      }
    }).join('\n'),
    js: Array.from(document.scripts).map(script => script.textContent || script.src).join('\n'),
    title: document.title,
    domain: window.location.hostname
  };
}

// Function to execute automation code
function executeAutomationCode(code) {
  try {
    // Send code to content script for execution
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'executeCode',
          code: code
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Execution failed'));
          }
        });
      });
    });
  } catch (error) {
    console.error('Automation execution error:', error);
    throw error;
  }
}