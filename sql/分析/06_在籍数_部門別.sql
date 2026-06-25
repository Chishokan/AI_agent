-- 在籍数（部門別）の最新スナップショット。
-- 配布/反応は校舎単位のため部門で割れない。部門の粒度はこの在籍数のみ。
SELECT c.name        AS 校舎,
       e.division     AS 部門,
       e.count        AS 在籍,
       e.year_month   AS 年月
FROM enrollment e
JOIN campus c ON c.id = e.campus_id
WHERE e.year_month = (
  SELECT MAX(year_month) FROM enrollment x
  WHERE x.campus_id = e.campus_id AND x.division = e.division
)
ORDER BY c.name, e.division;
