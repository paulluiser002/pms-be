import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('./seed.sql', import.meta.url), 'utf8');
const tables = [
  'companies', 'departments', 'employees', 'reporting_lines', 'roles', 'users', 'user_roles',
  'audit_events', 'goals', 'goal_milestones', 'goal_updates', 'goal_templates',
  'goal_template_versions', 'indicators', 'indicator_matrices', 'behavioral_templates',
  'behavioral_template_versions', 'behavioral_questions', 'review_cycles', 'cycle_stages',
  'evaluations', 'evaluator_assignments', 'evaluation_history', 'indicator_results',
  'accomplishment_submissions', 'behavioral_assessments', 'behavioral_responses',
  'journal_entries', 'evidence_files', 'nte_notices', 'nte_evidence', 'nte_responses',
  'nte_history', 'improvement_plans', 'improvement_plan_sources', 'improvement_plan_exclusions',
  'improvement_plan_weeks', 'improvement_week_submissions', 'improvement_week_assessments',
  'improvement_plan_history', 'notifications',
];

test('draft schema covers legacy PMS records and seed remains transactional', () => {
  for (const table of tables) {
    assert.match(schema, new RegExp(`CREATE TABLE ${table}\\s*\\(`, 'i'), table);
    assert.match(seed, new RegExp(`INSERT INTO ${table}\\s*\\(`, 'i'), `seed ${table}`);
  }
  assert.match(schema, /BEGIN;/);
  assert.match(seed, /BEGIN;/);
  assert.match(seed, /COMMIT;\s*$/);
});

test('PostgreSQL accepts complete scenarios, preserves reruns, and rejects invalid records', {
  skip: process.env.PMS_DATABASE_TEST !== '1' && 'Set PMS_DATABASE_TEST=1 against a disposable PostgreSQL database',
}, () => {
  const namespace = `pms_test_${process.pid}`;
  const sql = (query) => execFileSync('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const scoped = (query) => sql(`SET search_path TO ${namespace};\n${query}`);
  const reject = (query, constraint) => assert.throws(() => scoped(query), (error) => {
    assert.match(String(error.stderr), new RegExp(constraint));
    return true;
  });
  sql(`CREATE SCHEMA ${namespace}`);
  try {
    scoped(schema);
    scoped(seed);
    const digest = () => scoped(`SELECT md5(string_agg(row_data, '' ORDER BY row_data)) FROM (${tables.map((table) => `SELECT '${table}' || row_to_json(t)::text AS row_data FROM ${table} t`).join(' UNION ALL ')}) records`);
    const first = digest();
    scoped(seed);
    assert.equal(digest(), first, 'rerun changes no seeded row or timestamp');
    for (const table of tables) assert.ok(Number(scoped(`SELECT count(*) FROM ${table}`)) > 0, `${table} contains fixtures`);
    assert.equal(scoped("SELECT string_agg(code, ',' ORDER BY code) FROM roles"), 'employee,hr_admin,manager,system_admin');
    assert.equal(scoped("SELECT count(DISTINCT status) FROM nte_notices"), '5');
    assert.equal(scoped("SELECT count(DISTINCT status) FROM review_cycles"), '4');
    assert.equal(scoped("SELECT count(DISTINCT status) FROM improvement_plans"), '7');
    assert.equal(scoped("SELECT count(*) FROM nte_notices WHERE status = 'Draft' AND issued_at IS NOT NULL"), '0');
    assert.equal(scoped("SELECT count(*) FROM nte_notices WHERE early_closure_reason IS NOT NULL"), '1');
    assert.ok(Number(scoped('SELECT count(*) FROM improvement_week_submissions WHERE revision > 1')) > 0);
    assert.ok(Number(scoped('SELECT count(*) FROM accomplishment_submissions WHERE revision > 1')) > 0);
    assert.ok(Number(scoped('SELECT count(*) FROM improvement_plan_sources GROUP BY plan_id HAVING count(*) > 1 LIMIT 1')) > 1);
    assert.ok(Number(scoped('SELECT count(*) FROM indicator_matrices WHERE scoring_enabled')) > 0);
    assert.ok(Number(scoped('SELECT count(*) FROM behavioral_responses WHERE not_observed')) > 0);
    reject("UPDATE goals SET progress = 101", 'goals_progress_check');
    reject("UPDATE improvement_plan_weeks SET ends_on = starts_on + 5", 'improvement_plan_weeks_period_check');
    reject("UPDATE nte_notices SET status = 'Unexpected' WHERE status = 'Issued'", 'nte_notices_status_check');
    reject("UPDATE employees SET department_id = (SELECT id FROM departments WHERE company_id <> '00000000-0000-0000-0000-000000000001' LIMIT 1) WHERE company_id = '00000000-0000-0000-0000-000000000001'", 'employees_department_company_fkey');
    reject("UPDATE improvement_plans SET closure_note = NULL WHERE status = 'Completed'", 'improvement_plans_closure_check');
    reject("UPDATE nte_notices SET closure_note = NULL WHERE status = 'Closed'", 'nte_notices_closure_check');
    reject("UPDATE behavioral_responses SET score = 6 WHERE NOT not_observed AND score IS NOT NULL", 'behavioral_responses_score_check');
    reject("UPDATE evaluator_assignments SET evaluator_id = employee_id WHERE evaluator_type = 'Manager'", 'evaluator_assignments_self_check');
    reject("UPDATE improvement_plan_weeks SET follow_up_for = id", 'improvement_plan_weeks_follow_up_check');
    reject("INSERT INTO behavioral_assessments (id, assignment_id, evaluation_id, evaluator_id, template_version_id, assessment) SELECT 'ffffffff-ffff-ffff-ffff-fffffffffff1', a.id, a.evaluation_id, a.evaluator_id, (SELECT id FROM behavioral_template_versions WHERE version = 2 LIMIT 1), '{}' FROM evaluator_assignments a WHERE NOT EXISTS (SELECT 1 FROM behavioral_assessments b WHERE b.assignment_id = a.id) LIMIT 1", 'behavioral_assessments_evaluation_template_fkey');
    reject("UPDATE evaluator_assignments SET evaluator_type = 'Peer' WHERE evaluator_type = 'Manager'", 'evaluator_assignments_stage_type_fkey');
    reject("UPDATE improvement_week_submissions SET company_id = (SELECT id FROM companies WHERE id <> '00000000-0000-0000-0000-000000000001' LIMIT 1)", 'improvement_week_submissions_plan_company_fkey');
  } finally {
    sql(`DROP SCHEMA ${namespace} CASCADE`);
  }
});
