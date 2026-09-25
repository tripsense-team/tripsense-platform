CREATE INDEX user_profiles_public_name_prefix_idx
  ON user_profiles (lower(display_name) text_pattern_ops)
  WHERE display_name IS NOT NULL;
