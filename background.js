chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPEN_APP_WINDOW") {
    chrome.windows.create({
      url: chrome.runtime.getURL("app.html"),
      type: "popup",
      width: 420,
      height: 720
    });
    sendResponse({ ok: true });
  }
});
