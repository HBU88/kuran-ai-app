"use strict";

/**
 * routes/ayet-rehberi.js
 * POST /ayet-rehberi/sorgu — Duygu tabanlı ilmihal KB + ayet havuzu araması
 */

const express = require("express");
const router  = express.Router();
const { routeByEmotion } = require("../agent/emotion-router");

/**
 * POST /ayet-rehberi/sorgu
 *
 * Body: { "user_input": "Çok üzgünüm" }
 *
 * 200 → {
 *   soru, duygular,
 *   ilmihal:       [...],   // KB entry'leri
 *   ayetler_havuzu:[...],   // Havuzdan eşleşen ayetler
 *   toplam: { ilmihal_entries, ayetler }
 * }
 * 400 → { error: "Lütfen bir soru yazınız" }
 * 500 → { error: "İç sunucu hatası" }
 */
router.post("/sorgu", (req, res) => {
  const userInput    = (req.body?.user_input || "").trim();
  const ilmihalLimit = parseInt(req.body?.ilmihal_limit, 10) || 8;
  const ayetLimit    = parseInt(req.body?.ayet_limit,    10) || 5;

  if (!userInput) {
    return res.status(400).json({ error: "Lütfen bir soru yazınız" });
  }

  try {
    const { emotions, ilmihal_entries, ayetler, toplam } = routeByEmotion(
      userInput,
      { ilmihalLimit, ayetLimit }
    );

    return res.status(200).json({
      soru:           userInput,
      duygular:       emotions,
      ilmihal:        ilmihal_entries,
      ayetler_havuzu: ayetler,
      toplam: {
        ilmihal_entries: toplam.ilmihal,
        ayetler:         toplam.ayetler,
      },
    });
  } catch (err) {
    console.error("[ayet-rehberi] sorgu hatası:", err.message);
    return res.status(500).json({ error: "İç sunucu hatası" });
  }
});

/**
 * GET /ayet-rehberi/saglik
 * Basit health check — havuz istatistiklerini de döndürür
 */
router.get("/saglik", (_req, res) => {
  try {
    const { getHavuz } = require("../agent/emotion-router");
    const havuz = getHavuz();
    const stats = havuz
      ? {
          toplam_kategoriler: Object.keys(havuz.kategoriler || {}).length,
          scholar_approved:   havuz.metadata?.scholar_approved ?? false,
        }
      : { havuz: "yüklenemedi" };

    res.json({ ok: true, modul: "ayet-rehberi", havuz: stats });
  } catch {
    res.json({ ok: true, modul: "ayet-rehberi" });
  }
});

module.exports = router;
