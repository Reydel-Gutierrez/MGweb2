require('dotenv').config();
const assert = require('assert');
const http = require('http');
const express = require('express');
const { isAllowedType, maxUploadBytes } = require('../ops/storage');
const { hasBuildingAccess } = require('../ops/access');
const { expandOccurrences } = require('../ops/scheduleExpand');

assert.strictEqual(isAllowedType('image/jpeg'), true);
assert.strictEqual(isAllowedType('application/pdf'), false);
assert.strictEqual(isAllowedType('text/plain'), false);
assert.ok(maxUploadBytes() > 1000);
assert.strictEqual(hasBuildingAccess(['a', 'b'], 'b'), true);
assert.strictEqual(hasBuildingAccess(['a'], 'z'), false);

console.log('ops helper checks passed');

async function httpJson(port, method, path, { cookie, body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: Object.assign(
          {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
            ...(payload ? { 'Content-Length': payload.length } : {}),
          },
          headers || {}
        ),
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = raw ? JSON.parse(raw) : {};
          } catch (e) {
            json = { raw };
          }
          resolve({ status: res.statusCode, json, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function httpForm(port, path, cookie, fields, files) {
  const boundary = '----MgOpsTest' + Date.now();
  const parts = [];
  Object.keys(fields || {}).forEach((key) => {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${fields[key]}\r\n`
    );
  });
  (files || []).forEach((file) => {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`
    );
    parts.push(file.body);
    parts.push('\r\n');
  });
  parts.push(`--${boundary}--\r\n`);
  const body = Buffer.concat(
    parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p)))
  );
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = raw ? JSON.parse(raw) : {};
          } catch (e) {
            json = { raw };
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runDbHttpTests() {
  if (!process.env.MONGODB_URI) {
    console.log('Skipping DB/HTTP tests (MONGODB_URI not set)');
    return;
  }
  if (!process.env.MG_SESSION_SECRET) {
    console.log('Skipping HTTP auth tests (MG_SESSION_SECRET not set)');
    return;
  }

  const { User } = require('../db/db');
  const {
    ClientOrg,
    Building,
    ClientBuildingAccess,
    RecurringSchedule,
    ScheduleException,
    DocumentationEntry,
    DocumentationPhoto,
  } = require('../ops/models');
  const {
    createAdminSessionToken,
    createPortalSessionToken,
    COOKIE_NAME,
    PORTAL_COOKIE_NAME,
  } = require('../comms/adminAuth');

  const stamp = Date.now().toString(36);
  const ids = {
    admin: `ops-test-admin-${stamp}`,
    emp: `ops-test-emp-${stamp}`,
    clientA: `ops-test-ca-${stamp}`,
    clientB: `ops-test-cb-${stamp}`,
  };

  const created = { users: [], orgs: [], buildings: [], access: [], schedules: [], entries: [] };

  const app = express();
  app.use(express.json());
  app.use('/api/ops', require('../ops'));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;

  try {
    const orgA = await ClientOrg.create({ name: `OpsTest A ${stamp}` });
    const orgB = await ClientOrg.create({ name: `OpsTest B ${stamp}` });
    created.orgs.push(orgA._id, orgB._id);
    const bA = await Building.create({
      name: `SiteA ${stamp}`,
      clientOrgId: orgA._id,
      address: '1 Test St',
    });
    const bB = await Building.create({
      name: `SiteB ${stamp}`,
      clientOrgId: orgB._id,
      address: '2 Test St',
    });
    created.buildings.push(bA._id, bB._id);

    const admin = await User.create({
      fullName: 'Ops Test Admin',
      idNumber: ids.admin,
      email: `${ids.admin}@example.test`,
      username: ids.admin,
      password: 'test-pass',
      admin: true,
      role: 'admin',
    });
    const emp = await User.create({
      fullName: 'Ops Test Employee',
      idNumber: ids.emp,
      email: `${ids.emp}@example.test`,
      username: ids.emp,
      password: 'test-pass',
      admin: false,
      role: 'employee',
    });
    const clientA = await User.create({
      fullName: 'Ops Test Client A',
      idNumber: ids.clientA,
      email: `${ids.clientA}@example.test`,
      username: ids.clientA,
      password: 'test-pass',
      admin: false,
      role: 'client',
      clientOrgId: orgA._id,
    });
    const clientB = await User.create({
      fullName: 'Ops Test Client B',
      idNumber: ids.clientB,
      email: `${ids.clientB}@example.test`,
      username: ids.clientB,
      password: 'test-pass',
      admin: false,
      role: 'client',
      clientOrgId: orgB._id,
    });
    created.users.push(admin._id, emp._id, clientA._id, clientB._id);
    const accA = await ClientBuildingAccess.create({ userId: clientA._id, buildingId: bA._id });
    const accB = await ClientBuildingAccess.create({ userId: clientB._id, buildingId: bB._id });
    created.access.push(accA._id, accB._id);

    const schedule = await RecurringSchedule.create({
      kind: 'recurring',
      employeeId: emp._id,
      buildingId: bA._id,
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '18:00',
      endTime: '23:00',
      effectiveStartDate: '2026-08-17',
      createdBy: ids.admin,
    });
    created.schedules.push(schedule._id);
    await ScheduleException.create({
      scheduleId: schedule._id,
      date: '2026-08-19',
      type: 'skip',
      createdBy: ids.admin,
    });

    const occs = expandOccurrences(
      [schedule.toObject()],
      [{ scheduleId: schedule._id, date: '2026-08-19', type: 'skip' }],
      '2026-08-17',
      '2026-08-21',
      {}
    );
    assert.strictEqual(occs.length, 4);

    const entry = await DocumentationEntry.create({
      buildingId: bA._id,
      uploadedBy: emp._id,
      note: 'test note',
      photoCount: 0,
    });
    created.entries.push(entry._id);

    const adminCookie = `${COOKIE_NAME}=${encodeURIComponent(createAdminSessionToken(ids.admin))}`;
    const empCookie = `${PORTAL_COOKIE_NAME}=${encodeURIComponent(createPortalSessionToken(ids.emp, 'employee'))}`;
    const clientACookie = `${PORTAL_COOKIE_NAME}=${encodeURIComponent(createPortalSessionToken(ids.clientA, 'client'))}`;
    const clientBCookie = `${PORTAL_COOKIE_NAME}=${encodeURIComponent(createPortalSessionToken(ids.clientB, 'client'))}`;

    const buildingsAdmin = await httpJson(port, 'GET', '/api/ops/buildings', { cookie: adminCookie });
    assert.strictEqual(buildingsAdmin.status, 200);
    assert.ok(buildingsAdmin.json.some((b) => String(b.id) === String(bA._id)));

    const clientBuildings = await httpJson(port, 'GET', '/api/ops/client/buildings', {
      cookie: clientACookie,
    });
    assert.strictEqual(clientBuildings.status, 200);
    assert.strictEqual(clientBuildings.json.length, 1);
    assert.strictEqual(String(clientBuildings.json[0].id), String(bA._id));

    const forbiddenOcc = await httpJson(
      port,
      'GET',
      `/api/ops/client/occurrences?from=2026-08-17&to=2026-08-21&buildingId=${bB._id}`,
      { cookie: clientACookie }
    );
    assert.strictEqual(forbiddenOcc.status, 403);

    const forbiddenDocs = await httpJson(
      port,
      'GET',
      `/api/ops/client/documentation?buildingId=${bB._id}`,
      { cookie: clientACookie }
    );
    assert.strictEqual(forbiddenDocs.status, 403);

    const allowedOcc = await httpJson(
      port,
      'GET',
      `/api/ops/client/occurrences?from=2026-08-17&to=2026-08-21`,
      { cookie: clientACookie }
    );
    assert.strictEqual(allowedOcc.status, 200);
    assert.ok(allowedOcc.json.every((o) => String(o.buildingId) === String(bA._id)));
    assert.ok(!JSON.stringify(allowedOcc.json).includes('adminNote') || allowedOcc.json.every((o) => o.adminNote == null));

    const otherClient = await httpJson(
      port,
      'GET',
      `/api/ops/client/occurrences?from=2026-08-17&to=2026-08-21`,
      { cookie: clientBCookie }
    );
    assert.strictEqual(otherClient.status, 200);
    assert.ok(otherClient.json.every((o) => String(o.buildingId) !== String(bA._id)));

    const empOcc = await httpJson(
      port,
      'GET',
      `/api/ops/my/occurrences?from=2026-08-17&to=2026-08-21`,
      { cookie: empCookie }
    );
    assert.strictEqual(empOcc.status, 200);
    assert.ok(empOcc.json.every((o) => String(o.employeeId) === String(emp._id)));

    const empAdminBuildings = await httpJson(port, 'GET', '/api/ops/buildings', { cookie: empCookie });
    assert.strictEqual(empAdminBuildings.status, 403);

    const clientAdmin = await httpJson(port, 'GET', '/api/ops/buildings', { cookie: clientACookie });
    assert.strictEqual(clientAdmin.status, 403);

    const noAuth = await httpJson(port, 'GET', '/api/ops/buildings');
    assert.strictEqual(noAuth.status, 401);

    const badCookie = await httpJson(port, 'GET', '/api/ops/buildings', {
      cookie: 'mg_admin_session=not-a-valid.token',
    });
    assert.strictEqual(badCookie.status, 401);

    const badUpload = await httpForm(
      port,
      '/api/ops/documentation',
      empCookie,
      { buildingId: String(bA._id), note: '' },
      [{ filename: 'note.txt', type: 'text/plain', body: Buffer.from('not an image') }]
    );
    assert.strictEqual(badUpload.status, 400);

    const sharp = require('sharp');
    const jpeg = await sharp({
      create: { width: 12, height: 12, channels: 3, background: '#226688' },
    })
      .jpeg()
      .toBuffer();
    const goodUpload = await httpForm(
      port,
      '/api/ops/documentation',
      empCookie,
      { scheduleId: String(schedule._id), date: '2026-08-17', note: 'hallway' },
      [
        { filename: 'one.jpg', type: 'image/jpeg', body: jpeg },
        { filename: 'two.jpg', type: 'image/jpeg', body: jpeg },
      ]
    );
    assert.strictEqual(goodUpload.status, 201, goodUpload.json.message || JSON.stringify(goodUpload.json));
    assert.strictEqual(goodUpload.json.entry.photoCount, 2);
    assert.strictEqual(String(goodUpload.json.entry.scheduleId), String(schedule._id));
    assert.strictEqual(goodUpload.json.entry.date, '2026-08-17');
    created.entries.push(goodUpload.json.entry.id);

    const missingShiftUpload = await httpForm(
      port,
      '/api/ops/documentation',
      empCookie,
      { note: '' },
      [{ filename: 'one.jpg', type: 'image/jpeg', body: jpeg }]
    );
    assert.strictEqual(missingShiftUpload.status, 400);

    const skippedShiftUpload = await httpForm(
      port,
      '/api/ops/documentation',
      empCookie,
      { scheduleId: String(schedule._id), date: '2026-08-19', note: '' },
      [{ filename: 'one.jpg', type: 'image/jpeg', body: jpeg }]
    );
    assert.strictEqual(skippedShiftUpload.status, 400);

    const adminUpload = await httpForm(
      port,
      '/api/ops/documentation',
      adminCookie,
      { scheduleId: String(schedule._id), date: '2026-08-18', note: 'supervisor walkthrough' },
      [{ filename: 'one.jpg', type: 'image/jpeg', body: jpeg }]
    );
    assert.strictEqual(adminUpload.status, 201, adminUpload.json.message || JSON.stringify(adminUpload.json));
    created.entries.push(adminUpload.json.entry.id);

    const shiftDocs = await httpJson(
      port,
      'GET',
      `/api/ops/shift-documentation?scheduleId=${schedule._id}&date=2026-08-17`,
      { cookie: empCookie }
    );
    assert.strictEqual(shiftDocs.status, 200);
    assert.ok(shiftDocs.json.items.some((item) => String(item.id) === String(goodUpload.json.entry.id)));

    const clientShiftPhotos = await httpJson(
      port,
      'GET',
      `/api/ops/client/documentation?scheduleId=${schedule._id}&date=2026-08-17`,
      { cookie: clientACookie }
    );
    assert.strictEqual(clientShiftPhotos.status, 200);
    assert.ok(clientShiftPhotos.json.items.some((item) => String(item.id) === String(goodUpload.json.entry.id)));

    const clientWrongShift = await httpJson(
      port,
      'GET',
      `/api/ops/client/documentation?scheduleId=${schedule._id}&date=2026-08-17`,
      { cookie: clientBCookie }
    );
    assert.strictEqual(clientWrongShift.status, 403);

    const occsWithPhotos = await httpJson(
      port,
      'GET',
      `/api/ops/client/occurrences?from=2026-08-17&to=2026-08-21`,
      { cookie: clientACookie }
    );
    const monday = occsWithPhotos.json.find((o) => o.date === '2026-08-17');
    assert.ok(monday);
    assert.ok(monday.photoCount >= 2);

    const staffShifts = await httpJson(port, 'GET', '/api/ops/shifts?from=2026-08-17&to=2026-08-18', {
      cookie: empCookie,
    });
    assert.strictEqual(staffShifts.status, 200);
    assert.ok(staffShifts.json.some((o) => String(o.scheduleId) === String(schedule._id)));

    const clientPhotos = await httpJson(port, 'GET', '/api/ops/client/documentation', {
      cookie: clientACookie,
    });
    assert.strictEqual(clientPhotos.status, 200);
    assert.ok(clientPhotos.json.items.some((item) => String(item.id) === String(goodUpload.json.entry.id)));

    const otherPhotos = await httpJson(port, 'GET', '/api/ops/client/documentation', {
      cookie: clientBCookie,
    });
    assert.strictEqual(otherPhotos.status, 200);
    assert.ok(!otherPhotos.json.items.some((item) => String(item.buildingId) === String(bA._id)));

    const photoId = goodUpload.json.entry.photos[0].id;
    const stolen = await httpJson(port, 'GET', `/api/ops/photos/${photoId}/file`, {
      cookie: clientBCookie,
    });
    assert.strictEqual(stolen.status, 403);

    const ownPhoto = await httpJson(port, 'GET', `/api/ops/photos/${photoId}/file?variant=thumb`, {
      cookie: clientACookie,
    });
    assert.strictEqual(ownPhoto.status, 200);

    const noAuthDl = await httpJson(port, 'GET', `/api/ops/photos/${photoId}/file?download=1`);
    assert.strictEqual(noAuthDl.status, 401);

    const clientDl = await httpJson(port, 'GET', `/api/ops/photos/${photoId}/file?download=1`, {
      cookie: clientACookie,
    });
    assert.strictEqual(clientDl.status, 200);
    assert.ok(
      String((clientDl.headers && clientDl.headers['content-disposition']) || '')
        .toLowerCase()
        .includes('attachment')
    );

    const stolenDl = await httpJson(port, 'GET', `/api/ops/photos/${photoId}/file?download=1`, {
      cookie: clientBCookie,
    });
    assert.strictEqual(stolenDl.status, 403);

    const empDl = await httpJson(port, 'GET', `/api/ops/photos/${photoId}/file?download=1`, {
      cookie: empCookie,
    });
    assert.strictEqual(empDl.status, 200);

    const photoDoc = await DocumentationPhoto.findById(photoId);
    const retainDays = (photoDoc.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    assert.ok(retainDays > 29 && retainDays < 31, 'uploaded photos should expire in about 30 days');

    await DocumentationPhoto.updateMany(
      { entryId: goodUpload.json.entry.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    const { expireDuePhotos } = require('../ops/expirePhotos');
    await expireDuePhotos();
    const expiredDoc = await DocumentationPhoto.findById(photoId);
    assert.strictEqual(expiredDoc.expired, true);
    assert.strictEqual(expiredDoc.storageKey, '');
    const entryKept = await DocumentationEntry.findById(goodUpload.json.entry.id);
    assert.ok(entryKept);
    assert.strictEqual(entryKept.note, 'hallway');
    assert.strictEqual(entryKept.photoCount, 2);
    assert.strictEqual(entryKept.photosExpired, true);

    const expiredDl = await httpJson(port, 'GET', `/api/ops/photos/${photoId}/file?download=1`, {
      cookie: clientACookie,
    });
    assert.strictEqual(expiredDl.status, 410);

    const listedExpired = await httpJson(port, 'GET', '/api/ops/client/documentation', {
      cookie: clientACookie,
    });
    const listedEntry = listedExpired.json.items.find(
      (item) => String(item.id) === String(goodUpload.json.entry.id)
    );
    assert.ok(listedEntry);
    assert.strictEqual(listedEntry.photosExpired, true);
    assert.ok(!listedEntry.photos.some((p) => p.downloadUrl || p.thumbUrl));

    await ClientBuildingAccess.deleteMany({ userId: clientA._id });
    const bA2 = await Building.create({
      name: `SiteA-extra ${stamp}`,
      clientOrgId: orgA._id,
      address: '9 Extra',
    });
    created.buildings.push(bA2._id);

    const clientOpen = await User.create({
      fullName: 'Ops Test Client Open',
      idNumber: `ops-test-client-open-${stamp}`,
      email: `ops-test-client-open-${stamp}@example.test`,
      username: `ops-test-client-open-${stamp}`,
      password: 'test-pass',
      admin: false,
      role: 'client',
      clientOrgId: orgA._id,
    });
    created.users.push(clientOpen._id);
    const openCookie = `${PORTAL_COOKIE_NAME}=${encodeURIComponent(
      createPortalSessionToken(clientOpen.username, 'client')
    )}`;
    const openBuildings = await httpJson(port, 'GET', '/api/ops/client/buildings', {
      cookie: openCookie,
    });
    assert.strictEqual(openBuildings.status, 200);
    const openIds = openBuildings.json.map((b) => String(b.id));
    assert.ok(openIds.includes(String(bA._id)), 'client with no access rows should see org buildings');
    assert.ok(openIds.includes(String(bA2._id)));
    const openOcc = await httpJson(
      port,
      'GET',
      '/api/ops/client/occurrences?from=2026-08-17&to=2026-08-21',
      { cookie: openCookie }
    );
    assert.strictEqual(openOcc.status, 200);
    assert.ok(openOcc.json.some((o) => String(o.buildingId) === String(bA._id)));

    const accA2 = await ClientBuildingAccess.create({ userId: clientA._id, buildingId: bA2._id });
    created.access.push(accA2._id);
    const afterRestrict = await httpJson(port, 'GET', '/api/ops/client/documentation', {
      cookie: clientACookie,
    });
    assert.strictEqual(afterRestrict.status, 200);
    assert.ok(!afterRestrict.json.items.some((item) => String(item.buildingId) === String(bA._id)));
    const afterRestrictFile = await httpJson(port, 'GET', `/api/ops/photos/${photoId}/file?download=1`, {
      cookie: clientACookie,
    });
    assert.ok(afterRestrictFile.status === 403 || afterRestrictFile.status === 410);

    const overnightHttp = await httpJson(port, 'POST', '/api/ops/schedules', {
      cookie: adminCookie,
      body: {
        kind: 'recurring',
        employeeId: String(emp._id),
        buildingId: String(bA._id),
        daysOfWeek: [6, 0],
        startTime: '22:00',
        endTime: '06:00',
        effectiveStartDate: '2026-08-22',
      },
    });
    assert.strictEqual(overnightHttp.status, 201, overnightHttp.json.message);
    created.schedules.push(overnightHttp.json.id);
    const overnightOcc = await httpJson(
      port,
      'GET',
      '/api/ops/occurrences?from=2026-08-22&to=2026-08-23',
      { cookie: adminCookie }
    );
    assert.strictEqual(overnightOcc.status, 200);
    const nightRow = overnightOcc.json.find(
      (o) => String(o.scheduleId) === String(overnightHttp.json.id) && o.date === '2026-08-22'
    );
    assert.ok(nightRow);
    assert.strictEqual(nightRow.endsNextDay, true);

    const historySched = await RecurringSchedule.create({
      kind: 'recurring',
      employeeId: emp._id,
      buildingId: bA._id,
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '18:00',
      endTime: '23:00',
      effectiveStartDate: '2026-01-05',
      createdBy: ids.admin,
    });
    created.schedules.push(historySched._id);
    const patched = await httpJson(port, 'PATCH', `/api/ops/schedules/${historySched._id}`, {
      cookie: adminCookie,
      body: {
        kind: 'recurring',
        employeeId: String(emp._id),
        buildingId: String(bA._id),
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '19:00',
        endTime: '23:00',
        effectiveStartDate: '2026-01-05',
      },
    });
    assert.strictEqual(patched.status, 200, patched.json.message);
    if (patched.json.id) created.schedules.push(patched.json.id);
    const closed = await RecurringSchedule.findById(historySched._id);
    assert.strictEqual(closed.startTime, '18:00');
    assert.ok(closed.effectiveEndDate);

    const schedHttp = await httpJson(port, 'POST', '/api/ops/schedules', {
      cookie: adminCookie,
      body: {
        kind: 'recurring',
        employeeId: String(emp._id),
        buildingId: String(bA._id),
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '06:00',
        endTime: '11:00',
        effectiveStartDate: '2026-08-17',
        adminNote: 'internal only',
      },
    });
    assert.strictEqual(schedHttp.status, 201, schedHttp.json.message);
    created.schedules.push(schedHttp.json.id);
    const exHttp = await httpJson(port, 'POST', `/api/ops/schedules/${schedHttp.json.id}/exceptions`, {
      cookie: adminCookie,
      body: { date: '2026-08-18', type: 'skip', note: 'off' },
    });
    assert.strictEqual(exHttp.status, 201);

    const createdBuilding = await httpJson(port, 'POST', '/api/ops/buildings', {
      cookie: adminCookie,
      body: { name: `SiteA2 ${stamp}`, clientOrgId: String(orgA._id), address: '3 Test' },
    });
    assert.strictEqual(createdBuilding.status, 201);
    created.buildings.push(createdBuilding.json.id);

    const deletedBuilding = await httpJson(port, 'DELETE', `/api/ops/buildings/${createdBuilding.json.id}`, {
      cookie: adminCookie,
    });
    assert.strictEqual(deletedBuilding.status, 200, deletedBuilding.json.message);
    assert.strictEqual(await Building.findById(createdBuilding.json.id), null);

    const empCannotDelete = await httpJson(port, 'DELETE', `/api/ops/buildings/${bA._id}`, {
      cookie: empCookie,
    });
    assert.strictEqual(empCannotDelete.status, 403);

    const throwawayOrg = await httpJson(port, 'POST', '/api/ops/clients', {
      cookie: adminCookie,
      body: { name: `DeleteMe ${stamp}` },
    });
    assert.strictEqual(throwawayOrg.status, 201);
    const throwawayBuilding = await httpJson(port, 'POST', '/api/ops/buildings', {
      cookie: adminCookie,
      body: { name: `DeleteMeSite ${stamp}`, clientOrgId: throwawayOrg.json.id, address: '4 Test' },
    });
    assert.strictEqual(throwawayBuilding.status, 201);
    const deletedClient = await httpJson(port, 'DELETE', `/api/ops/clients/${throwawayOrg.json.id}`, {
      cookie: adminCookie,
    });
    assert.strictEqual(deletedClient.status, 200, deletedClient.json.message);
    assert.strictEqual(await ClientOrg.findById(throwawayOrg.json.id), null);
    assert.strictEqual(await Building.findById(throwawayBuilding.json.id), null);

    console.log('ops DB/HTTP authorization tests passed');
  } finally {
    const photos = await DocumentationPhoto.find({ entryId: { $in: created.entries } });
    const storage = require('../ops/storage');
    for (const photo of photos) {
      await storage.deleteObject(photo.storageKey);
      await storage.deleteObject(photo.thumbKey);
    }
    await DocumentationPhoto.deleteMany({ entryId: { $in: created.entries } });
    await DocumentationEntry.deleteMany({ _id: { $in: created.entries } });
    await RecurringSchedule.deleteMany({ _id: { $in: created.schedules } });
    await ScheduleException.deleteMany({ scheduleId: { $in: created.schedules } });
    await ClientBuildingAccess.deleteMany({ _id: { $in: created.access } });
    await Building.deleteMany({ _id: { $in: created.buildings } });
    await ClientOrg.deleteMany({ _id: { $in: created.orgs } });
    await User.deleteMany({ _id: { $in: created.users } });
    await new Promise((resolve) => server.close(resolve));
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  }
}

runDbHttpTests()
  .then(() => {
    console.log('scripts/test-ops-module.js passed');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
