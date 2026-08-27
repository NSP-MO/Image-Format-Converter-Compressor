/**
 * Image Format Converter & Compressor - Background Service Worker
 * Handles extension action clicks and opens the standalone offline conversion workspace.
 */

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('app.html')
  });
});
