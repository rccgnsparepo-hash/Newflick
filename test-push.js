fetch("http://localhost:3000/api/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    app_id: "050ecfbd-c43d-453d-a578-2f3ece4649ea",
    headings: { en: "Test" },
    contents: { en: "Test message" },
    include_aliases: { external_id: ["test-uid"] },
    target_channel: "push"
  })
}).then(res => res.json()).then(console.log).catch(console.error);
