/**
 * Image Format Converter & Compressor - Background Script
 * Handles extension action clicks and opens the standalone offline conversion workspace.
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

browserAPI.action.onClicked.addListener(() => {
  browserAPI.tabs.create({
    url: browserAPI.runtime.getURL('app.html')
  });
});
