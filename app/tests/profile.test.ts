import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoProfile } from '../src/data/demo.ts';
import { createLocalRepository, LOCAL_WORKSPACE_KEY } from '../src/lib/localRepository.ts';
import { geography, coverageErrors, matchesCoverage } from '../src/lib/geography.ts';
import { publicSnapshot, validateForPublish } from '../src/lib/profile.ts';
import { normalizeMalaysiaWhatsapp } from '../src/lib/whatsappNumber.ts';
import { safeReturnTo } from '../src/lib/safeReturnTo.ts';
import { isRecoveryGrantValid, createRecoveryGrant } from '../src/lib/recoveryGrant.ts';
import { parseAuthCallback, createCallbackCompletion } from '../src/lib/authCallback.ts';
function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}
test('nationwide geography has canonical IDs and no overlapping or duplicate subdivisions', () => {
  assert.equal(geography.length, 16);
  const ids = geography.flatMap((s) => [s.id, ...s.subdivisions.map((d) => d.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    geography.reduce((n, s) => n + s.subdivisions.length, 0),
    160,
  );
  assert.equal(
    matchesCoverage(
      [{ stateId: 'my-07', wholeState: true, subdivisionIds: [] }],
      'my-07',
      'my-07-04',
    ),
    true,
  );
  assert.equal(
    matchesCoverage(
      [{ stateId: 'my-07', wholeState: true, subdivisionIds: [] }],
      'my-07',
      'my-10-01',
    ),
    false,
  );
  const c = [
    { stateId: 'my-07', wholeState: false, subdivisionIds: ['my-07-04'] },
    { stateId: 'my-02', wholeState: true, subdivisionIds: [] },
  ];
  assert.equal(matchesCoverage(c, 'my-07'), true);
  assert.equal(matchesCoverage(c, 'my-07', 'my-07-05'), false);
  assert.equal(matchesCoverage(c, 'my-02', 'my-02-01'), true);
  assert.equal(matchesCoverage(c, 'my-01'), false);
  assert.ok(
    coverageErrors([{ stateId: 'my-07', wholeState: false, subdivisionIds: ['my-02-01'] }]).length,
  );
});
test('publication requires a valid profile, service prices and coverage', () => {
  const p = demoProfile();
  assert.deepEqual(validateForPublish(p), []);
  p.services[0].price = -1;
  assert.ok(validateForPublish(p).length);
  p.services[0].price = null;
  p.services[0].priceBasis = 'quote';
  assert.deepEqual(validateForPublish(p), []);
  p.coverage = [];
  assert.ok(validateForPublish(p).some((e) => e.includes('service area')));
});
test('public projection removes hidden WhatsApp and unknown private fields', () => {
  const p = {
    ...demoProfile(),
    whatsapp: '+60 12 345 6789',
    privateEmail: 'private@example.invalid',
  };
  const snapshot = publicSnapshot(p);
  assert.equal(snapshot.whatsapp, '');
  assert.equal('privateEmail' in snapshot, false);
  p.showWhatsapp = true;
  assert.equal(publicSnapshot(p).whatsapp, '60123456789');
  assert.equal(normalizeMalaysiaWhatsapp('javascript:alert(1)'), null);
  assert.equal(normalizeMalaysiaWhatsapp('+44 12345678'), null);
});
test('draft save is durable and separate from public snapshots; slug replacement and unpublish revoke old URLs', async () => {
  const s = storage(),
    repo = createLocalRepository(s);
  const start = await repo.load();
  assert.equal(await repo.getPublic('aina-demo'), null);
  const p = start.draft;
  const published = await repo.publish(p, start.revision);
  p.name = 'Private draft edit';
  await repo.save(p, published.revision);
  assert.notEqual((await repo.getPublic('aina-demo'))?.profile.name, p.name);
  const reloaded = await createLocalRepository(s).load();
  assert.equal(reloaded.draft.name, p.name);
  reloaded.draft.slug = 'new-link';
  const next = await repo.publish(reloaded.draft, reloaded.revision);
  assert.equal(await repo.getPublic('aina-demo'), null);
  assert.ok(await repo.getPublic('new-link'));
  await repo.unpublish(next.revision);
  assert.equal(await repo.getPublic('new-link'), null);
  assert.equal((await repo.listPublic()).length, 0);
  assert.equal((await repo.load()).draft.slug, 'new-link');
});
test('stale writes and invalid publications do not overwrite a saved workspace', async () => {
  const s = storage(),
    r = createLocalRepository(s);
  const p = (await r.load()).draft;
  await r.save(p, 0);
  await assert.rejects(r.save({ ...p, name: 'stale' }, 0), /another tab/);
  const before = s.getItem(LOCAL_WORKSPACE_KEY);
  await assert.rejects(r.publish({ ...p, slug: '' }, 1));
  assert.equal(s.getItem(LOCAL_WORKSPACE_KEY), before);
});
test('storage failure is reported without pretending the draft was saved', async () => {
  const r = createLocalRepository({
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
  });
  await assert.rejects(r.save(demoProfile(), 0), /quota/);
});
test('auth guards block external return destinations and bind recovery grants to user/time', () => {
  assert.equal(safeReturnTo('//evil.example'), '/dashboard');
  assert.equal(safeReturnTo('/\\evil.example'), '/dashboard');
  assert.equal(safeReturnTo('/dashboard/profile'), '/dashboard/profile');
  const grant = createRecoveryGrant('a', 1000);
  assert.equal(isRecoveryGrantValid(grant, 'b', 1100), false);
  assert.equal(isRecoveryGrantValid(grant, 'a', 1100), true);
  assert.equal(isRecoveryGrantValid(grant, 'a', 700000), false);
});
test('callback parser rejects ambiguous credentials and deduplicates concurrent code exchanges', async () => {
  assert.equal(parseAuthCallback('?code=x&type=signup&token_hash=y', '').kind, 'error');
  let calls = 0;
  const result = { data: { user: { id: 'a' } }, error: null };
  const auth = {
    getUser: async () => result,
    setSession: async () => result,
    verifyOtp: async () => result,
    exchangeCodeForSession: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return result;
    },
  };
  const complete = createCallbackCompletion(parseAuthCallback('?code=ok', ''), auth);
  await Promise.all([complete(), complete()]);
  assert.equal(calls, 1);
});

test('concurrent local writes accept only one revision', async () => {
  const r = createLocalRepository(storage());
  const p = demoProfile();
  const results = await Promise.allSettled([
    r.save(p, 0),
    r.save({ ...p, name: 'second write' }, 0),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});
