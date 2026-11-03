import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('schema and seed cover the core workflows', () => {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  const seed = readFileSync(new URL('./seed.sql', import.meta.url), 'utf8');
  for (const table of ['employees', 'goal_templates', 'indicators', 'review_cycles', 'evaluations', 'nte_notices', 'improvement_plans']) {
    assert.match(schema, new RegExp(`CREATE TABLE ${table}\\s*\\(`, 'i'));
  }
  assert.match(seed, /INSERT INTO employees/i);
  assert.match(seed, /ON CONFLICT/i);
});
