import fs from 'node:fs';
import { test } from 'node:test';
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

test('Firestore rules protect users, enrolments and academic records', async t => {
  // The demo- project prefix and explicit localhost emulator port ensure
  // this test cannot access the real Firebase project.
  const env = await initializeTestEnvironment({
    projectId: 'demo-ruta-cero-security',
    firestore: {
      host: '127.0.0.1',
      port: 8085,
      rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
    }
  });
  t.after(() => env.cleanup());
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'student'), {
      uid: 'student', email: 'student@example.test', role: 'student', fullName: 'Test'
    });
    await setDoc(doc(db, 'users', 'another'), {
      uid: 'another', email: 'another@example.test', role: 'student'
    });
    await setDoc(doc(db, 'users', 'admin'), {
      uid: 'admin', email: 'info@emyrarthuro.com', role: 'admin'
    });
  });
  const student = env.authenticatedContext('student', { email: 'student@example.test', email_verified: false }).firestore();
  const another = env.authenticatedContext('another', { email: 'another@example.test', email_verified: false }).firestore();
  const admin = env.authenticatedContext('admin', { email: 'info@emyrarthuro.com', email_verified: true }).firestore();
  const unverified = env.authenticatedContext('unverified', { email: 'info@emyrarthuro.com', email_verified: false }).firestore();
  const newUser = env.authenticatedContext('new-student', { email: 'new@example.test', email_verified: false }).firestore();

  await t.test('student can read and update own nonprivileged profile', async () => {
    await assertSucceeds(getDoc(doc(student, 'users', 'student')));
    await assertSucceeds(updateDoc(doc(student, 'users', 'student'), { fullName: 'Updated Test' }));
  });
  await t.test('student cannot assign role admin or super_admin', async () => {
    await assertFails(updateDoc(doc(student, 'users', 'student'), { role: 'admin' }));
    await assertFails(updateDoc(doc(student, 'users', 'student'), { role: 'super_admin' }));
    await assertFails(setDoc(doc(newUser, 'users', 'new-student'), {
      uid: 'new-student', email: 'new@example.test', role: 'admin'
    }));
  });
  await t.test('student can register only its own matching email and role student', async () => {
    await assertFails(setDoc(doc(newUser, 'users', 'new-student'), {
      uid: 'new-student', email: 'someone-else@example.test', role: 'student'
    }));
    await assertSucceeds(setDoc(doc(newUser, 'users', 'new-student'), {
      uid: 'new-student', email: 'new@example.test', role: 'student'
    }));
  });
  await t.test('student cannot rewrite its own email or UID', async () => {
    await assertFails(updateDoc(doc(student, 'users', 'student'), { email: 'info@emyrarthuro.com' }));
    await assertFails(updateDoc(doc(student, 'users', 'student'), { uid: 'admin' }));
  });
  await t.test('student cannot read another student profile', async () => {
    await assertFails(getDoc(doc(student, 'users', 'another')));
    await assertSucceeds(getDoc(doc(another, 'users', 'another')));
  });
  await t.test('verified admin can read student profile; unverified cannot', async () => {
    await assertSucceeds(getDoc(doc(admin, 'users', 'student')));
    await assertFails(getDoc(doc(unverified, 'users', 'student')));
  });
  await t.test('client has no direct write access to private Ruta Cero collections', async () => {
    await assertFails(setDoc(doc(student, 'rutaCeroWorkbooks', 'student'), { fields: { role: 'admin' } }));
    await assertFails(setDoc(doc(student, 'rutaCeroEnrollments', 'student'), { active: true }));
    await assertFails(setDoc(doc(student, 'rutaCeroConversations', 'student', 'agents', 'cerebro-mercado'), {
      messages: [{ role: 'user', content: 'Injected' }]
    }));
    await assertFails(getDoc(doc(another, 'rutaCeroWorkbooks', 'student')));
  });
});
