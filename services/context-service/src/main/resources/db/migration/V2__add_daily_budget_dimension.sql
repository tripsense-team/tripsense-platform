INSERT INTO preference_dimensions (code, cardinality, sensitivity_class)
VALUES ('DAILY_BUDGET_VND', 'SINGLE', 'STANDARD')
ON CONFLICT (code) DO NOTHING;
