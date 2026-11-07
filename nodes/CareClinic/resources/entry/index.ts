import { createHash, randomUUID } from 'crypto';
import { NodeConnectionTypes } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteSingleFunctions,
	INodeProperties,
	IHttpRequestOptions,
} from 'n8n-workflow';

const showForCreate = { resource: ['entry'], operation: ['create'] };
const showForDomain = (domain: string) => ({
	resource: ['entry'],
	operation: ['create'],
	domain: [domain],
});
const body = (property: string) => ({ send: { type: 'body' as const, property } });
// The gateway requires an offset. The n8n date picker can return local time without one.
const withOffset = '={{ DateTime.fromISO(String($value)).toISO({ suppressMilliseconds: true }) }}';
const defaultIdempotencyKey = '={{[$nodeId, $execution.id, $runIndex, $itemIndex].join(":")}}';
const legacyIdempotencyKey = '={{$execution.id}}-{{$itemIndex}}';
const defaultOccurredAt =
	'={{ $parameter.domain === "medication" ? $json.scheduledAt : $now.toISO() }}';
const legacyOccurredAt = '={{$now.toISO()}}';
const toolInvocations = new WeakMap<object, string>();

function invocationId(this: IExecuteSingleFunctions): string | number {
	if (this.getNode().type.endsWith('.careClinicTool')) {
		// n8n retries a tool call with the same arguments object but a new run index.
		const input = this.getInputData(0, NodeConnectionTypes.AiTool);
		// Without an ai_tool connection n8n returns a fresh empty item per call.
		// Engine tools use main input and a stable run index, including after resume.
		if (input !== this.getInputData(0, NodeConnectionTypes.AiTool)) {
			return this.getWorkflowDataProxy(this.getItemIndex()).$runIndex;
		}
		const args = input.json;
		let id = toolInvocations.get(args);
		if (id === undefined) {
			id = randomUUID();
			toolInvocations.set(args, id);
		}
		return id;
	}
	return this.getWorkflowDataProxy(this.getItemIndex()).$runIndex;
}

function prepareEntryRequest(
	this: IExecuteSingleFunctions,
	request: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const additionalFields = this.getNode().parameters.additionalFields as IDataObject | undefined;
	const parameter =
		additionalFields?.idempotencyKey !== undefined
			? 'additionalFields.idempotencyKey'
			: 'idempotencyKey';
	const raw = additionalFields?.idempotencyKey ?? this.getNode().parameters.idempotencyKey;
	const invocation = invocationId.call(this);
	let key: string;
	if (raw === undefined || raw === defaultIdempotencyKey || raw === legacyIdempotencyKey) {
		// Execution context survives retries and waiting executions. Unlike instance IDs,
		// this salt is also distinct on installs sharing an encryption key or imported IDs.
		const context = this.getContext('node');
		if (context.careClinicIdempotencySalt === undefined) {
			context.careClinicIdempotencySalt = randomUUID();
		}
		key =
			'n8n:' +
			createHash('sha256')
				.update(
					JSON.stringify([
						context.careClinicIdempotencySalt,
						this.getInstanceId?.(),
						this.getWorkflow().id,
						this.getNode().id,
						this.getExecutionId(),
						invocation,
						this.getItemIndex(),
					]),
				)
				.digest('hex');
	} else {
		key = this.getNodeParameter(parameter) as string;
	}
	request.headers = { ...request.headers };
	if (key === '') delete request.headers['Idempotency-Key'];
	else request.headers['Idempotency-Key'] = key;
	const rawTime = this.getNode().parameters.occurredAt;
	if (rawTime === undefined || rawTime === defaultOccurredAt || rawTime === legacyOccurredAt) {
		// A retry must also repeat the payload, not re-evaluate the current time.
		const context = this.getContext('node');
		const times = (context.careClinicOccurredAt ??= {}) as IDataObject;
		const domain = this.getNodeParameter('domain');
		const coordinate = JSON.stringify([
			this.getExecutionId(),
			invocation,
			this.getItemIndex(),
			domain,
		]);
		if (times[coordinate] === undefined) {
			times[coordinate] =
				domain === 'medication'
					? this.evaluateExpression(
							'{{ DateTime.fromISO(String($json.scheduledAt)).toISO({ suppressMilliseconds: true }) }}',
							this.getItemIndex(),
						)
					: (request.body as IDataObject).occurredAt;
		}
		(request.body as IDataObject).occurredAt = times[coordinate];
	}
	return Promise.resolve(request);
}

