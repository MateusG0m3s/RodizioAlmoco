import test from 'node:test';
import assert from 'node:assert/strict';
import { getInitials, getShortName } from '../src/utils/nameUtils.js';

test('iniciais usam primeiro e último nome e não colidem na equipe atual', () => {
  const team = [
    'Mateus de Oliveira Silva',
    'Mateus Augusto Santos Gomes',
    'Monique Aparecida Hilleshein',
    'Samara Revoredo'
  ];
  const initials = team.map(getInitials);
  assert.deepEqual(initials, ['MS', 'MG', 'MH', 'SR']);
  assert.equal(new Set(initials).size, team.length);
});

test('iniciais lidam com nome único, espaços extras e vazio', () => {
  assert.equal(getInitials('Samara'), 'SA');
  assert.equal(getInitials('  ana   paula  '), 'AP');
  assert.equal(getInitials(''), '?');
  assert.equal(getInitials(undefined), '?');
});

test('nome curto mantém primeiro e último nome', () => {
  assert.equal(getShortName('Monique Aparecida Hilleshein'), 'Monique Hilleshein');
  assert.equal(getShortName('Samara Revoredo'), 'Samara Revoredo');
  assert.equal(getShortName('Samara'), 'Samara');
});
