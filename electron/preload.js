const { contextBridge, ipcRenderer } = require("electron");

const _nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = function (input, init) {
  const url =
    typeof input === "string" ? input
    : input instanceof Request ? input.url
    : String(input);

  const isConnectivityProbe =
    typeof url === "string" &&
    (url === "/index.html" || url.endsWith("/index.html")) &&
    init?.method === "HEAD" &&
    init?.cache === "no-store";

  if (isConnectivityProbe) {
    const probes = [
      "https://www.gstatic.com/generate_204",
      "https://connectivitycheck.gstatic.com/generate_204",
    ];
    const tryNext = (i) => {
      if (i >= probes.length)
        return Promise.resolve(new Response(null, { status: 503 }));
      return _nativeFetch(probes[i], { method: "GET", cache: "no-store", signal: init?.signal })
        .then(() => new Response(null, { status: 200, statusText: "OK" }))
        .catch(() => tryNext(i + 1));
    };
    return tryNext(0);
  }

  return _nativeFetch(input, init);
};

contextBridge.exposeInMainWorld("flickBridge", {
  onUpdateAvailable: (cb) =>
    ipcRenderer.on("update-available", (_e, info) => cb(info)),
  onUpdateReady: (cb) =>
    ipcRenderer.on("update-ready", (_e, info) => cb(info)),
  showNotification: (title, body) =>
    ipcRenderer.send("show-notification", { title, body }),
  setBadge: (count) => ipcRenderer.send("set-badge", count),
  platform: process.platform,
});
