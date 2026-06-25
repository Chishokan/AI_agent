-- 施策（campaign）別: 配布枚数・反応数・反応率
SELECT cp.name                                      AS 施策,
       cp.period_start || ' 〜 ' || cp.period_end    AS 期間,
       SUM(d.actual_qty)                            AS 配布枚数,
       COALESCE(SUM(rr.cnt), 0)                     AS 反応数,
       ROUND(100.0 * COALESCE(SUM(rr.cnt),0)
             / NULLIF(SUM(d.actual_qty),0), 3)      AS 反応率_pct
FROM distribution d
JOIN campaign cp ON cp.id = d.campaign_id
LEFT JOIN (
  SELECT distribution_id, SUM(count) AS cnt FROM response GROUP BY distribution_id
) rr ON rr.distribution_id = d.id
GROUP BY cp.name, 期間
ORDER BY 反応率_pct DESC;
