"use strict";

/**
 * routes/ayet-rehberi.js
 * POST /ayet-rehberi/sorgu — Duygu tabanlı ilmihal KB arama
 */

const express = require("express");
const router  = express.Router();
const { routeByEmotion } = require("../agent/emotion-router");

/**
 * POST /ayet-rehberi/sorgu
 *
 * Body: { "user_input": "Çok üzgünüm" }
 *
 * 200 → { soru, duygular, sonuclar, toplam }
 * 400 → { error: "Lütfen bir soru yazınız" }
 * 500 → { error: "İç sunucu hatası" }
 */
router.post("/sorgu", (req, res) => {
  const userInput = (req.body?.user_input || "").trim();

  if (!userInput) {
    return res.status(400).json({ error: "Lütfen bir soru yazınız" });
  }

  try {
    const { emotions, matched_entries, total } = routeByEmotion(userInput, { limit: 8 });

    return res.status(200).json({
      soru:     userInput,
      duygular: emotions,
      sonuclar: matched_entries,
      toplam:   total,
    });
  } catch (err) {
    console.error("[ayet-rehberi] sorgu hatası:", err.message);
    return res.status(500).json({ error: "İç sunucu hatası" });
  }
});

/**
 * GET /ayet-rehberi/saglik
 * Basit health check
 */
router.get("/saglik", (_req, res) => {
  res.json({ ok: true, modul: "ayet-rehberi" });
});

module.exports = router;
