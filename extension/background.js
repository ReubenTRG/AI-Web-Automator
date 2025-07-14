// Background service worker
console.log('AI Web Automator background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Web Automator installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title,
          id: tabs[0].id
        });
      }
    });
    return true; // Keep message channel open for async response
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    console.log('Tab updated:', tab.url);
  }
});