export const entryDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['entry'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Log a symptom, mood or medication entry',
				action: 'Create an entry',
				routing: {
					request: { method: 'POST', url: '/entries' },
					send: { preSend: [prepareEntryRequest] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get entries logged since a time',
				action: 'Get many entries',
				routing: {
					request: { method: 'GET', url: '/entries' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'items' } }] },
				},
			},
		],
		default: 'create',
	},

	// Get Many
	{
		displayName: 'Since',
		name: 'since',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'Return entries that occurred at or after this time. The API keeps 90 days.',
		displayOptions: { show: { resource: ['entry'], operation: ['getAll'] } },
		routing: { send: { type: 'query', property: 'since', value: withOffset } },
	},

	// Create, shared
	{
		displayName: 'Domain',
		name: 'domain',
		type: 'options',
		required: true,
		options: [
			{ name: 'Medication', value: 'medication' },
			{ name: 'Mood', value: 'mood' },
			{ name: 'Symptom', value: 'symptom' },
		],
		default: 'symptom',
		displayOptions: { show: showForCreate },
		routing: body('domain'),
	},
	{
		displayName: 'Occurred At',
		name: 'occurredAt',
		type: 'dateTime',
		required: true,
		default: defaultOccurredAt,
		description: 'When the event happened, with a time zone offset',
		displayOptions: { show: showForCreate },
		routing: { send: { type: 'body', property: 'occurredAt', value: withOffset } },
	},
	// Keep saved 0.1.x workflow values through n8n's parameter normalisation.
	{
		displayName: 'Idempotency Key',
		name: 'idempotencyKey',
		type: 'hidden',
		default: defaultIdempotencyKey,
		displayOptions: { show: showForCreate },
	},

	// Symptom
	{
		displayName: 'Symptom ID',
		name: 'symptomId',
		type: 'string',
		required: true,
		default: '',
		description: 'The ID returned by Catalog Search for the symptom domain',
		displayOptions: { show: showForDomain('symptom') },
		routing: body('symptomId'),
	},
	{
		displayName: 'Symptom Name',
		name: 'symptomName',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { maxLength: 120 },
		displayOptions: { show: showForDomain('symptom') },
		routing: body('name'),
	},
	{
		displayName: 'Severity',
		name: 'severity',
		type: 'number',
		required: true,
		default: 5,
		typeOptions: { minValue: 1, maxValue: 10, numberPrecision: 0 },
		displayOptions: { show: showForDomain('symptom') },
		routing: body('severity'),
	},

	// Mood
	{
		displayName: 'Valence',
		name: 'valence',
		type: 'number',
		required: true,
		default: 0,
		typeOptions: { minValue: -5, maxValue: 5, numberPrecision: 0 },
		description: 'Mood from -5 (lowest) to 5 (highest)',
		displayOptions: { show: showForDomain('mood') },
		routing: body('valence'),
	},

	// Medication
	{
		displayName: 'Medication ID',
		name: 'medicationId',
		type: 'string',
		required: true,
		default: '',
		description: 'The medication ID returned by Reminder Get Today',
		displayOptions: { show: showForDomain('medication') },
		routing: body('medicationId'),
	},
	{
		displayName: 'Medication Name',
		name: 'medicationName',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { maxLength: 120 },
		displayOptions: { show: showForDomain('medication') },
		routing: body('medicationName'),
	},
	{
		displayName: 'Action',
		name: 'medicationAction',
		type: 'options',
		required: true,
		options: [
			{ name: 'Taken', value: 'taken' },
			{ name: 'Skipped', value: 'skipped' },
		],
		default: 'taken',
		displayOptions: { show: showForDomain('medication') },
		routing: body('action'),
	},

	{
		displayName: 'Reminder ID',
		name: 'reminderId',
		type: 'string',
		required: true,
		default: '',
		description: 'The reminder ID returned by Reminder Get Today',
		displayOptions: { show: showForDomain('medication') },
		routing: body('reminderId'),
	},
	{
		displayName: 'Reminder Index',
		name: 'reminderIndex',
		type: 'number',
		required: true,
		default: 0,
		typeOptions: { minValue: 0, maxValue: 1000, numberPrecision: 0 },
		description: 'The reminder index returned by Reminder Get Today',
		displayOptions: { show: showForDomain('medication') },
		routing: body('reminderIndex'),
	},

	// Optional fields
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showForCreate },
		options: [
			{
				displayName: 'Duration Minutes',
				name: 'durationMinutes',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0, maxValue: 43200, numberPrecision: 0 },
				description: 'Symptom entries only',
				routing: body('durationMinutes'),
			},
			{
				displayName: 'Energy',
				name: 'energy',
				type: 'number',
				default: 5,
				typeOptions: { minValue: 0, maxValue: 10, numberPrecision: 0 },
				description: 'Mood entries only',
				routing: body('energy'),
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: defaultIdempotencyKey,
				typeOptions: { maxLength: 255 },
				description:
					'Repeating a request with the same key and payload returns the original entry instead of a duplicate',
			},
			{
				displayName: 'Mood Label',
				name: 'label',
				type: 'string',
				default: '',
				typeOptions: { maxLength: 120 },
				description: 'Mood entries only',
				routing: body('label'),
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				default: '',
				typeOptions: { rows: 3, maxLength: 300 },
				routing: body('note'),
			},
		],
	},
];
