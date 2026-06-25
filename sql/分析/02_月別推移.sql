-- 月別: 配布枚数・反応数・反応率の推移
SELECT substr(d.date, 1, 7)                       AS 年月,
       SUM(d.actual_qty)                          AS 配布枚数,
       COALESCE(SUM(rr.cnt), 0)                   AS 反応数,
       ROUND(100.0 * COALESCE(SUM(rr.cnt),0)
             / NULLIF(SUM(d.actual_qty),0), 3)    AS 反応率_pct
FROM distribution d
LEFT JOIN (
  SELECT distribution_id, SUM(count) AS cnt FROM response GROUP BY distribution_id
) rr ON rr.distribution_id = d.id
GROUP BY 年月
ORDER BY 年月;
