// server.js — запускать командой: node server.js
// Этот файл положить в корень папки notewise (рядом с package.json)

const http = require("http");
const https = require("https");

const PORT = 3001;

const server = http.createServer(function (req, res) {
  // Разрешаем CORS для React приложения
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight запрос
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";

    req.on("data", function (chunk) {
      body += chunk.toString();
    });

    req.on("end", function () {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      const apiKey = parsed.apiKey;
      const payload = JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: parsed.system,
        messages: parsed.messages,
      });

      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      const proxyReq = https.request(options, function (proxyRes) {
        let data = "";
        proxyRes.on("data", function (chunk) { data += chunk; });
        proxyRes.on("end", function () {
          res.writeHead(proxyRes.statusCode, { "Content-Type": "application/json" });
          res.end(data);
        });
      });

      proxyReq.on("error", function (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      });

      proxyReq.write(payload);
      proxyReq.end();
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, function () {
  console.log("✅ Прокси-сервер запущен на http://localhost:" + PORT);
  console.log("   Теперь запустите React: npm start (в другом терминале)");
});
