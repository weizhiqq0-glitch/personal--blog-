const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "博客后端运行正常", time: new Date().toISOString() });
});

app.get("/api/articles", (req, res) => {
  res.json([]);
});

app.listen(port, () => {
  console.log("博客后端已启动：http://localhost:" + port);
});

