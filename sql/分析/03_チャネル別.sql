-- 校舎×チャネル別の反応数（体験申込 / 問い合わせ / 入塾 など）
SELECT c.name      AS 校舎,
       r.channel   AS チャネル,
       SUM(r.count) AS 反応数
FROM response r
JOIN distribution d ON d.id = r.distribution_id
JOIN campus c       ON c.id = d.campus_id
GROUP BY c.name, r.channel
ORDER BY c.name, 反応数 DESC;
