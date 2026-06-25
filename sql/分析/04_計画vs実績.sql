-- 校舎別: 計画枚数 → 実績枚数 と達成率（向き=計画→実績）
SELECT c.name                                       AS 校舎,
       SUM(d.planned_qty)                            AS 計画枚数,
       SUM(d.actual_qty)                             AS 実績枚数,
       SUM(d.actual_qty) - SUM(d.planned_qty)        AS 差,
       ROUND(100.0 * SUM(d.actual_qty)
             / NULLIF(SUM(d.planned_qty),0), 1)      AS 達成率_pct
FROM distribution d
JOIN campus c ON c.id = d.campus_id
GROUP BY c.name
ORDER BY 達成率_pct;
