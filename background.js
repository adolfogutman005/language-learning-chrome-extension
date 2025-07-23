chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "language-helper",
    title: "Check Language Info",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "language-helper") {
    chrome.storage.local.set({ selectedText: info.selectionText }, () => {
      chrome.action.openPopup();
    });
  }
});


