import type { INodeProperties } from 'n8n-workflow';

const showOnlyForSearch = { resource: ['catalog'], operation: ['search'] };

export const catalogDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['catalog'] } },
		options: [
			{
				name: 'Search',
				value: 'search',
				description: 'Search your symptoms, medications or sleep care plans',
				action: 'Search the catalog',
				routing: {
					request: { method: 'GET', url: '/catalog/search' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'items' } }] },
				},
			},
		],
		default: 'search',
	},
	{
		displayName: 'Domain',
		name: 'domain',
		type: 'options',
		required: true,
		options: [
			{ name: 'Symptom', value: 'symptom' },
			{ name: 'Medication', value: 'medication' },
			{ name: 'Sleep', value: 'sleep' },
		],
		default: 'symptom',
		displayOptions: { show: showOnlyForSearch },
		routing: { send: { type: 'query', property: 'domain' } },
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { maxLength: 80 },
		description: 'Text to search for. For sleep, * returns the default care plan.',
		displayOptions: { show: showOnlyForSearch },
		routing: { send: { type: 'query', property: 'q' } },
	},
];
