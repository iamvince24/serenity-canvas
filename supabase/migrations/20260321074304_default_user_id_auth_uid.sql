ALTER TABLE boards ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE nodes  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE edges  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE groups ALTER COLUMN user_id SET DEFAULT auth.uid();
