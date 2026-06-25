-- 校舎別: 配布枚数・反応数・体験申込率（分母=配布枚数を明示）
-- 期間を変える場合は下の BETWEEN のリテラルを置換。全期間なら WHERE 行を削除。
SELECT c.name                                   AS 校舎,
       SUM(d.actual_qty)                         AS 配布枚数,
       COALESCE(SUM(r.responses), 0)             AS 反応数計,
       COALESCE(SUM(r.taiken), 0)                AS 体験申込,
       ROUND(100.0 * COALESCE(SUM(r.taiken),0)
             / NULLIF(SUM(d.actual_qty),0), 3)   AS 体験申込率_pct
FROM distribution d
JOIN campus c ON c.id = d.campus_id
LEFT JOIN (
  SELECT distribution_id,
         SUM(count)                                          AS responses,
         SUM(CASE WHEN channel='体験申込' THEN count ELSE 0 END) AS taiken
  FROM response
  GROUP BY distribution_id
) r ON r.distribution_id = d.id
WHERE d.date BETWEEN '2026-03-01' AND '2026-05-31'
GROUP BY c.name
ORDER BY 体験申込率_pct DESC;
