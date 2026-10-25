import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoProfile } from '../src/data/demo.ts';
import { validSocialLink, emptySocialLinks } from '../src/lib/social.ts';
import { galleryErrors, moveGalleryPicture } from '../src/lib/gallery.ts';
import { publicSnapshot, validateForPublish } from '../src/lib/profile.ts';
import { createLocalRepository, LOCAL_WORKSPACE_KEY } from '../src/lib/localRepository.ts';
const picture = (id: string) => ({
  id,
  src: 'data:image/webp;base64,UklGRg==',
  caption: `Work ${id}`,
});
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test('social links accept only matching HTTPS platforms and reject lookalikes, unsafe schemes and credentials', () => {
  for (const link of [
    '',
    'https://facebook.com/demo',
    'https://www.facebook.com/profile.php?id=123',
    'https://m.facebook.com/demo',
    'https://fb.com/demo',
  ])
    assert.equal(validSocialLink('facebook', link), true, link);
  for (const link of ['https://threads.com/@demo', 'https://www.threads.net/@demo'])
    assert.equal(validSocialLink('threads', link), true);
  assert.equal(validSocialLink('instagram', 'https://www.instagram.com/demo/?ref=profile'), true);
  for (const link of [
    'javascript:alert(1)',
    'data:text/html,hi',
    'http://facebook.com/demo',
    'https://facebook.com.evil.invalid/a',
    'https://facebook.com@evil.invalid/a',
    'https://me:password@facebook.com/a',
    'https://%66acebook.com/a',
    'https://facebook.com:444/a',
    'https://facebook.com\\@evil.invalid/a',
    'https://facebook.com/a b',
    'https://facebook.com/\na',
    'https://instagram.com/demo',
  ])
    assert.equal(validSocialLink('facebook', link), false, link);
  assert.equal(validSocialLink('threads', 'https://threads.com/' + 'a'.repeat(500)), false);
});
test('gallery permits zero to eight bounded pictures and validates identifiers, media and captions', () => {
  assert.deepEqual(galleryErrors([]), []);
  const eight = Array.from({ length: 8 }, (_, i) => picture(String(i)));
  assert.deepEqual(galleryErrors(eight), []);
  for (const bad of [
    null,
    [...eight, picture('9')],
    [picture('same'), picture('same')],
    [{ ...picture('1'), src: 'https://example.invalid/personal.jpg' }],
    [{ ...picture('1'), src: 'data:image/svg+xml;base64,AAAA' }],
    [{ ...picture('1'), src: 'data:image/webp;base64,' + 'A'.repeat(120000) }],
    [{ ...picture('1'), caption: 'a'.repeat(141) }],
    [null],
  ])
    assert.ok(galleryErrors(bad).length);
  const reordered = moveGalleryPicture(eight, 2, -1);
  assert.deepEqual(
    reordered.slice(0, 2).map((p) => p.id),
    ['0', '2'],
  );
  assert.equal(eight[1].id, '1');
  assert.deepEqual(moveGalleryPicture(eight, 0, -1), eight);
});
test('legacy profiles receive empty socials/gallery and public projection excludes private media metadata', async () => {
  const s = storage();
  const { social, gallery, ...legacy } = demoProfile();
  s.setItem(
    LOCAL_WORKSPACE_KEY,
    JSON.stringify({
      draft: legacy,
      published: legacy,
      revision: 2,
      savedAt: 'saved',
      publishedAt: 'published',
    }),
  );
  const w = await createLocalRepository(s).load();
  assert.deepEqual(w.draft.social, emptySocialLinks());
  assert.deepEqual(w.published?.gallery, []);
  assert.equal(w.revision, 2);
  const p = {
    ...demoProfile(),
    social: {
      ...emptySocialLinks(),
      facebook: 'https://facebook.com/demo',
      privateToken: 'hidden',
    },
    gallery: [{ ...picture('one'), originalFilename: 'private-local-file.jpg' }],
  };
  const snapshot = publicSnapshot(p);
  assert.equal('privateToken' in snapshot.social, false);
  assert.equal('originalFilename' in snapshot.gallery[0], false);
  assert.equal(snapshot.social.facebook, p.social.facebook);
});
test('gallery/social edits, ordering and removals stay drafts until publication; invalid ninth upload cannot replace saved data', async () => {
  const s = storage(),
    r = createLocalRepository(s);
  const p = {
    ...demoProfile(),
    social: { ...emptySocialLinks(), instagram: 'https://instagram.com/demo' },
    gallery: Array.from({ length: 8 }, (_, i) => picture(String(i))),
  };
  let w = await r.publish(p, 0);
  const reordered = moveGalleryPicture(w.draft.gallery, 2, -1);
  w = await r.save({ ...w.draft, gallery: reordered, social: emptySocialLinks() }, w.revision);
  assert.equal((await r.load()).draft.gallery[1].id, '2');
  assert.equal((await r.getPublic(p.slug))?.profile.gallery[1].id, '1');
  assert.equal((await r.getPublic(p.slug))?.profile.social.instagram, p.social.instagram);
  const before = s.getItem(LOCAL_WORKSPACE_KEY);
  await assert.rejects(
    r.publish({ ...w.draft, gallery: [...w.draft.gallery, picture('9')] }, w.revision),
    /8 pictures/,
  );
  assert.equal(s.getItem(LOCAL_WORKSPACE_KEY), before);
  assert.ok(
    validateForPublish({ ...p, social: { ...p.social, facebook: 'javascript:alert(1)' } }).length,
  );
  w = await r.publish({ ...w.draft, gallery: [] }, w.revision);
  assert.deepEqual((await r.getPublic(p.slug))?.profile.gallery, []);
  assert.equal((await r.listPublic())[0].profile.social.instagram, '');
  await r.unpublish(w.revision);
  assert.equal(await r.getPublic(p.slug), null);
});
