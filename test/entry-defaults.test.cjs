const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Workflow, WorkflowDataProxy, NodeHelpers } = require('n8n-workflow');
const { CareClinic } = require('../dist/nodes/CareClinic/CareClinic.node');
const nodeType = new CareClinic();
const property = (name) => nodeType.description.properties.find((p) => p.name === name);
const legacyDefault = '={{$execution.id}}-{{$itemIndex}}';

function context(overrides = {}) {
	const o = {
		instance: 'install-A',
		workflow: 'workflow-A',
		node: 'node-A',
		execution: '1',
		run: 0,
		item: 0,
		json: {},
		domain: 'symptom',
		...overrides,
	};
	const parameters = { resource: 'entry', operation: 'create', domain: o.domain };
	for (const p of nodeType.description.properties)
		if (p.default !== undefined && parameters[p.name] === undefined) parameters[p.name] = p.default;
	if ('rawKey' in o) parameters.idempotencyKey = o.rawKey;
	if ('additionalFields' in o) parameters.additionalFields = o.additionalFields;
	if ('occurredAt' in o) parameters.occurredAt = o.occurredAt;
	const node = {
		id: o.node,
		name: 'Create',
		type: o.tool ? 'n8n-nodes-careclinic.careClinicTool' : 'n8n-nodes-careclinic.careClinic',
		typeVersion: 1,
		parameters,
		position: [0, 0],
	};
	const workflow = new Workflow({
		id: o.workflow,
		nodes: [node],
		connections: {},
		active: false,
		settings: { timezone: 'America/Toronto' },
		nodeTypes: { getByNameAndVersion: () => nodeType },
	});
	const data = o.data || {
		resultData: { runData: {} },
		executionData: {
			contextData: {},
			nodeExecutionStack: [],
			metadata: {},
			waitingExecution: {},
			waitingExecutionSource: {},
		},
	};
	const input = Array.from({ length: o.item + 1 }, () => ({ json: o.json }));
	const keys = { $execution: { id: o.execution } };
	const resolve = (expr, extra = {}) =>
		workflow.expression.getParameterValue(expr, data, o.run, o.item, node.name, input, 'manual', {
			...keys,
			...extra,
		});
	const toolItem = 'toolArgs' in o ? { json: o.toolArgs } : undefined;
	return {
		getInstanceId: () => o.instance,
		getExecutionId: () => o.execution,
		getWorkflow: () => ({ id: o.workflow }),
		getNode: () => node,
		getItemIndex: () => o.item,
		getInputData: (_index, connection) =>
			connection === 'ai_tool' ? toolItem || { json: {} } : input[o.item],
		evaluateExpression: (expr) => resolve('=' + expr),
		getContext: (type) => NodeHelpers.getContext(data, type, node),
		getWorkflowDataProxy: () =>
			new WorkflowDataProxy(
				workflow,
				data,
				o.run,
				o.item,
				node.name,
				input,
				{},
				'manual',
				keys,
			).getDataProxy(),
		getNodeParameter: (name, fallback, opts) => {
			const value = name.split('.').reduce((value, key) => value?.[key], parameters);
			const raw = value === undefined ? fallback : value;
			return opts?.rawExpressions ? raw : resolve(raw);
		},
		resolve,
		data,
		o,
	};
}

async function request(ctx) {
	const options = { headers: {}, body: {} };
	for (const name of ['occurredAt']) {
		const p = property(name);
		const routing = p.routing;
		const value = ctx.getNodeParameter(name);
		if (routing?.request?.headers)
			for (const [k, expr] of Object.entries(routing.request.headers))
				options.headers[k] = ctx.resolve(expr, { $value: value });
		if (routing?.send?.type === 'body')
			options.body[routing.send.property] = ctx.resolve(routing.send.value || value, {
				$value: value,
			});
		for (const preSend of routing?.send?.preSend || []) await preSend.call(ctx, options);
	}
	const create = nodeType.description.properties
		.find((p) => p.name === 'operation' && p.displayOptions.show.resource.includes('entry'))
		.options.find((o) => o.value === 'create');
	for (const preSend of create.routing.send.preSend) await preSend.call(ctx, options);
	return options;
}
const key = async (c) => (await request(c)).headers['Idempotency-Key'];

