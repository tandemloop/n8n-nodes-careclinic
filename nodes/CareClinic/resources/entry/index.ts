import type { INodeProperties } from 'n8n-workflow';

const showForCreate = { resource: ['entry'], operation: ['create'] };
const showForDomain = (domain: string) => ({
	resource: ['entry'],
	operation: ['create'],
	domain: [domain],
});
const body = (property: string) => ({ send: { type: 'body' as const, property } });
// The gateway requires an offset. The n8n date picker can return local time without one.
const withOffset = '={{ DateTime.fromISO(String($value)).toISO({ suppressMilliseconds: true }) }}';

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
				routing: { request: { method: 'POST', url: '/entries' } },
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
		default: '={{$now.toISO()}}',
		description: 'When the event happened, with a time zone offset',
		displayOptions: { show: showForCreate },
		routing: { send: { type: 'body', property: 'occurredAt', value: withOffset } },
	},
	{
		displayName: 'Idempotency Key',
		name: 'idempotencyKey',
		type: 'string',
		default: '={{$execution.id}}-{{$itemIndex}}',
		typeOptions: { maxLength: 255 },
		description:
			'Repeating a request with the same key and payload returns the original entry instead of a duplicate',
		displayOptions: { show: showForCreate },
		routing: { request: { headers: { 'Idempotency-Key': '={{$value}}' } } },
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
