WITH ranked_current AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC, id DESC
    ) AS rn
  FROM conversations
  WHERE is_current = 1
)
UPDATE conversations
SET is_current = 0
WHERE id IN (
  SELECT id
  FROM ranked_current
  WHERE rn > 1
);

WITH ranked_plan_versions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, plan_date
      ORDER BY COALESCE(plan_version, 0) ASC, COALESCE(updated_at, created_at) ASC, created_at ASC, id ASC
    ) AS next_plan_version
  FROM conversations
  WHERE COALESCE(conversation_type, 'general') = 'plan'
    AND plan_date IS NOT NULL
    AND plan_version IS NOT NULL
)
UPDATE conversations
SET plan_version = (
  SELECT next_plan_version
  FROM ranked_plan_versions
  WHERE ranked_plan_versions.id = conversations.id
)
WHERE id IN (SELECT id FROM ranked_plan_versions);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique
  ON users(name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_current_unique
  ON conversations(user_id)
  WHERE is_current = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_plan_version_unique
  ON conversations(user_id, plan_date, plan_version)
  WHERE COALESCE(conversation_type, 'general') = 'plan'
    AND plan_date IS NOT NULL
    AND plan_version IS NOT NULL;