test('F4 different installs even with identical identifiers and instance IDs', async () => {
	assert.notEqual(await key(context()), await key(context()));
});
test('F4 each workflow, node, execution, run and item is isolated', async () => {
	const base = context();
	const original = await key(base);
	for (const changes of [
		{ workflow: 'other' },
		{ node: 'other' },
		{ execution: '2' },
		{ run: 1 },
		{ item: 1 },
	]) {
		assert.notEqual(
			await key(context({ ...changes, data: base.data })),
			original,
			JSON.stringify(changes),
		);
	}
});
test('F4 retries and serialized execution resume keep exactly the same key', async () => {
	const c = context();
	const original = await key(c);
	assert.equal(await key(c), original);
	assert.equal(await key(context({ data: JSON.parse(JSON.stringify(c.data)) })), original);
});

test('F4 automatic current time is frozen for retries, isolated per run and item', async () => {
	const c = context();
	const before = await request(c);
	await new Promise((resolve) => setTimeout(resolve, 1100));
	const retry = await request(c);
	assert.equal(retry.body.occurredAt, before.body.occurredAt);
	assert.equal(
		(await request(context({ data: JSON.parse(JSON.stringify(c.data)) }))).body.occurredAt,
		before.body.occurredAt,
	);
	for (const changes of [{ run: 1 }, { item: 1 }]) {
		assert.notEqual(
			(await request(context({ ...changes, data: c.data }))).body.occurredAt,
			before.body.occurredAt,
		);
	}
});
test('F4 missing saved key and explicitly saved 0.1.0 default upgrade', async () => {
	for (const rawKey of [undefined, legacyDefault]) {
		const c = context({ rawKey });
		const a = await key(c);
		assert.match(a, /^n8n:[a-f0-9]{64}$/);
		assert.notEqual(await key(context({ rawKey })), a);
	}
});
test('F4 custom literal and expression keys remain exact', async () => {
	assert.equal(await key(context({ rawKey: 'order-778812-a' })), 'order-778812-a');
	assert.equal(
		await key(context({ rawKey: '={{$json.id}}', json: { id: 'source-event-42' } })),
		'source-event-42',
	);
});
test('F4 literal and evaluated empty keys omit the header', async () => {
	for (const rawKey of ['', '={{""}}']) assert.equal(await key(context({ rawKey })), undefined);
});
test('F4 automatic key is bounded ASCII, including imported and unsaved workflow IDs', async () => {
	for (const changes of [
		{ workflow: 'space name', node: '日本語' },
		{ node: 'x'.repeat(400) },
		{ workflow: undefined },
	]) {
		const k = await key(context(changes));
		assert.match(k, /^[\x21-\x7E]{1,255}$/);
		assert.equal(k.length, 68);
	}
});
test('medication default uses the input dose scheduledAt instant', async () => {
	for (const scheduledAt of ['2026-11-03T21:00:00-05:00', '2026-11-04T02:00:00.000Z']) {
		const r = await request(context({ domain: 'medication', json: { scheduledAt } }));
		assert.equal(Date.parse(r.body.occurredAt), Date.parse(scheduledAt));
		assert.equal(r.body.occurredAt, '2026-11-03T21:00:00-05:00');
	}
});
test('medication missing or invalid scheduled time never silently uses now', async () => {
	for (const scheduledAt of [undefined, null, '', 'not-a-date']) {
		const r = await request(context({ domain: 'medication', json: { scheduledAt } }));
		assert.equal(r.body.occurredAt, null);
	}
});

test('medication saved 0.1.0 default also adopts scheduled time', async () => {
	const r = await request(
		context({
			domain: 'medication',
			occurredAt: '={{$now.toISO()}}',
			json: { scheduledAt: '2026-11-03T21:00:00-05:00' },
		}),
	);
	assert.equal(r.body.occurredAt, '2026-11-03T21:00:00-05:00');
});

test('AI direct tool retries retain key and time, separate identical calls do not', async () => {
	const toolArgs = { valence: 3 };
	const first = context({ tool: true, toolArgs });
	const sent = await request(first);
	await new Promise((resolve) => setTimeout(resolve, 1100));
	const retry = await request(context({ tool: true, toolArgs, data: first.data, run: 1 }));
	assert.equal(retry.headers['Idempotency-Key'], sent.headers['Idempotency-Key']);
	assert.equal(retry.body.occurredAt, sent.body.occurredAt);
	const next = await request(
		context({ tool: true, toolArgs: { valence: 3 }, data: first.data, run: 2 }),
	);
	assert.notEqual(next.headers['Idempotency-Key'], sent.headers['Idempotency-Key']);
});

test('AI engine retry and separate calls work even with absent provider IDs', async () => {
	for (const json of [
		{ toolCallId: 'call-A' },
		{ toolCallId: '' },
		{ toolCallId: 'unknown' },
		{ toolCallId: undefined },
		{},
	]) {
		const c = context({ tool: true, json });
		const sent = await request(c);
		const retry = await request(
			context({
				tool: true,
				json: JSON.parse(JSON.stringify(json)),
				run: 0,
				data: JSON.parse(JSON.stringify(c.data)),
			}),
		);
		assert.equal(retry.headers['Idempotency-Key'], sent.headers['Idempotency-Key']);
		assert.equal(retry.body.occurredAt, sent.body.occurredAt);
		const next = await request(context({ tool: true, json, run: 1, data: c.data }));
		assert.notEqual(next.headers['Idempotency-Key'], sent.headers['Idempotency-Key']);
	}
});
test('symptom and mood default keep current time, explicit medication time is preserved', async () => {
	for (const domain of ['symptom', 'mood']) {
		const r = await request(context({ domain, json: { scheduledAt: '2000-01-01T00:00:00Z' } }));
		assert.ok(Math.abs(Date.parse(r.body.occurredAt) - Date.now()) < 5000);
	}
	const r = await request(
		context({
			domain: 'medication',
			occurredAt: '2026-11-03T20:00:00-05:00',
			json: { scheduledAt: '2026-11-03T21:00:00-05:00' },
		}),
	);
	assert.equal(r.body.occurredAt, '2026-11-03T20:00:00-05:00');
});
test('AI tool support and all approved field text stay unchanged', () => {
	assert.equal(nodeType.description.usableAsTool, true);
	assert.equal(
		property('additionalFields').options.find((p) => p.name === 'idempotencyKey').description,
		'Repeating a request with the same key and payload returns the original entry instead of a duplicate',
	);
	assert.equal(
		property('occurredAt').description,
		'When the event happened, with a time zone offset',
	);
});

test('N1 Idempotency Key is optional inside Additional Fields, not a top-level UI field', () => {
	assert.equal(
		nodeType.description.properties.some((p) => p.name === 'idempotencyKey' && p.type !== 'hidden'),
		false,
	);
	const field = property('additionalFields').options.find((p) => p.name === 'idempotencyKey');
	assert.equal(field.type, 'string');
	assert.equal(field.displayName, 'Idempotency Key');
	assert.equal(field.typeOptions.maxLength, 255);
	const create = nodeType.description.properties
		.find((p) => p.name === 'operation' && p.displayOptions.show.resource.includes('entry'))
		.options.find((o) => o.value === 'create');
	assert.equal(create.routing.send.preSend.length, 1);
	assert.equal(field.routing, undefined);
	assert.equal(property('idempotencyKey').routing, undefined);
});
test('N1 Additional Fields custom key overrides saved top-level key', async () => {
	assert.equal(
		await key(context({ rawKey: 'old', additionalFields: { idempotencyKey: 'new' } })),
		'new',
	);
	assert.equal(
		await key(
			context({
				additionalFields: { idempotencyKey: '={{$json.id}}' },
				json: { id: 'incoming-123' },
			}),
		),
		'incoming-123',
	);
});
test('N1 Additional Fields literal and evaluated empty key omit the header', async () => {
	for (const value of ['', '={{""}}']) {
		assert.equal(
			await key(context({ rawKey: 'old', additionalFields: { idempotencyKey: value } })),
			undefined,
		);
	}
});

test('N1 adding the nested default switches a saved custom key back to automatic', async () => {
	const field = property('additionalFields').options.find((p) => p.name === 'idempotencyKey');
	const c = context({ rawKey: 'old-custom', additionalFields: { idempotencyKey: field.default } });
	const generated = await key(c);
	assert.match(generated, /^n8n:[a-f0-9]{64}$/);
	assert.equal(await key(c), generated);
});
